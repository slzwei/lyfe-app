/**
 * Events service — Supabase CRUD for agency events & attendees
 */
import type { AgencyEvent, CreateEventInput, EventAttendee, EventType, ExternalAttendee, RoadshowActivity, RoadshowActivityType, RoadshowAttendance, RoadshowConfig } from '@/types/event';
import { supabase } from './supabase';

export interface SimpleUser {
    id: string;
    full_name: string;
    role: string;
    avatar_url?: string | null;
}

/**
 * Fetch events where the user is an attendee or creator, ordered by date ascending.
 */
export async function fetchEvents(
    userId: string,
): Promise<{ data: AgencyEvent[]; error: string | null }> {
    const [{ data: attendeeRows, error: attendeeError }, { data: createdRows, error: createdError }] =
        await Promise.all([
            supabase.from('event_attendees').select('event_id').eq('user_id', userId),
            supabase.from('events').select('id').eq('created_by', userId),
        ]);

    if (attendeeError) return { data: [], error: attendeeError.message };
    if (createdError) return { data: [], error: createdError.message };

    const attendeeIds = (attendeeRows || []).map((r: { event_id: string }) => r.event_id);
    const createdIds = (createdRows || []).map((r: { id: string }) => r.id);
    const eventIds = [...new Set([...attendeeIds, ...createdIds])];

    if (eventIds.length === 0) return { data: [], error: null };

    const { data, error } = await supabase
        .from('events')
        .select('*, creator_user:users!created_by(full_name), event_attendees(id, event_id, user_id, attendee_role, users(full_name, avatar_url))')
        .in('id', eventIds)
        .order('event_date', { ascending: true })
        .order('start_time', { ascending: true });

    if (error) return { data: [], error: error.message };

    return { data: mapEvents(data || []), error: null };
}

/**
 * Fetch all events (PA use), ordered by date ascending.
 */
export async function fetchAllEvents(): Promise<{ data: AgencyEvent[]; error: string | null }> {
    const { data, error } = await supabase
        .from('events')
        .select('*, creator_user:users!created_by(full_name), event_attendees(id, event_id, user_id, attendee_role, users(full_name, avatar_url))')
        .order('event_date', { ascending: true })
        .order('start_time', { ascending: true });

    if (error) return { data: [], error: error.message };
    return { data: mapEvents(data || []), error: null };
}

/**
 * Fetch the next N upcoming events for a user.
 */
export async function fetchUpcomingEvents(
    userId: string,
    limit = 5,
): Promise<{ data: AgencyEvent[]; error: string | null }> {
    const { data: events, error } = await fetchEvents(userId);
    if (error) return { data: [], error };

    const today = new Date().toISOString().split('T')[0];
    const upcoming = events
        .filter(e => e.event_date >= today)
        .slice(0, limit);

    return { data: upcoming, error: null };
}

/**
 * Fetch a single event with attendees joined.
 */
export async function fetchEventById(
    eventId: string,
): Promise<{ data: AgencyEvent | null; error: string | null }> {
    const { data, error } = await supabase
        .from('events')
        .select('*, creator_user:users!created_by(full_name), event_attendees(id, event_id, user_id, attendee_role, users(full_name, avatar_url))')
        .eq('id', eventId)
        .single();

    if (error) return { data: null, error: error.message };
    const mapped = mapEvents([data]);
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
            created_by: createdBy,
            external_attendees: input.external_attendees,
        })
        .select()
        .single();

    if (eventError) return { data: null, error: eventError.message };

    if (input.attendees.length > 0) {
        const rows = input.attendees.map(a => ({
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
 * Fetch all non-admin users for the attendee picker.
 */
export async function fetchAllUsers(): Promise<{ data: SimpleUser[]; error: string | null }> {
    const { data, error } = await supabase
        .from('users')
        .select('id, full_name, role, avatar_url')
        .neq('role', 'admin')
        .eq('is_active', true)
        .order('full_name', { ascending: true });

    if (error) return { data: [], error: error.message };
    return { data: (data || []) as SimpleUser[], error: null };
}

// ── Helpers ──────────────────────────────────────────────────

interface EventRow {
    id: string;
    title: string;
    description: string | null;
    event_type: EventType;
    event_date: string;
    start_time: string;
    end_time: string | null;
    location: string | null;
    created_by: string;
    creator_user?: { full_name: string } | null;
    created_at: string;
    updated_at: string;
    external_attendees: ExternalAttendee[];
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
    return rows.map(row => ({
        id: row.id,
        title: row.title,
        description: row.description,
        event_type: row.event_type,
        event_date: row.event_date,
        start_time: row.start_time,
        end_time: row.end_time,
        location: row.location,
        created_by: row.created_by,
        creator_name: row.creator_user?.full_name || null,
        created_at: row.created_at,
        updated_at: row.updated_at,
        external_attendees: row.external_attendees || [],
        attendees: (row.event_attendees || []).map((a: AttendeeRow) => ({
            id: a.id,
            event_id: a.event_id,
            user_id: a.user_id,
            attendee_role: a.attendee_role,
            full_name: a.users?.full_name || 'Unknown',
            avatar_url: a.users?.avatar_url || null,
        } as EventAttendee)),
    }));
}

/** Check if a user has already checked in to an event */
export async function hasUserCheckedIn(eventId: string, userId: string): Promise<boolean> {
    const { data } = await supabase
        .from('roadshow_attendance')
        .select('id')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .single();
    return !!data;
}

// ── Roadshow service functions ────────────────────────────────

/** Helpers to compute daily/slot cost client-side */
function computeCosts(config: { weekly_cost: number; slots_per_day: number }): { daily_cost: number; slot_cost: number } {
    const daily = config.weekly_cost / 7;
    const slot = daily / (config.slots_per_day || 1);
    return { daily_cost: Math.round(daily * 100) / 100, slot_cost: Math.round(slot * 100) / 100 };
}

/** Compute is_late and minutes_late from attendance row vs config */
function computeLate(attendance: { checked_in_at: string }, config: RoadshowConfig | null): { is_late: boolean; minutes_late: number } {
    if (!config) return { is_late: false, minutes_late: 0 };
    const checkedInAt = new Date(attendance.checked_in_at);
    const [h, m] = config.expected_start_time.split(':').map(Number);
    const eventDate = attendance.checked_in_at.split('T')[0];
    const graceTime = new Date(`${eventDate}T${config.expected_start_time}:00`);
    graceTime.setMinutes(graceTime.getMinutes() + config.late_grace_minutes);
    const diffMs = checkedInAt.getTime() - graceTime.getTime();
    const is_late = diffMs > 0;
    const minutes_late = is_late ? Math.ceil(diffMs / 60000) : 0;
    return { is_late, minutes_late };
}

export async function fetchRoadshowConfig(
    eventId: string,
): Promise<{ data: RoadshowConfig | null; error: string | null }> {
    const { data, error } = await supabase
        .from('roadshow_configs')
        .select('*')
        .eq('event_id', eventId)
        .single();

    if (error && error.code !== 'PGRST116') return { data: null, error: error.message };
    if (!data) return { data: null, error: null };

    const costs = computeCosts(data);
    return {
        data: {
            ...data,
            expected_start_time: (data.expected_start_time as string).slice(0, 5),
            ...costs,
        } as RoadshowConfig,
        error: null,
    };
}

export interface RoadshowConfigInput {
    weekly_cost: number;
    slots_per_day: number;
    expected_start_time: string;
    late_grace_minutes: number;
    suggested_sitdowns: number;
    suggested_pitches: number;
    suggested_closed: number;
}

export async function saveRoadshowConfig(
    eventId: string,
    input: RoadshowConfigInput,
): Promise<{ error: string | null }> {
    const { error } = await supabase
        .from('roadshow_configs')
        .upsert(
            { event_id: eventId, ...input },
            { onConflict: 'event_id' },
        );
    return { error: error ? error.message : null };
}

export async function fetchRoadshowAttendance(
    eventId: string,
    config?: RoadshowConfig | null,
): Promise<{ data: RoadshowAttendance[]; error: string | null }> {
    const { data, error } = await supabase
        .from('roadshow_attendance')
        .select('*, users!user_id(full_name)')
        .eq('event_id', eventId)
        .order('checked_in_at', { ascending: true });

    if (error) return { data: [], error: error.message };

    interface AttendanceRow {
        id: string;
        event_id: string;
        user_id: string;
        checked_in_at: string;
        late_reason: string | null;
        checked_in_by: string | null;
        pledged_sitdowns: number;
        pledged_pitches: number;
        pledged_closed: number;
        pledged_afyc: number;
        users?: { full_name: string } | null;
    }

    const rows = (data || []).map((row: AttendanceRow) => {
        const { is_late, minutes_late } = computeLate(row, config ?? null);
        return {
            id: row.id,
            event_id: row.event_id,
            user_id: row.user_id,
            full_name: row.users?.full_name ?? 'Unknown',
            checked_in_at: row.checked_in_at,
            late_reason: row.late_reason,
            checked_in_by: row.checked_in_by,
            is_late,
            minutes_late,
            pledged_sitdowns: row.pledged_sitdowns,
            pledged_pitches: row.pledged_pitches,
            pledged_closed: row.pledged_closed,
            pledged_afyc: row.pledged_afyc,
        } as RoadshowAttendance;
    });

    return { data: rows, error: null };
}

export interface PledgeInput {
    sitdowns: number;
    pitches: number;
    closed: number;
    afyc: number;
}

export async function logRoadshowAttendanceWithPledge(
    eventId: string,
    userId: string,
    lateReason: string | null,
    pledges: PledgeInput,
): Promise<{ error: string | null }> {
    const { error } = await supabase
        .from('roadshow_attendance')
        .insert({
            event_id: eventId,
            user_id: userId,
            late_reason: lateReason || null,
            pledged_sitdowns: pledges.sitdowns,
            pledged_pitches: pledges.pitches,
            pledged_closed: pledges.closed,
            pledged_afyc: pledges.afyc,
        });
    return { error: error ? error.message : null };
}

export async function managerCheckIn(
    eventId: string,
    userId: string,
    checkedInAt: string,
    lateReason: string | null,
    pledges: PledgeInput,
    managerId: string,
): Promise<{ error: string | null }> {
    const { error } = await supabase
        .from('roadshow_attendance')
        .insert({
            event_id: eventId,
            user_id: userId,
            checked_in_at: checkedInAt,
            late_reason: lateReason || null,
            checked_in_by: managerId,
            pledged_sitdowns: pledges.sitdowns,
            pledged_pitches: pledges.pitches,
            pledged_closed: pledges.closed,
            pledged_afyc: pledges.afyc,
        });
    return { error: error ? error.message : null };
}

export async function fetchRoadshowActivities(
    eventId: string,
): Promise<{ data: RoadshowActivity[]; error: string | null }> {
    const { data, error } = await supabase
        .from('roadshow_activities')
        .select('*, users!user_id(full_name)')
        .eq('event_id', eventId)
        .order('logged_at', { ascending: false });

    if (error) return { data: [], error: error.message };

    interface ActivityRow {
        id: string;
        event_id: string;
        user_id: string;
        type: string;
        afyc_amount: number | null;
        logged_at: string;
        users?: { full_name: string } | null;
    }

    const rows = (data || []).map((row: ActivityRow) => ({
        id: row.id,
        event_id: row.event_id,
        user_id: row.user_id,
        full_name: row.users?.full_name ?? 'Unknown',
        type: row.type as RoadshowActivityType,
        afyc_amount: row.afyc_amount,
        logged_at: row.logged_at,
    } as RoadshowActivity));

    return { data: rows, error: null };
}

export async function logRoadshowActivity(
    eventId: string,
    userId: string,
    type: RoadshowActivityType,
    afycAmount?: number,
    loggedAt?: string,
): Promise<{ data: RoadshowActivity | null; error: string | null }> {
    const { data, error } = await supabase
        .from('roadshow_activities')
        .insert({
            event_id: eventId,
            user_id: userId,
            type,
            afyc_amount: afycAmount ?? null,
            ...(loggedAt ? { logged_at: loggedAt } : {}),
        })
        .select()
        .single();

    if (error) return { data: null, error: error.message };
    return {
        data: {
            id: data.id,
            event_id: data.event_id,
            user_id: data.user_id,
            type: data.type,
            afyc_amount: data.afyc_amount,
            logged_at: data.logged_at,
        },
        error: null,
    };
}

export async function createRoadshowBulk(
    events: { title: string; event_date: string; start_time: string; end_time: string; location: string }[],
    config: RoadshowConfigInput,
    attendees: { user_id: string; attendee_role: string }[],
    createdBy: string,
): Promise<{ data: { event_ids: string[]; count: number } | null; error: string | null }> {
    const { data, error } = await supabase.rpc('create_roadshow_bulk', {
        p_events: events,
        p_config: config,
        p_attendees: attendees,
        p_created_by: createdBy,
    });

    if (error) return { data: null, error: error.message };
    return { data, error: null };
}

/**
 * Delete an event (attendees cascade via FK).
 */
export async function deleteEvent(
    eventId: string,
): Promise<{ error: string | null }> {
    const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId);
    return { error: error ? error.message : null };
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
            external_attendees: input.external_attendees,
        })
        .eq('id', eventId);

    if (eventError) return { data: null, error: eventError.message };

    const keepIds = input.attendees.map(a => a.user_id);

    // Step 2: upsert — inserts new attendees, updates roles for existing ones
    if (keepIds.length > 0) {
        const rows = input.attendees.map(a => ({
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
    const deleteQuery = supabase
        .from('event_attendees')
        .delete()
        .eq('event_id', eventId);

    const { error: deleteError } = keepIds.length > 0
        ? await deleteQuery.not('user_id', 'in', `(${keepIds.join(',')})`)
        : await deleteQuery;

    if (deleteError) return { data: null, error: deleteError.message };

    return fetchEventById(eventId);
}
