/**
 * Shared recruitment types — Candidate pipeline & interview scheduling.
 * UI-specific configs (CANDIDATE_STATUS_CONFIG, RECOMMENDATION_CONFIG) stay in each app.
 */

import type { CandidateStatus } from './database';
export type { CandidateStatus } from './database';

// ── Interview ──

export type InterviewType = 'zoom' | 'in_person';
export type InterviewStatus = 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';
export type InterviewRecommendation = 'second_interview' | 'on_hold' | 'pass';

export interface Interview {
    id: string;
    candidate_id: string;
    manager_id: string;
    scheduled_by_id: string;
    round_number: number;
    type: InterviewType;
    datetime: string;
    location: string | null;
    zoom_link: string | null;
    google_calendar_event_id: string | null;
    status: InterviewStatus;
    notes: string | null;
    recommendation: InterviewRecommendation | null;
    created_at: string;
}

// ── Candidate Activity ──

export type CandidateOutcome = 'reached' | 'no_answer' | 'sent';

export interface CandidateActivity {
    id: string;
    candidate_id: string;
    user_id: string;
    type: 'call' | 'whatsapp' | 'note';
    outcome: CandidateOutcome | null;
    note: string | null;
    created_at: string;
    actor_name?: string;
}

// ── Candidate Document ──

export const DOCUMENT_LABELS = [
    'Resume',
    'RES5',
    'M5',
    'M9',
    'M9A',
    'CM_LIP',
    'HI',
    'M8',
    'M8A',
    'ComGI',
    'BCP',
    'PGI',
    'Other',
] as const;

export type DocumentLabel = (typeof DOCUMENT_LABELS)[number];

export interface CandidateDocument {
    id: string;
    candidate_id: string;
    label: string;
    file_url: string;
    file_name: string;
    created_at: string;
}

// ── Candidate ──

export interface AssignedManager {
    id: string;
    full_name: string;
    role: string;
}

export interface CandidateProfileDetails {
    completed: boolean;
    onboarding_step: number;
    full_name: string;
    chinese_name: string | null;
    alias: string | null;
    date_of_birth: string | null;
    nationality: string | null;
    race: string | null;
    gender: string | null;
    marital_status: string | null;
    address_block: string | null;
    address_street: string | null;
    address_unit: string | null;
    address_postal: string | null;
    position_applied: string | null;
    expected_salary: string | null;
    salary_period: string | null;
    date_available: string | null;
    emergency_name: string | null;
    emergency_relationship: string | null;
    emergency_contact: string | null;
    education: { institution: string; qualification: string; year: string }[];
    employment_history: { company: string; position: string; period: string; reason_for_leaving: string }[];
    languages: { language: string; spoken: string; written: string }[];
    software_competencies: string | null;
    shorthand_wpm: number | null;
    typing_wpm: number | null;
}

export interface CandidateDiscResults {
    d_pct: number;
    i_pct: number;
    s_pct: number;
    c_pct: number;
    disc_type: string;
    angle: number;
}

export interface RecruitmentCandidate {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    status: CandidateStatus;
    assigned_manager_id: string;
    assigned_manager_name: string;
    created_by_id: string;
    invite_token: string | null;
    notes: string | null;
    resume_url: string | null;
    profile_pdf_path: string | null;
    disc_pdf_path: string | null;
    disc_results: CandidateDiscResults | null;
    profile_details: CandidateProfileDetails | null;
    interviews: Interview[];
    /** Phase A2/F: when status='on_hold', the DB trigger captures the prior
     *  status here so "resume" can restore it. NULL otherwise. */
    stage_before_hold: CandidateStatus | null;
    /** Phase A2/F: timestamp auto-stamped by DB trigger on first transition
     *  into 'rejected'. NULL for non-rejected candidates. */
    rejected_at: string | null;
    /** Phase A2/F: free-text reason supplied at rejection time. */
    rejected_reason: string | null;
    /** Phase A2/F: user.id of the staff member who rejected. */
    rejected_by_user_id: string | null;
    created_at: string;
    updated_at: string;
}

// ── Paper Completions (Phase C) ────────────────────────────────────────────
// Six paper codes; four requirements. Equivalencies encoded in fn_all_papers_passed:
//   Life Insurance 1 = M9 OR CM_LIP
//   Life Insurance 2 = M9A OR CM_LIP
//   Rules & Ethics   = M5 OR RES5
//   Health Insurance = HI
export const PAPER_CODES = ['M9', 'M9A', 'M5', 'RES5', 'HI', 'CM_LIP'] as const;
export type PaperCode = (typeof PAPER_CODES)[number];

/**
 * A paper attempt — single source of truth for paper progress. result=null
 * means the sitting is scheduled but hasn't happened (or hasn't been entered)
 * yet. The paper is "passed" for a requirement iff some attempt with an
 * accepted code has result='passed'.
 */
export interface CandidatePaperAttempt {
    id: string;
    candidate_id: string;
    paper_code: PaperCode;
    exam_at: string | null;
    cost: number | null;
    result: 'passed' | 'failed' | null;
    logged_by_user_id: string | null;
    created_at: string;
    updated_at: string;
}

// Derived summary status per requirement (driven by attempts).
export type PaperRequirementStatus = 'passed' | 'failed' | 'scheduled' | 'not_started';

// UI-derived requirement — the 4 cards shown to the user.
export type PaperRequirementCode = 'life_1' | 'life_2' | 'rules_ethics' | 'health_insurance';

export interface PaperRequirement {
    code: PaperRequirementCode;
    label: string;
    /** Codes that can satisfy this requirement (preference order). */
    acceptedPaperCodes: PaperCode[];
    /** All attempts for this requirement's accepted codes, newest first. */
    attempts: CandidatePaperAttempt[];
    /** The latest attempt (if any). */
    latest: CandidatePaperAttempt | null;
    /** The first passing attempt (if any). */
    passedAttempt: CandidatePaperAttempt | null;
    status: PaperRequirementStatus;
    /** Convenience: derived from `passedAttempt != null`. */
    satisfied: boolean;
}

// ── Milestones (Phase C + E) ───────────────────────────────────────────────
// 'bdm' is a pre-contracting formality with the principal (never fails, just
// "done" or "not"). Shares status shape with bes_induction and soar.
export const MILESTONE_CODES = ['bdm', 'bes_induction', 'soar', 'rnf', 'sales_authority'] as const;
export type MilestoneCode = (typeof MILESTONE_CODES)[number];

// Union of status values accepted across all milestone codes; per-code valid
// values are enforced by the DB CHECK constraint cm_status_valid_per_code.
export type MilestoneStatus = 'not_started' | 'scheduled' | 'completed' | 'lodged_to_mas' | 'issued';

export interface CandidateMilestone {
    id: string;
    candidate_id: string;
    milestone_code: MilestoneCode;
    status: MilestoneStatus;
    scheduled_date: string | null;
    /** Optional end of a multi-day schedule (ISO timestamptz). */
    scheduled_end_date: string | null;
    completed_date: string | null;
    reference_number: string | null;
    verified_by_user_id: string | null;
    note: string | null;
    created_at: string;
    updated_at: string;
}

// ── Prep Course Bookings (Phase C) ─────────────────────────────────────────
export const PREP_COURSE_CODES = ['M9_M9A', 'RES5', 'HI'] as const;
export type PrepCourseCode = (typeof PREP_COURSE_CODES)[number];

export interface CandidatePrepCourseBooking {
    id: string;
    candidate_id: string;
    course_code: PrepCourseCode;
    booked_by_user_id: string | null;
    booked_date: string | null;
    /** Optional end of a multi-day booking (ISO timestamptz). */
    booked_end_date: string | null;
    attended: boolean;
    note: string | null;
    created_at: string;
    updated_at: string;
}
