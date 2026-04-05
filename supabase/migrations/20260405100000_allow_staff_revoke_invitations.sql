-- Fix: revokeInvitation() silently fails because member_invitations_deny_update
-- blocks ALL client-side UPDATEs. Replace with a policy that lets staff
-- revoke pending invitations they have authority over.

DROP POLICY IF EXISTS member_invitations_deny_update ON public.member_invitations;
DROP POLICY IF EXISTS member_invitations_staff_update ON public.member_invitations;

CREATE POLICY member_invitations_staff_update
  ON public.member_invitations FOR UPDATE
  USING (
    status = 'pending'
    AND (
      -- Admin can revoke any invitation
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      -- Inviter can revoke their own
      OR invited_by_id = auth.uid()
      -- Manager/director can revoke invitations assigned to them
      OR (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('manager', 'director')
        AND assigned_manager_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    status = 'revoked'
  );
