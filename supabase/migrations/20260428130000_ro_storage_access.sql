-- Grant the 'ro' (Recruitment Officer) role storage access on the
-- candidate-documents and candidate-pdfs buckets.
--
-- Background: 20260428120000_add_ro_role added the enum value and extended
-- can_access_candidate so ROs can SELECT/UPDATE candidate rows + related
-- tables (candidate_documents, invitations). It did NOT update the
-- storage.objects RLS policies on the candidate-documents and candidate-pdfs
-- buckets, so RO users could see candidate_documents rows + invitation PDF
-- paths but createSignedUrl on the underlying storage objects returned
-- 404 ("Object not found" — Supabase masks RLS denials as 404s).
--
-- Symptom on mobile: every candidate detail screen logged
--   [getCandidateDocumentUrl] both buckets failed
-- when an RO opened it, and Registration Form / DISC Report / Enneagram
-- Report failed silently in getGeneratedPdfUrl (which has no warn or
-- captureError on RLS failure).
--
-- Pattern: idempotent DROP POLICY IF EXISTS + CREATE POLICY, mirroring
-- 20260331080000_phase2_high_severity.sql section 2.8. We append 'ro' to
-- the role list; all other roles' access is unchanged.
--
-- Scope:
--   * candidate-documents SELECT/INSERT/DELETE — ROs need both view + edit
--     per the add_ro_role migration commentary ("ROs need to see + edit
--     every candidate"). Without INSERT/DELETE, an RO clicking Add Document
--     or the trash icon would 403.
--   * candidate-pdfs SELECT only — these PDFs are written by lyfe-sg using
--     the service-role key, which bypasses RLS, so INSERT/DELETE policies
--     don't gate writes.
--   * candidate-resumes — unchanged. Existing policy already allows any
--     authenticated user.

-- ── candidate-documents bucket ────────────────────────────────────────────

DROP POLICY IF EXISTS "Staff can upload candidate documents" ON storage.objects;
DROP POLICY IF EXISTS "Staff can read candidate documents" ON storage.objects;
DROP POLICY IF EXISTS "Staff can delete candidate documents" ON storage.objects;

CREATE POLICY "Staff can upload candidate documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'candidate-documents'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'director', 'manager', 'agent', 'pa', 'ro')
  );

CREATE POLICY "Staff can read candidate documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'candidate-documents'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'director', 'manager', 'agent', 'pa', 'ro')
  );

CREATE POLICY "Staff can delete candidate documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'candidate-documents'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'director', 'manager', 'agent', 'pa', 'ro')
  );

-- ── candidate-pdfs bucket ─────────────────────────────────────────────────

DROP POLICY IF EXISTS "Staff can read candidate PDFs" ON storage.objects;

CREATE POLICY "Staff can read candidate PDFs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'candidate-pdfs'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'director', 'manager', 'pa', 'ro')
  );
