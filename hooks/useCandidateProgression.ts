import { fetchMilestones, fetchPaperAttempts, fetchPrepCourseBookings } from '@/lib/recruitment';
import type {
    CandidateMilestone,
    CandidatePaperAttempt,
    CandidatePrepCourseBooking,
    MilestoneCode,
    PaperCode,
    PaperRequirement,
    PaperRequirementCode,
    PaperRequirementStatus,
    PrepCourseCode,
} from '@/types/recruitment';
import { useCallback, useEffect, useMemo, useState } from 'react';

// Preference order per requirement. Listing M9/M9A first means the UI defaults
// to them; candidates can still opt into CM_LIP to collapse Life 1 + Life 2
// into one sitting. Must match fn_all_papers_passed in migration 20260417100100.
const REQUIREMENT_DEFS: {
    code: PaperRequirementCode;
    label: string;
    acceptedPaperCodes: PaperCode[];
}[] = [
    { code: 'life_1', label: 'Life Insurance 1', acceptedPaperCodes: ['M9', 'CM_LIP'] },
    { code: 'life_2', label: 'Life Insurance 2', acceptedPaperCodes: ['M9A', 'CM_LIP'] },
    { code: 'rules_ethics', label: 'Rules & Ethics', acceptedPaperCodes: ['M5', 'RES5'] },
    { code: 'health_insurance', label: 'Health Insurance', acceptedPaperCodes: ['HI'] },
];

/**
 * Derive the status of one paper requirement from the candidate's attempts.
 *
 *   - passed      → any attempt for an accepted code has result='passed'
 *   - failed      → no passed, latest attempt has result='failed'
 *   - scheduled   → no passed, latest has result=null and exam_at in the future
 *   - not_started → no attempts at all
 */
function resolveRequirement(
    def: (typeof REQUIREMENT_DEFS)[number],
    allAttempts: CandidatePaperAttempt[],
): PaperRequirement {
    const acceptedCodes = new Set<PaperCode>(def.acceptedPaperCodes);
    // Newest first (matches fetchPaperAttempts ordering).
    const attempts = allAttempts.filter((a) => acceptedCodes.has(a.paper_code));
    const latest = attempts[0] ?? null;
    const passedAttempt = attempts.find((a) => a.result === 'passed') ?? null;

    let status: PaperRequirementStatus;
    if (passedAttempt) {
        status = 'passed';
    } else if (!latest) {
        status = 'not_started';
    } else if (latest.result === 'failed') {
        status = 'failed';
    } else {
        // result = null → scheduled (whether exam_at is past or future; the UI
        // can highlight overdue sittings separately if needed).
        status = 'scheduled';
    }

    return {
        code: def.code,
        label: def.label,
        acceptedPaperCodes: def.acceptedPaperCodes,
        attempts,
        latest,
        passedAttempt,
        status,
        satisfied: passedAttempt !== null,
    };
}

export interface UseCandidateProgressionResult {
    paperAttempts: CandidatePaperAttempt[];
    milestones: CandidateMilestone[];
    prepCourses: CandidatePrepCourseBooking[];
    paperRequirements: PaperRequirement[];
    milestoneByCode: Record<MilestoneCode, CandidateMilestone | null>;
    prepCourseByCode: Record<PrepCourseCode, CandidatePrepCourseBooking | null>;
    allPapersPassed: boolean;
    rnfIssued: boolean;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

export function useCandidateProgression(candidateId: string | undefined): UseCandidateProgressionResult {
    const [paperAttempts, setPaperAttempts] = useState<CandidatePaperAttempt[]>([]);
    const [milestones, setMilestones] = useState<CandidateMilestone[]>([]);
    const [prepCourses, setPrepCourses] = useState<CandidatePrepCourseBooking[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!candidateId) return;
        setError(null);
        const [attemptsResult, milestonesResult, prepResult] = await Promise.all([
            fetchPaperAttempts(candidateId),
            fetchMilestones(candidateId),
            fetchPrepCourseBookings(candidateId),
        ]);
        const firstError = attemptsResult.error || milestonesResult.error || prepResult.error;
        if (firstError) setError(firstError);
        setPaperAttempts(attemptsResult.data);
        setMilestones(milestonesResult.data);
        setPrepCourses(prepResult.data);
        setIsLoading(false);
    }, [candidateId]);

    useEffect(() => {
        if (!candidateId) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        refresh();
    }, [candidateId, refresh]);

    const paperRequirements = useMemo(
        () => REQUIREMENT_DEFS.map((def) => resolveRequirement(def, paperAttempts)),
        [paperAttempts],
    );

    // Mirrors fn_all_papers_passed(c) from the migration. Both must agree.
    const allPapersPassed = useMemo(() => paperRequirements.every((r) => r.satisfied), [paperRequirements]);

    const milestoneByCode = useMemo<Record<MilestoneCode, CandidateMilestone | null>>(() => {
        const base: Record<MilestoneCode, CandidateMilestone | null> = {
            bdm: null,
            bes_induction: null,
            soar: null,
            rnf: null,
            sales_authority: null,
        };
        for (const m of milestones) base[m.milestone_code] = m;
        return base;
    }, [milestones]);

    const rnfIssued = milestoneByCode.rnf?.status === 'issued';

    const prepCourseByCode = useMemo<Record<PrepCourseCode, CandidatePrepCourseBooking | null>>(() => {
        const base: Record<PrepCourseCode, CandidatePrepCourseBooking | null> = {
            M9_M9A: null,
            RES5: null,
            HI: null,
        };
        for (const b of prepCourses) base[b.course_code] = b;
        return base;
    }, [prepCourses]);

    return {
        paperAttempts,
        milestones,
        prepCourses,
        paperRequirements,
        milestoneByCode,
        prepCourseByCode,
        allPapersPassed,
        rnfIssued,
        isLoading,
        error,
        refresh,
    };
}
