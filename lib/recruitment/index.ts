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
    type AssignableManager,
    fetchCandidates,
    fetchCandidate,
    createCandidate,
    updateCandidateStatus,
    fetchAssignableManagers,
    reassignCandidate,
    addCandidateActivity,
    syncAgentToMKTR,
} from './candidates';
export { getInviteUrl } from './invite-url';
export { scheduleInterview, updateInterview, deleteInterview } from './interviews';
export {
    fetchCandidateDocuments,
    uploadCandidateDocument,
    deleteCandidateDocument,
    getGeneratedPdfUrl,
} from './documents';
export { fetchPAManagerIds, fetchPAManagers, fetchPACandidateCount, fetchPAInterviewCount } from './pa-helpers';
