// ── Enum const arrays (used for filter dropdowns + type-checking) ──

export const USER_ROLES = ['admin', 'director', 'manager', 'agent', 'pa', 'candidate'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const LIFECYCLE_STAGES = ['applied', 'interview_scheduled', 'interviewed', 'approved', 'exam_prep', 'licensed', 'active_agent'] as const;
export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

export const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'proposed', 'won', 'lost'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_SOURCES = ['referral', 'walk_in', 'online', 'event', 'cold_call', 'other'] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const PRODUCT_INTERESTS = ['life', 'health', 'ilp', 'general'] as const;
export type ProductInterest = (typeof PRODUCT_INTERESTS)[number];

export const CANDIDATE_STATUSES = ['applied', 'interview_scheduled', 'interviewed', 'approved', 'exam_prep', 'licensed', 'active_agent'] as const;
export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];

export const EVENT_TYPES = ['team_meeting', 'training', 'agency_event', 'roadshow', 'other'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const LEAD_ACTIVITY_TYPES = ['created', 'note', 'call', 'status_change', 'reassignment', 'email', 'meeting', 'follow_up'] as const;
export type LeadActivityType = (typeof LEAD_ACTIVITY_TYPES)[number];

export const CANDIDATE_ACTIVITY_TYPES = ['call', 'whatsapp', 'note'] as const;
export type CandidateActivityType = (typeof CANDIDATE_ACTIVITY_TYPES)[number];

export const INTERVIEW_STATUSES = ['scheduled', 'completed', 'cancelled', 'rescheduled'] as const;
export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

// ── Row types ──

export interface User {
  id: string;
  email: string | null;
  phone: string | null;
  full_name: string;
  avatar_url: string | null;
  role: UserRole;
  reports_to: string | null;
  reports_to_name?: string | null;
  lifecycle_stage: LifecycleStage | null;
  date_of_birth: string | null;
  last_login_at: string | null;
  push_token: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  source: LeadSource | null;
  source_name: string | null;
  status: LeadStatus;
  product_interest: ProductInterest | null;
  notes: string | null;
  assigned_to: string;
  assigned_to_name?: string;
  created_by: string;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface Candidate {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  status: CandidateStatus;
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
  event_type: EventType;
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
  options: Record<string, string>; // { A: "...", B: "...", C: "...", D: "..." }
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

export interface LeadActivity {
  id: string;
  lead_id: string;
  user_id: string;
  user_name?: string;
  lead_name?: string;
  type: LeadActivityType;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
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

export interface InviteToken {
  id: string;
  token: string;
  intended_role: UserRole;
  assigned_manager_id: string | null;
  assigned_manager_name?: string;
  created_by: string;
  created_by_name?: string;
  consumed_by: string | null;
  consumed_by_name?: string;
  consumed_at: string | null;
  expires_at: string;
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

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  director: 'Director',
  manager: 'Manager',
  agent: 'Agent',
  pa: 'PA',
  candidate: 'Candidate',
};

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  proposed: 'Proposed',
  won: 'Won',
  lost: 'Lost',
};

export const CANDIDATE_STATUS_LABELS: Record<CandidateStatus, string> = {
  applied: 'Applied',
  interview_scheduled: 'Interview Scheduled',
  interviewed: 'Interviewed',
  approved: 'Approved',
  exam_prep: 'Exam Prep',
  licensed: 'Licensed',
  active_agent: 'Active Agent',
};

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  team_meeting: 'Team Meeting',
  training: 'Training',
  agency_event: 'Agency Event',
  roadshow: 'Roadshow',
  other: 'Other',
};

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  referral: 'Referral',
  walk_in: 'Walk-in',
  online: 'Online',
  event: 'Event',
  cold_call: 'Cold Call',
  other: 'Other',
};

export const PRODUCT_INTEREST_LABELS: Record<ProductInterest, string> = {
  life: 'Life',
  health: 'Health',
  ilp: 'ILP',
  general: 'General',
};

// ── Supabase join response helpers ──
// These type the shape returned by Supabase `.select('*, relation(col)')` joins.

export type WithJoin<T> = T & { [key: string]: { full_name: string } | { name: string } | null };

export interface NameJoin {
  full_name: string;
}

/** Extract `full_name` from a Supabase join relation, falling back to a default. */
export function joinName(relation: NameJoin | null | undefined, fallback = 'Unknown'): string {
  return relation?.full_name ?? fallback;
}

/** Extract `name` from a Supabase join relation (e.g. candidates table). */
export function joinCandidateName(relation: { name: string } | null | undefined, fallback = 'Unknown'): string {
  return relation?.name ?? fallback;
}
