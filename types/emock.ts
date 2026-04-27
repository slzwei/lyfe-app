/**
 * eMock — CMFAS practice exam types.
 *
 * eMock attempts are written by lyfe-sg's `/emock` route (web). lyfe-app reads
 * them so managers can see candidate practice progress alongside real paper
 * results. Real exam results live in `candidate_paper_attempts` — these are
 * just practice signals.
 *
 * The shared `emock_attempts` table is keyed on `auth.users.id`, not
 * `candidates.id`; the lib function bridges via `candidate_profiles.user_id`.
 */

export const EMOCK_MODULE_CODES = ['M9', 'M9A', 'HI', 'RES5'] as const;
export type EmockModuleCode = (typeof EMOCK_MODULE_CODES)[number];

export const EMOCK_MODULE_META: Record<EmockModuleCode, { label: string }> = {
    M9: { label: 'Life Insurance 1' },
    M9A: { label: 'Life Insurance 2' },
    HI: { label: 'Health Insurance' },
    RES5: { label: 'Rules & Ethics' },
};

export interface EmockAttempt {
    id: string;
    module_id: string;
    quiz_id: string;
    score: number | null;
    total: number | null;
    passed: boolean | null;
    time_taken_seconds: number | null;
    completed_at: string | null;
    status: string;
}

export interface EmockModuleSummary {
    code: EmockModuleCode;
    label: string;
    attemptCount: number;
    bestAttempt: EmockAttempt | null;
    latestAttempt: EmockAttempt | null;
    everPassed: boolean;
    /** Best score as a percentage 0–100, rounded. Null when no attempts. */
    bestPercent: number | null;
}

export function isEmockModuleCode(code: string): code is EmockModuleCode {
    return (EMOCK_MODULE_CODES as readonly string[]).includes(code);
}
