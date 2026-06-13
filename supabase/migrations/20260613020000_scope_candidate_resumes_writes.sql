-- =====================================================================
-- H4 — Scope candidate-resumes WRITE policies (INSERT/UPDATE/DELETE) to staff
--
-- WHY:
--   The candidate-resumes bucket was created by
--   20260306123638_add_resume_url_to_candidates.sql with three write
--   policies that gate ONLY on bucket_id, for the `authenticated` role:
--       "Authenticated users can upload resumes"  (INSERT)
--       "Authenticated users can update resumes"  (UPDATE)
--       "Authenticated users can delete resumes"  (DELETE)
--   Every authenticated user — candidates included — therefore satisfies
--   them. The SELECT side was later locked to staff
--   (20260511130000_tighten_candidate_resumes_select.sql), but the write
--   side was never touched.
--
--   Verified live 2026-06-13 (rolled-back impersonation, role='candidate'):
--   a candidate could INSERT a brand-new object into the bucket. The
--   overwrite/delete of an *existing* object is presently blocked only as
--   a side effect of the staff-only SELECT policy (a candidate cannot
--   locate a row it cannot read, and ON CONFLICT DO UPDATE upsert trips
--   RLS) — an accidental, fragile mitigation that evaporates the moment
--   the SELECT policy is loosened. The write policies themselves remain
--   mis-scoped, so a non-staff user can still plant objects in the bucket.
--
-- WHAT:
--   Replace the three bucket-only write policies with role-gated versions
--   matching the existing "Staff can view resumes" SELECT policy
--   (20260511130000) and the candidate-documents write pattern
--   (20260428130000). Same staff role list, including 'ro'. As with those
--   policies the role check (not a TO clause) is the gate: anon/unscoped
--   callers have a NULL app_metadata.role and fail the IN (...) check.
--
--   Safe for every legitimate writer:
--     * lyfe-app mobile uploads/deletes (lib/recruitment/documents.ts,
--       lib/recruitment/candidates.ts) run under a staff JWT from
--       staff-only screens (Add Candidate, candidate detail).
--     * lyfe-sg invite-attachment uploads + resume deletes
--       (src/lib/supabase/storage.ts) use the service-role admin client,
--       which bypasses RLS entirely.
--     * Candidate-side resume upload at invite time is service-role on
--       lyfe-sg — never the authenticated client.
--
-- VERIFICATION OF NO BREAKAGE (2026-06-13):
--   grep -rn "candidate-resumes" across lyfe-app + lyfe-sg: every
--   authenticated-client write originates from a staff-gated surface;
--   every candidate-side write uses getAdminClient() (service role).
--
-- ROLLBACK:
--   DROP POLICY "Staff can upload resumes" ON storage.objects;
--   DROP POLICY "Staff can update resumes" ON storage.objects;
--   DROP POLICY "Staff can delete resumes" ON storage.objects;
--   -- then re-create the three "Authenticated users can ..." policies
--   -- from 20260306123638 (bucket_id-only, TO authenticated).
-- =====================================================================

-- Drop the broad bucket-only write policies (the vulnerable set)...
DROP POLICY IF EXISTS "Authenticated users can upload resumes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update resumes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete resumes" ON storage.objects;

-- ...and the role-gated names too, so a re-run / replay is a clean no-op.
DROP POLICY IF EXISTS "Staff can upload resumes" ON storage.objects;
DROP POLICY IF EXISTS "Staff can update resumes" ON storage.objects;
DROP POLICY IF EXISTS "Staff can delete resumes" ON storage.objects;

CREATE POLICY "Staff can upload resumes"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'candidate-resumes'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN
        ('admin', 'director', 'manager', 'agent', 'pa', 'ro')
  );

CREATE POLICY "Staff can update resumes"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'candidate-resumes'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN
        ('admin', 'director', 'manager', 'agent', 'pa', 'ro')
  );

CREATE POLICY "Staff can delete resumes"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'candidate-resumes'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN
        ('admin', 'director', 'manager', 'agent', 'pa', 'ro')
  );
