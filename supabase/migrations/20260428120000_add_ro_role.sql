-- Add 'ro' (Recruitment Officer) to the user_role enum and grant ROs the
-- same broad candidate visibility that admins and directors have.
--
-- Background: ROs handle pre-2nd-interview candidate work across all managers.
-- Unlike PAs (who are scoped to a specific manager via pa_manager_assignments),
-- ROs report only to the director and need to see + edit every candidate in
-- the system.
--
-- Existing safeguards already cover ROs without further change:
--   * validate_reports_to_role + validate_candidate_manager_role allow only
--     'manager' and 'director' as upline holders, so ROs are blocked from
--     being set as an agent's reports_to or a candidate's assigned_manager_id.
--   * sync_role_to_jwt() copies users.role into raw_app_meta_data verbatim,
--     so 'ro' propagates to JWT app_metadata automatically.

-- ── 1. Extend the user_role enum ──────────────────────────────────────────
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'ro';

-- ── 2. Extend the candidate visibility helper ─────────────────────────────
-- can_access_candidate gates SELECT/UPDATE on candidates and (transitively)
-- on candidate_profiles, candidate_activities, candidate_documents,
-- interviews, etc. Adding 'ro' to the admin/director clause grants ROs
-- the same global visibility without touching any per-table policy.
CREATE OR REPLACE FUNCTION public.can_access_candidate(cand_manager_id uuid, cand_created_by uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT
        cand_manager_id = auth.uid()
        OR cand_created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = cand_manager_id AND u.reports_to = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM pa_manager_assignments pma
            WHERE pma.pa_id = auth.uid()
            AND pma.manager_id = cand_manager_id
        )
        OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'director', 'ro');
$$;
