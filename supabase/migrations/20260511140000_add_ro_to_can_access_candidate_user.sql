-- =====================================================================
-- 1.12 — Add 'ro' to can_access_candidate_user admin clause
--
-- WHY:
--   20260331020000_phase2_data_integrity.sql defined the function with
--   final clause:
--     OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','director')
--   'ro' (recruitment officer, added 2026-04-28) is missing. RO users
--   therefore see zero rows on candidate detail screens for tables
--   gated by this helper: candidate_paper_attempts, candidate_milestones,
--   candidate_prep_course_bookings, candidate_module_progress,
--   candidate_module_item_progress, emock_attempts.
--
--   Per the capabilities matrix (lyfe-types/src/roles.ts), RO has
--   view_candidates + manage_milestones + verify_papers — all of
--   which depend on this helper.
--
-- WHAT:
--   Replace the function with 'ro' included in the role IN-list. Body
--   otherwise identical to 20260331020000 — same SECURITY DEFINER,
--   STABLE, search_path=public.
--
-- ROLLBACK:
--   Re-run the CREATE OR REPLACE from 20260331020000 (without 'ro').
-- =====================================================================

CREATE OR REPLACE FUNCTION public.can_access_candidate_user(p_candidate_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM candidate_profiles cp
      WHERE cp.candidate_id = p_candidate_id AND cp.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM candidates c
      WHERE c.id = p_candidate_id AND c.assigned_manager_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM candidates c
      JOIN users mgr ON mgr.id = c.assigned_manager_id
      WHERE c.id = p_candidate_id AND mgr.reports_to = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM candidates c
      JOIN pa_manager_assignments pma ON pma.manager_id = c.assigned_manager_id
      WHERE c.id = p_candidate_id AND pma.pa_id = auth.uid()
    )
    OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'director', 'ro');
$$;
