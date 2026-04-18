/**
 * Tests for hooks/useCandidateProgression.ts — per-requirement status derived
 * from the attempts-only model.
 *
 * Mirrors the business rules encoded in fn_all_papers_passed() in migration
 * 20260417100100_candidate_lifecycle_tables.sql. If these tests drift from
 * that SQL function, the client-side "licensed readiness" banner will
 * disagree with the server-side transition guard.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useCandidateProgression } from '@/hooks/useCandidateProgression';
import type {
    CandidateMilestone,
    CandidatePaperAttempt,
    CandidatePrepCourseBooking,
    MilestoneCode,
    MilestoneStatus,
    PaperCode,
} from '@/types/recruitment';

const mockFetchPaperAttempts = jest.fn();
const mockFetchMilestones = jest.fn();
const mockFetchPrepCourseBookings = jest.fn();

jest.mock('@/lib/recruitment', () => ({
    fetchPaperAttempts: (...a: unknown[]) => mockFetchPaperAttempts(...a),
    fetchMilestones: (...a: unknown[]) => mockFetchMilestones(...a),
    fetchPrepCourseBookings: (...a: unknown[]) => mockFetchPrepCourseBookings(...a),
}));

function makeAttempt(
    code: PaperCode,
    result: CandidatePaperAttempt['result'] = 'passed',
    examAt: string = '2026-04-10T02:00:00Z',
): CandidatePaperAttempt {
    return {
        id: `att-${code}-${result ?? 'sch'}-${examAt}`,
        candidate_id: 'cand-1',
        paper_code: code,
        exam_at: examAt,
        cost: 120,
        result,
        logged_by_user_id: null,
        created_at: '2026-04-01T00:00:00Z',
        updated_at: '2026-04-01T00:00:00Z',
    };
}

function makeMilestone(code: MilestoneCode, status: MilestoneStatus): CandidateMilestone {
    return {
        id: `ms-${code}`,
        candidate_id: 'cand-1',
        milestone_code: code,
        status,
        scheduled_date: null,
        scheduled_end_date: null,
        completed_date: null,
        reference_number: null,
        verified_by_user_id: null,
        note: null,
        created_at: '2026-04-01T00:00:00Z',
        updated_at: '2026-04-01T00:00:00Z',
    };
}

function setup(
    attempts: CandidatePaperAttempt[],
    milestones: CandidateMilestone[] = [],
    prepCourses: CandidatePrepCourseBooking[] = [],
) {
    mockFetchPaperAttempts.mockResolvedValue({ data: attempts, error: null });
    mockFetchMilestones.mockResolvedValue({ data: milestones, error: null });
    mockFetchPrepCourseBookings.mockResolvedValue({ data: prepCourses, error: null });
}

beforeEach(() => {
    jest.clearAllMocks();
});

describe('useCandidateProgression — paper requirements', () => {
    it('returns not_started requirements when no attempts exist', async () => {
        setup([]);
        const { result } = renderHook(() => useCandidateProgression('cand-1'));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.paperRequirements).toHaveLength(4);
        for (const r of result.current.paperRequirements) {
            expect(r.status).toBe('not_started');
            expect(r.satisfied).toBe(false);
            expect(r.attempts).toHaveLength(0);
        }
        expect(result.current.allPapersPassed).toBe(false);
    });

    it('marks all 4 requirements passed via M9/M9A/M5/HI', async () => {
        setup([makeAttempt('M9'), makeAttempt('M9A'), makeAttempt('M5'), makeAttempt('HI')]);
        const { result } = renderHook(() => useCandidateProgression('cand-1'));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.paperRequirements.every((r) => r.satisfied)).toBe(true);
        expect(result.current.allPapersPassed).toBe(true);
    });

    it('satisfies Life 1 + Life 2 simultaneously via CM_LIP', async () => {
        setup([makeAttempt('CM_LIP'), makeAttempt('M5'), makeAttempt('HI')]);
        const { result } = renderHook(() => useCandidateProgression('cand-1'));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        const life1 = result.current.paperRequirements.find((r) => r.code === 'life_1');
        const life2 = result.current.paperRequirements.find((r) => r.code === 'life_2');
        expect(life1?.satisfied).toBe(true);
        expect(life2?.satisfied).toBe(true);
        expect(life1?.passedAttempt?.paper_code).toBe('CM_LIP');
        expect(life2?.passedAttempt?.paper_code).toBe('CM_LIP');
        expect(result.current.allPapersPassed).toBe(true);
    });

    it('reports status=failed when latest attempt failed and nothing passed', async () => {
        setup([makeAttempt('M9', 'failed')]);
        const { result } = renderHook(() => useCandidateProgression('cand-1'));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        const life1 = result.current.paperRequirements.find((r) => r.code === 'life_1');
        expect(life1?.status).toBe('failed');
        expect(life1?.satisfied).toBe(false);
    });

    it('reports status=scheduled when latest attempt has null result', async () => {
        setup([makeAttempt('M5', null, '2026-06-15T02:00:00Z')]);
        const { result } = renderHook(() => useCandidateProgression('cand-1'));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        const rulesEthics = result.current.paperRequirements.find((r) => r.code === 'rules_ethics');
        expect(rulesEthics?.status).toBe('scheduled');
        expect(rulesEthics?.latest?.paper_code).toBe('M5');
    });

    it('treats any prior passed attempt as "passed" even after later failed attempts', async () => {
        setup([
            // Newer failed attempt
            makeAttempt('M9', 'failed', '2026-05-20T02:00:00Z'),
            // Older passed attempt
            { ...makeAttempt('M9', 'passed', '2026-05-01T02:00:00Z'), id: 'att-old' },
        ]);
        const { result } = renderHook(() => useCandidateProgression('cand-1'));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        const life1 = result.current.paperRequirements.find((r) => r.code === 'life_1');
        expect(life1?.status).toBe('passed');
        expect(life1?.satisfied).toBe(true);
    });

    it('reports rnfIssued only when rnf milestone status is "issued"', async () => {
        setup([], [makeMilestone('rnf', 'lodged_to_mas')]);
        const { result, rerender } = renderHook(({ id }: { id: string }) => useCandidateProgression(id), {
            initialProps: { id: 'cand-1' },
        });
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.rnfIssued).toBe(false);

        setup([], [makeMilestone('rnf', 'issued')]);
        await act(async () => {
            await result.current.refresh();
        });
        expect(result.current.rnfIssued).toBe(true);
    });

    it('exposes a milestoneByCode record with nulls for missing codes', async () => {
        setup([], [makeMilestone('bes_induction', 'completed')]);
        const { result } = renderHook(() => useCandidateProgression('cand-1'));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.milestoneByCode.bes_induction?.status).toBe('completed');
        expect(result.current.milestoneByCode.soar).toBeNull();
        expect(result.current.milestoneByCode.rnf).toBeNull();
        expect(result.current.milestoneByCode.sales_authority).toBeNull();
    });
});
