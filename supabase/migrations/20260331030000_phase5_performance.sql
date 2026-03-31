-- Phase 5: Performance — index cleanup and additions

-- ============================================================================
-- Task 1: Drop duplicate indexes
-- The initial schema snapshot created indexes that were redefined in later
-- migrations with _id suffix. Each pair indexes the same column — drop the
-- shorter-named duplicates to save storage and speed up writes.
-- ============================================================================

DROP INDEX IF EXISTS idx_candidates_created_by;     -- duplicate of idx_candidates_created_by_id
DROP INDEX IF EXISTS idx_candidates_manager;         -- duplicate of idx_candidates_assigned_manager_id
DROP INDEX IF EXISTS idx_exam_answers_attempt;       -- duplicate of idx_exam_answers_attempt_id
DROP INDEX IF EXISTS idx_interviews_candidate;       -- duplicate of idx_interviews_candidate_id
DROP INDEX IF EXISTS idx_interviews_manager;         -- duplicate of idx_interviews_manager_id


-- ============================================================================
-- Task 2: Add missing FK indexes
-- FK columns without indexes cause sequential scans on JOINs and constraint
-- checks. Partial indexes used where columns are nullable.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_invitations_invited_by_user
  ON public.invitations(invited_by_user_id)
  WHERE invited_by_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invitations_job
  ON public.invitations(job_id)
  WHERE job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_candidate_activities_user
  ON public.candidate_activities(user_id);

CREATE INDEX IF NOT EXISTS idx_lead_activities_user_created
  ON public.lead_activities(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_users_active_role
  ON public.users(role)
  WHERE is_active = true;
