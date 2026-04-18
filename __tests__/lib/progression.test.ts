/**
 * Tests for lib/recruitment/progression.ts — paper attempts, milestones,
 * prep-course writes, and the markCandidateLicensed readiness guard.
 *
 * The shared checkAllPapersPassed() primitive must stay in sync with the
 * fn_all_papers_passed() SQL function from migration 20260417100100. If a row
 * layout changes here, confirm the migration didn't change.
 */
import { supabase } from '@/lib/supabase';

import {
    checkAllPapersPassed,
    deletePaperAttempt,
    markCandidateLicensed,
    upsertMilestone,
    upsertPaperAttempt,
    upsertPrepCourseBooking,
} from '@/lib/recruitment/progression';
import type { CandidateMilestone, CandidatePaperAttempt } from '@/types/recruitment';

jest.mock('@/lib/supabase');

const mockSupa = supabase as any;

function makeAttempt(
    code: CandidatePaperAttempt['paper_code'],
    result: CandidatePaperAttempt['result'] = 'passed',
): CandidatePaperAttempt {
    return {
        id: `att-${code}-${result ?? 'sch'}`,
        candidate_id: 'cand-1',
        paper_code: code,
        exam_at: '2026-04-10T02:00:00Z',
        cost: 120,
        result,
        logged_by_user_id: null,
        created_at: '2026-04-01T00:00:00Z',
        updated_at: '2026-04-01T00:00:00Z',
    };
}

function makeRnf(status: CandidateMilestone['status']): CandidateMilestone {
    return {
        id: 'ms-rnf',
        candidate_id: 'cand-1',
        milestone_code: 'rnf',
        status,
        scheduled_date: null,
        scheduled_end_date: null,
        completed_date: null,
        reference_number: status === 'issued' ? 'RNF-2026-001' : null,
        verified_by_user_id: null,
        note: null,
        created_at: '2026-04-01T00:00:00Z',
        updated_at: '2026-04-01T00:00:00Z',
    };
}

beforeEach(() => {
    mockSupa.__resetChains();
    jest.clearAllMocks();
});

// ── checkAllPapersPassed ──────────────────────────────────────────────────

describe('checkAllPapersPassed', () => {
    it('returns false when no attempts exist', () => {
        expect(checkAllPapersPassed([])).toBe(false);
    });

    it('returns true for the M9/M9A/M5/HI path', () => {
        expect(
            checkAllPapersPassed([makeAttempt('M9'), makeAttempt('M9A'), makeAttempt('M5'), makeAttempt('HI')]),
        ).toBe(true);
    });

    it('returns true for CM_LIP + M5 + HI (CM_LIP satisfies Life 1 + Life 2)', () => {
        expect(checkAllPapersPassed([makeAttempt('CM_LIP'), makeAttempt('M5'), makeAttempt('HI')])).toBe(true);
    });

    it('returns true when RES5 substitutes for M5', () => {
        expect(
            checkAllPapersPassed([makeAttempt('M9'), makeAttempt('M9A'), makeAttempt('RES5'), makeAttempt('HI')]),
        ).toBe(true);
    });

    it('returns false when HI is missing', () => {
        expect(checkAllPapersPassed([makeAttempt('M9'), makeAttempt('M9A'), makeAttempt('M5')])).toBe(false);
    });

    it('ignores failed and scheduled (null-result) attempts', () => {
        expect(
            checkAllPapersPassed([
                makeAttempt('M9', 'failed'),
                makeAttempt('M9A', null),
                makeAttempt('M5', 'failed'),
                makeAttempt('HI', 'passed'),
            ]),
        ).toBe(false);
    });

    it('counts multiple attempts as passed if any one passed', () => {
        expect(
            checkAllPapersPassed([
                makeAttempt('M9', 'failed'),
                { ...makeAttempt('M9', 'passed'), id: 'att-M9-passed-2' },
                makeAttempt('M9A'),
                makeAttempt('M5'),
                makeAttempt('HI'),
            ]),
        ).toBe(true);
    });
});

// ── upsertPaperAttempt (insert + update) ──────────────────────────────────

describe('upsertPaperAttempt', () => {
    it('inserts a new attempt when no id is supplied', async () => {
        const chain = mockSupa.__getChain('candidate_paper_attempts');
        chain.__resolveWith({
            data: makeAttempt('M9', null),
            error: null,
        });

        const res = await upsertPaperAttempt(
            'cand-1',
            { paperCode: 'M9', examAt: '2026-06-01T02:00:00Z', cost: 120, result: null },
            'user-1',
        );

        expect(res.error).toBeNull();
        const insertCall = chain.__calls.find((c: any) => c.method === 'insert');
        expect(insertCall).toBeDefined();
        const row = insertCall.args[0];
        expect(row.candidate_id).toBe('cand-1');
        expect(row.paper_code).toBe('M9');
        expect(row.exam_at).toBe('2026-06-01T02:00:00Z');
        expect(row.cost).toBe(120);
        expect(row.result).toBeNull();
        expect(row.logged_by_user_id).toBe('user-1');
    });

    it('updates an existing attempt when id is supplied', async () => {
        const chain = mockSupa.__getChain('candidate_paper_attempts');
        chain.__resolveWith({
            data: makeAttempt('M9', 'passed'),
            error: null,
        });

        await upsertPaperAttempt(
            'cand-1',
            { id: 'att-1', paperCode: 'M9', examAt: null, cost: 120, result: 'passed' },
            'user-1',
        );

        const updateCall = chain.__calls.find((c: any) => c.method === 'update');
        expect(updateCall).toBeDefined();
        expect(updateCall.args[0].result).toBe('passed');
        expect(chain.__calls.find((c: any) => c.method === 'eq')?.args).toEqual(['id', 'att-1']);
    });

    it('surfaces Supabase errors', async () => {
        const chain = mockSupa.__getChain('candidate_paper_attempts');
        chain.__resolveWith({ data: null, error: { message: 'RLS denied' } });

        const res = await upsertPaperAttempt('cand-1', {
            paperCode: 'M9',
            examAt: null,
            cost: null,
            result: null,
        });

        expect(res.data).toBeNull();
        expect(res.error).toBe('RLS denied');
    });
});

// ── deletePaperAttempt ───────────────────────────────────────────────────

describe('deletePaperAttempt', () => {
    it('deletes by id and reports success', async () => {
        const chain = mockSupa.__getChain('candidate_paper_attempts');
        chain.__resolveWith({ error: null });

        const res = await deletePaperAttempt('att-1');

        expect(res.error).toBeNull();
        expect(chain.__calls.find((c: any) => c.method === 'delete')).toBeDefined();
        expect(chain.__calls.find((c: any) => c.method === 'eq')?.args).toEqual(['id', 'att-1']);
    });

    it('surfaces errors', async () => {
        const chain = mockSupa.__getChain('candidate_paper_attempts');
        chain.__resolveWith({ error: { message: 'permission denied' } });

        const res = await deletePaperAttempt('att-1');
        expect(res.error).toBe('permission denied');
    });
});

// ── upsertMilestone ──────────────────────────────────────────────────────

describe('upsertMilestone', () => {
    it('rejects RNF status=issued without a reference number', async () => {
        const res = await upsertMilestone('cand-1', 'rnf', { status: 'issued' }, 'user-1');
        expect(res.data).toBeNull();
        expect(res.error).toMatch(/reference number/i);
        expect(mockSupa.from).not.toHaveBeenCalled();
    });

    it('accepts RNF status=issued with a valid reference and trims it', async () => {
        const chain = mockSupa.__getChain('candidate_milestones');
        chain.__resolveWith({ data: makeRnf('issued'), error: null });

        await upsertMilestone('cand-1', 'rnf', { status: 'issued', referenceNumber: '  RNF-2026-001  ' }, 'user-1');

        const row = chain.__calls.find((c: any) => c.method === 'upsert').args[0];
        expect(row.reference_number).toBe('RNF-2026-001');
        expect(row.status).toBe('issued');
    });

    it('passes scheduled_end_date through', async () => {
        const chain = mockSupa.__getChain('candidate_milestones');
        chain.__resolveWith({ data: null, error: null });

        await upsertMilestone(
            'cand-1',
            'bes_induction',
            {
                status: 'scheduled',
                scheduledDate: '2026-05-01T02:00:00Z',
                scheduledEndDate: '2026-05-02T02:00:00Z',
            },
            'user-1',
        );

        const row = chain.__calls.find((c: any) => c.method === 'upsert').args[0];
        expect(row.scheduled_date).toBe('2026-05-01T02:00:00Z');
        expect(row.scheduled_end_date).toBe('2026-05-02T02:00:00Z');
    });
});

// ── upsertPrepCourseBooking ──────────────────────────────────────────────

describe('upsertPrepCourseBooking', () => {
    it('passes bookedEndDate through', async () => {
        const chain = mockSupa.__getChain('candidate_prep_course_bookings');
        chain.__resolveWith({ data: null, error: null });

        await upsertPrepCourseBooking(
            'cand-1',
            'M9_M9A',
            {
                bookedDate: '2026-06-01T02:00:00Z',
                bookedEndDate: '2026-06-03T02:00:00Z',
                attended: true,
            },
            'user-1',
        );

        const row = chain.__calls.find((c: any) => c.method === 'upsert').args[0];
        expect(row.booked_date).toBe('2026-06-01T02:00:00Z');
        expect(row.booked_end_date).toBe('2026-06-03T02:00:00Z');
        expect(row.attended).toBe(true);
    });
});

// ── markCandidateLicensed ────────────────────────────────────────────────

describe('markCandidateLicensed', () => {
    function seedReadyState() {
        const attemptsChain = mockSupa.__getChain('candidate_paper_attempts');
        attemptsChain.__resolveWith({
            data: [makeAttempt('M9'), makeAttempt('M9A'), makeAttempt('M5'), makeAttempt('HI')],
            error: null,
        });
        const milestonesChain = mockSupa.__getChain('candidate_milestones');
        milestonesChain.__resolveWith({ data: [makeRnf('issued')], error: null });
        return { attemptsChain, milestonesChain };
    }

    it('writes status=licensed when papers + RNF are ready', async () => {
        seedReadyState();
        const candidatesChain = mockSupa.__getChain('candidates');
        candidatesChain.__resolveWith({ error: null });

        const res = await markCandidateLicensed('cand-1');

        expect(res.error).toBeNull();
        const updateCall = candidatesChain.__calls.find((c: any) => c.method === 'update');
        expect(updateCall.args[0]).toEqual({ status: 'licensed' });
    });

    it('refuses when a paper requirement is missing', async () => {
        const attemptsChain = mockSupa.__getChain('candidate_paper_attempts');
        attemptsChain.__resolveWith({
            data: [makeAttempt('M9'), makeAttempt('M9A'), makeAttempt('M5')],
            error: null,
        });
        mockSupa.__getChain('candidate_milestones').__resolveWith({
            data: [makeRnf('issued')],
            error: null,
        });

        const res = await markCandidateLicensed('cand-1');

        expect(res.error).toMatch(/paper/i);
        expect(mockSupa.from).not.toHaveBeenCalledWith('candidates');
    });

    it('refuses when RNF is not yet issued', async () => {
        const attemptsChain = mockSupa.__getChain('candidate_paper_attempts');
        attemptsChain.__resolveWith({
            data: [makeAttempt('M9'), makeAttempt('M9A'), makeAttempt('M5'), makeAttempt('HI')],
            error: null,
        });
        mockSupa.__getChain('candidate_milestones').__resolveWith({
            data: [makeRnf('lodged_to_mas')],
            error: null,
        });

        const res = await markCandidateLicensed('cand-1');

        expect(res.error).toMatch(/rnf/i);
        expect(mockSupa.from).not.toHaveBeenCalledWith('candidates');
    });
});
