/**
 * Live-applicant data layer.
 *
 * Resolves which in-progress candidates the current staff member is allowed to
 * see "live" on the dashboard, and maps each candidate's auth `user_id` (the key
 * carried by the `candidate-progress` broadcast) back to a candidate record.
 *
 * Access rule (confirmed product spec):
 *   - admin, ro              → all candidates (global)
 *   - director               → candidates assigned to them OR to a manager who
 *                              reports to them (users.reports_to)
 *   - manager                → candidates assigned to them
 *   - everyone else          → nothing (the card is never rendered for them)
 *
 * Everything fails CLOSED: any query error yields an empty scope/map so an
 * unauthorized or errored session shows no live applicants rather than leaking.
 */
import { supabase } from '@/lib/supabase';

/** Broadcast channel + event emitted by lyfe-sg (web ATS / candidate portal). */
export const LIVE_PROGRESS_CHANNEL = 'candidate-progress';
export const LIVE_PROGRESS_EVENT = 'progress';

/** Coarse phase a candidate is in, as broadcast by the web app. */
export type LiveState = 'form' | 'quiz' | 'viewing-results' | 'signed-out';

export interface LiveProgressPayload {
    userId: string;
    state: LiveState;
}

/** A candidate the viewer is authorized to see live, keyed by auth user_id. */
export interface ScopeCandidate {
    userId: string;
    candidateId: string;
    name: string;
}

/** 'all' for admin/ro; otherwise the set of manager ids whose candidates are visible. */
export type LiveScope = { all: true } | { all: false; managerIds: Set<string> };

/** Candidates in these terminal states are done onboarding and never shown as live. */
const TERMINAL_STATUSES = '(licensed,active_agent,rejected)';

/**
 * Resolve the viewer's visibility scope from their role + reporting line.
 * Mirrors the team-scoping pattern in lib/team.ts (director → direct-report
 * managers via users.reports_to).
 */
export async function resolveLiveScope(userId: string, role: string): Promise<LiveScope> {
    if (role === 'admin' || role === 'ro') return { all: true };

    const managerIds = new Set<string>([userId]);

    if (role === 'director') {
        const { data, error } = await supabase
            .from('users')
            .select('id')
            .eq('reports_to', userId)
            .in('role', ['manager', 'director']);
        if (error) {
            if (__DEV__) console.warn('[liveApplicants] resolveLiveScope reports lookup failed:', error.message);
            return { all: false, managerIds }; // fail closed to "self only"
        }
        for (const r of (data ?? []) as { id: string }[]) managerIds.add(r.id);
    }

    return { all: false, managerIds };
}

/**
 * Build the userId → candidate allow-map of the viewer's authorized,
 * non-terminal, non-archived candidates. RLS on candidates/candidate_profiles
 * applies as defence-in-depth on top of the explicit scope filter.
 */
export async function fetchLiveScopeMap(scope: LiveScope): Promise<Map<string, ScopeCandidate>> {
    const empty = new Map<string, ScopeCandidate>();

    let managerFilter: string[] | null = null;
    if (!scope.all) {
        managerFilter = [...scope.managerIds];
        if (managerFilter.length === 0) return empty; // nothing in scope — skip the query entirely
    }

    let query = supabase
        .from('candidates')
        .select('id, name, assigned_manager_id, status, archived_at')
        .is('archived_at', null)
        .not('status', 'in', TERMINAL_STATUSES);
    if (managerFilter) query = query.in('assigned_manager_id', managerFilter);

    const { data: candidates, error } = await query;
    if (error) {
        if (__DEV__) console.warn('[liveApplicants] fetchLiveScopeMap candidates failed:', error.message);
        return empty;
    }
    if (!candidates || candidates.length === 0) return empty;

    const byCandidateId = new Map(candidates.map((c) => [c.id, c]));

    // candidates has no direct auth user_id — map via candidate_profiles.
    const { data: profiles, error: profErr } = await supabase
        .from('candidate_profiles')
        .select('user_id, candidate_id')
        .in('candidate_id', [...byCandidateId.keys()]);
    if (profErr) {
        if (__DEV__) console.warn('[liveApplicants] fetchLiveScopeMap profiles failed:', profErr.message);
        return empty;
    }

    const map = new Map<string, ScopeCandidate>();
    for (const p of (profiles ?? []) as { user_id: string | null; candidate_id: string | null }[]) {
        if (!p.user_id || !p.candidate_id) continue;
        const candidate = byCandidateId.get(p.candidate_id);
        if (!candidate) continue;
        map.set(p.user_id, {
            userId: p.user_id,
            candidateId: candidate.id,
            name: candidate.name ?? 'Applicant',
        });
    }
    return map;
}

// ─── v2: precise progress (counts) ──────────────────────────────────────────

/** Enneagram quiz length (current flow). Legacy DISC is longer; callers clamp. */
export const QUIZ_TOTAL = 36;
/** Onboarding form step count. */
export const FORM_STEPS = 6;

export interface LiveProgress {
    onboardingStep: number; // 1..FORM_STEPS
    profileCompleted: boolean;
    quizAnswered: number; // 0..QUIZ_TOTAL
    quizCompleted: boolean;
}

interface LiveProgressRow {
    user_id: string;
    onboarding_step: number | null;
    profile_completed: boolean | null;
    quiz_answered: number | null;
    quiz_completed: boolean | null;
}

/**
 * Precise progress for the given live applicants via the
 * get_candidates_live_progress RPC (SECURITY DEFINER + per-row access gate).
 * Fails soft — returns an empty map on error so the widget falls back to the
 * coarse phase bar. The RPC enforces access, so the result only ever contains
 * candidates the caller is authorised to see.
 */
export async function fetchLiveProgress(userIds: string[]): Promise<Map<string, LiveProgress>> {
    const map = new Map<string, LiveProgress>();
    if (userIds.length === 0) return map;

    // RPC isn't in the generated types until `gen:types` re-runs post-migration;
    // cast at the call site (same precedent as get_team_lead_stats in lib/team.ts).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('get_candidates_live_progress', {
        p_user_ids: userIds,
    });
    if (error || !data) {
        if (__DEV__ && error) console.warn('[liveApplicants] fetchLiveProgress failed:', error.message);
        return map;
    }

    for (const r of data as LiveProgressRow[]) {
        map.set(r.user_id, {
            onboardingStep: r.onboarding_step ?? 1,
            profileCompleted: !!r.profile_completed,
            quizAnswered: r.quiz_answered ?? 0,
            quizCompleted: !!r.quiz_completed,
        });
    }
    return map;
}

// ─── "Onboarded today" (persistent summary) ─────────────────────────────────

export interface TodayCandidate {
    userId: string;
    candidateId: string;
    name: string;
}

/** Singapore is UTC+8 year-round (no DST). UTC ISO instant of today's SGT midnight. */
function sgtTodayStartISO(): string {
    const sgt = new Date(Date.now() + 8 * 3600 * 1000);
    const ms = Date.UTC(sgt.getUTCFullYear(), sgt.getUTCMonth(), sgt.getUTCDate()) - 8 * 3600 * 1000;
    return new Date(ms).toISOString();
}

/**
 * Candidates invited today (SGT) who have finished onboarding (quiz completed),
 * for the widget's "N onboarded today" summary + completed list. Access is
 * enforced by RLS on the candidates/candidate_profiles reads and by the
 * per-row access gate inside get_candidates_live_progress. Fails soft to [].
 */
export async function fetchTodaysOnboarded(): Promise<TodayCandidate[]> {
    const since = sgtTodayStartISO();

    // Today's accessible candidates (RLS scopes to what the viewer may see).
    const { data: cands, error } = await supabase
        .from('candidates')
        .select('id, name, created_at, archived_at')
        .gte('created_at', since)
        .is('archived_at', null);
    if (error || !cands || cands.length === 0) return [];

    const byCandidateId = new Map(cands.map((c) => [c.id, c]));
    const { data: profiles, error: pErr } = await supabase
        .from('candidate_profiles')
        .select('user_id, candidate_id')
        .in('candidate_id', [...byCandidateId.keys()]);
    if (pErr || !profiles || profiles.length === 0) return [];

    const rows = profiles as { user_id: string | null; candidate_id: string | null }[];
    const userIds = rows.map((p) => p.user_id).filter((id): id is string => !!id);
    const progress = await fetchLiveProgress(userIds);

    const result: TodayCandidate[] = [];
    for (const p of rows) {
        if (!p.user_id || !p.candidate_id) continue;
        if (!progress.get(p.user_id)?.quizCompleted) continue; // "onboarded" = quiz finished
        const candidate = byCandidateId.get(p.candidate_id);
        if (!candidate) continue;
        result.push({ userId: p.user_id, candidateId: candidate.id, name: candidate.name ?? 'Applicant' });
    }
    return result;
}
