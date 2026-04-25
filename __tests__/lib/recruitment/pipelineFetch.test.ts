/**
 * Tests for lib/recruitment/pipelineFetch.ts — bulk snapshot fetcher.
 *
 * Strategy: mock the four fetchers it composes (`fetchCandidates` from
 * `./candidates`, plus the three bulk fetchers from `./progression`). We don't
 * re-test the underlying Supabase wiring here — those modules have their own
 * tests. We DO test that:
 *   - candidate-fetch errors short-circuit (no bulk follow-up calls)
 *   - rows are grouped correctly per candidate (the Map-of-arrays grouping)
 *   - urgency counts are tallied
 *   - a partial fetch error from any of the three bulk calls surfaces
 *   - the empty-id case still returns a sane snapshot
 */
import { fetchPipelineSnapshot } from '@/lib/recruitment/pipelineFetch';
import { fetchCandidates } from '@/lib/recruitment/candidates';
import {
    fetchActivitiesForCandidates,
    fetchMilestonesForCandidates,
    fetchPaperAttemptsForCandidates,
} from '@/lib/recruitment/progression';
import type {
    CandidateActivity,
    CandidateMilestone,
    CandidatePaperAttempt,
    RecruitmentCandidate,
} from '@/types/recruitment';

jest.mock('@/lib/supabase');
jest.mock('@/lib/recruitment/candidates');
jest.mock('@/lib/recruitment/progression');

const mockFetchCandidates = fetchCandidates as jest.MockedFunction<typeof fetchCandidates>;
const mockFetchAttempts = fetchPaperAttemptsForCandidates as jest.MockedFunction<
    typeof fetchPaperAttemptsForCandidates
>;
const mockFetchMilestones = fetchMilestonesForCandidates as jest.MockedFunction<typeof fetchMilestonesForCandidates>;
const mockFetchActivities = fetchActivitiesForCandidates as jest.MockedFunction<typeof fetchActivitiesForCandidates>;

function makeCandidate(overrides: Partial<RecruitmentCandidate> = {}): RecruitmentCandidate {
    return {
        id: 'cand-1',
        name: 'Sarah Rahman',
        phone: '+6591234567',
        email: 'sarah@example.com',
        status: 'exam_prep',
        notes: null,
        rejected_at: null,
        rejection_reason: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-04-01T00:00:00Z',
        invitation: null,
        invitation_id: null,
        invited_by_user_id: null,
        invited_by: null,
        manager_id: 'mgr-1',
        manager: null,
        recruiter_id: null,
        recruiter: null,
        profile_completion_pct: 50,
        disc_results: null,
        documents: [],
        interviews: [],
        activities: [],
        profile_details: null,
        ...overrides,
    } as unknown as RecruitmentCandidate;
}

function makeAttempt(candidateId: string, code: CandidatePaperAttempt['paper_code'] = 'M9'): CandidatePaperAttempt {
    return {
        id: `att-${candidateId}-${code}`,
        candidate_id: candidateId,
        paper_code: code,
        exam_at: null,
        cost: null,
        result: null,
        logged_by_user_id: null,
        created_at: '2026-04-01T00:00:00Z',
        updated_at: '2026-04-01T00:00:00Z',
    };
}

function makeMilestone(candidateId: string): CandidateMilestone {
    return {
        id: `ms-${candidateId}`,
        candidate_id: candidateId,
        milestone_code: 'rnf',
        status: 'not_started',
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

function makeActivity(candidateId: string): CandidateActivity {
    return {
        id: `act-${candidateId}`,
        candidate_id: candidateId,
        activity_type: 'note',
        outcome: null,
        notes: 'follow up',
        scheduled_at: null,
        completed_at: '2026-04-20T10:00:00Z',
        created_by_user_id: null,
        created_at: '2026-04-20T10:00:00Z',
        updated_at: '2026-04-20T10:00:00Z',
    } as unknown as CandidateActivity;
}

beforeEach(() => {
    jest.clearAllMocks();
    mockFetchAttempts.mockResolvedValue({ data: [], error: null });
    mockFetchMilestones.mockResolvedValue({ data: [], error: null });
    mockFetchActivities.mockResolvedValue({ data: [], error: null });
});

describe('fetchPipelineSnapshot', () => {
    it('short-circuits with a zeroed snapshot when fetchCandidates errors', async () => {
        mockFetchCandidates.mockResolvedValue({ data: [], error: 'RLS denied' });

        const snap = await fetchPipelineSnapshot('user-1', false);

        expect(snap.error).toBe('RLS denied');
        expect(snap.rows).toEqual([]);
        expect(snap.counts).toEqual({
            'at-risk': 0,
            'this-week': 0,
            ready: 0,
            'on-track': 0,
            hidden: 0,
        });
        // Bulk fetchers must NOT run if the candidate query failed — wasted roundtrips.
        expect(mockFetchAttempts).not.toHaveBeenCalled();
        expect(mockFetchMilestones).not.toHaveBeenCalled();
        expect(mockFetchActivities).not.toHaveBeenCalled();
    });

    it('returns a sane empty snapshot when there are no candidates', async () => {
        mockFetchCandidates.mockResolvedValue({ data: [], error: null });

        const snap = await fetchPipelineSnapshot('user-1', true);

        expect(snap.error).toBeNull();
        expect(snap.rows).toEqual([]);
        expect(Object.values(snap.counts).every((n) => n === 0)).toBe(true);
        // Bulk fetchers still run with an empty id list — they short-circuit themselves.
        expect(mockFetchAttempts).toHaveBeenCalledWith([]);
        expect(mockFetchMilestones).toHaveBeenCalledWith([]);
        expect(mockFetchActivities).toHaveBeenCalledWith([], 60);
    });

    it('groups bulk results by candidate_id and computes a NextStep per candidate', async () => {
        const candA = makeCandidate({ id: 'cand-A', name: 'Alex' });
        const candB = makeCandidate({ id: 'cand-B', name: 'Bea', status: 'pre_licensed' });
        mockFetchCandidates.mockResolvedValue({ data: [candA, candB], error: null });
        mockFetchAttempts.mockResolvedValue({
            data: [makeAttempt('cand-A', 'M9'), makeAttempt('cand-A', 'M5'), makeAttempt('cand-B', 'M9A')],
            error: null,
        });
        mockFetchMilestones.mockResolvedValue({ data: [makeMilestone('cand-B')], error: null });
        mockFetchActivities.mockResolvedValue({ data: [makeActivity('cand-A')], error: null });

        const snap = await fetchPipelineSnapshot('user-1', true);

        expect(snap.error).toBeNull();
        expect(snap.rows).toHaveLength(2);
        expect(snap.rows[0].candidate.id).toBe('cand-A');
        expect(snap.rows[1].candidate.id).toBe('cand-B');
        // Each row carries a fully-shaped NextStep (from computeNextStep).
        expect(snap.rows[0].nextStep).toEqual(
            expect.objectContaining({ urgency: expect.any(String), text: expect.any(String) }),
        );
        // counts must equal the per-row urgency tallies.
        const tallied =
            snap.counts['at-risk'] +
            snap.counts['this-week'] +
            snap.counts.ready +
            snap.counts['on-track'] +
            snap.counts.hidden;
        expect(tallied).toBe(2);

        // The bulk fetchers were called with the candidate ids in order.
        expect(mockFetchAttempts).toHaveBeenCalledWith(['cand-A', 'cand-B']);
        expect(mockFetchMilestones).toHaveBeenCalledWith(['cand-A', 'cand-B']);
        expect(mockFetchActivities).toHaveBeenCalledWith(['cand-A', 'cand-B'], 60);
    });

    it('surfaces a partial error from the bulk fetchers without dropping the snapshot', async () => {
        const cand = makeCandidate({ id: 'cand-1' });
        mockFetchCandidates.mockResolvedValue({ data: [cand], error: null });
        mockFetchAttempts.mockResolvedValue({ data: [], error: null });
        mockFetchMilestones.mockResolvedValue({ data: [], error: 'milestones table timed out' });
        mockFetchActivities.mockResolvedValue({ data: [], error: null });

        const snap = await fetchPipelineSnapshot('user-1', false);

        expect(snap.error).toBe('milestones table timed out');
        // Snapshot is still populated even when one bulk source partially failed.
        expect(snap.rows).toHaveLength(1);
    });

    it('reports the FIRST non-null bulk error (attempts > milestones > activities) so partial UIs stay deterministic', async () => {
        mockFetchCandidates.mockResolvedValue({ data: [makeCandidate()], error: null });
        mockFetchAttempts.mockResolvedValue({ data: [], error: 'attempts failed' });
        mockFetchMilestones.mockResolvedValue({ data: [], error: 'milestones also failed' });
        mockFetchActivities.mockResolvedValue({ data: [], error: 'activities also failed' });

        const snap = await fetchPipelineSnapshot('user-1', true);

        expect(snap.error).toBe('attempts failed');
    });

    it('passes the now param through to computeNextStep when provided', async () => {
        const cand = makeCandidate({ id: 'cand-1', updated_at: '2025-01-01T00:00:00Z' });
        mockFetchCandidates.mockResolvedValue({ data: [cand], error: null });

        // With a fixed `now`, the computed NextStep is stable — exercise the param path.
        const snap = await fetchPipelineSnapshot('user-1', false, new Date('2026-04-23T09:00:00Z'));

        expect(snap.rows).toHaveLength(1);
        expect(snap.rows[0].nextStep).toBeDefined();
    });
});
