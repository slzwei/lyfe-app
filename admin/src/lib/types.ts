/**
 * Admin panel types.
 *
 * Shared types (enums, core interfaces) imported from lyfe-types via synced copies.
 * Admin-specific types (ExamPaper, RoadmapModule, etc.) defined locally.
 *
 * Ownership boundaries:
 *   lyfe-sg    = candidate-facing ATS (invitations, onboarding, DISC, interviews, jobs)
 *   admin      = system management (users, roles, exams, training, analytics, events)
 *   lyfe-app   = field operations (leads, events, roadshows, candidate status updates)
 */

// ── Re-export shared types ──
export type { UserRole, LifecycleStage, CandidateStatus } from './shared-types/database';
export type {
    LeadStatus,
    LeadSource,
    ProductInterest,
    LeadActivityType,
    Lead,
    LeadActivity,
} from './shared-types/lead';
export type { EventType } from './shared-types/event';
export { STAFF_ROLES } from './shared-types/roles';

// ── Enum const arrays (for filter dropdowns) ──

export const USER_ROLES = ['admin', 'director', 'manager', 'agent', 'pa', 'candidate'] as const;
export const LIFECYCLE_STAGES = [
    'applied',
    'interview_scheduled',
    'interviewed',
    'approved',
    'eapp_done',
    'exam_prep',
    'licensed',
    'active_agent',
    'on_hold',
    'rejected',
] as const;
export const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'proposed', 'won', 'lost'] as const;
export const LEAD_SOURCES = ['referral', 'walk_in', 'online', 'event', 'cold_call', 'other'] as const;
export const PRODUCT_INTERESTS = ['life', 'health', 'ilp', 'general'] as const;
export const CANDIDATE_STATUSES = [
    'applied',
    'interview_scheduled',
    'interviewed',
    'approved',
    'eapp_done',
    'exam_prep',
    'licensed',
    'active_agent',
    'on_hold',
    'rejected',
] as const;
export const EVENT_TYPES = ['team_meeting', 'training', 'agency_event', 'roadshow', 'exam', 'other'] as const;
export const LEAD_ACTIVITY_TYPES = [
    'created',
    'note',
    'call',
    'status_change',
    'reassignment',
    'email',
    'meeting',
    'follow_up',
] as const;
export const CANDIDATE_ACTIVITY_TYPES = ['call', 'whatsapp', 'note'] as const;
export type CandidateActivityType = (typeof CANDIDATE_ACTIVITY_TYPES)[number];
export const INTERVIEW_STATUSES = ['scheduled', 'completed', 'cancelled', 'rescheduled'] as const;
export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

// ── Admin-specific row types ──

export interface User {
    id: string;
    email: string | null;
    phone: string | null;
    full_name: string;
    avatar_url: string | null;
    role: (typeof USER_ROLES)[number];
    reports_to: string | null;
    reports_to_name?: string | null;
    lifecycle_stage: (typeof LIFECYCLE_STAGES)[number] | null;
    date_of_birth: string | null;
    last_login_at: string | null;
    push_token: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface Candidate {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    status: (typeof CANDIDATE_STATUSES)[number];
    assigned_manager_id: string;
    assigned_manager_name?: string;
    created_by_id: string;
    created_by_name?: string;
    invite_token: string | null;
    notes: string | null;
    resume_url: string | null;
    created_at: string;
    updated_at: string;
}

export interface AgencyEvent {
    id: string;
    title: string;
    description: string | null;
    event_type: (typeof EVENT_TYPES)[number];
    event_date: string;
    start_time: string;
    end_time: string | null;
    location: string | null;
    created_by: string;
    creator_name?: string;
    created_at: string;
    updated_at: string;
    external_attendees: unknown[];
    attendee_count?: number;
}

export interface ExamPaper {
    id: string;
    code: string;
    title: string;
    description: string | null;
    duration_minutes: number;
    pass_percentage: number;
    question_count: number;
    is_active: boolean;
    is_mandatory: boolean;
    allow_multiple_answers: boolean;
    display_order: number;
    created_at: string;
    updated_at: string;
    actual_question_count?: number;
    attempt_count?: number;
}

export interface ExamQuestion {
    id: string;
    paper_id: string;
    question_number: number;
    question_text: string;
    has_latex: boolean;
    options: Record<string, string>;
    correct_answer: string;
    explanation: string | null;
    explanation_has_latex: boolean;
    created_at: string;
}

export interface ExamAttempt {
    id: string;
    user_id: string;
    user_name?: string;
    paper_id: string;
    paper_title?: string;
    status: string;
    score: number | null;
    total_questions: number;
    percentage: number | null;
    passed: boolean | null;
    started_at: string;
    submitted_at: string | null;
    duration_seconds: number | null;
    created_at: string;
}

export interface Interview {
    id: string;
    candidate_id: string;
    manager_id: string;
    scheduled_by_id: string;
    round_number: number;
    type: 'zoom' | 'in_person';
    datetime: string;
    location: string | null;
    zoom_link: string | null;
    status: InterviewStatus;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface CandidateActivity {
    id: string;
    candidate_id: string;
    user_id: string;
    user_name?: string;
    candidate_name?: string;
    type: CandidateActivityType;
    outcome: string | null;
    note: string | null;
    created_at: string;
}

export interface PaManagerAssignment {
    id: string;
    pa_id: string;
    pa_name?: string;
    manager_id: string;
    manager_name?: string;
    assigned_at: string;
}

// ── Label maps ──

export const ROLE_LABELS: Record<(typeof USER_ROLES)[number], string> = {
    admin: 'Admin',
    director: 'Director',
    manager: 'Manager',
    agent: 'Agent',
    pa: 'PA',
    candidate: 'Candidate',
};

export const LEAD_STATUS_LABELS: Record<(typeof LEAD_STATUSES)[number], string> = {
    new: 'New',
    contacted: 'Contacted',
    qualified: 'Qualified',
    proposed: 'Proposed',
    won: 'Won',
    lost: 'Lost',
};

export const CANDIDATE_STATUS_LABELS: Record<(typeof CANDIDATE_STATUSES)[number], string> = {
    applied: 'Applied',
    interview_scheduled: 'Interview Scheduled',
    interviewed: 'Interviewed',
    approved: 'Approved',
    eapp_done: 'eApp Done',
    exam_prep: 'Exam Prep',
    licensed: 'Licensed',
    active_agent: 'Active Agent',
    on_hold: 'On Hold',
    rejected: 'Rejected',
};

export const EVENT_TYPE_LABELS: Record<(typeof EVENT_TYPES)[number], string> = {
    team_meeting: 'Team Meeting',
    training: 'Training',
    agency_event: 'Agency Event',
    roadshow: 'Roadshow',
    exam: 'Exam',
    other: 'Other',
};

export const LEAD_SOURCE_LABELS: Record<(typeof LEAD_SOURCES)[number], string> = {
    referral: 'Referral',
    walk_in: 'Walk-in',
    online: 'Online',
    event: 'Event',
    cold_call: 'Cold Call',
    other: 'Other',
};

export const PRODUCT_INTEREST_LABELS: Record<(typeof PRODUCT_INTERESTS)[number], string> = {
    life: 'Life',
    health: 'Health',
    ilp: 'ILP',
    general: 'General',
};

// ── Supabase join response helpers ──

export type WithJoin<T> = T & { [key: string]: { full_name: string } | { name: string } | null };

export interface NameJoin {
    full_name: string;
}

export function joinName(relation: NameJoin | null | undefined, fallback = 'Unknown'): string {
    return relation?.full_name ?? fallback;
}

export function joinCandidateName(relation: { name: string } | null | undefined, fallback = 'Unknown'): string {
    return relation?.name ?? fallback;
}

// ── Roadmap types (admin-only — training builder) ──

export const MODULE_TYPES = ['training', 'exam', 'resource'] as const;
export type ModuleType = (typeof MODULE_TYPES)[number];

export const PROGRAMME_ICON_TYPES = ['seedling', 'sprout'] as const;
export type ProgrammeIconType = (typeof PROGRAMME_ICON_TYPES)[number];

export const MODULE_STATUSES = ['not_started', 'in_progress', 'completed'] as const;
export type ModuleStatus = (typeof MODULE_STATUSES)[number];

export const RESOURCE_TYPES = ['link', 'file', 'video', 'text'] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export interface RoadmapProgramme {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    display_order: number;
    icon_type: ProgrammeIconType;
    is_active: boolean;
    archived_at: string | null;
    archived_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface RoadmapModule {
    id: string;
    programme_id: string;
    title: string;
    description: string | null;
    learning_objectives: string | null;
    module_type: ModuleType;
    display_order: number;
    is_active: boolean;
    is_required: boolean;
    estimated_minutes: number | null;
    exam_paper_id: string | null;
    icon_name: string | null;
    icon_color: string | null;
    archived_at: string | null;
    archived_by: string | null;
    created_at: string;
    updated_at: string;
    exam_papers?: { code: string; title: string } | null;
}

export interface RoadmapResource {
    id: string;
    module_id: string;
    title: string;
    description: string | null;
    resource_type: ResourceType;
    content_url: string | null;
    content_text: string | null;
    display_order: number;
    is_active: boolean;
    created_at: string;
}

export interface RoadmapPrerequisite {
    id: string;
    module_id: string;
    required_module_id: string;
    created_at: string;
}

export const MODULE_TYPE_LABELS: Record<ModuleType, string> = {
    training: 'Training',
    exam: 'Exam',
    resource: 'Resource',
};

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
    link: 'Link',
    file: 'File',
    video: 'Video',
    text: 'Article',
};

export const ITEM_TYPES = ['material', 'pre_quiz', 'quiz', 'exam', 'attendance'] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const ITEM_RESOURCE_TYPES = ['pdf', 'video', 'link', 'image'] as const;
export type ItemResourceType = (typeof ITEM_RESOURCE_TYPES)[number];

export interface RoadmapModuleItem {
    id: string;
    module_id: string;
    item_type: ItemType;
    title: string;
    description: string | null;
    display_order: number;
    is_required: boolean;
    is_active: boolean;
    icon_name: string | null;
    resource_url: string | null;
    resource_type: ItemResourceType | null;
    exam_paper_id: string | null;
    pass_percentage: number | null;
    time_limit_minutes: number | null;
    archived_at: string | null;
    archived_by: string | null;
    created_at: string;
    updated_at: string;
    roadmap_modules?: { title: string } | null;
    exam_papers?: { code: string; title: string } | null;
}

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
    material: 'Material',
    pre_quiz: 'Pre-Quiz',
    quiz: 'Quiz',
    exam: 'Exam',
    attendance: 'Attendance',
};

export const ITEM_RESOURCE_TYPE_LABELS: Record<ItemResourceType, string> = {
    pdf: 'PDF',
    video: 'Video',
    link: 'Link',
    image: 'Image',
};
