-- =====================================================================
-- 1.15 — Replace enrollment correlated-subquery RLS with
--        can_access_candidate_user(candidate_id)
--
-- WHY:
--   Current policies on public.candidate_programme_enrollment
--   (verified via pg_policy 2026-05-11):
--
--     enrollment_select USING (
--       can_access_candidate(
--         (SELECT assigned_manager_id FROM candidates
--           WHERE id = candidate_programme_enrollment.candidate_id),
--         (SELECT created_by_id FROM candidates
--           WHERE id = candidate_programme_enrollment.candidate_id)
--       )
--     )
--     enrollment_update — identical USING expression
--
--   Issues:
--   1. Two correlated SELECTs per row evaluation. On large enrollment
--      scans this is 2N candidate-table lookups.
--   2. Uses the older `can_access_candidate(manager_id, created_by_id)`
--      helper which doesn't account for PA assignments, hierarchy via
--      reports_to, or the 'ro' role added 2026-04-28. Net effect:
--      ROs, PAs (for managers' candidates), and director hierarchy
--      may see enrollment rows for which they cannot see the parent
--      candidate — inconsistent access surface.
--
--   The newer helper `can_access_candidate_user(p_candidate_id)`
--   (migration 20260331020000, with 'ro' added immediately upstream
--   in 20260511140000) handles all four access paths in a single
--   STABLE SECURITY DEFINER call. Postgres caches results within
--   a query so 2N becomes ~N.
--
-- WHAT:
--   Replace USING expressions on enrollment_select + enrollment_update
--   to call can_access_candidate_user(candidate_id) directly.
--
--   enrollment_delete + deny_delete_candidate_programme_enrollment
--   + enrollment_upsert are untouched (different intents).
--
-- DEPENDENCY:
--   This migration assumes can_access_candidate_user includes 'ro'.
--   The immediately upstream migration 20260511140000 adds it.
--   If running on a DB without that migration, ROs lose access to
--   enrollment rows (no functional regression — they previously had
--   no access via the old helper either).
--
-- VERIFY:
--   Before: as a PA mapped to a manager, query enrollment for that
--           manager's candidates — verify row counts.
--   After:  same query → same row count (PA path now goes through
--           the new helper which also includes PA assignments).
--
--   As an RO user → enrollment rows visible (was 0 before).
--
-- ROLLBACK:
--   Recreate the old policies pointing at can_access_candidate(...) —
--   see prior bodies above.
-- =====================================================================

DROP POLICY IF EXISTS enrollment_select ON public.candidate_programme_enrollment;
DROP POLICY IF EXISTS enrollment_update ON public.candidate_programme_enrollment;

CREATE POLICY enrollment_select
  ON public.candidate_programme_enrollment
  FOR SELECT
  USING ( public.can_access_candidate_user(candidate_id) );

CREATE POLICY enrollment_update
  ON public.candidate_programme_enrollment
  FOR UPDATE
  USING ( public.can_access_candidate_user(candidate_id) )
  WITH CHECK ( public.can_access_candidate_user(candidate_id) );
