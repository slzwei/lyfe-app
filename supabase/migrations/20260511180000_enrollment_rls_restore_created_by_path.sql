-- =====================================================================
-- 1.15-followup — Restore created_by access path on enrollment RLS
--
-- WHY:
--   Migration 20260511170000 swapped enrollment_select / enrollment_update
--   from can_access_candidate(manager_id, created_by_id) to
--   can_access_candidate_user(candidate_id). The new helper covers
--   four access paths (own profile, assigned_manager, director hierarchy,
--   PA assignment) plus admin/director/ro roles — but does NOT include
--   `candidates.created_by_id = auth.uid()`, which the old helper did.
--
--   Real-world effect: a manager who created a candidate, then had the
--   candidate reassigned to another manager, loses enrollment visibility
--   on that candidate. Rare in practice (created_by typically equals
--   assigned_manager) but a genuine semantic regression.
--
-- WHAT:
--   OR the created_by path back into both enrollment policies. We do
--   this at the policy level rather than modifying
--   can_access_candidate_user globally, because the central helper is
--   used by many tables (candidate_paper_attempts, candidate_milestones,
--   candidate_module_progress, etc.) and silently broadening their
--   access surface deserves a separate, deliberate decision.
--
-- ROLLBACK:
--   Recreate enrollment_select / enrollment_update with only the
--   helper call (as in 20260511170000).
-- =====================================================================

DROP POLICY IF EXISTS enrollment_select ON public.candidate_programme_enrollment;
DROP POLICY IF EXISTS enrollment_update ON public.candidate_programme_enrollment;

CREATE POLICY enrollment_select
  ON public.candidate_programme_enrollment
  FOR SELECT
  USING (
    public.can_access_candidate_user(candidate_id)
    OR EXISTS (
      SELECT 1 FROM public.candidates c
      WHERE c.id = candidate_programme_enrollment.candidate_id
        AND c.created_by_id = auth.uid()
    )
  );

CREATE POLICY enrollment_update
  ON public.candidate_programme_enrollment
  FOR UPDATE
  USING (
    public.can_access_candidate_user(candidate_id)
    OR EXISTS (
      SELECT 1 FROM public.candidates c
      WHERE c.id = candidate_programme_enrollment.candidate_id
        AND c.created_by_id = auth.uid()
    )
  )
  WITH CHECK (
    public.can_access_candidate_user(candidate_id)
    OR EXISTS (
      SELECT 1 FROM public.candidates c
      WHERE c.id = candidate_programme_enrollment.candidate_id
        AND c.created_by_id = auth.uid()
    )
  );
