/**
 * Events service — Supabase CRUD for agency events & attendees
 */
import type { AgencyEvent, CreateEventInput, EventAttendee, EventType, ExternalAttendee } from '@/types/event';
import type { Json } from '@/types/shared/database.types';
import { formatDateLabel, formatTime, timeRangesOverlap, toDateStr, todayLocalStr } from './dateTime';
import { applyPageRange, resolvePage } from './pagination';
import { supabase } from './supabase';
import { queueMutation } from './offline';
import { resolveTeamDataScope } from './teamDataScope';

export interface SimpleUser {
    id: string;
    full_name: string;
    role: string;
    avatar_url?: string | null;
}

// ── Shared query helpers ─────────────────────────────────────

const EVENT_SELECT =
    '*, creator_user:users!created_by(full_name), event_attendees(id, event_id, user_id, attendee_role, users(full_name, avatar_url))';

// Attendance-scoped variant: the aliased !inner embed filters server-side
// without disturbing the display embed above.
const EVENT_SELECT_ATTENDING = `${EVENT_SELECT}, attendee_filter:event_attendees!inner(user_id)`;

/** How far back the mobile calendar loads history. Older events stay in the DB/web. */
export const EVENTS_HISTORY_MONTHS = 6;

/** YYYY-MM-DD lower bound for calendar queries — local time, never toISOString. */
export function eventsWindowStart(now: Date = new Date()): string {
    const d = new Date(now);
    d.setMonth(d.getMonth() - EVENTS_HISTORY_MONTHS);
    return toDateStr(d);
}

function sortEvents(list: AgencyEvent[]): AgencyEvent[] {
    return list.sort((a, b) =>
        a.event_date === b.event_date
            ? a.start_time.localeCompare(b.start_time)
            : a.event_date.localeCompare(b.event_date),
    );
}

function mergeDedupEvents(a: AgencyEvent[], b: AgencyEvent[]): AgencyEvent[] {
    const seen = new Map<string, AgencyEvent>();
    for (const e of [...a, ...b]) {
        if (!seen.has(e.id)) seen.set(e.id, e);
    }
    return sortEvents([...seen.values()]);
}

interface UserEventsFilter {
    /** event_date >= (YYYY-MM-DD) */
    dateGte?: string;
    /** event_date == (YYYY-MM-DD) */
    dateEq?: string;
    /** Per-branch row cap; callers must slice the merged result themselves */
    limit?: number;
}

/**
 * Events the user created + events they attend, as two parallel bounded
 * queries merged client-side (PostgREST can't OR a plain column filter with
 * an embedded-table filter). Replaces the old fetch-all-ids + `.in(ids)`
 * pattern whose URL grew with every attendance row.
 */
async function queryUserEvents(
    userId: string,
    filter: UserEventsFilter,
): Promise<{ data: AgencyEvent[]; error: string | null }> {
    let createdQ = supabase.from('events').select(EVENT_SELECT).eq('created_by', userId);
    let attendingQ = supabase.from('events').select(EVENT_SELECT_ATTENDING).eq('attendee_filter.user_id', userId);

    if (filter.dateGte !== undefined) {
        createdQ = createdQ.gte('event_date', filter.dateGte);
        attendingQ = attendingQ.gte('event_date', filter.dateGte);
    }
    if (filter.dateEq !== undefined) {
        createdQ = createdQ.eq('event_date', filter.dateEq);
        attendingQ = attendingQ.eq('event_date', filter.dateEq);
    }

    createdQ = createdQ.order('event_date', { ascending: true }).order('start_time', { ascending: true });
    attendingQ = attendingQ.order('event_date', { ascending: true }).order('start_time', { ascending: true });

    if (filter.limit !== undefined) {
        createdQ = createdQ.limit(filter.limit);
        attendingQ = attendingQ.limit(filter.limit);
    }

    const [created, attending] = await Promise.all([createdQ, attendingQ]);
    if (created.error) return { data: [], error: created.error.message };
    if (attending.error) return { data: [], error: attending.error.message };

    return {
        data: mergeDedupEvents(
            mapEvents((created.data || []) as EventRow[]),
            mapEvents((attending.data || []) as EventRow[]),
        ),
        error: null,
    };
}

// ── Public event queries ─────────────────────────────────────

/**
 * Fetch events where the user is an attendee or creator, ordered by date
 * ascending. History is bounded to `windowStart` (default: 6 months back).
 */
export async function fetchEvents(
    userId: string,
    windowStart: string = eventsWindowStart(),
): Promise<{ data: AgencyEvent[]; error: string | null }> {
    return queryUserEvents(userId, { dateGte: windowStart });
}

/**
 * Fetch all events (PA/RO/admin use), ordered by date ascending.
 * Pass `windowStart` to bound history (the calendar does); default unbounded.
 */
export async function fetchAllEvents(
    page?: number,
    pageSize: number = 50,
    windowStart?: string,
): Promise<{ data: AgencyEvent[]; error: string | null; hasMore: boolean }> {
    let query = supabase
        .from('events')
        .select(EVENT_SELECT)
        .order('event_date', { ascending: true })
        .order('start_time', { ascending: true });

    if (windowStart !== undefined) {
        query = query.gte('event_date', windowStart);
    }

    query = applyPageRange(query, page, pageSize);

    const { data, error } = await query;
    if (error) return { data: [], error: error.message, hasMore: false };

    const results = mapEvents((data || []) as EventRow[]);
    const { data: paged, hasMore } = resolvePage(results, page, pageSize);
    return { data: paged, error: null, hasMore };
}

/**
 * Fetch the next N upcoming events for a user (event_date >= today, local
 * time — the old toISOString cutoff put "today" in UTC, so before 8am SGT
 * yesterday's events counted as upcoming).
 */
export async function fetchUpcomingEvents(
    userId: string,
    limit = 5,
): Promise<{ data: AgencyEvent[]; error: string | null }> {
    const res = await queryUserEvents(userId, { dateGte: todayLocalStr(), limit });
    if (res.error) return res;
    return { data: res.data.slice(0, limit), error: null };
}

/**
 * Today's events for the user — cheap enough for the live bar to poll.
 */
export async function fetchTodayEvents(userId: string): Promise<{ data: AgencyEvent[]; error: string | null }> {
    return queryUserEvents(userId, { dateEq: todayLocalStr() });
}

// ── Team calendar (manager/director "Team" scope) ────────────

/**
 * Resolve the ids of a manager's direct reports, or a director's
 * managers + their agents — the same reports_to scoping as
 * lib/team.ts fetchTeamMembers, without the stats fan-out.
 */
async function resolveTeamMemberIds(userId: string, role: string): Promise<{ ids: string[]; error: string | null }> {
    const teamDataScope = await resolveTeamDataScope(userId);

    if (role === 'manager') {
        const { data, error } = await supabase
            .from('users')
            .select('id')
            .in('role', ['manager', 'agent'])
            .eq('reports_to', userId)
            .eq('is_test_data', teamDataScope);
        if (error) return { ids: [], error: error.message };
        return { ids: (data || []).map((r: { id: string }) => r.id), error: null };
    }

    // Director: managers reporting to them + agents reporting to those managers
    const { data: managers, error: mErr } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'manager')
        .eq('reports_to', userId)
        .eq('is_test_data', teamDataScope);
    if (mErr) return { ids: [], error: mErr.message };

    const managerIds = (managers || []).map((r: { id: string }) => r.id);
    if (managerIds.length === 0) return { ids: [], error: null };

    const { data: agents, error: aErr } = await supabase
        .from('users')
        .select('id')
        .in('reports_to', managerIds)
        .eq('is_test_data', teamDataScope);
    if (aErr) return { ids: [], error: aErr.message };

    return { ids: [...managerIds, ...(agents || []).map((r: { id: string }) => r.id)], error: null };
}

/**
 * Events created by OR attended by anyone on the user's team, bounded to
 * the calendar window. Two-query merge — a single query would AND the
 * created_by and attendee filters (review-caught).
 */
export async function fetchTeamEvents(
    userId: string,
    role: string,
    windowStart: string = eventsWindowStart(),
): Promise<{ data: AgencyEvent[]; error: string | null }> {
    const team = await resolveTeamMemberIds(userId, role);
    if (team.error) return { data: [], error: team.error };
    if (team.ids.length === 0) return { data: [], error: null };

    const createdQ = supabase
        .from('events')
        .select(EVENT_SELECT)
        .in('created_by', team.ids)
        .gte('event_date', windowStart)
        .order('event_date', { ascending: true })
        .order('start_time', { ascending: true });
    const attendingQ = supabase
        .from('events')
        .select(EVENT_SELECT_ATTENDING)
        .in('attendee_filter.user_id', team.ids)
        .gte('event_date', windowStart)
        .order('event_date', { ascending: true })
        .order('start_time', { ascending: true });

    const [created, attending] = await Promise.all([createdQ, attendingQ]);
    if (created.error) return { data: [], error: created.error.message };
    if (attending.error) return { data: [], error: attending.error.message };

    return {
        data: mergeDedupEvents(
            mapEvents((created.data || []) as EventRow[]),
            mapEvents((attending.data || []) as EventRow[]),
        ),
        error: null,
    };
}

// ── Conflict detection ───────────────────────────────────────

export interface EventConflict {
    attendeeName: string;
    eventTitle: string;
    eventDate: string;
    timeRange: string;
}

/**
 * Find existing events that overlap the proposed slot for any of the
 * selected attendees. One bounded query; overlap resolved client-side.
 * Callers treat this as advisory (warn, never block) and must fail open
 * if the query errors.
 */
export async function findEventConflicts(params: {
    dates: string[];
    startTime: string;
    endTime: string | null;
    attendeeIds: string[];
    excludeEventId?: string;
}): Promise<{ data: EventConflict[]; error: string | null }> {
    const { dates, startTime, endTime, attendeeIds, excludeEventId } = params;
    if (dates.length === 0 || attendeeIds.length === 0) return { data: [], error: null };

    let query = supabase
        .from('events')
        .select(EVENT_SELECT_ATTENDING)
        .in('event_date', dates)
        .in('attendee_filter.user_id', attendeeIds);
    if (excludeEventId) {
        query = query.neq('id', excludeEventId);
    }

    const { data, error } = await query;
    if (error) return { data: [], error: error.message };

    const idSet = new Set(attendeeIds);
    const conflicts: EventConflict[] = [];
    for (const ev of mapEvents((data || []) as EventRow[])) {
        if (!timeRangesOverlap(startTime, endTime, ev.start_time, ev.end_time)) continue;
        for (const att of ev.attendees) {
            if (!idSet.has(att.user_id)) continue;
            conflicts.push({
                attendeeName: att.full_name || 'An attendee',
                eventTitle: ev.title,
                eventDate: formatDateLabel(ev.event_date),
                timeRange: `${formatTime(ev.start_time)}${ev.end_time ? ` – ${formatTime(ev.end_time)}` : ''}`,
            });
        }
    }
    return { data: conflicts, error: null };
}

/**
 * Fetch a single event with attendees joined.
 */
export async function fetchEventById(eventId: string): Promise<{ data: AgencyEvent | null; error: string | null }> {
    const { data, error } = await supabase.from('events').select(EVENT_SELECT).eq('id', eventId).single();

    if (error) return { data: null, error: error.message };
    const mapped = mapEvents([data] as EventRow[]);
    return { data: mapped[0] || null, error: null };
}

/**
 * Create an event and insert attendees.
 */
export async function createEvent(
    input: CreateEventInput,
    createdBy: string,
): Promise<{ data: AgencyEvent | null; error: string | null }> {
    const { data: event, error: eventError } = await supabase
        .from('events')
        .insert({
            title: input.title,
            description: input.description || null,
            event_type: input.event_type,
            event_date: input.event_date,
            start_time: input.start_time,
            end_time: input.end_time || null,
            location: input.location || null,
            // Location coords — both set together or both null (DB CHECK enforces).
            // Undefined at input time => null => TBC state.
            latitude: input.latitude ?? null,
            longitude: input.longitude ?? null,
            // Omit location_radius_meters when undefined so the DB DEFAULT 100 applies.
            ...(input.location_radius_meters !== undefined
                ? { location_radius_meters: input.location_radius_meters }
                : {}),
            created_by: createdBy,
            external_attendees: input.external_attendees as unknown as Json,
        })
        .select()
        .single();

    if (eventError) return { data: null, error: eventError.message };

    if (input.attendees.length > 0) {
        const rows = input.attendees.map((a) => ({
            event_id: event.id,
            user_id: a.user_id,
            attendee_role: a.attendee_role,
        }));
        const { error: attendeeError } = await supabase.from('event_attendees').insert(rows);
        if (attendeeError) return { data: null, error: attendeeError.message };
    }

    return fetchEventById(event.id);
}

/**
 * Update only the location fields on an event, without round-tripping the
 * full CreateEventInput. Used by the event detail screen's "Pin venue" flow
 * so managers can backfill legacy events or retune an existing pin without
 * having to re-confirm title / date / attendees.
 *
 * - Pass `latitude: null, longitude: null` to clear the pin back to TBC.
 *   Check-in will then be blocked for the event until it's pinned again.
 * - Pass `locationName` to also update the free-text venue label (e.g. when
 *   the user searched for "NTUC Bukit Timah" in the MapPicker). Undefined
 *   means don't touch the existing label.
 */
export async function updateEventLocation(
    eventId: string,
    fields: {
        latitude: number | null;
        longitude: number | null;
        locationName?: string;
        locationRadiusMeters?: number;
    },
): Promise<{ error: string | null }> {
    const patch = {
        latitude: fields.latitude,
        longitude: fields.longitude,
        ...(fields.locationName !== undefined ? { location: fields.locationName } : {}),
        ...(fields.locationRadiusMeters !== undefined ? { location_radius_meters: fields.locationRadiusMeters } : {}),
    };
    const res = await queueMutation('events', 'update', patch, { id: eventId }, () =>
        supabase.from('events').update(patch).eq('id', eventId),
    );
    return { error: res.error };
}

/**
 * Fetch all non-admin users for the attendee picker.
 */
export async function fetchAllUsers(
    scopeUserId?: string | null,
    includeTestData?: boolean,
): Promise<{ data: SimpleUser[]; error: string | null }> {
    const teamDataScope = includeTestData ?? (scopeUserId ? await resolveTeamDataScope(scopeUserId) : false);
    const { data, error } = await supabase
        .from('users')
        .select('id, full_name, role, avatar_url')
        .neq('role', 'admin')
        .eq('is_active', true)
        .eq('is_test_data', teamDataScope)
        .order('full_name', { ascending: true });

    if (error) return { data: [], error: error.message };
    return { data: (data || []) as SimpleUser[], error: null };
}

// ── Helpers ──────────────────────────────────────────────────

interface EventRow {
    id: string;
    title: string;
    description: string | null;
    event_type: string;
    event_date: string;
    start_time: string;
    end_time: string | null;
    location: string | null;
    latitude: number | null;
    longitude: number | null;
    location_radius_meters: number;
    created_by: string;
    creator_user?: { full_name: string } | null;
    created_at: string | null;
    updated_at: string | null;
    external_attendees: ExternalAttendee[] | null;
    event_attendees?: AttendeeRow[];
}

interface AttendeeRow {
    id: string;
    event_id: string;
    user_id: string;
    attendee_role: string;
    users?: { full_name: string; avatar_url: string | null } | null;
}

function mapEvents(rows: EventRow[]): AgencyEvent[] {
    return rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        event_type: row.event_type as EventType,
        event_date: row.event_date,
        start_time: row.start_time,
        end_time: row.end_time,
        location: row.location,
        latitude: row.latitude,
        longitude: row.longitude,
        location_radius_meters: row.location_radius_meters,
        created_by: row.created_by,
        creator_name: row.creator_user?.full_name || null,
        created_at: row.created_at ?? '',
        updated_at: row.updated_at ?? '',
        external_attendees: row.external_attendees || [],
        attendees: (row.event_attendees || []).map(
            (a: AttendeeRow) =>
                ({
                    id: a.id,
                    event_id: a.event_id,
                    user_id: a.user_id,
                    attendee_role: a.attendee_role,
                    full_name: a.users?.full_name || 'Unknown',
                    avatar_url: a.users?.avatar_url || null,
                }) as EventAttendee,
        ),
    }));
}

/**
 * Delete an event (attendees cascade via FK).
 */
export async function deleteEvent(eventId: string): Promise<{ error: string | null }> {
    const res = await queueMutation('events', 'delete', {}, { id: eventId }, () =>
        supabase.from('events').delete().eq('id', eventId),
    );
    return { error: res.error };
}

/**
 * Update an existing event and reconcile its attendees safely.
 *
 * Order matters for data integrity (UNIQUE constraint on event_id+user_id):
 *   1. Update event fields.
 *   2. Upsert new/updated attendees — old attendees untouched if this fails.
 *   3. Delete only attendees no longer in the list — a failure here leaves
 *      extra rows rather than missing ones, which is far less harmful.
 */
export async function updateEvent(
    eventId: string,
    input: CreateEventInput,
): Promise<{ data: AgencyEvent | null; error: string | null }> {
    const { error: eventError } = await supabase
        .from('events')
        .update({
            title: input.title,
            description: input.description || null,
            event_type: input.event_type,
            event_date: input.event_date,
            start_time: input.start_time,
            end_time: input.end_time || null,
            location: input.location || null,
            // Location coords — set both or null both. Preserves any existing
            // pin only if `input` explicitly passes undefined (i.e. update
            // called without touching location); passing null clears to TBC.
            ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
            ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
            ...(input.location_radius_meters !== undefined
                ? { location_radius_meters: input.location_radius_meters }
                : {}),
            external_attendees: input.external_attendees as unknown as Json,
        })
        .eq('id', eventId);

    if (eventError) return { data: null, error: eventError.message };

    const keepIds = input.attendees.map((a) => a.user_id);

    // Step 2: upsert — inserts new attendees, updates roles for existing ones
    if (keepIds.length > 0) {
        const rows = input.attendees.map((a) => ({
            event_id: eventId,
            user_id: a.user_id,
            attendee_role: a.attendee_role,
        }));
        const { error: upsertError } = await supabase
            .from('event_attendees')
            .upsert(rows, { onConflict: 'event_id,user_id' });
        if (upsertError) return { data: null, error: upsertError.message };
    }

    // Step 3: remove attendees that are no longer in the list
    const deleteQuery = supabase.from('event_attendees').delete().eq('event_id', eventId);
    const { error: deleteError } =
        keepIds.length > 0 ? await deleteQuery.not('user_id', 'in', `(${keepIds.join(',')})`) : await deleteQuery;

    if (deleteError) return { data: null, error: deleteError.message };

    return fetchEventById(eventId);
}
