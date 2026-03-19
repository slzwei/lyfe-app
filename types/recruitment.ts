/**
 * Recruitment types — Candidate pipeline & interview scheduling
 *
 * CandidateStatus is canonical in types/database.ts (derived from Supabase enums).
 * Re-exported here for convenience — do NOT redefine locally.
 */

// ── Candidate Statuses ──
import type { CandidateStatus } from '@/types/database';
import type { IconName } from '@/types/ui';
export type { CandidateStatus } from '@/types/database';

export interface CandidateStatusConfig {
    label: string;
    color: string;
    icon: IconName;
    order: number;
}

export const CANDIDATE_STATUS_CONFIG: Record<CandidateStatus, CandidateStatusConfig> = {
    applied: { label: 'Applied', color: '#007AFF', icon: 'person-add', order: 0 },
    interview_scheduled: { label: 'Interview', color: '#EAB308', icon: 'calendar', order: 1 },
    interviewed: { label: 'Interviewed', color: '#AF52DE', icon: 'checkmark-circle', order: 2 },
    approved: { label: 'Approved', color: '#34C759', icon: 'shield-checkmark', order: 3 },
    exam_prep: { label: 'Exam Prep', color: '#FF3B30', icon: 'school', order: 4 },
    licensed: { label: 'Licensed', color: '#007AFF', icon: 'ribbon', order: 5 },
    active_agent: { label: 'Active Agent', color: '#FF7600', icon: 'star', order: 6 },
};

export const CANDIDATE_STATUSES = (
    Object.entries(CANDIDATE_STATUS_CONFIG) as [CandidateStatus, CandidateStatusConfig][]
)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([key]) => key);

// ── Interview ──
export type InterviewType = 'zoom' | 'in_person';
export type InterviewStatus = 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';

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
    interviews: Interview[];
    created_at: string;
    updated_at: string;
}
