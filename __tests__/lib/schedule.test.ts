/**
 * Tests for lib/recruitment/schedule — the candidate personal-agenda client.
 * The RPC itself enforces self-scope + field masking (verified at the DB layer);
 * here we cover the row mapping, the args passed to the RPC, error handling, and
 * the pure display helpers.
 */
import {
    fetchMyCandidateSchedule,
    formatScheduleWhen,
    scheduleItemLocation,
    scheduleItemTitle,
    type CandidateScheduleItem,
} from '@/lib/recruitment/schedule';
import { supabase } from '@/lib/supabase';

const mockRpc = { value: { data: [] as unknown, error: null as unknown } };
jest.mock('@/lib/supabase', () => ({
    supabase: { rpc: jest.fn((_fn: string, _args: unknown) => Promise.resolve(mockRpc.value)) },
}));

beforeEach(() => {
    mockRpc.value = { data: [], error: null };
    (supabase.rpc as jest.Mock).mockClear();
});

const item = (over: Partial<CandidateScheduleItem>): CandidateScheduleItem => ({
    kind: 'interview',
    id: 'x',
    code: null,
    startAt: '2026-07-04T07:00:00+08:00',
    endAt: null,
    location: null,
    isOnline: false,
    status: 'scheduled',
    ...over,
});

describe('fetchMyCandidateSchedule', () => {
    it('maps raw RPC rows (snake_case) into CandidateScheduleItem', async () => {
        mockRpc.value = {
            data: [
                {
                    kind: 'interview',
                    ref_id: 'iv1',
                    code: 'zoom',
                    start_at: '2026-07-04T07:00:00+08:00',
                    end_at: null,
                    location: null,
                    is_online: true,
                    status: 'scheduled',
                },
            ],
            error: null,
        };
        const { data, error } = await fetchMyCandidateSchedule();
        expect(error).toBeNull();
        expect(data).toEqual([
            {
                kind: 'interview',
                id: 'iv1',
                code: 'zoom',
                startAt: '2026-07-04T07:00:00+08:00',
                endAt: null,
                location: null,
                isOnline: true,
                status: 'scheduled',
            },
        ]);
    });

    it('defaults to upcoming-only, unlimited', async () => {
        await fetchMyCandidateSchedule();
        expect(supabase.rpc as jest.Mock).toHaveBeenCalledWith('get_my_candidate_schedule', {
            p_include_past: false,
            p_limit: null,
        });
    });

    it('passes includePast + limit through to the RPC', async () => {
        await fetchMyCandidateSchedule({ includePast: true, limit: 3 });
        expect(supabase.rpc as jest.Mock).toHaveBeenCalledWith('get_my_candidate_schedule', {
            p_include_past: true,
            p_limit: 3,
        });
    });

    it('fails soft with the error message on RPC error', async () => {
        mockRpc.value = { data: null, error: { message: 'boom' } };
        const { data, error } = await fetchMyCandidateSchedule();
        expect(data).toEqual([]);
        expect(error).toBe('boom');
    });
});

describe('scheduleItemTitle', () => {
    it('labels each kind', () => {
        expect(scheduleItemTitle(item({ kind: 'interview' }))).toBe('Interview');
        expect(scheduleItemTitle(item({ kind: 'paper', code: 'M9' }))).toBe('M9 exam');
        expect(scheduleItemTitle(item({ kind: 'prep_course', code: 'M9_M9A' }))).toBe('M9/M9A prep course');
        expect(scheduleItemTitle(item({ kind: 'milestone', code: 'bes_induction' }))).toBe('BES Induction');
    });

    it('falls back to the raw code for unknown values', () => {
        expect(scheduleItemTitle(item({ kind: 'milestone', code: 'bdm' }))).toBe('BDM');
        expect(scheduleItemTitle(item({ kind: 'paper', code: 'ZZ' }))).toBe('ZZ exam');
    });
});

describe('formatScheduleWhen (Asia/Singapore)', () => {
    it('shows date + time for interviews/papers', () => {
        const when = formatScheduleWhen(item({ kind: 'interview', startAt: '2026-07-04T07:00:00+08:00' }));
        expect(when).toContain('4 Jul');
        expect(when).toContain('·');
        expect(when).toMatch(/7:00/); // 07:00 +08:00 == 7:00 am SGT
    });

    it('shows a date range for multi-day prep/milestone', () => {
        const when = formatScheduleWhen(
            item({
                kind: 'prep_course',
                startAt: '2026-07-04T00:00:00+08:00',
                endAt: '2026-07-06T00:00:00+08:00',
            }),
        );
        expect(when).toContain('–');
        expect(when).toContain('4 Jul');
        expect(when).toContain('6 Jul');
    });

    it('shows a single day (no time) for single-day milestones', () => {
        const when = formatScheduleWhen(item({ kind: 'milestone', startAt: '2026-07-06T00:00:00+08:00', endAt: null }));
        expect(when).toContain('6 Jul');
        expect(when).not.toContain('·');
        expect(when).not.toContain('–');
    });
});

describe('scheduleItemLocation', () => {
    it('reports Online / location / In person for interviews only', () => {
        expect(scheduleItemLocation(item({ kind: 'interview', isOnline: true }))).toBe('Online');
        expect(scheduleItemLocation(item({ kind: 'interview', isOnline: false, location: 'MKTR Office' }))).toBe(
            'MKTR Office',
        );
        expect(scheduleItemLocation(item({ kind: 'interview', isOnline: false, location: null }))).toBe('In person');
        expect(scheduleItemLocation(item({ kind: 'paper', code: 'M9' }))).toBeNull();
    });
});
