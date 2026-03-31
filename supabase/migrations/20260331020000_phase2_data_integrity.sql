-- Phase 2: Data Integrity Fixes
-- Task 1: Add RLS policies to invitations table
-- Task 2: Fix candidate_module_progress FK mismatch — rewrite RLS function
-- Task 6: Fix delete_candidate RPC cascade gaps

-- ============================================================================
-- Task 1: invitations — RLS enabled but ZERO policies
-- Without policies, user-context queries return empty. Staff can't see PDFs,
-- candidates can't verify their own invitation in AuthContext.
-- Writes go through service-role (edge functions), so only SELECT needed.
-- ============================================================================

-- Staff can read all invitations
CREATE POLICY invitations_select_staff ON public.invitations
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'director', 'manager', 'pa')
  );

-- Candidates can read their own invitation (linked via user_id after acceptance)
CREATE POLICY invitations_select_own ON public.invitations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());


-- ============================================================================
-- Task 2: Fix can_access_candidate_user() — resolves through candidates table
--
-- The FK on candidate_module_progress.candidate_id references candidates(id)
-- (original DDL). The code passes candidates.id values via
-- getCandidateIdForUser(). But the existing RLS function treated the value as
-- users.id, causing RLS to block all reads for non-admin roles.
--
-- This rewrite resolves access through the candidates table and
-- candidate_profiles bridge.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_access_candidate_user(p_candidate_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    -- Self-access: the candidate's linked auth user can see their own progress
    EXISTS (
      SELECT 1 FROM candidate_profiles cp
      WHERE cp.candidate_id = p_candidate_id AND cp.user_id = auth.uid()
    )
    -- Direct manager: I am the assigned manager for this candidate
    OR EXISTS (
      SELECT 1 FROM candidates c
      WHERE c.id = p_candidate_id AND c.assigned_manager_id = auth.uid()
    )
    -- Director/higher: the candidate's manager reports to me
    OR EXISTS (
      SELECT 1 FROM candidates c
      JOIN users mgr ON mgr.id = c.assigned_manager_id
      WHERE c.id = p_candidate_id AND mgr.reports_to = auth.uid()
    )
    -- PA: candidate's manager is one of my assigned managers
    OR EXISTS (
      SELECT 1 FROM candidates c
      JOIN pa_manager_assignments pma ON pma.manager_id = c.assigned_manager_id
      WHERE c.id = p_candidate_id AND pma.pa_id = auth.uid()
    )
    -- Admin or director sees all
    OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'director');
$$;

-- Fix the misleading comments from the previous migration
COMMENT ON COLUMN candidate_module_progress.candidate_id IS
  'References candidates(id). Named candidate_id because it tracks a candidate''s progress through training modules. Resolve to users.id via candidate_profiles bridge.';

COMMENT ON COLUMN candidate_module_item_progress.candidate_id IS
  'References candidates(id). Named candidate_id because it tracks a candidate''s progress through module items. Resolve to users.id via candidate_profiles bridge.';


-- ============================================================================
-- Task 6: Fix delete_candidate RPC — missing candidates row deletion
--
-- Original RPC deletes disc_results, disc_responses, candidate_profiles,
-- invitations — but never deletes the candidates row itself.
-- candidate_activities and candidate_documents (which have ON DELETE CASCADE
-- from candidates) are also orphaned.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.delete_candidate(p_invitation_id uuid)
RETURNS void AS $$
DECLARE
  v_user_id uuid;
  v_candidate_id uuid;
BEGIN
  -- Resolve user_id and candidate_record_id from invitation
  SELECT user_id, candidate_record_id
  INTO v_user_id, v_candidate_id
  FROM public.invitations WHERE id = p_invitation_id;

  -- Clean up user-keyed data
  IF v_user_id IS NOT NULL THEN
    DELETE FROM public.disc_results WHERE user_id = v_user_id;
    DELETE FROM public.disc_responses WHERE user_id = v_user_id;
    DELETE FROM public.candidate_profiles WHERE user_id = v_user_id;
  END IF;

  -- Clean up candidate-keyed data (explicit for clarity, CASCADE would also handle these)
  IF v_candidate_id IS NOT NULL THEN
    DELETE FROM public.candidate_activities WHERE candidate_id = v_candidate_id;
    DELETE FROM public.candidate_documents WHERE candidate_id = v_candidate_id;
    DELETE FROM public.candidate_module_progress WHERE candidate_id = v_candidate_id;
    DELETE FROM public.candidate_module_item_progress WHERE candidate_id = v_candidate_id;
  END IF;

  -- Delete the invitation
  DELETE FROM public.invitations WHERE id = p_invitation_id;

  -- Delete the candidate record itself
  IF v_candidate_id IS NOT NULL THEN
    DELETE FROM public.candidates WHERE id = v_candidate_id;
  END IF;
END;
$$ LANGUAGE plpgsql SET search_path = public;
