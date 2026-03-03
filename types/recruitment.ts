/**
 * Recruitment types — Candidate pipeline & interview scheduling
 */

// ── Candidate Statuses ──
export type CandidateStatus =
    | 'applied'
    | 'interview_scheduled'
    | 'interviewed'
    | 'approved'
    | 'exam_prep'
    | 'licensed'
    | 'active_agent';

export interface CandidateStatusConfig {
    label: string;
    color: string;
    icon: string;
    order: number;
}

export const CANDIDATE_STATUS_CONFIG: Record<CandidateStatus, CandidateStatusConfig> = {
    applied: { label: 'Applied', color: '#007AFF', icon: 'person-add', order: 0 },
    interview_scheduled: { label: 'Interview', color: '#FF9500', icon: 'calendar', order: 1 },
    interviewed: { label: 'Interviewed', color: '#AF52DE', icon: 'checkmark-circle', order: 2 },
    approved: { label: 'Approved', color: '#34C759', icon: 'shield-checkmark', order: 3 },
    exam_prep: { label: 'Exam Prep', color: '#FF3B30', icon: 'school', order: 4 },
    licensed: { label: 'Licensed', color: '#007AFF', icon: 'ribbon', order: 5 },
    active_agent: { label: 'Active Agent', color: '#0A7E6B', icon: 'star', order: 6 },
};

export const CANDIDATE_STATUSES: CandidateStatus[] = [
    'applied', 'interview_scheduled', 'interviewed', 'approved', 'exam_prep', 'licensed', 'active_agent',
];

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

// ── Candidate ──
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
    interviews: Interview[];
    created_at: string;
    updated_at: string;
}


