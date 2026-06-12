/**
 * Roadshow service — check-in, pledges, activities, config, bulk creation
 */
import type { RoadshowActivity, RoadshowActivityType, RoadshowAttendance, RoadshowConfig } from '@/types/event';
import type { Json } from '@/types/shared/database.types';
import { friendlyError } from './errors';
import { applyPageRange, resolvePage } from './pagination';
import { supabase } from './supabase';
import { queueMutation, enqueueWrite, isNetworkError, isNetworkErrorResult } from './offline';
import type { OfflineOperation } from './offline';

/** PostgREST error code: "no rows found" from .single() */
const PGRST_NO_ROWS = 'PGRST116';
/** Postgres error code: unique_violation */
const PG_UNIQUE_VIOLATION = '23505';

// ── Helpers ──────────────────────────────────────────────────

/**
 * Queue a write that failed because the device is offline. Returns the
 * caller-facing result: no error when queued, an actionable message when the
 * queue refused the item (full / not allowlisted) — never a silent drop.
 */
async function queueOfflineWrite(
    table: string,
    operation: OfflineOperation,
    payload: Record<string, unknown>,
    filters?: Record<string, unknown>,
    onConflict?: string,
): Promise<{ error: string | null }> {
    const queued = await enqueueWrite(table, operation, payload, filters, onConflict);
    return queued ? { error: null } : { error: 'Could not save offline — please try again when connected.' };
}

/** Compute daily/slot cost client-side */
function computeCosts(config: { weekly_cost: number; slots_per_day: number }): {
    daily_cost: number;
    slot_cost: number;
} {
    const daily = config.weekly_cost / 7;
    const slot = daily / (config.slots_per_day || 1);
    return { daily_cost: Math.round(daily * 100) / 100, slot_cost: Math.round(slot * 100) / 100 };
}

/** Compute is_late and minutes_late from attendance row vs config */
function computeLate(
    attendance: { checked_in_at: string },
    config: RoadshowConfig | null,
): { is_late: boolean; minutes_late: number } {
    if (!config) return { is_late: false, minutes_late: 0 };
    const checkedInAt = new Date(attendance.checked_in_at);
    const eventDate = attendance.checked_in_at.split('T')[0];
    const graceTime = new Date(`${eventDate}T${config.expected_start_time}:00`);
    graceTime.setMinutes(graceTime.getMinutes() + config.late_grace_minutes);
    const diffMs = checkedInAt.getTime() - graceTime.getTime();
    const is_late = diffMs > 0;
    const minutes_late = is_late ? Math.ceil(diffMs / 60000) : 0;
    return { is_late, minutes_late };
}

// ── Check-in ─────────────────────────────────────────────────

/** Check if a user has already checked in to an event */
export async function hasUserCheckedIn(
    eventId: string,
    userId: string,
): Promise<{ data: boolean; error: string | null }> {
    const { data, error } = await supabase
        .from('roadshow_attendance')
        .select('id')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .single();

    // PGRST116 = "no rows found" — not an error, just means not checked in
    if (error && error.code !== PGRST_NO_ROWS) {
        return { data: false, error: friendlyError(error.message, error.code) };
    }
    return { data: !!data, error: null };
}

// ── Config ───────────────────────────────────────────────────

export interface RoadshowConfigInput {
    weekly_cost: number;
    slots_per_day: number;
    expected_start_time: string;
    late_grace_minutes: number;
    suggested_sitdowns: number;
    suggested_pitches: number;
    suggested_closed: number;
}

export async function fetchRoadshowConfig(
    eventId: string,
): Promise<{ data: RoadshowConfig | null; error: string | null }> {
    const { data, error } = await supabase
        .from('roadshow_configs')
        .select(
            'id, event_id, weekly_cost, slots_per_day, expected_start_time, late_grace_minutes, suggested_sitdowns, suggested_pitches, suggested_closed, created_at, updated_at',
        )
        .eq('event_id', eventId)
        .single();

    if (error && error.code !== PGRST_NO_ROWS) return { data: null, error: friendlyError(error.message, error.code) };
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

export async function saveRoadshowConfig(
    eventId: string,
    input: RoadshowConfigInput,
): Promise<{ error: string | null }> {
    const row = { event_id: eventId, ...input };
    try {
        const { error, status } = await supabase.from('roadshow_configs').upsert(row, { onConflict: 'event_id' });
        if (!error) return { error: null };
        // Offline → queue the config upsert (replays on reconnect). postgrest
        // resolves network failures (status 0) instead of throwing.
        if (isNetworkErrorResult(error, status)) {
            return queueOfflineWrite('roadshow_configs', 'upsert', row, undefined, 'event_id');
        }
        return { error: friendlyError(error.message, error.code) };
    } catch (e) {
        if (isNetworkError(e)) {
            return queueOfflineWrite('roadshow_configs', 'upsert', row, undefined, 'event_id');
        }
        throw e;
    }
}

// ── Attendance ───────────────────────────────────────────────

export async function fetchRoadshowAttendance(
    eventId: string,
    config?: RoadshowConfig | null,
): Promise<{ data: RoadshowAttendance[]; error: string | null }> {
    const { data, error } = await supabase
        .from('roadshow_attendance')
        .select('*, users!user_id(full_name)')
        .eq('event_id', eventId)
        .order('checked_in_at', { ascending: true });

    if (error) return { data: [], error: friendlyError(error.message, error.code) };

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

export interface CheckInResult {
    error: string | null;
    /** True when the row already exists (unique_violation on event_id+user_id).
     *  Caller should treat as a successful idempotent check-in, not an error. */
    alreadyCheckedIn?: boolean;
}

export async function logRoadshowAttendanceWithPledge(
    eventId: string,
    userId: string,
    lateReason: string | null,
    pledges: PledgeInput,
): Promise<CheckInResult> {
    const payload = {
        event_id: eventId,
        user_id: userId,
        late_reason: lateReason || null,
        pledged_sitdowns: pledges.sitdowns,
        pledged_pitches: pledges.pitches,
        pledged_closed: pledges.closed,
        pledged_afyc: pledges.afyc,
    };
    try {
        const { error, status } = await supabase.from('roadshow_attendance').insert(payload);
        if (!error) return { error: null };
        if (error.code === PG_UNIQUE_VIOLATION) return { error: null, alreadyCheckedIn: true };
        // Offline → queue the check-in (replays on reconnect; a duplicate that
        // already exists will simply fail the unique constraint on replay).
        // postgrest resolves network failures (status 0) instead of throwing.
        if (isNetworkErrorResult(error, status)) {
            return queueOfflineWrite('roadshow_attendance', 'insert', payload);
        }
        return { error: friendlyError(error.message, error.code) };
    } catch (e) {
        if (isNetworkError(e)) {
            return queueOfflineWrite('roadshow_attendance', 'insert', payload);
        }
        throw e;
    }
}

export async function managerCheckIn(
    eventId: string,
    userId: string,
    checkedInAt: string,
    lateReason: string | null,
    pledges: PledgeInput,
    managerId: string,
): Promise<CheckInResult> {
    const payload = {
        event_id: eventId,
        user_id: userId,
        checked_in_at: checkedInAt,
        late_reason: lateReason || null,
        checked_in_by: managerId,
        pledged_sitdowns: pledges.sitdowns,
        pledged_pitches: pledges.pitches,
        pledged_closed: pledges.closed,
        pledged_afyc: pledges.afyc,
    };
    try {
        const { error, status } = await supabase.from('roadshow_attendance').insert(payload);
        if (!error) return { error: null };
        if (error.code === PG_UNIQUE_VIOLATION) return { error: null, alreadyCheckedIn: true };
        if (isNetworkErrorResult(error, status)) {
            return queueOfflineWrite('roadshow_attendance', 'insert', payload);
        }
        return { error: friendlyError(error.message, error.code) };
    } catch (e) {
        if (isNetworkError(e)) {
            return queueOfflineWrite('roadshow_attendance', 'insert', payload);
        }
        throw e;
    }
}

// ── Activities ───────────────────────────────────────────────

export async function fetchRoadshowActivities(
    eventId: string,
    page?: number,
    pageSize: number = 20,
): Promise<{ data: RoadshowActivity[]; error: string | null; hasMore: boolean }> {
    let query = supabase
        .from('roadshow_activities')
        .select('*, users!user_id(full_name)')
        .eq('event_id', eventId)
        .order('logged_at', { ascending: false });

    query = applyPageRange(query, page, pageSize);

    const { data, error } = await query;
    if (error) return { data: [], error: friendlyError(error.message, error.code), hasMore: false };

    interface ActivityRow {
        id: string;
        event_id: string;
        user_id: string;
        type: string;
        afyc_amount: number | null;
        logged_at: string;
        users?: { full_name: string } | null;
    }

    const rows = (data || []).map(
        (row: ActivityRow) =>
            ({
                id: row.id,
                event_id: row.event_id,
                user_id: row.user_id,
                full_name: row.users?.full_name ?? 'Unknown',
                type: row.type as RoadshowActivityType,
                afyc_amount: row.afyc_amount,
                logged_at: row.logged_at,
            }) as RoadshowActivity,
    );

    const { data: paged, hasMore } = resolvePage(rows, page, pageSize);
    return { data: paged, error: null, hasMore };
}

export async function logRoadshowActivity(
    eventId: string,
    userId: string,
    type: RoadshowActivityType,
    afycAmount?: number,
    loggedAt?: string,
): Promise<{ data: RoadshowActivity | null; error: string | null }> {
    const payload = {
        event_id: eventId,
        user_id: userId,
        type,
        afyc_amount: afycAmount ?? null,
        ...(loggedAt ? { logged_at: loggedAt } : {}),
    };
    const res = await queueMutation('roadshow_activities', 'insert', payload, undefined, () =>
        supabase.from('roadshow_activities').insert(payload).select().single(),
    );
    if (res.error) return { data: null, error: res.error };
    // Queued offline → build an optimistic row from the known inputs.
    const row = res.data as { id?: string; logged_at?: string } | null;
    return {
        data: {
            id: row?.id ?? `offline-${Date.now()}`,
            event_id: eventId,
            user_id: userId,
            type,
            afyc_amount: afycAmount ?? null,
            logged_at: row?.logged_at ?? loggedAt ?? new Date().toISOString(),
        },
        error: null,
    };
}

// ── Bulk Creation ────────────────────────────────────────────

export async function createRoadshowBulk(
    events: {
        title: string;
        event_date: string;
        start_time: string;
        end_time: string;
        location: string;
        latitude: number | null;
        longitude: number | null;
    }[],
    config: RoadshowConfigInput,
    attendees: { user_id: string; attendee_role: string }[],
    createdBy: string,
): Promise<{ data: { event_ids: string[]; count: number } | null; error: string | null }> {
    const { data, error } = await supabase.rpc('create_roadshow_bulk', {
        p_events: events,
        p_config: config as unknown as Json,
        p_attendees: attendees,
        p_created_by: createdBy,
    });

    if (error) return { data: null, error: friendlyError(error.message, error.code) };
    return { data: data as { event_ids: string[]; count: number }, error: null };
}
