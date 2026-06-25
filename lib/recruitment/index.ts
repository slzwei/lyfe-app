/**
 * Recruitment service — barrel re-export from sub-modules.
 *
 * Sub-modules:
 *   candidates.ts  — Candidate CRUD, resume, activities, MKTR sync
 *   interviews.ts  — Interview scheduling, update, delete
 *   documents.ts   — Candidate document management
 *   pa-helpers.ts  — PA-specific queries (manager IDs, counts)
 */
export {
    type CreateCandidateInput,
    type CandidateArchiveMode,
    type AssignableManager,
    fetchCandidates,
    fetchCandidate,
    createCandidate,
    updateCandidateStatus,
    rejectCandidate,
    activateAgent,
    archiveCandidate,
    deleteCandidate,
    fetchAssignableManagers,
    reassignCandidate,
    addCandidateActivity,
} from './candidates';
export { getInviteUrl } from './invite-url';
export { scheduleInterview, updateInterview, deleteInterview } from './interviews';
export {
    fetchCandidateDocuments,
    uploadCandidateDocument,
    deleteCandidateDocument,
    getGeneratedPdfUrl,
    getCandidateDocumentUrl,
} from './documents';
export { getDocumentKind } from './documentKind';
export type { DocumentKind } from './documentKind';
export { fetchPAManagerIds, fetchPAManagers, fetchPACandidateCount, fetchPAInterviewCount } from './pa-helpers';
export {
    fetchPaperAttempts,
    fetchMilestones,
    fetchPrepCourseBookings,
    fetchEmockAttemptsForCandidate,
    checkAllPapersPassed,
    upsertPaperAttempt,
    deletePaperAttempt,
    upsertMilestone,
    upsertPrepCourseBooking,
    markCandidateLicensed,
    type PaperAttemptPatch,
    type MilestonePatch,
    type PrepCourseBookingPatch,
} from './progression';
