/**
 * Events service — Supabase CRUD for agency events & attendees
 */
import type { AgencyEvent, CreateEventInput, EventAttendee, EventType, ExternalAttendee } from '@/types/event';
import { applyPageRange, resolvePage } from './pagination';
import { supabase } from './supabase';

export interface SimpleUser {
    id: string;
    full_name: string;
    role: string;
    avatar_url?: string | null;
}

// ── Shared query helpers ─────────────────────────────────────

const EVENT_SELECT =
    '*, creator_user:users!created_by(full_name), event_attendees(id, event_id, user_id, attendee_role, users(full_name, avatar_url))';

/**
 * Fetch event IDs where the user is an attendee or creator.
 */
async function getUserEventIds(userId: string): Promise<{ ids: string[]; error: string | null }> {
    const [{ data: attendeeRows, error: attendeeError }, { data: createdRows, error: createdError }] =
        await Promise.all([
            supabase.from('event_attendees').select('event_id').eq('user_id', userId),
            supabase.from('events').select('id').eq('created_by', userId),
        ]);

    if (attendeeError) return { ids: [], error: attendeeError.message };
    if (createdError) return { ids: [], error: createdError.message };

    const attendeeIds = (attendeeRows || []).map((r: { event_id: string }) => r.event_id);
    const createdIds = (createdRows || []).map((r: { id: string }) => r.id);
    return { ids: [...new Set([...attendeeIds, ...createdIds])], error: null };
}

// ── Public event queries ─────────────────────────────────────

/**
 * Fetch events where the user is an attendee or creator, ordered by date ascending.
 */
export async function fetchEvents(userId: string): Promise<{ data: AgencyEvent[]; error: string | null }> {
    const { ids, error: idsError } = await getUserEventIds(userId);
    if (idsError) return { data: [], error: idsError };
    if (ids.length === 0) return { data: [], error: null };

    const { data, error } = await supabase
        .from('events')
        .select(EVENT_SELECT)
        .in('id', ids)
        .order('event_date', { ascending: true })
        .order('start_time', { ascending: true });

    if (error) return { data: [], error: error.message };
    return { data: mapEvents((data || []) as EventRow[]), error: null };
}

/**
 * Fetch all events (PA use), ordered by date ascending.
 */
export async function fetchAllEvents(
    page?: number,
    pageSize: number = 50,
): Promise<{ data: AgencyEvent[]; error: string | null; hasMore: boolean }> {
    let query = supabase
        .from('events')
        .select(EVENT_SELECT)
        .order('event_date', { ascending: true })
        .order('start_time', { ascending: true });

    query = applyPageRange(query, page, pageSize);

    const { data, error } = await query;
    if (error) return { data: [], error: error.message, hasMore: false };

    const results = mapEvents((data || []) as EventRow[]);
    const { data: paged, hasMore } = resolvePage(results, page, pageSize);
    return { data: paged, error: null, hasMore };
}

/**
 * Fetch the next N upcoming events for a user.
 * Filters server-side by event_date >= today and limits to `limit` rows.
 */
export async function fetchUpcomingEvents(
    userId: string,
    limit = 5,
): Promise<{ data: AgencyEvent[]; error: string | null }> {
    const today = new Date().toISOString().split('T')[0];

    const { ids, error: idsError } = await getUserEventIds(userId);
    if (idsError) return { data: [], error: idsError };
    if (ids.length === 0) return { data: [], error: null };

    const { data, error } = await supabase
        .from('events')
        .select(EVENT_SELECT)
        .in('id', ids)
        .gte('event_date', today)
        .order('event_date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(limit);

    if (error) return { data: [], error: error.message };
    return { data: mapEvents((data || []) as EventRow[]), error: null };
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
            created_by: createdBy,
            external_attendees: input.external_attendees as any,
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
    event_type: string;
    event_date: string;
    start_time: string;
    end_time: string | null;
    location: string | null;
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
    const { error } = await supabase.from('events').delete().eq('id', eventId);
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
            external_attendees: input.external_attendees as any,
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
    // Use .filter() with PostgREST syntax — keepIds are UUIDs validated by the
    // attendee picker upstream, so the parenthesised list is safe for PostgREST.
    // Using .filter() is equivalent to .not().in() but avoids the SDK's string
    // interpolation pitfalls with the .not('col','in','(...)') overload.
    const { error: deleteError } =
        keepIds.length > 0
            ? await supabase
                  .from('event_attendees')
                  .delete()
                  .eq('event_id', eventId)
                  .filter('user_id', 'not.in', `(${keepIds.join(',')})`)
            : await supabase.from('event_attendees').delete().eq('event_id', eventId);

    if (deleteError) return { data: null, error: deleteError.message };

    return fetchEventById(eventId);
}
