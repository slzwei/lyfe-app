/**
 * Candidate pipeline — urgency + next-step computation.
 *
 * Given a candidate + their progression snapshot + recent activity, returns
 * a single "what to do next" directive, classified by urgency. Pure function,
 * no side effects — easy to unit test, easy to memoize, safe to call per row.
 *
 * Design note: signals are all derived from data the SYSTEM already tracks
 * (status, milestones, paper attempts, interviews, activities). Nothing in
 * here requires the manager to remember to log something. Lost-candidate
 * prevention shouldn't depend on perfect logging hygiene that doesn't happen.
 */
import type {
    CandidateActivity,
    CandidateMilestone,
    CandidatePaperAttempt,
    CandidateStatus,
    Interview,
    MilestoneCode,
    PaperCode,
    PaperRequirement,
    PaperRequirementCode,
    PaperRequirementStatus,
    RecruitmentCandidate,
} from '@/types/recruitment';

// ── Public types ────────────────────────────────────────────────

export type Urgency = 'at-risk' | 'this-week' | 'ready' | 'on-track' | 'hidden';

export interface NextStep {
    urgency: Urgency;
    /** User-facing action text, e.g. "Schedule BDM interview". */
    text: string;
    /** Small time/signal chip, e.g. "stuck 14d" or "Thu 2pm". Null when not useful. */
    signal: string | null;
    /** Optional action hint — which primary action the UI should suggest. */
    actionHint?: 'call' | 'message' | 'schedule' | 'book' | 'register' | 'file' | 'chase' | null;
}

export interface PipelineInput {
    candidate: RecruitmentCandidate;
    milestones: CandidateMilestone[];
    attempts: CandidatePaperAttempt[];
    interviews: Interview[];
    activities: CandidateActivity[];
    /** Pre-computed paper requirements (from useCandidateProgression). */
    paperRequirements: PaperRequirement[];
    /** Optional "now" override for testing. Defaults to new Date(). */
    now?: Date;
}

// ── Thresholds (tune here; do not scatter numbers through the logic) ──

export const THRESHOLDS = {
    /** How long onboarding can sit incomplete before we flag it. */
    ONBOARDING_STALE_DAYS: 5,
    /** How long after a failed paper without a re-sit before we nag. */
    PAPER_FAILURE_UNBOOKED_DAYS: 7,
    /** How long at current status without any scheduled event before we flag. */
    STALLED_NO_SCHEDULE_DAYS: 14,
    /** How far out counts as "this week" for upcoming events. */
    THIS_WEEK_DAYS: 5,
    /** Days past a scheduled event date before we consider it missed/unrecorded. */
    MISSED_EVENT_GRACE_DAYS: 1,
} as const;

// ── Main function ──────────────────────────────────────────────

export function computeNextStep(input: PipelineInput): NextStep {
    const { candidate, milestones, attempts, interviews, paperRequirements } = input;
    const now = input.now ?? new Date();

    // 0. Hidden candidates (rejected / on_hold) — excluded from pipeline views.
    if (candidate.status === 'rejected') {
        return { urgency: 'hidden', text: 'Rejected', signal: null };
    }
    if (candidate.status === 'on_hold') {
        return { urgency: 'hidden', text: 'On hold', signal: null };
    }

    // 1. AT RISK — onboarding stalled
    const onboardingStale = checkOnboardingStalled(candidate, now);
    if (onboardingStale) return onboardingStale;

    // 2. AT RISK — paper failed, no re-sit booked
    const paperFollowup = checkFailedPaperUnbooked(paperRequirements, now);
    if (paperFollowup) return paperFollowup;

    // 3. AT RISK — missed scheduled event (exam passed without a result, interview past due, etc.)
    const missed = checkMissedScheduledEvent(interviews, milestones, attempts, now);
    if (missed) return missed;

    // 4. READY TO ADVANCE — gate passed, manager action needed
    const ready = checkReadyToAdvance(candidate, paperRequirements, milestones);
    if (ready) return ready;

    // 5. THIS WEEK — scheduled event within next N days
    const thisWeek = checkUpcomingScheduled(interviews, milestones, attempts, now);
    if (thisWeek) return thisWeek;

    // 6. AT RISK — stalled, no schedule, no recent activity
    const stalled = checkStalled(candidate, interviews, milestones, attempts, input.activities, now);
    if (stalled) return stalled;

    // 7. ON TRACK — default
    return {
        urgency: 'on-track',
        text: onTrackText(candidate.status),
        signal: null,
    };
}

// ── At-risk checks ─────────────────────────────────────────────

function checkOnboardingStalled(c: RecruitmentCandidate, now: Date): NextStep | null {
    // Candidate was invited (status='applied') and has not yet completed profile.
    if (c.status !== 'applied') return null;
    const profileComplete = c.profile_details?.completed === true;
    if (profileComplete) return null;
    const days = daysSince(c.created_at, now);
    if (days < THRESHOLDS.ONBOARDING_STALE_DAYS) return null;

    return {
        urgency: 'at-risk',
        text: 'Onboarding incomplete — chase profile',
        signal: `invited ${formatDaysShort(days)}`,
        actionHint: 'chase',
    };
}

function checkFailedPaperUnbooked(reqs: PaperRequirement[], now: Date): NextStep | null {
    // For each requirement that has a recent failure, check if a re-sit is booked.
    for (const req of reqs) {
        if (req.satisfied) continue;
        const latest = req.latest;
        if (!latest || latest.result !== 'failed') continue;
        if (!latest.exam_at) continue;

        const daysSinceFailed = daysSince(latest.exam_at, now);
        if (daysSinceFailed < THRESHOLDS.PAPER_FAILURE_UNBOOKED_DAYS) continue;

        // Is there a newer attempt scheduled or passed?
        const hasFollowup = req.attempts.some(
            (a) =>
                a.id !== latest.id &&
                new Date(a.created_at) > new Date(latest.created_at) &&
                (a.result === 'passed' || (a.exam_at && new Date(a.exam_at) > now)),
        );
        if (hasFollowup) continue;

        return {
            urgency: 'at-risk',
            text: `Re-book ${req.label} — failed ${formatDaysShort(daysSinceFailed)} ago`,
            signal: `failed ${formatDaysShort(daysSinceFailed)}`,
            actionHint: 'book',
        };
    }
    return null;
}

function checkMissedScheduledEvent(
    interviews: Interview[],
    milestones: CandidateMilestone[],
    attempts: CandidatePaperAttempt[],
    now: Date,
): NextStep | null {
    const grace = THRESHOLDS.MISSED_EVENT_GRACE_DAYS;
    const cutoff = addDays(now, -grace);

    // Missed interview — scheduled before (now - grace) and still status='scheduled'.
    const missedInterview = interviews
        .filter((i) => i.status === 'scheduled' && new Date(i.datetime) < cutoff)
        .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime())[0];
    if (missedInterview) {
        return {
            urgency: 'at-risk',
            text: `Log ${ordinal(missedInterview.round_number)} interview outcome — past due`,
            signal: `due ${formatDaysShort(daysSince(missedInterview.datetime, now))} ago`,
            actionHint: 'chase',
        };
    }

    // Missed milestone — scheduled_date past, still 'scheduled'.
    const missedMilestone = milestones
        .filter((m) => m.status === 'scheduled' && m.scheduled_date != null && new Date(m.scheduled_date) < cutoff)
        .sort((a, b) => new Date(b.scheduled_date!).getTime() - new Date(a.scheduled_date!).getTime())[0];
    if (missedMilestone) {
        return {
            urgency: 'at-risk',
            text: `Confirm ${milestoneLabel(missedMilestone.milestone_code)} — past due`,
            signal: `due ${formatDaysShort(daysSince(missedMilestone.scheduled_date!, now))} ago`,
            actionHint: 'chase',
        };
    }

    // Missed paper attempt — exam_at past, result still null.
    const missedAttempt = attempts
        .filter((a) => a.result === null && a.exam_at != null && new Date(a.exam_at) < cutoff)
        .sort((a, b) => new Date(b.exam_at!).getTime() - new Date(a.exam_at!).getTime())[0];
    if (missedAttempt) {
        return {
            urgency: 'at-risk',
            text: `Log ${missedAttempt.paper_code} result — exam was ${formatDaysShort(daysSince(missedAttempt.exam_at!, now))} ago`,
            signal: `result overdue`,
            actionHint: 'chase',
        };
    }

    return null;
}

// ── Ready-to-advance checks ────────────────────────────────────

function checkReadyToAdvance(
    c: RecruitmentCandidate,
    reqs: PaperRequirement[],
    milestones: CandidateMilestone[],
): NextStep | null {
    const allPapersPassed = reqs.length > 0 && reqs.every((r) => r.satisfied);
    const byCode = milestonesByCode(milestones);

    // After eapp_done / approved / exam_prep and all papers passed, and no BDM yet → Schedule BDM
    if (
        allPapersPassed &&
        !isMilestoneStarted(byCode.bdm) &&
        (c.status === 'exam_prep' || c.status === 'approved' || c.status === 'eapp_done')
    ) {
        return {
            urgency: 'ready',
            text: 'Schedule BDM interview',
            signal: 'all papers passed',
            actionHint: 'schedule',
        };
    }

    // BDM completed, no BES yet → Register for BES
    if (isMilestoneDone(byCode.bdm) && !isMilestoneStarted(byCode.bes_induction)) {
        return {
            urgency: 'ready',
            text: 'Register for BES induction',
            signal: 'BDM done',
            actionHint: 'register',
        };
    }

    // BES completed, no SOAR yet → Register for SOAR
    if (isMilestoneDone(byCode.bes_induction) && !isMilestoneStarted(byCode.soar)) {
        return {
            urgency: 'ready',
            text: 'Register for SOAR',
            signal: 'BES done',
            actionHint: 'register',
        };
    }

    // SOAR completed, no RNF yet → File RNF
    if (isMilestoneDone(byCode.soar) && !isMilestoneLodged(byCode.rnf)) {
        return {
            urgency: 'ready',
            text: 'File RNF with MAS',
            signal: 'SOAR done',
            actionHint: 'file',
        };
    }

    // RNF issued, no sales_authority yet → Confirm sales authority
    if (byCode.rnf?.status === 'issued' && !isMilestoneDone(byCode.sales_authority) && c.status !== 'active_agent') {
        return {
            urgency: 'ready',
            text: 'Activate as agent — RNF issued',
            signal: 'license-ready',
            actionHint: 'file',
        };
    }

    return null;
}

// ── This-week check ─────────────────────────────────────────────

function checkUpcomingScheduled(
    interviews: Interview[],
    milestones: CandidateMilestone[],
    attempts: CandidatePaperAttempt[],
    now: Date,
): NextStep | null {
    const horizon = addDays(now, THRESHOLDS.THIS_WEEK_DAYS);

    type Evt = { at: Date; text: string; signal: string; actionHint: NextStep['actionHint'] };
    const upcoming: Evt[] = [];

    // Interviews
    for (const i of interviews) {
        if (i.status !== 'scheduled') continue;
        const at = new Date(i.datetime);
        if (at < now || at > horizon) continue;
        upcoming.push({
            at,
            text: `${ordinal(i.round_number)} interview ${formatShortDate(at, now)}`,
            signal: formatInSignal(at, now),
            actionHint: 'schedule',
        });
    }

    // Milestones (BDM / BES / SOAR etc.)
    for (const m of milestones) {
        if (m.status !== 'scheduled' || !m.scheduled_date) continue;
        const at = new Date(m.scheduled_date);
        if (at < now || at > horizon) continue;
        upcoming.push({
            at,
            text: `${milestoneLabel(m.milestone_code)} ${formatShortDate(at, now)}`,
            signal: formatInSignal(at, now),
            actionHint: 'schedule',
        });
    }

    // Paper attempts
    for (const a of attempts) {
        if (a.result !== null || !a.exam_at) continue;
        const at = new Date(a.exam_at);
        if (at < now || at > horizon) continue;
        upcoming.push({
            at,
            text: `${a.paper_code} exam ${formatShortDate(at, now)}`,
            signal: formatInSignal(at, now),
            actionHint: 'schedule',
        });
    }

    if (upcoming.length === 0) return null;

    // Pick the soonest.
    upcoming.sort((a, b) => a.at.getTime() - b.at.getTime());
    const next = upcoming[0];
    return {
        urgency: 'this-week',
        text: next.text,
        signal: next.signal,
        actionHint: next.actionHint,
    };
}

// ── Stalled check (last-resort at-risk) ────────────────────────

function checkStalled(
    c: RecruitmentCandidate,
    interviews: Interview[],
    milestones: CandidateMilestone[],
    attempts: CandidatePaperAttempt[],
    activities: CandidateActivity[],
    now: Date,
): NextStep | null {
    // "Stalled" = candidate hasn't moved in ages AND has nothing on the calendar.
    // Any future event (scheduled interview/milestone/exam) exempts them.
    const hasFutureEvent =
        interviews.some((i) => i.status === 'scheduled' && new Date(i.datetime) > now) ||
        milestones.some((m) => m.status === 'scheduled' && m.scheduled_date && new Date(m.scheduled_date) > now) ||
        attempts.some((a) => a.result === null && a.exam_at && new Date(a.exam_at) > now);

    if (hasFutureEvent) return null;

    // Prefer the real signal — most recent manager→candidate activity (call / whatsapp /
    // note). If no activities are available (either not fetched or never logged), fall
    // back to candidate.updated_at as a coarse proxy. The fallback is noisier but
    // still catches most stalls.
    const latestActivityIso = activities.length > 0 ? activities[0].created_at : null;
    const staleSinceIso = latestActivityIso ?? c.updated_at;
    const days = daysSince(staleSinceIso, now);
    if (days < THRESHOLDS.STALLED_NO_SCHEDULE_DAYS) return null;

    return {
        urgency: 'at-risk',
        text: `Stalled at ${statusLabel(c.status)} — ${formatDaysShort(days)}, no events scheduled`,
        signal: `stuck ${formatDaysShort(days)}`,
        actionHint: 'chase',
    };
}

// ── Helpers ─────────────────────────────────────────────────────

function milestonesByCode(ms: CandidateMilestone[]): Partial<Record<MilestoneCode, CandidateMilestone>> {
    const out: Partial<Record<MilestoneCode, CandidateMilestone>> = {};
    for (const m of ms) out[m.milestone_code] = m;
    return out;
}

function isMilestoneStarted(m: CandidateMilestone | undefined): boolean {
    if (!m) return false;
    return m.status !== 'not_started';
}

function isMilestoneDone(m: CandidateMilestone | undefined): boolean {
    if (!m) return false;
    return m.status === 'completed' || m.status === 'issued' || m.status === 'lodged_to_mas';
}

function isMilestoneLodged(m: CandidateMilestone | undefined): boolean {
    if (!m) return false;
    return m.status === 'lodged_to_mas' || m.status === 'issued';
}

function daysSince(iso: string, now: Date): number {
    const then = new Date(iso).getTime();
    const diffMs = now.getTime() - then;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function addDays(d: Date, n: number): Date {
    const out = new Date(d);
    out.setDate(out.getDate() + n);
    return out;
}

function formatDaysShort(n: number): string {
    if (n <= 0) return 'today';
    if (n === 1) return '1d';
    if (n < 7) return `${n}d`;
    if (n < 30) return `${Math.round(n / 7)}w`;
    return `${Math.round(n / 30)}mo`;
}

function formatInSignal(at: Date, now: Date): string {
    const hoursDiff = Math.round((at.getTime() - now.getTime()) / (1000 * 60 * 60));
    if (hoursDiff < 1) return 'now';
    if (hoursDiff < 24) return `in ${hoursDiff}h`;
    const d = Math.round(hoursDiff / 24);
    return d === 1 ? 'tomorrow' : `in ${d}d`;
}

function formatShortDate(at: Date, now: Date): string {
    const sameDay =
        at.getFullYear() === now.getFullYear() && at.getMonth() === now.getMonth() && at.getDate() === now.getDate();
    if (sameDay) {
        return at.toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit' });
    }
    return at.toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' });
}

function ordinal(n: number): string {
    if (n === 1) return '1st';
    if (n === 2) return '2nd';
    if (n === 3) return '3rd';
    return `${n}th`;
}

function milestoneLabel(code: MilestoneCode): string {
    switch (code) {
        case 'bdm':
            return 'BDM interview';
        case 'bes_induction':
            return 'BES induction';
        case 'soar':
            return 'SOAR';
        case 'rnf':
            return 'RNF application';
        case 'sales_authority':
            return 'sales authority';
    }
}

function statusLabel(s: CandidateStatus): string {
    switch (s) {
        case 'applied':
            return 'onboarding';
        case 'interview_scheduled':
            return 'interview';
        case 'interviewed':
            return 'post-interview';
        case 'eapp_done':
            return 'eApp';
        case 'approved':
            return 'approved';
        case 'exam_prep':
            return 'exam prep';
        case 'licensed':
            return 'licensed';
        case 'active_agent':
            return 'active agent';
        case 'on_hold':
            return 'on hold';
        case 'rejected':
            return 'rejected';
    }
}

function onTrackText(s: CandidateStatus): string {
    switch (s) {
        case 'applied':
            return 'Completing profile';
        case 'interview_scheduled':
            return 'Awaiting interview';
        case 'interviewed':
            return 'Awaiting decision';
        case 'eapp_done':
            return 'eApp complete';
        case 'approved':
            return 'Preparing for papers';
        case 'exam_prep':
            return 'Taking exams';
        case 'licensed':
            return 'Licensed';
        case 'active_agent':
            return 'Active agent';
        default:
            return 'In progress';
    }
}

// ── Paper requirement builder (pure, shared with useCandidateProgression) ─

// Preference order per requirement. Mirrors fn_all_papers_passed() in
// migration 20260417100100 AND the REQUIREMENT_DEFS in useCandidateProgression.
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
 * Build the 4 paper requirements from a candidate's attempt history.
 * Pure function; attempts are expected newest-first (matches fetchPaperAttempts).
 */
export function buildPaperRequirements(attempts: CandidatePaperAttempt[]): PaperRequirement[] {
    return REQUIREMENT_DEFS.map((def) => {
        const accepted = new Set<PaperCode>(def.acceptedPaperCodes);
        const reqAttempts = attempts.filter((a) => accepted.has(a.paper_code));
        const latest = reqAttempts[0] ?? null;
        const passedAttempt = reqAttempts.find((a) => a.result === 'passed') ?? null;

        let status: PaperRequirementStatus;
        if (passedAttempt) status = 'passed';
        else if (!latest) status = 'not_started';
        else if (latest.result === 'failed') status = 'failed';
        else status = 'scheduled';

        return {
            code: def.code,
            label: def.label,
            acceptedPaperCodes: def.acceptedPaperCodes,
            attempts: reqAttempts,
            latest,
            passedAttempt,
            status,
            satisfied: passedAttempt !== null,
        };
    });
}

/** Urgency-first sort comparator. At-risk → this-week → ready → on-track. */
export function compareByUrgency(a: NextStep, b: NextStep): number {
    return urgencyRank(a.urgency) - urgencyRank(b.urgency);
}

function urgencyRank(u: Urgency): number {
    switch (u) {
        case 'at-risk':
            return 0;
        case 'this-week':
            return 1;
        case 'ready':
            return 2;
        case 'on-track':
            return 3;
        case 'hidden':
            return 4;
    }
}
