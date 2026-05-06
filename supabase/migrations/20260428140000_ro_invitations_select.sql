-- Grant 'ro' (Recruitment Officer) SELECT access on the invitations table.
--
-- Background: The candidate detail screen reads
--   invitations.profile_pdf_path, disc_pdf_path, enneagram_pdf_path
-- to render the Registration / DISC / Enneagram PDF rows in the Documents
-- section. The 20260428120000_add_ro_role migration extended
-- can_access_candidate (which gates candidates, candidate_documents, and
-- candidate_profiles) but did NOT touch the invitations table's own RLS
-- policies. Result: ROs saw uploaded candidate_documents but the three
-- generated PDF rows never rendered, because the underlying invitations
-- read returned null.
--
-- Approach: add a new dedicated SELECT policy for 'ro'. We deliberately do
-- not modify the three existing staff SELECT policies
-- (invitations_select_staff, invitations_staff_select,
-- staff_select_invitations) — they're already-overlapping duplicates that
-- should be consolidated separately. An additive RO-only policy is
-- zero-risk to other roles.
--
-- Scope: SELECT only. ROs read invitations but don't create/modify them.
-- Invitation creation belongs to managers/PAs who initiate the recruitment
-- cycle; ROs process candidates after invitation acceptance.

CREATE POLICY "invitations_ro_select"
  ON public.invitations FOR SELECT
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'ro');
