/**
 * Recruitment types — Candidate pipeline & interview scheduling
 *
 * Shared types re-exported from lyfe-types. UI configs with IconName stay local.
 */

// ── Re-export all shared types ──
// ── Local UI configs (depend on IconName) ──
import type { CandidateStatus } from './shared/recruitment';
import type { InterviewRecommendation } from './shared/recruitment';
import type { IconName } from '@/types/ui';

export type {
    CandidateStatus,
    InterviewType,
    InterviewStatus,
    InterviewRecommendation,
    Interview,
    CandidateOutcome,
    CandidateActivity,
    DocumentLabel,
    CandidateDocument,
    AssignedManager,
    CandidateProfileDetails,
    CandidateDiscResults,
    RecruitmentCandidate,
    PaperCode,
    CandidatePaperAttempt,
    PaperRequirementCode,
    PaperRequirementStatus,
    PaperRequirement,
    MilestoneCode,
    MilestoneStatus,
    CandidateMilestone,
    PrepCourseCode,
    CandidatePrepCourseBooking,
} from './shared/recruitment';
export { DOCUMENT_LABELS, PAPER_CODES, MILESTONE_CODES, PREP_COURSE_CODES } from './shared/recruitment';

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
    eapp_done: { label: 'eApp Done', color: '#34C759', icon: 'shield-checkmark', order: 3 },
    exam_prep: { label: 'Exam Prep', color: '#FF3B30', icon: 'school', order: 4 },
    licensed: { label: 'Licensed', color: '#007AFF', icon: 'ribbon', order: 5 },
    active_agent: { label: 'Active Agent', color: '#FF7600', icon: 'star', order: 6 },
    on_hold: { label: 'On Hold', color: '#8E8E93', icon: 'pause-circle', order: 7 },
    rejected: { label: 'Rejected', color: '#FF3B30', icon: 'close-circle', order: 8 },
};

export const CANDIDATE_STATUSES = (
    Object.entries(CANDIDATE_STATUS_CONFIG) as [CandidateStatus, CandidateStatusConfig][]
)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([key]) => key);

export const RECOMMENDATION_CONFIG: Record<InterviewRecommendation, { label: string; color: string; icon: IconName }> =
    {
        second_interview: { label: '2nd Interview', color: '#007AFF', icon: 'refresh-outline' },
        on_hold: { label: 'On Hold', color: '#EAB308', icon: 'pause-circle-outline' },
        pass: { label: 'Pass', color: '#FF3B30', icon: 'close-circle-outline' },
    };
