-- =====================================================================
-- Baseline for Dashboard-created tables (audit C3)
--
-- WHY:
--   candidate_profiles, disc_responses, disc_results and invitations were
--   created by hand in the Supabase Dashboard (by the lyfe-sg ATS work,
--   ~2026-03-19/20) and never committed as migrations. ~30 later migrations
--   ALTER them, attach policies/triggers, or add them to the realtime
--   publication — so `supabase db reset` dies at the first reference
--   (20260320173133_enable_realtime.sql). The live database was the only
--   copy of the recipe. This file commits the recipe.
--
-- WHAT:
--   CREATEs the four tables in their original (pre-2026-03-20) shape: the
--   current production DDL MINUS every column/constraint/index/policy/
--   trigger that a later migration adds, so a fresh replay converges on
--   today's production state exactly. Deliberately NOT included here
--   (added by later migrations on replay):
--     - disc_results.results_email            (20260320190459_006_hardening)
--     - disc_results.duration_seconds         (20260321082112_disc_duration)
--     - invitations.profile_pdf_path/disc_pdf_path (20260321093751_pdf_storage)
--     - invitations.invited_by_user_id        (20260321113837_staff_auth_attribution)
--     - invitations.job_id                    (20260321115746_create_jobs_and_pipeline_v2)
--     - invitations.candidate_record_id + candidate_profiles.candidate_id
--                                             (20260321120644_bridge_candidate_models)
--     - invitations.attached_files            (20260322085947_invitation_attachments)
--     - invitations.assigned_manager_id       (20260322140000_add_assigned_manager_to_invitations)
--     - invitations.enneagram_pdf_path        (20260419120000_create_enneagram_tables)
--     - all progress/audit/milestone triggers, staff policies, perf indexes,
--       REPLICA IDENTITY FULL, and realtime publication membership.
--
--   The five invitations policies below (staff_select_invitations etc.) are
--   Dashboard-originals that exist in production but in no migration — they
--   are baselined here verbatim so the rebuilt policy set matches prod.
--   (They overlap the invitations_* policies that 20260331030000 adds later;
--   consolidating that redundancy is a separate, already-tracked item.)
--
--   Every statement is guarded (IF NOT EXISTS / pg_policies check), so
--   applying this file to production — where everything already exists —
--   is a strict no-op.
--
-- KNOWN DRIFT DELIBERATELY NOT CODIFIED HERE (tracked by other audit items):
--   - users_select_authenticated USING(true)  → audit H3 (to be replaced,
--     not reproduced)
--   - leads dual PERMISSIVE DELETE policies   → audit H5
--   - get_lead_pipeline_stats(uuid,boolean) 2-arg overload → audit H2
--   - synthetic_* tables exist in migrations but were hand-dropped in prod
-- =====================================================================

-- ── Dashboard-created functions ───────────────────────────────────────
-- sync_role_to_jwt() predates the migration chain (the on_user_role_change
-- trigger is re-pointed at it by 20260329190000, and 20260428120000 relies on
-- it) but no migration before then defines it. Existence-guarded — never
-- replaces a live definition (20260428-era prod must keep its current one).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'sync_role_to_jwt'
  ) THEN
    CREATE FUNCTION public.sync_role_to_jwt()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $fn$
    BEGIN
      UPDATE auth.users
      SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object('role', NEW.role::text)
      WHERE id = NEW.id;
      RETURN NEW;
    END;
    $fn$;
  END IF;
END $$;

-- ── invitations (created first: candidate_profiles FKs onto it) ──────

CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL,
  email text NOT NULL,
  candidate_name text,
  position_applied text,
  status text NOT NULL DEFAULT 'pending',
  invited_by text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  archived_at timestamptz,
  CONSTRAINT invitations_token_key UNIQUE (token),
  CONSTRAINT invitations_status_check
    CHECK (status IN ('pending', 'accepted', 'expired', 'revoked'))
);

CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.invitations (email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations (token);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = 'invitations' AND policyname = 'staff_select_invitations') THEN
    CREATE POLICY staff_select_invitations ON public.invitations
      FOR SELECT TO authenticated
      USING ((auth.jwt() -> 'app_metadata' ->> 'role')
        IN ('admin', 'director', 'manager', 'agent', 'pa'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = 'invitations' AND policyname = 'candidate_select_own_invitation') THEN
    CREATE POLICY candidate_select_own_invitation ON public.invitations
      FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = 'invitations' AND policyname = 'staff_insert_invitations') THEN
    CREATE POLICY staff_insert_invitations ON public.invitations
      FOR INSERT TO authenticated
      WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role')
        IN ('admin', 'director', 'manager', 'pa'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = 'invitations' AND policyname = 'staff_update_invitations') THEN
    CREATE POLICY staff_update_invitations ON public.invitations
      FOR UPDATE TO authenticated
      USING ((auth.jwt() -> 'app_metadata' ->> 'role')
        IN ('admin', 'director', 'manager'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = 'invitations' AND policyname = 'admin_delete_invitations') THEN
    CREATE POLICY admin_delete_invitations ON public.invitations
      FOR DELETE TO authenticated
      USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
  END IF;
END $$;

-- ── candidate_profiles ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.candidate_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position_applied text,
  expected_salary text,
  date_available date,
  full_name text NOT NULL DEFAULT '',
  chinese_name text,
  alias text,
  date_of_birth date,
  place_of_birth text,
  nationality text,
  race text,
  gender text,
  marital_status text,
  address_block text,
  address_street text,
  address_unit text,
  address_postal text,
  contact_number text,
  email text,
  ns_enlistment_date date,
  ns_ord_date date,
  ns_service_status text,
  ns_status text,
  ns_exemption_reason text,
  emergency_name text,
  emergency_relationship text,
  emergency_contact text,
  education jsonb NOT NULL DEFAULT '[]'::jsonb,
  software_competencies text,
  shorthand_wpm integer,
  typing_wpm integer,
  languages jsonb NOT NULL DEFAULT '[]'::jsonb,
  employment_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  additional_health boolean,
  additional_health_detail text,
  additional_dismissed boolean,
  additional_dismissed_detail text,
  additional_convicted boolean,
  additional_convicted_detail text,
  additional_bankrupt boolean,
  additional_bankrupt_detail text,
  additional_relatives boolean,
  additional_relatives_detail text,
  additional_prev_applied boolean,
  additional_prev_applied_detail text,
  declaration_agreed boolean NOT NULL DEFAULT false,
  declaration_date timestamptz,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  salary_period text DEFAULT 'hour',
  invitation_id uuid REFERENCES public.invitations(id),
  onboarding_step smallint NOT NULL DEFAULT 1,
  CONSTRAINT candidate_profiles_user_id_key UNIQUE (user_id)
);

ALTER TABLE public.candidate_profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = 'candidate_profiles' AND policyname = 'Users can view own profile') THEN
    CREATE POLICY "Users can view own profile" ON public.candidate_profiles
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = 'candidate_profiles' AND policyname = 'Users can insert own profile') THEN
    CREATE POLICY "Users can insert own profile" ON public.candidate_profiles
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = 'candidate_profiles' AND policyname = 'Users can update own profile') THEN
    CREATE POLICY "Users can update own profile" ON public.candidate_profiles
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── disc_responses ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.disc_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  responses jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT disc_responses_user_id_key UNIQUE (user_id)
);

ALTER TABLE public.disc_responses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = 'disc_responses' AND policyname = 'Users can view own disc responses') THEN
    CREATE POLICY "Users can view own disc responses" ON public.disc_responses
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = 'disc_responses' AND policyname = 'Users can insert own disc responses') THEN
    CREATE POLICY "Users can insert own disc responses" ON public.disc_responses
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = 'disc_responses' AND policyname = 'Users can update own disc responses') THEN
    CREATE POLICY "Users can update own disc responses" ON public.disc_responses
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── disc_results ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.disc_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  d_raw numeric NOT NULL,
  i_raw numeric NOT NULL,
  s_raw numeric NOT NULL,
  c_raw numeric NOT NULL,
  d_pct numeric NOT NULL,
  i_pct numeric NOT NULL,
  s_pct numeric NOT NULL,
  c_pct numeric NOT NULL,
  disc_type text NOT NULL,
  angle numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT disc_results_user_id_key UNIQUE (user_id)
);

ALTER TABLE public.disc_results ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = 'disc_results' AND policyname = 'Users can view own disc results') THEN
    CREATE POLICY "Users can view own disc results" ON public.disc_results
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = 'disc_results' AND policyname = 'Users can insert own disc results') THEN
    CREATE POLICY "Users can insert own disc results" ON public.disc_results
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = 'disc_results' AND policyname = 'Users can update own disc results') THEN
    CREATE POLICY "Users can update own disc results" ON public.disc_results
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;
