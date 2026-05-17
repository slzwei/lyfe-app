-- =====================================================================
-- Scope public.member_invitations SELECT policy by inviter / assignee
--
-- WHY:
--   The existing policy `member_invitations_staff_select` (from
--   20260331030000) lets any admin/director/manager SELECT every row.
--   The mobile Team tab's `fetchMyInvitations()` has no .eq() filter
--   and relies on RLS to scope rows — so every manager sees every
--   pending invite under their "Pending Invites" list, including ones
--   assigned to other managers. Reported 2026-05-17 (Daniel saw an
--   invite assigned to Shawn).
--
-- WHAT:
--   Replace the broad role-in-list policy with a properly-scoped one:
--     - admin   → see all (operational console)
--     - director → see all (matches existing "director sees all" pattern
--                  in fetchTeamMembers; known tech debt, separate fix)
--     - manager → only invitations they created OR are assigned to
--     - pa / ro → only invitations they created (they invite candidates,
--                 candidate invites are filtered out client-side anyway)
--
--   The companion `member_invitations_self_select` (20260404100000)
--   that lets a user read their own accepted row is left untouched.
--   The UPDATE policy `member_invitations_staff_update` (20260405110000)
--   is already correctly scoped to admin / inviter / assigned manager
--   so revoke permissions are unchanged.
--
-- VERIFY:
--   1. As manager Daniel (not inviter, not assignee), fetchMyInvitations()
--      should NOT return Shavon Teo (assigned to Shawn).
--   2. As manager Shawn (assignee), fetchMyInvitations() should return
--      Shavon Teo.
--   3. As admin Shawn Lee, fetchMyInvitations() should return all rows.
--   4. As director (any), fetchMyInvitations() should return all rows.
-- =====================================================================

DROP POLICY IF EXISTS member_invitations_staff_select ON public.member_invitations;

CREATE POLICY member_invitations_staff_select
  ON public.member_invitations FOR SELECT
  TO authenticated
  USING (
    -- Admins + directors see everything
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'director')
    -- Managers: only invites they sent OR are assigned to manage
    OR (
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager'
      AND (invited_by_id = auth.uid() OR assigned_manager_id = auth.uid())
    )
    -- PA / RO: only invites they sent (they invite candidates only)
    OR (
      (auth.jwt() -> 'app_metadata' ->> 'role') IN ('pa', 'ro')
      AND invited_by_id = auth.uid()
    )
  );
