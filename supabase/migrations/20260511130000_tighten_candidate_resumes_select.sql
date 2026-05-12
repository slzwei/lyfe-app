-- =====================================================================
-- 1.11 — Tighten candidate-resumes SELECT policy to staff-only
--
-- WHY:
--   Migration 20260311000000_harden_rls_security.sql created policy
--   `Authenticated users can view resumes` with USING `bucket_id =
--   'candidate-resumes'` — no role gate. Any authenticated user
--   (candidates and 'ro' included) can fetch any resume via
--   createSignedUrl with a guessed/enumerated path. The bucket holds
--   PII from prospective hires.
--
--   Migration 20260428130000_ro_storage_access.sql explicitly notes
--   "candidate-resumes — unchanged. Existing policy already allows
--   any authenticated user" — confirming the broad policy is still
--   live.
--
-- WHAT:
--   Replace with a role-gated SELECT matching the candidate-documents
--   pattern from 20260428130000. Includes 'ro' so the new role can
--   still inspect resumes attached to candidates they process.
--
-- VERIFICATION OF NO BREAKAGE (2026-05-11):
--   grep -rn "candidate-resumes" lyfe-sg/src/app/candidate → 0 hits.
--   All reads happen from staff actions (staff/candidates/actions.ts)
--   or the shared storage lib (lib/supabase/storage.ts), both of
--   which are invoked from staff-side routes. Candidate uploads use
--   service-role bypass for INSERT.
--
-- ROLLBACK:
--   DROP POLICY "Staff can view resumes" ON storage.objects;
--   CREATE POLICY "Authenticated users can view resumes"
--     ON storage.objects FOR SELECT
--     USING (bucket_id = 'candidate-resumes');
-- =====================================================================

DROP POLICY IF EXISTS "Authenticated users can view resumes" ON storage.objects;

CREATE POLICY "Staff can view resumes"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'candidate-resumes'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN
        ('admin', 'director', 'manager', 'agent', 'pa', 'ro')
  );
