-- Phase 1 security fixes from 2026-03-30 production readiness audit
-- Fixes: C-2 (notifications INSERT policy), C-3 (assign_candidate_role)

-- ═══════════════════════════════════════════════════════════════════
-- 1. Block client-side INSERT on notifications table
--    All legitimate inserts come from edge functions (service-role)
--    or DB triggers (SECURITY DEFINER), both of which bypass RLS.
--    Without this policy, any authenticated user can push-notify
--    any other user via the anon key + JWT.
-- ═══════════════════════════════════════════════════════════════════

CREATE POLICY notifications_insert_block ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (false);

-- ═══════════════════════════════════════════════════════════════════
-- 2. Drop assign_candidate_role() SECURITY DEFINER function
--    This function allowed any authenticated user with a NULL role
--    to self-assign the 'candidate' role by calling the RPC.
--    The handle_new_user trigger now handles role assignment,
--    making this function redundant and dangerous.
-- ═══════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.assign_candidate_role();
