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
    applied: { label: 'Applied', color: '#5C7A9E', icon: 'person-add', order: 0 },
    interview_scheduled: { label: 'Interview', color: '#C89B3C', icon: 'calendar', order: 1 },
    interviewed: { label: 'Interviewed', color: '#B27AAE', icon: 'checkmark-circle', order: 2 },
    approved: { label: 'Approved', color: '#7A8C6B', icon: 'shield-checkmark', order: 3 },
    eapp_done: { label: 'eApp Done', color: '#7A8C6B', icon: 'shield-checkmark', order: 3 },
    exam_prep: { label: 'Exam Prep', color: '#D6552B', icon: 'school', order: 4 },
    licensed: { label: 'Licensed', color: '#5E6F51', icon: 'ribbon', order: 5 },
    active_agent: { label: 'Active Agent', color: '#D6552B', icon: 'star', order: 6 },
    on_hold: { label: 'On Hold', color: '#8B857A', icon: 'pause-circle', order: 7 },
    rejected: { label: 'Rejected', color: '#B33A2E', icon: 'close-circle', order: 8 },
};

export const CANDIDATE_STATUSES = (
    Object.entries(CANDIDATE_STATUS_CONFIG) as [CandidateStatus, CandidateStatusConfig][]
)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([key]) => key);

export const RECOMMENDATION_CONFIG: Record<InterviewRecommendation, { label: string; color: string; icon: IconName }> =
    {
        second_interview: { label: '2nd Interview', color: '#5C7A9E', icon: 'refresh-outline' },
        on_hold: { label: 'On Hold', color: '#C89B3C', icon: 'pause-circle-outline' },
        pass: { label: 'Pass', color: '#B33A2E', icon: 'close-circle-outline' },
    };
