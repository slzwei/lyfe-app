-- =====================================================================
-- 1.13 — Consolidate redundant invitations SELECT policies
--
-- WHY:
--   pg_policy on public.invitations currently has 7 SELECT-equivalent
--   policies, accumulated across 3 migrations (20260331020000,
--   20260331030000, 20260428140000). RLS evaluates them with OR
--   semantics so correctness isn't broken, but every SELECT pays the
--   evaluation cost of every policy. Audit cites this as a
--   medium-priority hygiene issue.
--
--   Current SELECT policies (verified via pg_policy 2026-05-11):
--     invitations_select_staff      admin/director/manager/pa
--     invitations_staff_select      admin/director/manager/pa
--     invitations_ro_select         ro
--     invitations_select_own        user_id = auth.uid()
--     invitations_candidate_select  user_id = auth.uid()
--     candidate_select_own_invitation  auth.uid() = user_id
--     staff_select_invitations      admin/director/manager/agent/pa
--                                   (note: includes agent — kept!)
--
-- WHAT:
--   Drop three duplicates that exactly overlap others:
--     - invitations_select_staff       (dup of invitations_staff_select)
--     - invitations_select_own         (dup of invitations_candidate_select)
--     - invitations_ro_select          (fold into staff_select with 'ro')
--   Then recreate invitations_staff_select to include 'ro'.
--
--   Intentionally NOT touched:
--     - staff_select_invitations  — has 'agent' in addition to staff,
--       which is intentional (agents see invitations they sent).
--       Removing or merging is a separate decision.
--     - candidate_select_own_invitation — semantically identical to
--       invitations_candidate_select but uses different policy name;
--       leaving for the next consolidation pass to avoid churn here.
--
-- VERIFY:
--   Existing staff queries on invitations should still return same
--   row sets (the surviving staff_select_invitations covers
--   admin/director/manager/agent/pa and the recreated
--   invitations_staff_select covers admin/director/manager/pa/ro).
--   Net access change: 'ro' gains SELECT (matches 20260428140000
--   original intent), nothing else changes.
--
-- ROLLBACK:
--   Re-create the 3 dropped policies with their original bodies
--   (see migrations 20260331020000:14-23 + 20260428140000:24-26).
-- =====================================================================

DROP POLICY IF EXISTS "invitations_select_staff" ON public.invitations;
DROP POLICY IF EXISTS "invitations_select_own" ON public.invitations;
DROP POLICY IF EXISTS "invitations_ro_select" ON public.invitations;
DROP POLICY IF EXISTS "invitations_staff_select" ON public.invitations;

CREATE POLICY "invitations_staff_select"
  ON public.invitations FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN
      ('admin', 'director', 'manager', 'pa', 'ro')
  );
