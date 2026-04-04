-- Fix: users cannot read their own accepted member_invitations row
--
-- checkInvitationStatus() in the mobile app queries member_invitations
-- with the user's JWT (RLS-enforced), but the only SELECT policy
-- restricts reads to admin/director/manager. This means any user
-- invited as agent, PA, or candidate after the INVITATION_SYSTEM_CUTOFF
-- gets silently rejected — the row exists but RLS hides it.
--
-- Add a self-read policy so authenticated users can see their own
-- accepted invitation.

CREATE POLICY member_invitations_self_select
  ON public.member_invitations FOR SELECT
  USING (accepted_by_id = auth.uid());
