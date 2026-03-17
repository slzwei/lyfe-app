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
    fetchCandidates,
    fetchCandidate,
    createCandidate,
    updateCandidateStatus,
    addCandidateActivity,
    syncAgentToMKTR,
} from './candidates';
export { scheduleInterview, updateInterview, deleteInterview } from './interviews';
export { fetchCandidateDocuments, uploadCandidateDocument, deleteCandidateDocument } from './documents';
export { fetchPAManagerIds, fetchPAManagers, fetchPACandidateCount, fetchPAInterviewCount } from './pa-helpers';
