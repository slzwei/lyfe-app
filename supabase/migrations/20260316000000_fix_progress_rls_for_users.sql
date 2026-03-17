-- ============================================================================
-- Fix RLS policies on candidate progress tables.
--
-- The candidate_id FK on candidate_module_progress and
-- candidate_module_item_progress was re-pointed from candidates(id) to
-- users(id), but the RLS policies still JOIN on the candidates table.
-- Since no candidates rows match users IDs, all reads/writes are silently
-- blocked for candidates viewing their own roadmap.
--
-- This migration:
--   1. Creates can_access_candidate_user(uuid) — mirrors can_access_candidate
--      but resolves manager/creator via the users table (reports_to).
--   2. Replaces all four policies on candidate_module_progress.
--   3. Replaces all four policies on candidate_module_item_progress.
-- ============================================================================

-- 1. Helper function: can the current auth user access this candidate's data?
--    p_candidate_user_id is a users.id for a candidate-role user.
CREATE OR REPLACE FUNCTION public.can_access_candidate_user(p_candidate_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT
        -- Self-access: the candidate can see/edit their own progress
        p_candidate_user_id = auth.uid()
        -- Direct manager: the candidate reports to me
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = p_candidate_user_id AND u.reports_to = auth.uid()
        )
        -- Director/manager whose report manages this candidate
        OR EXISTS (
            SELECT 1 FROM users u
            JOIN users mgr ON mgr.id = u.reports_to
            WHERE u.id = p_candidate_user_id AND mgr.reports_to = auth.uid()
        )
        -- PA: candidate's manager is one of my assigned managers
        OR EXISTS (
            SELECT 1 FROM users u
            JOIN pa_manager_assignments pma ON pma.manager_id = u.reports_to
            WHERE u.id = p_candidate_user_id AND pma.pa_id = auth.uid()
        )
        -- Admin or director sees all
        OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'director');
$$;

-- ============================================================================
-- 2. candidate_module_progress — replace policies
-- ============================================================================

DROP POLICY IF EXISTS progress_select ON candidate_module_progress;
DROP POLICY IF EXISTS progress_upsert ON candidate_module_progress;
DROP POLICY IF EXISTS progress_update ON candidate_module_progress;
DROP POLICY IF EXISTS progress_delete ON candidate_module_progress;

CREATE POLICY progress_select ON candidate_module_progress
    FOR SELECT TO authenticated
    USING (can_access_candidate_user(candidate_id));

CREATE POLICY progress_upsert ON candidate_module_progress
    FOR INSERT TO authenticated
    WITH CHECK (can_access_candidate_user(candidate_id));

CREATE POLICY progress_update ON candidate_module_progress
    FOR UPDATE TO authenticated
    USING (can_access_candidate_user(candidate_id));

CREATE POLICY progress_delete ON candidate_module_progress
    FOR DELETE TO authenticated
    USING (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text);

-- ============================================================================
-- 3. candidate_module_item_progress — replace policies
-- ============================================================================

DROP POLICY IF EXISTS item_progress_select ON candidate_module_item_progress;
DROP POLICY IF EXISTS item_progress_insert ON candidate_module_item_progress;
DROP POLICY IF EXISTS item_progress_update ON candidate_module_item_progress;
DROP POLICY IF EXISTS item_progress_delete ON candidate_module_item_progress;

CREATE POLICY item_progress_select ON candidate_module_item_progress
    FOR SELECT TO authenticated
    USING (can_access_candidate_user(candidate_id));

CREATE POLICY item_progress_insert ON candidate_module_item_progress
    FOR INSERT TO authenticated
    WITH CHECK (can_access_candidate_user(candidate_id));

CREATE POLICY item_progress_update ON candidate_module_item_progress
    FOR UPDATE TO authenticated
    USING (can_access_candidate_user(candidate_id));

CREATE POLICY item_progress_delete ON candidate_module_item_progress
    FOR DELETE TO authenticated
    USING (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text);
