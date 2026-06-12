-- lead-rpc-authz-test.sql — behavioral proof for audit H1.
--
-- Loads the REAL function definitions under test (via \i :mig — zero drift
-- from the committed migration) on top of a minimal lead schema and a faithful
-- copy of can_access_lead, then drives assign_lead_with_activity /
-- update_lead_status_with_activity as four different users and asserts who is
-- allowed vs blocked. Any mismatch RAISEs, so psql -v ON_ERROR_STOP=1 exits 1.
--
-- Run via scripts/verify-lead-rpc-authz.sh (provides the Supabase auth shim
-- that makes auth.uid()/auth.jwt() read request.jwt.claims).
--
-- :mig must be set to the path of the function migration under test, e.g.
--   psql -v mig=supabase/migrations/20260612000000_secure_lead_rpcs_access_control.sql

\set ON_ERROR_STOP on

-- ── minimal schema the functions depend on ────────────────────────────────
CREATE TYPE public.lead_status AS ENUM ('new', 'contacted', 'qualified', 'converted', 'lost');
CREATE TYPE public.lead_activity_type AS ENUM ('note', 'call', 'whatsapp', 'status_change', 'reassignment', 'unassignment');

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
    status public.lead_status NOT NULL DEFAULT 'new',
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.lead_activities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id uuid NOT NULL,
    user_id uuid NOT NULL,
    type public.lead_activity_type NOT NULL,
    description text,
    metadata jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Faithful copy of can_access_lead from 20260311000000_harden_rls_security.sql
-- (the authorization dependency, not the unit under test).
CREATE OR REPLACE FUNCTION public.can_access_lead(lead_assigned_to uuid, lead_created_by uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT
        lead_assigned_to = auth.uid()
        OR lead_created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = lead_assigned_to AND u.reports_to = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM pa_manager_assignments pma
            WHERE pma.pa_id = auth.uid()
            AND (
                lead_assigned_to = pma.manager_id
                OR EXISTS (
                    SELECT 1 FROM users u
                    WHERE u.id = lead_assigned_to AND u.reports_to = pma.manager_id
                )
            )
        )
        OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'director');
$$;

-- ── the functions under test (real committed migration, no drift) ─────────
\i :mig

-- ── fixture: a lead owned by an agent who reports to a manager ────────────
-- ids:  candidate …00c1 | agent …00a9 (reports to mgr) | manager …00d1 | admin …00ad | lead …feed
INSERT INTO public.users (id, role, reports_to) VALUES
    ('00000000-0000-0000-0000-0000000000d1', 'manager',   NULL),
    ('00000000-0000-0000-0000-0000000000c1', 'candidate', NULL),
    ('00000000-0000-0000-0000-0000000000a9', 'agent',     '00000000-0000-0000-0000-0000000000d1'),
    ('00000000-0000-0000-0000-0000000000ad', 'admin',     NULL);
INSERT INTO public.leads (id, assigned_to, created_by, status) VALUES
    ('00000000-0000-0000-0000-00000000feed', '00000000-0000-0000-0000-0000000000a9', '00000000-0000-0000-0000-0000000000d1', 'new');

-- ── assertion matrix ──────────────────────────────────────────────────────
-- Each scenario impersonates a user via request.jwt.claims, invokes the RPC,
-- and on a successful (allowed) call raises the OK sentinel so the fixture row
-- is never actually mutated. 'allowed' = OK sentinel fired; 'blocked' = the
-- function's own authorization exception fired.
DO $$
DECLARE
    lead uuid := '00000000-0000-0000-0000-00000000feed';
    cand uuid := '00000000-0000-0000-0000-0000000000c1';
    agt  uuid := '00000000-0000-0000-0000-0000000000a9';
    mgr  uuid := '00000000-0000-0000-0000-0000000000d1';
    adm  uuid := '00000000-0000-0000-0000-0000000000ad';
    failures text := '';
BEGIN
    -- 1. candidate reassigns a lead it cannot access -> BLOCKED
    PERFORM set_config('request.jwt.claims',
        json_build_object('sub', cand, 'role', 'authenticated',
                          'app_metadata', json_build_object('role', 'candidate'))::text, true);
    BEGIN
        PERFORM assign_lead_with_activity(lead, cand, cand);
        RAISE EXCEPTION 'OK_SENTINEL';
    EXCEPTION
        WHEN raise_exception THEN
            IF SQLERRM = 'OK_SENTINEL' THEN failures := failures || E'\n[1] candidate reassign foreign lead: VULNERABLE (allowed, expected blocked)'; END IF;
        WHEN insufficient_privilege THEN NULL; -- blocked as expected
        WHEN no_data_found THEN failures := failures || E'\n[1] candidate reassign foreign lead: unexpected no_data_found';
    END;

    -- 2. candidate changes status of a lead it cannot access -> BLOCKED
    BEGIN
        PERFORM update_lead_status_with_activity(lead, 'lost', 'new', cand);
        RAISE EXCEPTION 'OK_SENTINEL';
    EXCEPTION
        WHEN raise_exception THEN
            IF SQLERRM = 'OK_SENTINEL' THEN failures := failures || E'\n[2] candidate status-change foreign lead: VULNERABLE (allowed, expected blocked)'; END IF;
        WHEN insufficient_privilege THEN NULL;
        WHEN no_data_found THEN failures := failures || E'\n[2] candidate status-change foreign lead: unexpected no_data_found';
    END;

    -- 3. candidate spoofs a different acting id (uid mismatch) -> BLOCKED
    BEGIN
        PERFORM assign_lead_with_activity(lead, cand, mgr);
        RAISE EXCEPTION 'OK_SENTINEL';
    EXCEPTION
        WHEN raise_exception THEN
            -- Unauthorized is also raise_exception; only OK_SENTINEL means it ran.
            IF SQLERRM = 'OK_SENTINEL' THEN failures := failures || E'\n[3] candidate spoof acting_user_id: VULNERABLE (allowed, expected blocked)'; END IF;
        WHEN insufficient_privilege THEN NULL;
    END;

    -- 4. owning agent changes its OWN lead status -> ALLOWED
    PERFORM set_config('request.jwt.claims',
        json_build_object('sub', agt, 'role', 'authenticated',
                          'app_metadata', json_build_object('role', 'agent'))::text, true);
    BEGIN
        PERFORM update_lead_status_with_activity(lead, 'contacted', 'new', agt);
        RAISE EXCEPTION 'OK_SENTINEL';
    EXCEPTION
        WHEN raise_exception THEN
            IF SQLERRM <> 'OK_SENTINEL' THEN failures := failures || E'\n[4] owning agent status-change own lead: REGRESSION (' || SQLERRM || ')'; END IF;
        WHEN OTHERS THEN failures := failures || E'\n[4] owning agent status-change own lead: REGRESSION (' || SQLERRM || ')';
    END;

    -- 5. owning agent tries to REASSIGN (lacks reassign_leads capability) -> BLOCKED
    BEGIN
        PERFORM assign_lead_with_activity(lead, mgr, agt);
        RAISE EXCEPTION 'OK_SENTINEL';
    EXCEPTION
        WHEN raise_exception THEN
            IF SQLERRM = 'OK_SENTINEL' THEN failures := failures || E'\n[5] owning agent reassign (no capability): VULNERABLE (allowed, expected blocked)'; END IF;
        WHEN insufficient_privilege THEN NULL;
    END;

    -- 6. manager of the assigned agent reassigns -> ALLOWED
    PERFORM set_config('request.jwt.claims',
        json_build_object('sub', mgr, 'role', 'authenticated',
                          'app_metadata', json_build_object('role', 'manager'))::text, true);
    BEGIN
        PERFORM assign_lead_with_activity(lead, agt, mgr);
        RAISE EXCEPTION 'OK_SENTINEL';
    EXCEPTION
        WHEN raise_exception THEN
            IF SQLERRM <> 'OK_SENTINEL' THEN failures := failures || E'\n[6] managing manager reassign team lead: REGRESSION (' || SQLERRM || ')'; END IF;
        WHEN OTHERS THEN failures := failures || E'\n[6] managing manager reassign team lead: REGRESSION (' || SQLERRM || ')';
    END;

    -- 7. admin reassigns any lead -> ALLOWED
    PERFORM set_config('request.jwt.claims',
        json_build_object('sub', adm, 'role', 'authenticated',
                          'app_metadata', json_build_object('role', 'admin'))::text, true);
    BEGIN
        PERFORM assign_lead_with_activity(lead, agt, adm);
        RAISE EXCEPTION 'OK_SENTINEL';
    EXCEPTION
        WHEN raise_exception THEN
            IF SQLERRM <> 'OK_SENTINEL' THEN failures := failures || E'\n[7] admin reassign any lead: REGRESSION (' || SQLERRM || ')'; END IF;
        WHEN OTHERS THEN failures := failures || E'\n[7] admin reassign any lead: REGRESSION (' || SQLERRM || ')';
    END;

    IF failures <> '' THEN
        RAISE EXCEPTION 'H1 lead-RPC authz assertions FAILED:%', failures;
    END IF;
    RAISE NOTICE 'H1 lead-RPC authz: all 7 scenarios passed (candidate/foreign blocked, owner status + manager/admin reassign allowed)';
END $$;
