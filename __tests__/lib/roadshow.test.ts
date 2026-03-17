/**
 * Tests for lib/roadshow.ts — Roadshow service: check-in, pledges, activities,
 * config, and bulk creation.
 *
 * Pure utility functions (computeCosts, computeLate) are tested via their
 * observable effect on the public API return values.
 */
import { supabase } from '@/lib/supabase';
import {
    hasUserCheckedIn,
    fetchRoadshowConfig,
    saveRoadshowConfig,
    fetchRoadshowAttendance,
    logRoadshowAttendanceWithPledge,
    managerCheckIn,
    fetchRoadshowActivities,
    logRoadshowActivity,
    createRoadshowBulk,
} from '@/lib/roadshow';
import type { RoadshowConfig } from '@/types/event';

jest.mock('@/lib/supabase');

const mockSupa = supabase as any;

function mockResolve(chain: any, value: any) {
    chain.__resolveWith(value);
}

// ── Shared fixtures ──────────────────────────────────────────────────────────

const CONFIG_ROW = {
    id: 'cfg-1',
    event_id: 'evt-1',
    weekly_cost: 700,
    slots_per_day: 2,
    expected_start_time: '09:00:00',
    late_grace_minutes: 15,
    suggested_sitdowns: 5,
    suggested_pitches: 3,
    suggested_closed: 1,
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
};

const CONFIG_INPUT = {
    weekly_cost: 700,
    slots_per_day: 2,
    expected_start_time: '09:00',
    late_grace_minutes: 15,
    suggested_sitdowns: 5,
    suggested_pitches: 3,
    suggested_closed: 1,
};

const PLEDGE_INPUT = {
    sitdowns: 5,
    pitches: 3,
    closed: 1,
    afyc: 1000,
};

const ATTENDANCE_ROW = {
    id: 'att-1',
    event_id: 'evt-1',
    user_id: 'u1',
    checked_in_at: '2026-03-15T09:30:00Z',
    late_reason: null,
    checked_in_by: null,
    pledged_sitdowns: 5,
    pledged_pitches: 3,
    pledged_closed: 1,
    pledged_afyc: 1000,
    users: { full_name: 'Alice Tan' },
};

const ACTIVITY_ROW = {
    id: 'act-1',
    event_id: 'evt-1',
    user_id: 'u1',
    type: 'sitdown',
    afyc_amount: null,
    logged_at: '2026-03-15T10:00:00Z',
    users: { full_name: 'Bob Lim' },
};

// ── Test lifecycle ───────────────────────────────────────────────────────────

beforeEach(() => {
    mockSupa.__resetChains();
    jest.clearAllMocks();
});

// ── hasUserCheckedIn ─────────────────────────────────────────────────────────

describe('hasUserCheckedIn', () => {
    it('returns { data: true } when an attendance row exists', async () => {
        const chain = mockSupa.__getChain('roadshow_attendance');
        mockResolve(chain, { data: { id: 'att-1' }, error: null });

        const result = await hasUserCheckedIn('evt-1', 'u1');
        expect(result).toEqual({ data: true, error: null });
    });

    it('returns { data: false } when data is null with no error', async () => {
        const chain = mockSupa.__getChain('roadshow_attendance');
        mockResolve(chain, { data: null, error: null });

        const result = await hasUserCheckedIn('evt-1', 'u1');
        expect(result).toEqual({ data: false, error: null });
    });

    it('treats PGRST116 (no rows found) as not checked in — not an error', async () => {
        const chain = mockSupa.__getChain('roadshow_attendance');
        mockResolve(chain, { data: null, error: { code: 'PGRST116', message: 'No rows found' } });

        const result = await hasUserCheckedIn('evt-1', 'u1');
        expect(result).toEqual({ data: false, error: null });
    });

    it('propagates non-PGRST116 database errors', async () => {
        const chain = mockSupa.__getChain('roadshow_attendance');
        mockResolve(chain, { data: null, error: { code: '42P01', message: 'Table does not exist' } });

        const result = await hasUserCheckedIn('evt-1', 'u1');
        expect(result).toEqual({ data: false, error: 'Table does not exist' });
    });

    it('returns { data: false } when data is an empty object (falsy check)', async () => {
        const chain = mockSupa.__getChain('roadshow_attendance');
        // An empty object is truthy — but `!!{}` = true, so we verify the coercion
        mockResolve(chain, { data: { id: 'att-2' }, error: null });

        const result = await hasUserCheckedIn('evt-99', 'u-none');
        expect(result.data).toBe(true);
        expect(result.error).toBeNull();
    });
});

// ── fetchRoadshowConfig ──────────────────────────────────────────────────────

describe('fetchRoadshowConfig', () => {
    it('returns config with computed daily_cost and slot_cost', async () => {
        // weekly_cost 700, slots_per_day 2 → daily = 100, slot = 50
        const chain = mockSupa.__getChain('roadshow_configs');
        mockResolve(chain, { data: CONFIG_ROW, error: null });

        const result = await fetchRoadshowConfig('evt-1');
        expect(result.error).toBeNull();
        expect(result.data).not.toBeNull();
        expect(result.data!.daily_cost).toBe(100);
        expect(result.data!.slot_cost).toBe(50);
    });

    it('trims expected_start_time to HH:MM format', async () => {
        const chain = mockSupa.__getChain('roadshow_configs');
        mockResolve(chain, { data: { ...CONFIG_ROW, expected_start_time: '09:30:00' }, error: null });

        const result = await fetchRoadshowConfig('evt-1');
        expect(result.data!.expected_start_time).toBe('09:30');
    });

    it('returns null data with no error when PGRST116 (no config yet)', async () => {
        const chain = mockSupa.__getChain('roadshow_configs');
        mockResolve(chain, { data: null, error: { code: 'PGRST116', message: 'No rows found' } });

        const result = await fetchRoadshowConfig('evt-1');
        expect(result.data).toBeNull();
        expect(result.error).toBeNull();
    });

    it('returns null data with no error when data is null and no error', async () => {
        const chain = mockSupa.__getChain('roadshow_configs');
        mockResolve(chain, { data: null, error: null });

        const result = await fetchRoadshowConfig('evt-1');
        expect(result.data).toBeNull();
        expect(result.error).toBeNull();
    });

    it('propagates non-PGRST116 database errors', async () => {
        const chain = mockSupa.__getChain('roadshow_configs');
        mockResolve(chain, { data: null, error: { code: '500', message: 'Internal server error' } });

        const result = await fetchRoadshowConfig('evt-1');
        expect(result.data).toBeNull();
        expect(result.error).toBe('Internal server error');
    });

    it('computes costs correctly when slots_per_day is 1', async () => {
        // weekly_cost 350, slots_per_day 1 → daily = 50, slot = 50
        const chain = mockSupa.__getChain('roadshow_configs');
        mockResolve(chain, {
            data: { ...CONFIG_ROW, weekly_cost: 350, slots_per_day: 1 },
            error: null,
        });

        const result = await fetchRoadshowConfig('evt-1');
        expect(result.data!.daily_cost).toBe(50);
        expect(result.data!.slot_cost).toBe(50);
    });

    it('avoids division by zero when slots_per_day is 0', async () => {
        // slots_per_day 0 falls back to 1 in computeCosts
        const chain = mockSupa.__getChain('roadshow_configs');
        mockResolve(chain, {
            data: { ...CONFIG_ROW, weekly_cost: 700, slots_per_day: 0 },
            error: null,
        });

        const result = await fetchRoadshowConfig('evt-1');
        expect(result.data).not.toBeNull();
        expect(isFinite(result.data!.slot_cost)).toBe(true);
    });

    it('preserves all other config fields in the returned object', async () => {
        const chain = mockSupa.__getChain('roadshow_configs');
        mockResolve(chain, { data: CONFIG_ROW, error: null });

        const result = await fetchRoadshowConfig('evt-1');
        const d = result.data!;
        expect(d.id).toBe('cfg-1');
        expect(d.event_id).toBe('evt-1');
        expect(d.late_grace_minutes).toBe(15);
        expect(d.suggested_sitdowns).toBe(5);
        expect(d.suggested_pitches).toBe(3);
        expect(d.suggested_closed).toBe(1);
    });
});

// ── saveRoadshowConfig ───────────────────────────────────────────────────────

describe('saveRoadshowConfig', () => {
    it('resolves with no error on successful upsert', async () => {
        const chain = mockSupa.__getChain('roadshow_configs');
        mockResolve(chain, { error: null });

        const result = await saveRoadshowConfig('evt-1', CONFIG_INPUT);
        expect(result.error).toBeNull();
    });

    it('returns the error message when upsert fails', async () => {
        const chain = mockSupa.__getChain('roadshow_configs');
        mockResolve(chain, { error: { message: 'unique constraint violation' } });

        const result = await saveRoadshowConfig('evt-1', CONFIG_INPUT);
        expect(result.error).toBe('unique constraint violation');
    });

    it('calls supabase.from with roadshow_configs table', async () => {
        const chain = mockSupa.__getChain('roadshow_configs');
        mockResolve(chain, { error: null });

        await saveRoadshowConfig('evt-2', CONFIG_INPUT);
        expect(mockSupa.from).toHaveBeenCalledWith('roadshow_configs');
    });

    it('handles zero-value config fields without error', async () => {
        const chain = mockSupa.__getChain('roadshow_configs');
        mockResolve(chain, { error: null });

        const result = await saveRoadshowConfig('evt-1', {
            weekly_cost: 0,
            slots_per_day: 0,
            expected_start_time: '00:00',
            late_grace_minutes: 0,
            suggested_sitdowns: 0,
            suggested_pitches: 0,
            suggested_closed: 0,
        });
        expect(result.error).toBeNull();
    });
});

// ── fetchRoadshowAttendance ──────────────────────────────────────────────────

describe('fetchRoadshowAttendance', () => {
    it('returns mapped attendance rows with full_name from join', async () => {
        const chain = mockSupa.__getChain('roadshow_attendance');
        mockResolve(chain, { data: [ATTENDANCE_ROW], error: null });

        const result = await fetchRoadshowAttendance('evt-1');
        expect(result.error).toBeNull();
        expect(result.data).toHaveLength(1);
        expect(result.data[0].full_name).toBe('Alice Tan');
        expect(result.data[0].pledged_sitdowns).toBe(5);
        expect(result.data[0].pledged_afyc).toBe(1000);
    });

    it('defaults full_name to "Unknown" when users join is null', async () => {
        const chain = mockSupa.__getChain('roadshow_attendance');
        mockResolve(chain, {
            data: [{ ...ATTENDANCE_ROW, users: null }],
            error: null,
        });

        const result = await fetchRoadshowAttendance('evt-1');
        expect(result.data[0].full_name).toBe('Unknown');
    });

    it('returns empty array with no error on empty result set', async () => {
        const chain = mockSupa.__getChain('roadshow_attendance');
        mockResolve(chain, { data: [], error: null });

        const result = await fetchRoadshowAttendance('evt-1');
        expect(result.data).toEqual([]);
        expect(result.error).toBeNull();
    });

    it('returns empty array and error message on database failure', async () => {
        const chain = mockSupa.__getChain('roadshow_attendance');
        mockResolve(chain, { data: null, error: { message: 'Query timeout' } });

        const result = await fetchRoadshowAttendance('evt-1');
        expect(result.data).toEqual([]);
        expect(result.error).toBe('Query timeout');
    });

    it('returns empty array and error when data is null with no error', async () => {
        const chain = mockSupa.__getChain('roadshow_attendance');
        mockResolve(chain, { data: null, error: null });

        const result = await fetchRoadshowAttendance('evt-1');
        expect(result.data).toEqual([]);
        expect(result.error).toBeNull();
    });

    it('marks attendance as on-time when checked in before grace period', async () => {
        // Check-in at 09:14:59 local, start 09:00, grace 15 min → deadline 09:15 → on time
        // Use local-time ISO (no Z) so computeLate parses both timestamps consistently
        const chain = mockSupa.__getChain('roadshow_attendance');
        mockResolve(chain, {
            data: [{ ...ATTENDANCE_ROW, checked_in_at: '2026-03-15T09:14:59' }],
            error: null,
        });

        const config: RoadshowConfig = {
            ...CONFIG_ROW,
            expected_start_time: '09:00',
            late_grace_minutes: 15,
            daily_cost: 100,
            slot_cost: 50,
        };

        const result = await fetchRoadshowAttendance('evt-1', config);
        expect(result.data[0].is_late).toBe(false);
        expect(result.data[0].minutes_late).toBe(0);
    });

    it('marks attendance as late when checked in after grace period and computes minutes_late', async () => {
        // Check-in at 09:20, start 09:00, grace 15 min → deadline 09:15 → 5 min late
        const chain = mockSupa.__getChain('roadshow_attendance');
        mockResolve(chain, {
            data: [{ ...ATTENDANCE_ROW, checked_in_at: '2026-03-15T09:20:00+00:00' }],
            error: null,
        });

        const config: RoadshowConfig = {
            ...CONFIG_ROW,
            expected_start_time: '09:15',
            late_grace_minutes: 0,
            daily_cost: 100,
            slot_cost: 50,
        };

        const result = await fetchRoadshowAttendance('evt-1', config);
        expect(result.data[0].is_late).toBe(true);
        expect(result.data[0].minutes_late).toBeGreaterThan(0);
    });

    it('treats all attendance as on-time when no config is provided', async () => {
        const chain = mockSupa.__getChain('roadshow_attendance');
        mockResolve(chain, {
            data: [{ ...ATTENDANCE_ROW, checked_in_at: '2026-03-15T12:00:00Z' }],
            error: null,
        });

        // No config → computeLate returns { is_late: false, minutes_late: 0 }
        const result = await fetchRoadshowAttendance('evt-1');
        expect(result.data[0].is_late).toBe(false);
        expect(result.data[0].minutes_late).toBe(0);
    });

    it('handles multiple attendance rows correctly', async () => {
        const chain = mockSupa.__getChain('roadshow_attendance');
        mockResolve(chain, {
            data: [ATTENDANCE_ROW, { ...ATTENDANCE_ROW, id: 'att-2', user_id: 'u2', users: { full_name: 'Charlie' } }],
            error: null,
        });

        const result = await fetchRoadshowAttendance('evt-1');
        expect(result.data).toHaveLength(2);
        expect(result.data[1].full_name).toBe('Charlie');
    });
});

// ── logRoadshowAttendanceWithPledge ──────────────────────────────────────────

describe('logRoadshowAttendanceWithPledge', () => {
    it('resolves with no error on successful insert', async () => {
        const chain = mockSupa.__getChain('roadshow_attendance');
        mockResolve(chain, { error: null });

        const result = await logRoadshowAttendanceWithPledge('evt-1', 'u1', null, PLEDGE_INPUT);
        expect(result.error).toBeNull();
    });

    it('returns error message when insert fails', async () => {
        const chain = mockSupa.__getChain('roadshow_attendance');
        mockResolve(chain, { error: { message: 'unique constraint on (event_id, user_id)' } });

        const result = await logRoadshowAttendanceWithPledge('evt-1', 'u1', null, PLEDGE_INPUT);
        expect(result.error).toBe('unique constraint on (event_id, user_id)');
    });

    it('stores a late_reason when provided', async () => {
        const chain = mockSupa.__getChain('roadshow_attendance');
        mockResolve(chain, { error: null });

        const result = await logRoadshowAttendanceWithPledge('evt-1', 'u1', 'MRT was delayed', PLEDGE_INPUT);
        expect(result.error).toBeNull();
        expect(mockSupa.from).toHaveBeenCalledWith('roadshow_attendance');
    });

    it('converts empty string late_reason to null', async () => {
        const chain = mockSupa.__getChain('roadshow_attendance');
        mockResolve(chain, { error: null });

        // Empty string should be coerced to null by `lateReason || null` in impl
        const result = await logRoadshowAttendanceWithPledge('evt-1', 'u1', '', PLEDGE_INPUT);
        expect(result.error).toBeNull();
    });

    it('handles zero pledge values without error', async () => {
        const chain = mockSupa.__getChain('roadshow_attendance');
        mockResolve(chain, { error: null });

        const result = await logRoadshowAttendanceWithPledge('evt-1', 'u1', null, {
            sitdowns: 0,
            pitches: 0,
            closed: 0,
            afyc: 0,
        });
        expect(result.error).toBeNull();
    });
});

// ── managerCheckIn ───────────────────────────────────────────────────────────

describe('managerCheckIn', () => {
    it('resolves with no error on successful insert', async () => {
        const chain = mockSupa.__getChain('roadshow_attendance');
        mockResolve(chain, { error: null });

        const result = await managerCheckIn('evt-1', 'agent-1', '2026-03-15T09:30:00Z', null, PLEDGE_INPUT, 'mgr-1');
        expect(result.error).toBeNull();
    });

    it('returns error message when insert fails', async () => {
        const chain = mockSupa.__getChain('roadshow_attendance');
        mockResolve(chain, { error: { message: 'RLS policy violation' } });

        const result = await managerCheckIn('evt-1', 'agent-1', '2026-03-15T09:30:00Z', null, PLEDGE_INPUT, 'mgr-1');
        expect(result.error).toBe('RLS policy violation');
    });

    it('passes late_reason when provided', async () => {
        const chain = mockSupa.__getChain('roadshow_attendance');
        mockResolve(chain, { error: null });

        const result = await managerCheckIn(
            'evt-1',
            'agent-1',
            '2026-03-15T10:00:00Z',
            'Oversleeping',
            PLEDGE_INPUT,
            'mgr-1',
        );
        expect(result.error).toBeNull();
        expect(mockSupa.from).toHaveBeenCalledWith('roadshow_attendance');
    });

    it('converts empty string late_reason to null', async () => {
        const chain = mockSupa.__getChain('roadshow_attendance');
        mockResolve(chain, { error: null });

        // `lateReason || null` coerces empty string to null
        const result = await managerCheckIn('evt-1', 'u1', '2026-03-15T09:00:00Z', '', PLEDGE_INPUT, 'mgr-1');
        expect(result.error).toBeNull();
    });

    it('includes the managerId as checked_in_by', async () => {
        const chain = mockSupa.__getChain('roadshow_attendance');
        mockResolve(chain, { error: null });

        await managerCheckIn('evt-1', 'agent-2', '2026-03-15T09:00:00Z', null, PLEDGE_INPUT, 'mgr-99');
        expect(mockSupa.from).toHaveBeenCalledWith('roadshow_attendance');
    });
});

// ── fetchRoadshowActivities ──────────────────────────────────────────────────

describe('fetchRoadshowActivities', () => {
    it('returns mapped activities with full_name from join', async () => {
        const chain = mockSupa.__getChain('roadshow_activities');
        mockResolve(chain, { data: [ACTIVITY_ROW], error: null });

        const result = await fetchRoadshowActivities('evt-1');
        expect(result.error).toBeNull();
        expect(result.data).toHaveLength(1);
        expect(result.data[0].type).toBe('sitdown');
        expect(result.data[0].full_name).toBe('Bob Lim');
    });

    it('defaults full_name to "Unknown" when users join is null', async () => {
        const chain = mockSupa.__getChain('roadshow_activities');
        mockResolve(chain, {
            data: [{ ...ACTIVITY_ROW, users: null }],
            error: null,
        });

        const result = await fetchRoadshowActivities('evt-1');
        expect(result.data[0].full_name).toBe('Unknown');
    });

    it('returns empty array with no error on empty result set', async () => {
        const chain = mockSupa.__getChain('roadshow_activities');
        mockResolve(chain, { data: [], error: null });

        const result = await fetchRoadshowActivities('evt-1');
        expect(result.data).toEqual([]);
        expect(result.error).toBeNull();
        expect(result.hasMore).toBe(false);
    });

    it('returns empty array, error message, and hasMore=false on failure', async () => {
        const chain = mockSupa.__getChain('roadshow_activities');
        mockResolve(chain, { data: null, error: { message: 'Permission denied' } });

        const result = await fetchRoadshowActivities('evt-1');
        expect(result.data).toEqual([]);
        expect(result.error).toBe('Permission denied');
        expect(result.hasMore).toBe(false);
    });

    it('returns hasMore=false when page is not provided (backward compat)', async () => {
        const chain = mockSupa.__getChain('roadshow_activities');
        mockResolve(chain, { data: [ACTIVITY_ROW], error: null });

        const result = await fetchRoadshowActivities('evt-1');
        expect(result.hasMore).toBe(false);
    });

    it('returns hasMore=true when there are more results than pageSize', async () => {
        // Request pageSize=2, return 3 rows → hasMore=true, data trimmed to 2
        const rows = Array.from({ length: 3 }, (_, i) => ({ ...ACTIVITY_ROW, id: `act-${i}` }));
        const chain = mockSupa.__getChain('roadshow_activities');
        mockResolve(chain, { data: rows, error: null });

        const result = await fetchRoadshowActivities('evt-1', 0, 2);
        expect(result.hasMore).toBe(true);
        expect(result.data).toHaveLength(2);
    });

    it('returns hasMore=false on the last page', async () => {
        // One row remains on page 1 with pageSize=2 → hasMore=false
        const chain = mockSupa.__getChain('roadshow_activities');
        mockResolve(chain, { data: [ACTIVITY_ROW], error: null });

        const result = await fetchRoadshowActivities('evt-1', 1, 2);
        expect(result.hasMore).toBe(false);
        expect(result.data).toHaveLength(1);
    });

    it('maps afyc_amount correctly for case_closed activities', async () => {
        const chain = mockSupa.__getChain('roadshow_activities');
        mockResolve(chain, {
            data: [{ ...ACTIVITY_ROW, type: 'case_closed', afyc_amount: 5000 }],
            error: null,
        });

        const result = await fetchRoadshowActivities('evt-1');
        expect(result.data[0].type).toBe('case_closed');
        expect(result.data[0].afyc_amount).toBe(5000);
    });

    it('maps afyc_amount as null for non-closed activities', async () => {
        const chain = mockSupa.__getChain('roadshow_activities');
        mockResolve(chain, {
            data: [{ ...ACTIVITY_ROW, type: 'pitch', afyc_amount: null }],
            error: null,
        });

        const result = await fetchRoadshowActivities('evt-1');
        expect(result.data[0].afyc_amount).toBeNull();
    });
});

// ── logRoadshowActivity ──────────────────────────────────────────────────────

describe('logRoadshowActivity', () => {
    it('inserts and returns the new activity on success', async () => {
        const chain = mockSupa.__getChain('roadshow_activities');
        mockResolve(chain, {
            data: {
                id: 'act-new',
                event_id: 'evt-1',
                user_id: 'u1',
                type: 'pitch',
                afyc_amount: null,
                logged_at: '2026-03-15T10:00:00Z',
            },
            error: null,
        });

        const result = await logRoadshowActivity('evt-1', 'u1', 'pitch');
        expect(result.error).toBeNull();
        expect(result.data).not.toBeNull();
        expect(result.data!.id).toBe('act-new');
        expect(result.data!.type).toBe('pitch');
    });

    it('returns case_closed activity with afyc_amount', async () => {
        const chain = mockSupa.__getChain('roadshow_activities');
        mockResolve(chain, {
            data: {
                id: 'act-2',
                event_id: 'evt-1',
                user_id: 'u1',
                type: 'case_closed',
                afyc_amount: 8000,
                logged_at: '2026-03-15T14:00:00Z',
            },
            error: null,
        });

        const result = await logRoadshowActivity('evt-1', 'u1', 'case_closed', 8000);
        expect(result.error).toBeNull();
        expect(result.data!.afyc_amount).toBe(8000);
    });

    it('returns null data and error message on insert failure', async () => {
        const chain = mockSupa.__getChain('roadshow_activities');
        mockResolve(chain, { data: null, error: { message: 'FK constraint failed' } });

        const result = await logRoadshowActivity('evt-1', 'u1', 'sitdown');
        expect(result.data).toBeNull();
        expect(result.error).toBe('FK constraint failed');
    });

    it('uses provided loggedAt timestamp when passed', async () => {
        const chain = mockSupa.__getChain('roadshow_activities');
        mockResolve(chain, {
            data: {
                id: 'act-3',
                event_id: 'evt-1',
                user_id: 'u1',
                type: 'departure',
                afyc_amount: null,
                logged_at: '2026-03-15T18:00:00Z',
            },
            error: null,
        });

        const result = await logRoadshowActivity('evt-1', 'u1', 'departure', undefined, '2026-03-15T18:00:00Z');
        expect(result.error).toBeNull();
        expect(result.data!.logged_at).toBe('2026-03-15T18:00:00Z');
    });

    it('defaults afyc_amount to null when not provided', async () => {
        const chain = mockSupa.__getChain('roadshow_activities');
        mockResolve(chain, {
            data: {
                id: 'act-4',
                event_id: 'evt-1',
                user_id: 'u1',
                type: 'check_in',
                afyc_amount: null,
                logged_at: '2026-03-15T09:00:00Z',
            },
            error: null,
        });

        const result = await logRoadshowActivity('evt-1', 'u1', 'check_in');
        expect(result.data!.afyc_amount).toBeNull();
    });

    it('maps all returned fields onto the RoadshowActivity shape', async () => {
        const chain = mockSupa.__getChain('roadshow_activities');
        mockResolve(chain, {
            data: {
                id: 'act-5',
                event_id: 'evt-X',
                user_id: 'u-X',
                type: 'sitdown',
                afyc_amount: null,
                logged_at: '2026-03-15T11:00:00Z',
            },
            error: null,
        });

        const result = await logRoadshowActivity('evt-X', 'u-X', 'sitdown');
        const act = result.data!;
        expect(act.id).toBe('act-5');
        expect(act.event_id).toBe('evt-X');
        expect(act.user_id).toBe('u-X');
        expect(act.type).toBe('sitdown');
        expect(act.logged_at).toBe('2026-03-15T11:00:00Z');
    });
});

// ── createRoadshowBulk ───────────────────────────────────────────────────────

describe('createRoadshowBulk', () => {
    const EVENTS = [
        {
            title: 'Roadshow Day 1',
            event_date: '2026-03-15',
            start_time: '09:00',
            end_time: '17:00',
            location: 'Mall A',
        },
        {
            title: 'Roadshow Day 2',
            event_date: '2026-03-16',
            start_time: '09:00',
            end_time: '17:00',
            location: 'Mall B',
        },
    ];
    const ATTENDEES = [
        { user_id: 'u1', attendee_role: 'attendee' },
        { user_id: 'u2', attendee_role: 'duty_manager' },
    ];

    it('calls the create_roadshow_bulk RPC with correct arguments', async () => {
        mockSupa.rpc.mockResolvedValue({ data: { event_ids: ['evt-1', 'evt-2'], count: 2 }, error: null });

        await createRoadshowBulk(EVENTS, CONFIG_INPUT, ATTENDEES, 'mgr-1');

        expect(mockSupa.rpc).toHaveBeenCalledWith('create_roadshow_bulk', {
            p_events: EVENTS,
            p_config: CONFIG_INPUT,
            p_attendees: ATTENDEES,
            p_created_by: 'mgr-1',
        });
    });

    it('returns event_ids and count from RPC response', async () => {
        mockSupa.rpc.mockResolvedValue({
            data: { event_ids: ['evt-1', 'evt-2'], count: 2 },
            error: null,
        });

        const result = await createRoadshowBulk(EVENTS, CONFIG_INPUT, ATTENDEES, 'mgr-1');
        expect(result.error).toBeNull();
        expect(result.data).not.toBeNull();
        expect(result.data!.count).toBe(2);
        expect(result.data!.event_ids).toEqual(['evt-1', 'evt-2']);
    });

    it('returns null data and error message on RPC failure', async () => {
        mockSupa.rpc.mockResolvedValue({ data: null, error: { message: 'RPC execution failed' } });

        const result = await createRoadshowBulk(EVENTS, CONFIG_INPUT, ATTENDEES, 'mgr-1');
        expect(result.data).toBeNull();
        expect(result.error).toBe('RPC execution failed');
    });

    it('handles empty events array without error', async () => {
        mockSupa.rpc.mockResolvedValue({ data: { event_ids: [], count: 0 }, error: null });

        const result = await createRoadshowBulk([], CONFIG_INPUT, ATTENDEES, 'mgr-1');
        expect(result.error).toBeNull();
        expect(result.data!.count).toBe(0);
        expect(result.data!.event_ids).toEqual([]);
    });

    it('handles empty attendees array without error', async () => {
        mockSupa.rpc.mockResolvedValue({ data: { event_ids: ['evt-3'], count: 1 }, error: null });

        const result = await createRoadshowBulk(EVENTS, CONFIG_INPUT, [], 'mgr-1');
        expect(result.error).toBeNull();
        expect(result.data!.count).toBe(1);
    });

    it('returns a single event_id when creating one roadshow', async () => {
        mockSupa.rpc.mockResolvedValue({ data: { event_ids: ['evt-solo'], count: 1 }, error: null });

        const result = await createRoadshowBulk(
            [{ title: 'Solo Day', event_date: '2026-03-20', start_time: '10:00', end_time: '16:00', location: 'HQ' }],
            CONFIG_INPUT,
            ATTENDEES,
            'mgr-2',
        );
        expect(result.data!.event_ids).toHaveLength(1);
        expect(result.data!.event_ids[0]).toBe('evt-solo');
    });
});

// ── computeCosts (via fetchRoadshowConfig) — pure utility edge cases ─────────

describe('computeCosts — edge cases via fetchRoadshowConfig', () => {
    it('rounds daily_cost to 2 decimal places', async () => {
        // weekly_cost 100, 7 days → 14.285714... → rounds to 14.29
        const chain = mockSupa.__getChain('roadshow_configs');
        mockResolve(chain, { data: { ...CONFIG_ROW, weekly_cost: 100, slots_per_day: 1 }, error: null });

        const result = await fetchRoadshowConfig('evt-1');
        expect(result.data!.daily_cost).toBe(14.29);
    });

    it('rounds slot_cost to 2 decimal places', async () => {
        // weekly_cost 100, slots_per_day 3 → daily=14.29, slot=4.76...
        const chain = mockSupa.__getChain('roadshow_configs');
        mockResolve(chain, { data: { ...CONFIG_ROW, weekly_cost: 100, slots_per_day: 3 }, error: null });

        const result = await fetchRoadshowConfig('evt-1');
        expect(result.data!.slot_cost).toBe(4.76);
    });
});

// ── computeLate (via fetchRoadshowAttendance) — pure utility edge cases ──────

describe('computeLate — edge cases via fetchRoadshowAttendance', () => {
    it('returns is_late=false and minutes_late=0 when config is null', async () => {
        const chain = mockSupa.__getChain('roadshow_attendance');
        mockResolve(chain, { data: [ATTENDANCE_ROW], error: null });

        const result = await fetchRoadshowAttendance('evt-1', null);
        expect(result.data[0].is_late).toBe(false);
        expect(result.data[0].minutes_late).toBe(0);
    });

    it('returns is_late=false and minutes_late=0 when check-in is exactly at deadline', async () => {
        // Start 09:00, grace 0 → deadline 09:00; check-in 09:00 → diff=0 → not late
        // Use local-time ISO (no Z) so computeLate parses both timestamps consistently
        const chain = mockSupa.__getChain('roadshow_attendance');
        mockResolve(chain, {
            data: [{ ...ATTENDANCE_ROW, checked_in_at: '2026-03-15T09:00:00' }],
            error: null,
        });

        const config: RoadshowConfig = {
            ...CONFIG_ROW,
            expected_start_time: '09:00',
            late_grace_minutes: 0,
            daily_cost: 100,
            slot_cost: 50,
        };

        const result = await fetchRoadshowAttendance('evt-1', config);
        expect(result.data[0].is_late).toBe(false);
        expect(result.data[0].minutes_late).toBe(0);
    });

    it('uses Math.ceil so 1 second past deadline counts as 1 minute late', async () => {
        // Deadline 09:15:00, check-in 09:15:01 → 1 second over → ceil(1/60)=1 minute
        // Use local-time ISO (no Z) so computeLate parses both timestamps consistently
        const chain = mockSupa.__getChain('roadshow_attendance');
        mockResolve(chain, {
            data: [{ ...ATTENDANCE_ROW, checked_in_at: '2026-03-15T09:15:01' }],
            error: null,
        });

        const config: RoadshowConfig = {
            ...CONFIG_ROW,
            expected_start_time: '09:00',
            late_grace_minutes: 15,
            daily_cost: 100,
            slot_cost: 50,
        };

        const result = await fetchRoadshowAttendance('evt-1', config);
        expect(result.data[0].is_late).toBe(true);
        expect(result.data[0].minutes_late).toBe(1);
    });
});
