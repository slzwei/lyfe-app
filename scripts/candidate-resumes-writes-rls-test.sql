-- candidate-resumes-writes-rls-test.sql — behavioral proof for audit H4.
--
-- storage.objects (RLS-enabled + granted to anon/authenticated/service_role)
-- and auth.uid()/auth.jwt() come from scripts/db-rebuild-shim.sql. This harness
-- registers the bucket (objects.bucket_id has an FK to storage.buckets), adds
-- the staff-only SELECT policy that already shipped (20260511130000), seeds a
-- victim resume, then applies the WRITE-policy set under test via `\i :mig`
-- (zero drift from the committed file) and drives storage writes as three
-- personas, asserting:
--   * a candidate's writes are all denied (INSERT raises, UPDATE hits 0 rows),
--   * a staff manager can still upload + update resumes,
--   * an unscoped (no-role) caller is denied.
-- Any mismatch RAISEs, so psql -v ON_ERROR_STOP=1 exits non-zero.
--
-- :mig must be set to the policy set under test, e.g.
--   psql -v mig=supabase/migrations/20260613020000_scope_candidate_resumes_writes.sql
-- Point :mig at __fixtures__/candidate-resumes-writes-vulnerable.sql to prove
-- the suite FAILS on the pre-fix policies.

\set ON_ERROR_STOP on

-- Register the bucket (FK target) + the shipped staff-only SELECT policy.
INSERT INTO storage.buckets (id, name, public)
VALUES ('candidate-resumes', 'candidate-resumes', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Staff can view resumes" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'candidate-resumes'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','director','manager','agent','pa','ro')
  );

-- A victim resume owned by some other user, in a different candidate's folder.
INSERT INTO storage.objects (id, bucket_id, name, owner)
VALUES ('effe7c67-0000-0000-0000-000000000001', 'candidate-resumes', 'victim-candidate/resume.pdf', gen_random_uuid());

-- ── apply the write-policy set under test ─────────────────────────────────
\i :mig

-- ── persona 1: candidate — every write denied ─────────────────────────────
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
    json_build_object('sub','b5ab5b4c-0000-0000-0000-000000000004',
                      'app_metadata', json_build_object('role','candidate'))::text, true);
DO $$
DECLARE allowed boolean := false; n int;
BEGIN
    -- plant a brand-new object → must be denied
    BEGIN
        INSERT INTO storage.objects (bucket_id, name) VALUES ('candidate-resumes','attacker/new.pdf');
        allowed := true;
    EXCEPTION WHEN insufficient_privilege THEN allowed := false;
    END;
    IF allowed THEN RAISE EXCEPTION 'VULNERABLE: candidate could INSERT into candidate-resumes'; END IF;

    -- overwrite/delete an existing object → must affect 0 rows
    UPDATE storage.objects SET name = name WHERE bucket_id = 'candidate-resumes';
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 0 THEN RAISE EXCEPTION 'VULNERABLE: candidate updated % resume row(s)', n; END IF;

    RAISE NOTICE 'passed: candidate writes denied (INSERT blocked, UPDATE affected 0 rows)';
END $$;
ROLLBACK;

-- ── persona 2: staff manager — uploads + updates allowed ──────────────────
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
    json_build_object('sub','0091f8e8-0000-0000-0000-000000000002',
                      'app_metadata', json_build_object('role','manager'))::text, true);
DO $$
DECLARE n int;
BEGIN
    INSERT INTO storage.objects (bucket_id, name) VALUES ('candidate-resumes','staff/upload.pdf');
    UPDATE storage.objects SET name = name WHERE name = 'victim-candidate/resume.pdf';
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 1 THEN RAISE EXCEPTION 'REGRESSION: staff manager UPDATE affected % row(s) (expected 1)', n; END IF;
    RAISE NOTICE 'passed: staff manager can upload + update resumes';
END $$;
ROLLBACK;

-- ── persona 3: unscoped (no role) caller — denied ─────────────────────────
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{}', true);
DO $$
DECLARE allowed boolean := false;
BEGIN
    BEGIN
        INSERT INTO storage.objects (bucket_id, name) VALUES ('candidate-resumes','anon/x.pdf');
        allowed := true;
    EXCEPTION WHEN insufficient_privilege THEN allowed := false;
    END;
    IF allowed THEN RAISE EXCEPTION 'VULNERABLE: unscoped (no-role) caller could INSERT'; END IF;
    RAISE NOTICE 'passed: unscoped caller denied';
END $$;
ROLLBACK;

SELECT 'H4 candidate-resumes writes RLS behavioral test passed' AS result;
