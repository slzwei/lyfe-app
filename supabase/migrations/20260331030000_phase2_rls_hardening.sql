-- Phase 2: RLS hardening for member_invitations and invitations tables
-- Defence-in-depth: all access is currently via service-role, but these
-- policies protect against accidental anon-key exposure.

-- ── 2.13: Re-enable RLS on member_invitations ──────────────────────────────
ALTER TABLE public.member_invitations ENABLE ROW LEVEL SECURITY;

-- Staff can read invitations they created or all if admin
CREATE POLICY member_invitations_staff_select
  ON public.member_invitations FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'director', 'manager')
  );

-- Staff can insert invitations
CREATE POLICY member_invitations_staff_insert
  ON public.member_invitations FOR INSERT
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'director', 'manager', 'pa')
  );

-- Block client-side UPDATE/DELETE (only service-role + triggers should modify)
CREATE POLICY member_invitations_deny_update
  ON public.member_invitations FOR UPDATE
  USING (false);

CREATE POLICY member_invitations_deny_delete
  ON public.member_invitations FOR DELETE
  USING (false);


-- ── 2.14: Add policies to invitations table ────────────────────────────────
-- RLS is already enabled but has zero policies.

-- Staff can read all invitations
CREATE POLICY invitations_staff_select
  ON public.invitations FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'director', 'manager', 'pa')
  );

-- Candidates can read their own invitation
CREATE POLICY invitations_candidate_select
  ON public.invitations FOR SELECT
  USING (
    user_id = auth.uid()
  );

-- Only staff can insert invitations
CREATE POLICY invitations_staff_insert
  ON public.invitations FOR INSERT
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'director', 'manager', 'pa')
  );

-- Only admin can update invitations via client
CREATE POLICY invitations_staff_update
  ON public.invitations FOR UPDATE
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Block client-side DELETE
CREATE POLICY invitations_deny_delete
  ON public.invitations FOR DELETE
  USING (false);
