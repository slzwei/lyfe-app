-- leads-delete-rls-test.sql — behavioral proof for audit H5.
--
-- auth.uid()/auth.jwt(), the anon/authenticated/service_role roles (service_role
-- with BYPASSRLS), and the public-schema default grants come from
-- scripts/db-rebuild-shim.sql. This harness builds the minimal leads schema +
-- a faithful copy of can_access_lead, enables RLS on leads, applies the
-- DELETE-policy set under test via `\i :mig` (zero drift from the committed
-- file), seeds a lead owned by an agent, then drives DELETE as three personas:
--   * owning agent  (authenticated) — DELETE of its OWN lead must hit 0 rows,
--   * admin         (authenticated) — DELETE must also hit 0 rows (the deny is
--                                     absolute for every authenticated role),
--   * service_role  (BYPASSRLS)     — DELETE must still hit 1 row, proving the
--                                     legitimate delete-account cascade path is
--                                     unaffected.
-- Any mismatch RAISEs, so psql -v ON_ERROR_STOP=1 exits non-zero.
--
-- :mig must be set to the DELETE-policy set under test, e.g.
--   psql -v mig=supabase/migrations/20260613030000_drop_leads_delete_allow_policy.sql
-- Point :mig at __fixtures__/leads-delete-vulnerable.sql to prove the suite
-- FAILS on the pre-fix policies (the agent's DELETE then succeeds → VULNERABLE).

\set ON_ERROR_STOP on

-- ── minimal schema can_access_lead depends on ─────────────────────────────
CREATE TABLE public.users (
    id uuid PRIMARY KEY,
    reports_to uuid REFERENCES public.users(id),
    role text NOT NULL
);
CREATE TABLE public.pa_manager_assignments (
    pa_id uuid NOT NULL,
    manager_id uuid NOT NULL
);
CREATE TABLE public.leads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    assigned_to uuid,
    created_by uuid,
    status text NOT NULL DEFAULT 'new',
    created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Faithful copy of the live can_access_lead (the authorization dependency the
-- leads_delete allow policy gated on — NOT the unit under test).
CREATE OR REPLACE FUNCTION public.can_access_lead(lead_assigned_to uuid, lead_created_by uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT
        lead_assigned_to = auth.uid()
        OR lead_created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM users u WHERE u.id = lead_assigned_to AND u.reports_to = auth.uid())
        OR EXISTS (
            SELECT 1 FROM pa_manager_assignments pma
            WHERE pma.pa_id = auth.uid()
            AND (lead_assigned_to = pma.manager_id
                 OR EXISTS (SELECT 1 FROM users u WHERE u.id = lead_assigned_to AND u.reports_to = pma.manager_id))
        )
        OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'director');
$$;

-- The shipped leads_select policy (20260404000000_audit_fixes.sql) — present so
-- the seeded lead is VISIBLE to the authenticated caller. Under RLS a DELETE
-- only affects rows the caller can BOTH see (a SELECT policy) AND delete (a
-- DELETE policy), so without this the delete would hit 0 rows on visibility
-- alone and mask the DELETE-policy behaviour. In prod this policy exists, which
-- is precisely why the pre-fix leads_delete allow policy was exploitable.
CREATE POLICY leads_select ON public.leads FOR SELECT TO authenticated
  USING (can_access_lead(assigned_to, created_by));

-- ── apply the DELETE-policy set under test ─────────────────────────────────
\i :mig

-- ── fixture: a lead owned by an agent who reports to a manager ─────────────
-- ids:  agent …00a9 (reports to mgr) | manager …00d1 | admin …00ad | lead …feed
INSERT INTO public.users (id, role, reports_to) VALUES
    ('00000000-0000-0000-0000-0000000000d1', 'manager', NULL),
    ('00000000-0000-0000-0000-0000000000a9', 'agent',   '00000000-0000-0000-0000-0000000000d1'),
    ('00000000-0000-0000-0000-0000000000ad', 'admin',   NULL);
INSERT INTO public.leads (id, assigned_to, created_by, status) VALUES
    ('00000000-0000-0000-0000-00000000feed', '00000000-0000-0000-0000-0000000000a9', '00000000-0000-0000-0000-0000000000d1', 'new');

-- ── persona 1: owning agent — DELETE of its OWN lead must be blocked ───────
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
    json_build_object('sub','00000000-0000-0000-0000-0000000000a9',
                      'app_metadata', json_build_object('role','agent'))::text, true);
DO $$
DECLARE n int;
BEGIN
    -- sanity: the agent CAN access this lead, so a 0-row delete is the DELETE
    -- policy biting — not an incidental visibility (SELECT-policy) block.
    IF NOT can_access_lead('00000000-0000-0000-0000-0000000000a9','00000000-0000-0000-0000-0000000000d1') THEN
        RAISE EXCEPTION 'TEST BUG: agent cannot access its own lead';
    END IF;
    DELETE FROM leads WHERE id = '00000000-0000-0000-0000-00000000feed';
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 0 THEN RAISE EXCEPTION 'VULNERABLE: owning agent hard-deleted % lead row(s) (expected 0)', n; END IF;
    RAISE NOTICE 'passed: owning agent DELETE blocked by RLS (0 rows)';
END $$;
ROLLBACK;

-- ── persona 2: admin (authenticated) — DELETE must also be blocked ─────────
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
    json_build_object('sub','00000000-0000-0000-0000-0000000000ad',
                      'app_metadata', json_build_object('role','admin'))::text, true);
DO $$
DECLARE n int;
BEGIN
    DELETE FROM leads WHERE id = '00000000-0000-0000-0000-00000000feed';
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 0 THEN RAISE EXCEPTION 'VULNERABLE: admin hard-deleted % lead row(s) (expected 0)', n; END IF;
    RAISE NOTICE 'passed: admin DELETE blocked by RLS (deny is absolute for authenticated)';
END $$;
ROLLBACK;

-- ── persona 3: service_role (BYPASSRLS) — cascade path must still work ─────
BEGIN;
SET LOCAL ROLE service_role;
DO $$
DECLARE n int;
BEGIN
    DELETE FROM leads WHERE id = '00000000-0000-0000-0000-00000000feed';
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 1 THEN RAISE EXCEPTION 'REGRESSION: service_role DELETE affected % row(s) (expected 1)', n; END IF;
    RAISE NOTICE 'passed: service_role (delete-account cascade) can still delete leads';
END $$;
ROLLBACK;

SELECT 'H5 leads hard-DELETE RLS behavioral test passed' AS result;
