-- users-pii-rls-test.sql — behavioral proof for audit H3.
--
-- Builds the pre-fix baseline (the correctly-scoped users SELECT policies the
-- canonical chain already ships, PLUS the prod-only blanket
-- `users_select_authenticated USING (true)` policy and the table-wide SELECT
-- grant), applies the REAL migration under test via `\i :mig` (zero drift from
-- the committed file), then drives SELECTs as four different DB sessions and
-- asserts:
--   * a candidate is scoped to their own row (was: all rows),
--   * staff keep the full directory (team/lead-ownership features depend on it),
--   * push_token is unreadable by the authenticated role for EVERYONE
--     (candidate AND staff) — only service_role may read it.
-- Any mismatch RAISEs, so psql -v ON_ERROR_STOP=1 exits non-zero.
--
-- Run via scripts/verify-users-pii-rls.sh (provides the Supabase auth shim so
-- auth.uid()/auth.jwt() read request.jwt.claims, and the anon/authenticated/
-- service_role roles).
--
-- :mig must be set to the migration under test, e.g.
--   psql -v mig=supabase/migrations/20260613010000_scope_users_select_pii.sql

\set ON_ERROR_STOP on

-- ── minimal schema the policies depend on ─────────────────────────────────
CREATE TYPE public.user_role AS ENUM ('admin','director','manager','agent','pa','candidate');

CREATE TABLE public.users (
    id            uuid PRIMARY KEY,
    email         text,
    phone         text,
    full_name     text NOT NULL,
    avatar_url    text,
    role          public.user_role NOT NULL,
    reports_to    uuid REFERENCES public.users(id),
    lifecycle_stage text,
    date_of_birth date,
    last_login_at timestamptz,
    is_active     boolean DEFAULT true,
    created_at    timestamptz DEFAULT now(),
    updated_at    timestamptz DEFAULT now(),
    external_id   text,
    push_token    text,
    notification_preferences jsonb,
    onboarding_complete boolean,
    email_verified boolean,
    last_seen_at  timestamptz,
    face_registered_at timestamptz,
    consent_tos_at timestamptz,
    consent_privacy_at timestamptz,
    consent_operational_push_at timestamptz,
    consent_marketing_at timestamptz,
    is_test_data  boolean DEFAULT false
);
CREATE TABLE public.pa_manager_assignments (
    pa_id      uuid NOT NULL,
    manager_id uuid NOT NULL
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Pre-fix grant the migration revokes: a table-wide SELECT to the client roles.
GRANT SELECT ON public.users TO anon, authenticated;

-- Canonical scoped policies (faithful to the live policy set).
CREATE POLICY users_select_own   ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY users_select_admin ON public.users FOR SELECT USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY users_select_team  ON public.users FOR SELECT USING (reports_to = auth.uid());
CREATE POLICY users_select_pa    ON public.users FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.pa_manager_assignments p WHERE p.pa_id = auth.uid() AND p.manager_id = users.id)
);
CREATE POLICY "Staff can read staff users" ON public.users FOR SELECT USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','director','manager','agent','pa')
);
-- The prod-only blanket policy the fix removes (audit H3).
CREATE POLICY users_select_authenticated ON public.users FOR SELECT USING (true);

-- Seed: admin, a manager, an agent reporting to that manager, and a candidate.
INSERT INTO public.users (id, email, phone, full_name, role, reports_to, push_token) VALUES
  ('00000000-0000-0000-0000-000000000001','admin@x','6511','Admin One','admin',   NULL,                                  'ExponentPushToken[admin]'),
  ('00000000-0000-0000-0000-000000000002','mgr@x',  '6522','Manager Two','manager',NULL,                                  'ExponentPushToken[mgr]'),
  ('00000000-0000-0000-0000-000000000003','agent@x','6533','Agent Three','agent', '00000000-0000-0000-0000-000000000002','ExponentPushToken[agent]'),
  ('00000000-0000-0000-0000-000000000004','cand@x', '6544','Cand Four',  'candidate',NULL,                                'ExponentPushToken[cand]');

-- ── apply the migration under test ────────────────────────────────────────
\i :mig

-- ── persona 1: candidate — own row only + push_token denied ───────────────
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
    json_build_object('sub','00000000-0000-0000-0000-000000000004',
                      'app_metadata', json_build_object('role','candidate'))::text, true);
DO $$
DECLARE n int; denied boolean := false;
BEGIN
    SELECT count(*) INTO n FROM public.users;
    IF n <> 1 THEN RAISE EXCEPTION 'VULNERABLE: candidate sees % user rows (expected 1 = own)', n; END IF;
    BEGIN
        PERFORM push_token FROM public.users;
        RAISE EXCEPTION 'LEAK: candidate read push_token';
    EXCEPTION WHEN insufficient_privilege THEN denied := true;
    END;
    IF NOT denied THEN RAISE EXCEPTION 'LEAK: push_token not denied to candidate'; END IF;
    RAISE NOTICE 'passed: candidate scoped to own row + push_token denied';
END $$;
ROLLBACK;

-- ── persona 2: staff agent — full directory retained + push_token denied ──
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
    json_build_object('sub','00000000-0000-0000-0000-000000000003',
                      'app_metadata', json_build_object('role','agent'))::text, true);
DO $$
DECLARE n int; denied boolean := false;
BEGIN
    SELECT count(*) INTO n FROM public.users;
    IF n <> 4 THEN RAISE EXCEPTION 'REGRESSION: staff agent sees % rows (expected 4 = full directory)', n; END IF;
    -- A granted column still reads fine.
    PERFORM full_name FROM public.users LIMIT 1;
    BEGIN
        PERFORM push_token FROM public.users;
        RAISE EXCEPTION 'LEAK: staff agent read push_token';
    EXCEPTION WHEN insufficient_privilege THEN denied := true;
    END;
    IF NOT denied THEN RAISE EXCEPTION 'LEAK: push_token not denied to staff agent'; END IF;
    RAISE NOTICE 'passed: staff directory intact + push_token denied to staff';
END $$;
ROLLBACK;

-- ── persona 3: admin — sees all rows (admin path unaffected) ──────────────
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
    json_build_object('sub','00000000-0000-0000-0000-000000000001',
                      'app_metadata', json_build_object('role','admin'))::text, true);
DO $$
DECLARE n int;
BEGIN
    SELECT count(*) INTO n FROM public.users;
    IF n <> 4 THEN RAISE EXCEPTION 'REGRESSION: admin sees % rows (expected 4)', n; END IF;
    RAISE NOTICE 'passed: admin sees all rows';
END $$;
ROLLBACK;

-- ── service_role still reads push_token (the edge-function path) ──────────
BEGIN;
SET LOCAL ROLE service_role;
DO $$
DECLARE tok text;
BEGIN
    SELECT push_token INTO tok FROM public.users WHERE id = '00000000-0000-0000-0000-000000000003';
    IF tok IS NULL THEN RAISE EXCEPTION 'BROKEN: service_role could not read push_token'; END IF;
    RAISE NOTICE 'passed: service_role still reads push_token';
END $$;
ROLLBACK;

SELECT 'H3 users-PII RLS behavioral test passed' AS result;
