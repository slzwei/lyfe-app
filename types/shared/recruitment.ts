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
    created_at: string;
    updated_at: string;
}
