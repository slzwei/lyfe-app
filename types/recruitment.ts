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
    applied: { label: 'Applied', color: '#0969DA', icon: 'person-add', order: 0 },
    interview_scheduled: { label: 'Interview', color: '#BF8700', icon: 'calendar', order: 1 },
    interviewed: { label: 'Interviewed', color: '#8250DF', icon: 'checkmark-circle', order: 2 },
    approved: { label: 'Approved', color: '#1A7F37', icon: 'shield-checkmark', order: 3 },
    exam_prep: { label: 'Exam Prep', color: '#E8614D', icon: 'school', order: 4 },
    licensed: { label: 'Licensed', color: '#0550AE', icon: 'ribbon', order: 5 },
    active_agent: { label: 'Active Agent', color: '#1A7F37', icon: 'star', order: 6 },
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

// ── Mock Data ──
const now = Date.now();
const d = (days: number) => new Date(now - days * 86400000).toISOString();

export const MOCK_CANDIDATES: RecruitmentCandidate[] = [
    {
        id: 'c1', name: 'Jason Teo', phone: '+65 9111 2222', email: 'jason.teo@gmail.com',
        status: 'applied', assigned_manager_id: 'mgr-1', assigned_manager_name: 'David Lim',
        created_by_id: 'mock-user-id', invite_token: 'inv_abc123', notes: 'Referred by agent Michael Wong',
        interviews: [], created_at: d(1), updated_at: d(1),
    },
    {
        id: 'c2', name: 'Priya Sharma', phone: '+65 8222 3333', email: 'priya.s@outlook.com',
        status: 'interview_scheduled', assigned_manager_id: 'mgr-1', assigned_manager_name: 'David Lim',
        created_by_id: 'mock-user-id', invite_token: 'inv_def456', notes: 'Strong background in financial advisory',
        interviews: [{
            id: 'int-1', candidate_id: 'c2', manager_id: 'mgr-1', scheduled_by_id: 'mock-user-id',
            round_number: 1, type: 'zoom', datetime: new Date(now + 2 * 86400000).toISOString(),
            location: null, zoom_link: 'https://zoom.us/j/123456789', google_calendar_event_id: null,
            status: 'scheduled', notes: null, created_at: d(3),
        }],
        created_at: d(5), updated_at: d(3),
    },
    {
        id: 'c3', name: 'Ahmad Razak', phone: '+65 9333 4444', email: 'ahmad.r@email.com',
        status: 'interviewed', assigned_manager_id: 'mgr-1', assigned_manager_name: 'David Lim',
        created_by_id: 'mock-user-id', invite_token: null, notes: 'Very motivated, good presentation skills',
        interviews: [{
            id: 'int-2', candidate_id: 'c3', manager_id: 'mgr-1', scheduled_by_id: 'mock-user-id',
            round_number: 1, type: 'zoom', datetime: d(2),
            location: null, zoom_link: 'https://zoom.us/j/987654321', google_calendar_event_id: null,
            status: 'completed', notes: 'Good cultural fit. Recommend proceed to round 2.', created_at: d(7),
        }],
        created_at: d(10), updated_at: d(2),
    },
    {
        id: 'c4', name: 'Lisa Tan', phone: '+65 8444 5555', email: 'lisa.tan@company.sg',
        status: 'approved', assigned_manager_id: 'mgr-1', assigned_manager_name: 'David Lim',
        created_by_id: 'mock-user-id', invite_token: null, notes: 'Previously in banking sector. Approved after 2 interview rounds.',
        interviews: [
            { id: 'int-3', candidate_id: 'c4', manager_id: 'mgr-1', scheduled_by_id: 'mock-user-id', round_number: 1, type: 'zoom', datetime: d(14), location: null, zoom_link: 'https://zoom.us/j/111222333', google_calendar_event_id: null, status: 'completed', notes: 'Solid understanding of insurance products', created_at: d(18) },
            { id: 'int-4', candidate_id: 'c4', manager_id: 'mgr-1', scheduled_by_id: 'mock-user-id', round_number: 2, type: 'in_person', datetime: d(10), location: 'Lyfe Office, 1 Raffles Place #20-01', zoom_link: null, google_calendar_event_id: null, status: 'completed', notes: 'Approved. Ready for exam preparation.', created_at: d(14) },
        ],
        created_at: d(20), updated_at: d(10),
    },
    {
        id: 'c5', name: 'Wei Ming Chen', phone: '+65 9555 6666', email: null,
        status: 'exam_prep', assigned_manager_id: 'mgr-1', assigned_manager_name: 'David Lim',
        created_by_id: 'mock-user-id', invite_token: null, notes: 'Preparing for M5 and M9. Target completion: March 2026.',
        interviews: [
            { id: 'int-5', candidate_id: 'c5', manager_id: 'mgr-1', scheduled_by_id: 'mock-user-id', round_number: 1, type: 'zoom', datetime: d(30), location: null, zoom_link: 'https://zoom.us/j/444555666', google_calendar_event_id: null, status: 'completed', notes: 'Great energy', created_at: d(35) },
        ],
        created_at: d(40), updated_at: d(5),
    },
    {
        id: 'c6', name: 'Siti Nurhaliza', phone: '+65 8666 7777', email: 'siti.n@gmail.com',
        status: 'licensed', assigned_manager_id: 'mgr-1', assigned_manager_name: 'David Lim',
        created_by_id: 'mock-user-id', invite_token: null, notes: 'All 4 mandatory papers passed. Pending final activation.',
        interviews: [
            { id: 'int-6', candidate_id: 'c6', manager_id: 'mgr-1', scheduled_by_id: 'mock-user-id', round_number: 1, type: 'in_person', datetime: d(60), location: 'Lyfe Office', zoom_link: null, google_calendar_event_id: null, status: 'completed', notes: 'Excellent candidate', created_at: d(65) },
        ],
        created_at: d(70), updated_at: d(3),
    },
];
