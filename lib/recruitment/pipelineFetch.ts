/**
 * Pipeline snapshot fetcher — one-shot bulk fetch that powers the
 * Monday-morning pipeline view. Kept separate from `pipeline.ts` so the
 * pure logic there stays importable by unit tests without pulling in the
 * Supabase client.
 */
import type {
    CandidateActivity,
    CandidateMilestone,
    CandidatePaperAttempt,
    RecruitmentCandidate,
} from '@/types/recruitment';
import { fetchCandidates } from './candidates';
import { buildPaperRequirements, computeNextStep, type NextStep, type Urgency } from './pipeline';
import {
    fetchActivitiesForCandidates,
    fetchMilestonesForCandidates,
    fetchPaperAttemptsForCandidates,
} from './progression';

export interface PipelineSnapshot {
    /** Candidates with their computed next-step attached. Caller applies sort. */
    rows: { candidate: RecruitmentCandidate; nextStep: NextStep }[];
    /** Count per urgency group. */
    counts: Record<Urgency, number>;
    /** Raw error message if fetch failed partially. */
    error: string | null;
}

/**
 * One-shot fetcher: pulls candidates + their milestones + paper attempts in 3
 * parallel queries, then computes computeNextStep per candidate. Safe to call
 * for 30+ candidates — no N+1.
 *
 * Note: does not fetch activities yet (computeNextStep treats them as
 * optional; the stalled check uses candidate.updated_at as a proxy). Add
 * activity fetching later if we tighten the stalled rule.
 */
export async function fetchPipelineSnapshot(
    userId: string,
    isManagerView: boolean,
    now: Date = new Date(),
): Promise<PipelineSnapshot> {
    const emptyCounts: Record<Urgency, number> = {
        'at-risk': 0,
        'this-week': 0,
        ready: 0,
        'on-track': 0,
        hidden: 0,
    };

    const { data: candidates, error: candError } = await fetchCandidates(userId, isManagerView);
    if (candError) {
        return { rows: [], counts: emptyCounts, error: candError };
    }

    const ids = candidates.map((c) => c.id);
    const [attemptsResult, milestonesResult, activitiesResult] = await Promise.all([
        fetchPaperAttemptsForCandidates(ids),
        fetchMilestonesForCandidates(ids),
        fetchActivitiesForCandidates(ids, 60),
    ]);
    const error = attemptsResult.error || milestonesResult.error || activitiesResult.error;

    // Group bulk results by candidate_id for O(1) lookup.
    const attemptsById = new Map<string, CandidatePaperAttempt[]>();
    for (const a of attemptsResult.data) {
        const existing = attemptsById.get(a.candidate_id) ?? [];
        existing.push(a);
        attemptsById.set(a.candidate_id, existing);
    }
    const milestonesById = new Map<string, CandidateMilestone[]>();
    for (const m of milestonesResult.data) {
        const existing = milestonesById.get(m.candidate_id) ?? [];
        existing.push(m);
        milestonesById.set(m.candidate_id, existing);
    }
    const activitiesById = new Map<string, CandidateActivity[]>();
    for (const a of activitiesResult.data) {
        const existing = activitiesById.get(a.candidate_id) ?? [];
        existing.push(a);
        activitiesById.set(a.candidate_id, existing);
    }

    const rows = candidates.map((candidate) => {
        const attempts = attemptsById.get(candidate.id) ?? [];
        const milestones = milestonesById.get(candidate.id) ?? [];
        const activities = activitiesById.get(candidate.id) ?? [];
        const paperRequirements = buildPaperRequirements(attempts);
        const nextStep = computeNextStep({
            candidate,
            milestones,
            attempts,
            interviews: candidate.interviews ?? [],
            activities,
            paperRequirements,
            now,
        });
        return { candidate, nextStep };
    });

    const counts: Record<Urgency, number> = { ...emptyCounts };
    for (const r of rows) counts[r.nextStep.urgency]++;

    return { rows, counts, error };
}
