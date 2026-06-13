-- Pre-fix fixture for audit H4 — the candidate-resumes WRITE policies exactly
-- as originally created by 20260306123638_add_resume_url_to_candidates.sql:
-- gated on bucket_id ALONE, for the `authenticated` role, so any authenticated
-- user (candidates included) can INSERT/UPDATE/DELETE in the bucket.
--
-- Used two ways:
--   * candidateResumesWriteAccessControl.test.ts parses it and asserts the
--     write policies are NOT role-gated — proving the suite's gate checks
--     discriminate (fail-before / pass-after).
--   * scripts/candidate-resumes-writes-rls-test.sql applies it via `\i :mig`
--     as the pre-fix baseline; a candidate INSERT then succeeds and the
--     harness RAISEs 'VULNERABLE', so verify-candidate-resumes-writes-rls.sh
--     exits non-zero.

CREATE POLICY "Authenticated users can upload resumes"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'candidate-resumes');

CREATE POLICY "Authenticated users can update resumes"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'candidate-resumes');

CREATE POLICY "Authenticated users can delete resumes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'candidate-resumes');
