/**
 * Tests for computeNextStep — the candidate pipeline urgency + next-step engine.
 *
 * Each test shapes a minimal candidate + progression snapshot, asserts on the
 * returned urgency/text/signal.
 */
import {
    buildPaperRequirements,
    compareByUrgency,
    computeNextStep,
    THRESHOLDS,
    type NextStep,
    type PipelineInput,
} from '@/lib/recruitment/pipeline';
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
    RecruitmentCandidate,
} from '@/types/recruitment';

// ── Test fixtures ────────────────────────────────────────────────

const NOW = new Date('2026-04-23T09:00:00+08:00');

function daysAgo(n: number): string {
    const d = new Date(NOW);
    d.setDate(d.getDate() - n);
    return d.toISOString();
}

function daysFromNow(n: number): string {
    const d = new Date(NOW);
    d.setDate(d.getDate() + n);
    return d.toISOString();
}

function makeCandidate(overrides: Partial<RecruitmentCandidate> = {}): RecruitmentCandidate {
    return {
        id: 'cand-1',
        name: 'Sarah Rahman',
        phone: '+6591234567',
        email: 'sarah@example.com',
        status: 'exam_prep',
        assigned_manager_id: 'mgr-1',
        assigned_manager_name: 'Wei Ming Lee',
        created_by_id: 'mgr-1',
        invite_token: null,
        notes: null,
        resume_url: null,
        profile_pdf_path: null,
        disc_pdf_path: null,
        enneagram_pdf_path: null,
        disc_results: null,
        profile_details: null,
        interviews: [],
        stage_before_hold: null,
        rejected_at: null,
        rejected_reason: null,
        rejected_by_user_id: null,
        created_at: daysAgo(30),
        updated_at: daysAgo(5),
        ...overrides,
    };
}

function makeMilestone(code: MilestoneCode, overrides: Partial<CandidateMilestone> = {}): CandidateMilestone {
    return {
        id: `ms-${code}`,
        candidate_id: 'cand-1',
        milestone_code: code,
        status: 'not_started',
        scheduled_date: null,
        scheduled_end_date: null,
        completed_date: null,
        reference_number: null,
        verified_by_user_id: null,
        note: null,
        created_at: daysAgo(30),
        updated_at: daysAgo(30),
        ...overrides,
    };
}

function makeAttempt(paper: PaperCode, overrides: Partial<CandidatePaperAttempt> = {}): CandidatePaperAttempt {
    return {
        id: `att-${paper}-${Math.random()}`,
        candidate_id: 'cand-1',
        paper_code: paper,
        exam_at: daysAgo(5),
        cost: null,
        result: 'passed',
        logged_by_user_id: null,
        created_at: daysAgo(5),
        updated_at: daysAgo(5),
        ...overrides,
    };
}

function makeRequirement(
    code: PaperRequirementCode,
    label: string,
    accepted: PaperCode[],
    attempts: CandidatePaperAttempt[],
): PaperRequirement {
    const passedAttempt = attempts.find((a) => a.result === 'passed') ?? null;
    const latest =
        [...attempts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] ?? null;
    let status: PaperRequirement['status'] = 'not_started';
    if (passedAttempt) status = 'passed';
    else if (latest?.result === 'failed') status = 'failed';
    else if (latest && latest.exam_at && latest.result === null) status = 'scheduled';
    return {
        code,
        label,
        acceptedPaperCodes: accepted,
        attempts,
        latest,
        passedAttempt,
        status,
        satisfied: !!passedAttempt,
    };
}

function makeInterview(overrides: Partial<Interview> = {}): Interview {
    return {
        id: 'iv-1',
        candidate_id: 'cand-1',
        manager_id: 'mgr-1',
        scheduled_by_id: 'mgr-1',
        round_number: 1,
        type: 'zoom',
        datetime: daysFromNow(3),
        location: null,
        zoom_link: 'https://zoom.us/abc',
        google_calendar_event_id: null,
        status: 'scheduled',
        notes: null,
        recommendation: null,
        created_at: daysAgo(2),
        ...overrides,
    };
}

function allPassedRequirements(): PaperRequirement[] {
    return [
        makeRequirement('life_1', 'Life Insurance 1', ['M9', 'CM_LIP'], [makeAttempt('M9', { result: 'passed' })]),
        makeRequirement('life_2', 'Life Insurance 2', ['M9A', 'CM_LIP'], [makeAttempt('M9A', { result: 'passed' })]),
        makeRequirement('rules_ethics', 'Rules & Ethics', ['M5', 'RES5'], [makeAttempt('RES5', { result: 'passed' })]),
        makeRequirement('health_insurance', 'Health Insurance', ['HI'], [makeAttempt('HI', { result: 'passed' })]),
    ];
}

function noPapersStarted(): PaperRequirement[] {
    return [
        makeRequirement('life_1', 'Life Insurance 1', ['M9', 'CM_LIP'], []),
        makeRequirement('life_2', 'Life Insurance 2', ['M9A', 'CM_LIP'], []),
        makeRequirement('rules_ethics', 'Rules & Ethics', ['M5', 'RES5'], []),
        makeRequirement('health_insurance', 'Health Insurance', ['HI'], []),
    ];
}

function baseInput(overrides: Partial<PipelineInput> = {}): PipelineInput {
    return {
        candidate: makeCandidate(),
        milestones: [],
        attempts: [],
        interviews: [],
        activities: [],
        paperRequirements: noPapersStarted(),
        now: NOW,
        ...overrides,
    };
}

// ── Tests ───────────────────────────────────────────────────────

describe('computeNextStep — hidden states', () => {
    it('returns hidden for rejected candidates', () => {
        const result = computeNextStep(baseInput({ candidate: makeCandidate({ status: 'rejected' }) }));
        expect(result.urgency).toBe('hidden');
        expect(result.text).toBe('Rejected');
    });

    it('returns hidden for on_hold candidates', () => {
        const result = computeNextStep(baseInput({ candidate: makeCandidate({ status: 'on_hold' }) }));
        expect(result.urgency).toBe('hidden');
        expect(result.text).toBe('On hold');
    });
});

describe('computeNextStep — onboarding stalled (at-risk)', () => {
    it('flags applied candidate with incomplete profile after 5+ days', () => {
        const result = computeNextStep(
            baseInput({
                candidate: makeCandidate({
                    status: 'applied',
                    profile_details: null,
                    created_at: daysAgo(6),
                }),
            }),
        );
        expect(result.urgency).toBe('at-risk');
        expect(result.text).toMatch(/Onboarding incomplete/);
        expect(result.actionHint).toBe('chase');
    });

    it('does NOT flag applied candidate still within the 5-day grace', () => {
        const result = computeNextStep(
            baseInput({
                candidate: makeCandidate({
                    status: 'applied',
                    profile_details: null,
                    created_at: daysAgo(3),
                }),
            }),
        );
        expect(result.urgency).not.toBe('at-risk');
    });

    it('does NOT flag applied candidate with completed profile', () => {
        const result = computeNextStep(
            baseInput({
                candidate: makeCandidate({
                    status: 'applied',
                    // Complete enough to satisfy the check.
                    profile_details: { completed: true } as never,
                    created_at: daysAgo(20),
                }),
            }),
        );
        expect(result.urgency).not.toBe('at-risk');
    });
});

describe('computeNextStep — failed paper without re-sit (at-risk)', () => {
    it('flags candidate who failed a paper 7+ days ago with no follow-up', () => {
        const failedAttempt = makeAttempt('M9', {
            result: 'failed',
            exam_at: daysAgo(8),
            created_at: daysAgo(8),
        });
        const reqs: PaperRequirement[] = [
            makeRequirement('life_1', 'Life Insurance 1', ['M9', 'CM_LIP'], [failedAttempt]),
            makeRequirement('life_2', 'Life Insurance 2', ['M9A', 'CM_LIP'], []),
            makeRequirement('rules_ethics', 'Rules & Ethics', ['M5', 'RES5'], []),
            makeRequirement('health_insurance', 'Health Insurance', ['HI'], []),
        ];
        const result = computeNextStep(baseInput({ paperRequirements: reqs }));
        expect(result.urgency).toBe('at-risk');
        expect(result.text).toMatch(/Re-book Life Insurance 1/);
        expect(result.actionHint).toBe('book');
    });

    it('does NOT flag if a follow-up attempt is already scheduled', () => {
        const failedAttempt = makeAttempt('M9', {
            id: 'att-1',
            result: 'failed',
            exam_at: daysAgo(10),
            created_at: daysAgo(10),
        });
        const followup = makeAttempt('M9', {
            id: 'att-2',
            result: null,
            exam_at: daysFromNow(5),
            created_at: daysAgo(1),
        });
        const reqs: PaperRequirement[] = [
            makeRequirement('life_1', 'Life Insurance 1', ['M9', 'CM_LIP'], [failedAttempt, followup]),
            makeRequirement('life_2', 'Life Insurance 2', ['M9A', 'CM_LIP'], []),
            makeRequirement('rules_ethics', 'Rules & Ethics', ['M5', 'RES5'], []),
            makeRequirement('health_insurance', 'Health Insurance', ['HI'], []),
        ];
        const result = computeNextStep(baseInput({ paperRequirements: reqs }));
        // Should be this-week because there's a scheduled attempt within 5 days,
        // not at-risk.
        expect(result.urgency).not.toBe('at-risk');
    });
});

describe('computeNextStep — missed scheduled event (at-risk)', () => {
    it('flags a past-due interview still marked scheduled', () => {
        const iv = makeInterview({
            datetime: daysAgo(3),
            status: 'scheduled',
            round_number: 2,
        });
        const result = computeNextStep(baseInput({ interviews: [iv] }));
        expect(result.urgency).toBe('at-risk');
        expect(result.text).toMatch(/2nd interview outcome/);
    });

    it('flags a past-due milestone still marked scheduled', () => {
        const ms = makeMilestone('bes_induction', {
            status: 'scheduled',
            scheduled_date: daysAgo(4),
        });
        const result = computeNextStep(baseInput({ milestones: [ms] }));
        expect(result.urgency).toBe('at-risk');
        expect(result.text).toMatch(/BES induction/);
    });

    it('flags a paper attempt with past exam_at and no result', () => {
        const attempt = makeAttempt('RES5', { result: null, exam_at: daysAgo(3) });
        const result = computeNextStep(baseInput({ attempts: [attempt] }));
        expect(result.urgency).toBe('at-risk');
        expect(result.text).toMatch(/Log RES5 result/);
    });
});

describe('computeNextStep — ready to advance', () => {
    it('all papers passed, no BDM → Schedule BDM', () => {
        const result = computeNextStep(
            baseInput({
                candidate: makeCandidate({ status: 'exam_prep' }),
                paperRequirements: allPassedRequirements(),
            }),
        );
        expect(result.urgency).toBe('ready');
        expect(result.text).toBe('Schedule BDM interview');
        expect(result.actionHint).toBe('schedule');
    });

    it('BDM completed, no BES → Register for BES', () => {
        const result = computeNextStep(
            baseInput({
                candidate: makeCandidate({ status: 'exam_prep' }),
                paperRequirements: allPassedRequirements(),
                milestones: [makeMilestone('bdm', { status: 'completed' })],
            }),
        );
        expect(result.urgency).toBe('ready');
        expect(result.text).toBe('Register for BES induction');
    });

    it('BES completed, no SOAR → Register for SOAR', () => {
        const result = computeNextStep(
            baseInput({
                candidate: makeCandidate({ status: 'exam_prep' }),
                paperRequirements: allPassedRequirements(),
                milestones: [
                    makeMilestone('bdm', { status: 'completed' }),
                    makeMilestone('bes_induction', { status: 'completed' }),
                ],
            }),
        );
        expect(result.urgency).toBe('ready');
        expect(result.text).toBe('Register for SOAR');
    });

    it('SOAR completed, RNF not lodged → File RNF', () => {
        const result = computeNextStep(
            baseInput({
                candidate: makeCandidate({ status: 'exam_prep' }),
                paperRequirements: allPassedRequirements(),
                milestones: [
                    makeMilestone('bdm', { status: 'completed' }),
                    makeMilestone('bes_induction', { status: 'completed' }),
                    makeMilestone('soar', { status: 'completed' }),
                ],
            }),
        );
        expect(result.urgency).toBe('ready');
        expect(result.text).toBe('File RNF with MAS');
    });

    it('RNF issued → Activate as agent', () => {
        const result = computeNextStep(
            baseInput({
                candidate: makeCandidate({ status: 'licensed' }),
                paperRequirements: allPassedRequirements(),
                milestones: [
                    makeMilestone('bdm', { status: 'completed' }),
                    makeMilestone('bes_induction', { status: 'completed' }),
                    makeMilestone('soar', { status: 'completed' }),
                    makeMilestone('rnf', { status: 'issued' }),
                ],
            }),
        );
        expect(result.urgency).toBe('ready');
        expect(result.text).toMatch(/Activate as agent/);
    });
});

describe('computeNextStep — this week', () => {
    it('flags upcoming interview within 5 days', () => {
        const iv = makeInterview({ datetime: daysFromNow(2), round_number: 2 });
        const result = computeNextStep(baseInput({ interviews: [iv] }));
        expect(result.urgency).toBe('this-week');
        expect(result.text).toMatch(/2nd interview/);
    });

    it('flags upcoming milestone within 5 days', () => {
        const ms = makeMilestone('bdm', {
            status: 'scheduled',
            scheduled_date: daysFromNow(3),
        });
        const result = computeNextStep(baseInput({ milestones: [ms] }));
        expect(result.urgency).toBe('this-week');
        expect(result.text).toMatch(/BDM interview/);
    });

    it('does NOT flag events beyond 5 days out as this-week', () => {
        const iv = makeInterview({ datetime: daysFromNow(10) });
        const result = computeNextStep(baseInput({ interviews: [iv] }));
        expect(result.urgency).not.toBe('this-week');
    });
});

describe('computeNextStep — stalled', () => {
    it('flags a candidate with no events and no recent updates (14+ days) [updated_at fallback]', () => {
        const result = computeNextStep(
            baseInput({
                candidate: makeCandidate({
                    status: 'exam_prep',
                    updated_at: daysAgo(20),
                }),
                activities: [], // no activities provided → falls back to updated_at
            }),
        );
        expect(result.urgency).toBe('at-risk');
        expect(result.text).toMatch(/Stalled at exam prep/);
    });

    it('does NOT flag stalled if there is an upcoming scheduled event', () => {
        const result = computeNextStep(
            baseInput({
                candidate: makeCandidate({ updated_at: daysAgo(20) }),
                interviews: [makeInterview({ datetime: daysFromNow(3) })],
            }),
        );
        expect(result.urgency).toBe('this-week');
    });

    it('prefers activity timestamp over updated_at — recent activity prevents stalled flag', () => {
        // Candidate updated_at 20d ago (would trigger stalled via proxy)
        // but there's a note logged 3d ago → not stalled.
        const recentActivity: CandidateActivity = {
            id: 'act-1',
            candidate_id: 'cand-1',
            user_id: 'mgr-1',
            type: 'note',
            outcome: null,
            note: 'Quick check-in',
            created_at: daysAgo(3),
        };
        const result = computeNextStep(
            baseInput({
                candidate: makeCandidate({ updated_at: daysAgo(20) }),
                activities: [recentActivity],
            }),
        );
        expect(result.urgency).toBe('on-track');
    });

    it('prefers activity timestamp over updated_at — old activity triggers stalled flag', () => {
        // Candidate updated_at yesterday (would NOT trigger stalled via proxy),
        // but the last activity was 30d ago → stalled.
        const oldActivity: CandidateActivity = {
            id: 'act-old',
            candidate_id: 'cand-1',
            user_id: 'mgr-1',
            type: 'call',
            outcome: 'no_answer',
            note: null,
            created_at: daysAgo(30),
        };
        const result = computeNextStep(
            baseInput({
                candidate: makeCandidate({ updated_at: daysAgo(1) }),
                activities: [oldActivity],
            }),
        );
        expect(result.urgency).toBe('at-risk');
        expect(result.text).toMatch(/Stalled/);
    });
});

describe('computeNextStep — on track (default)', () => {
    it('returns on-track for a candidate with recent activity and no pending gates', () => {
        const result = computeNextStep(
            baseInput({
                candidate: makeCandidate({
                    status: 'exam_prep',
                    updated_at: daysAgo(2),
                }),
            }),
        );
        expect(result.urgency).toBe('on-track');
    });
});

describe('THRESHOLDS — sanity', () => {
    it('exposes tunable constants', () => {
        expect(THRESHOLDS.ONBOARDING_STALE_DAYS).toBeGreaterThan(0);
        expect(THRESHOLDS.PAPER_FAILURE_UNBOOKED_DAYS).toBeGreaterThan(0);
        expect(THRESHOLDS.STALLED_NO_SCHEDULE_DAYS).toBeGreaterThan(0);
        expect(THRESHOLDS.THIS_WEEK_DAYS).toBeGreaterThan(0);
    });
});

describe('buildPaperRequirements', () => {
    it('returns 4 requirements in canonical order', () => {
        const reqs = buildPaperRequirements([]);
        expect(reqs.map((r) => r.code)).toEqual(['life_1', 'life_2', 'rules_ethics', 'health_insurance']);
    });

    it('marks a requirement passed when any accepted paper is passed', () => {
        const reqs = buildPaperRequirements([makeAttempt('M9', { result: 'passed' })]);
        const life1 = reqs.find((r) => r.code === 'life_1')!;
        expect(life1.satisfied).toBe(true);
        expect(life1.status).toBe('passed');
    });

    it('marks rules_ethics passed via RES5 or M5 (either works)', () => {
        const reqs = buildPaperRequirements([makeAttempt('RES5', { result: 'passed' })]);
        expect(reqs.find((r) => r.code === 'rules_ethics')!.satisfied).toBe(true);
    });

    it('marks requirement failed when latest attempt failed and no pass exists', () => {
        const reqs = buildPaperRequirements([makeAttempt('M9', { result: 'failed' })]);
        const life1 = reqs.find((r) => r.code === 'life_1')!;
        expect(life1.status).toBe('failed');
        expect(life1.satisfied).toBe(false);
    });

    it('marks requirement scheduled when attempt has no result yet', () => {
        const reqs = buildPaperRequirements([makeAttempt('HI', { result: null, exam_at: daysFromNow(3) })]);
        expect(reqs.find((r) => r.code === 'health_insurance')!.status).toBe('scheduled');
    });

    it('CM_LIP satisfies both life_1 AND life_2', () => {
        const reqs = buildPaperRequirements([makeAttempt('CM_LIP', { result: 'passed' })]);
        expect(reqs.find((r) => r.code === 'life_1')!.satisfied).toBe(true);
        expect(reqs.find((r) => r.code === 'life_2')!.satisfied).toBe(true);
    });
});

describe('compareByUrgency', () => {
    const mk = (u: NextStep['urgency']): NextStep => ({ urgency: u, text: '', signal: null });

    it('orders at-risk first, then this-week, ready, on-track, hidden', () => {
        const sorted = [mk('on-track'), mk('at-risk'), mk('hidden'), mk('this-week'), mk('ready')]
            .sort(compareByUrgency)
            .map((x) => x.urgency);
        expect(sorted).toEqual(['at-risk', 'this-week', 'ready', 'on-track', 'hidden']);
    });
});
