-- ═══════════════════════════════════════════════════════════════════════════════
-- Audit Log: track all INSERT/UPDATE/DELETE on critical tables
-- ═══════════════════════════════════════════════════════════════════════════════
-- Design decisions (from FMEA):
--   1. Exception handler: trigger NEVER blocks business operations
--   2. zzz_ prefix: fires LAST after all business-logic triggers
--   3. RLS via JWT only: admin-only read, no users table join
--   4. disc_responses excluded from UPDATE audit (auto-save noise)
--   5. txid_current() groups cascade deletes into logical units
--   6. source column distinguishes app users vs service-role vs dashboard

-- ─── 1. Create audit_log table ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.audit_log (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_name  text        NOT NULL,
  operation   text        NOT NULL,  -- INSERT, UPDATE, DELETE
  actor_id    uuid,                  -- auth.uid() if available
  actor_role  text,                  -- JWT app_metadata.role
  source      text        NOT NULL DEFAULT 'unknown',  -- app, service_role, dashboard
  old_data    jsonb,                 -- NULL for INSERT
  new_data    jsonb,                 -- NULL for DELETE
  tx_id       bigint      NOT NULL,  -- txid_current() to group cascade operations
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for querying by table + time range
CREATE INDEX idx_audit_log_table_created
  ON public.audit_log (table_name, created_at DESC);

-- Index for querying by actor
CREATE INDEX idx_audit_log_actor_created
  ON public.audit_log (actor_id, created_at DESC)
  WHERE actor_id IS NOT NULL;

-- ─── 2. RLS: admin-only read, no insert/update/delete policies ──────────────

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_audit_log"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (
    ((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'
  );

-- ─── 3. Trigger function ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.zzz_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id   uuid;
  v_actor_role text;
  v_source     text;
  v_old        jsonb;
  v_new        jsonb;
BEGIN
  -- Never let audit logging break a business operation
  BEGIN
    -- Resolve actor via fallback chain
    v_actor_id := COALESCE(
      auth.uid(),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
    );

    -- Resolve role from JWT
    v_actor_role := (
      nullif(current_setting('request.jwt.claims', true), '')::jsonb
      -> 'app_metadata' ->> 'role'
    );

    -- Determine source context
    IF v_actor_id IS NOT NULL THEN
      v_source := 'app';
    ELSIF current_user IN ('supabase_admin', 'postgres') THEN
      v_source := 'dashboard';
    ELSE
      v_source := 'service_role';
    END IF;

    -- Serialize row data
    IF TG_OP = 'DELETE' THEN
      v_old := row_to_json(OLD)::jsonb;
      v_new := NULL;
    ELSIF TG_OP = 'INSERT' THEN
      v_old := NULL;
      v_new := row_to_json(NEW)::jsonb;
    ELSE -- UPDATE
      v_old := row_to_json(OLD)::jsonb;
      v_new := row_to_json(NEW)::jsonb;
    END IF;

    INSERT INTO public.audit_log (table_name, operation, actor_id, actor_role, source, old_data, new_data, tx_id)
    VALUES (TG_TABLE_NAME, TG_OP, v_actor_id, v_actor_role, v_source, v_old, v_new, txid_current());

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[audit_log] write failed on %.%: %', TG_TABLE_NAME, TG_OP, SQLERRM;
  END;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ─── 4. Attach triggers to critical tables ──────────────────────────────────
-- Named zzz_ to fire LAST (PostgreSQL fires AFTER triggers alphabetically)

-- candidates
CREATE TRIGGER zzz_audit_candidates
  AFTER INSERT OR UPDATE OR DELETE ON public.candidates
  FOR EACH ROW EXECUTE FUNCTION public.zzz_audit_trigger();

-- invitations
CREATE TRIGGER zzz_audit_invitations
  AFTER INSERT OR UPDATE OR DELETE ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION public.zzz_audit_trigger();

-- candidate_profiles
CREATE TRIGGER zzz_audit_candidate_profiles
  AFTER INSERT OR UPDATE OR DELETE ON public.candidate_profiles
  FOR EACH ROW EXECUTE FUNCTION public.zzz_audit_trigger();

-- disc_results
CREATE TRIGGER zzz_audit_disc_results
  AFTER INSERT OR UPDATE OR DELETE ON public.disc_results
  FOR EACH ROW EXECUTE FUNCTION public.zzz_audit_trigger();

-- disc_responses: INSERT and DELETE only (skip UPDATE — auto-save is too noisy)
CREATE TRIGGER zzz_audit_disc_responses
  AFTER INSERT OR DELETE ON public.disc_responses
  FOR EACH ROW EXECUTE FUNCTION public.zzz_audit_trigger();

-- leads
CREATE TRIGGER zzz_audit_leads
  AFTER INSERT OR UPDATE OR DELETE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.zzz_audit_trigger();

-- lead_activities
CREATE TRIGGER zzz_audit_lead_activities
  AFTER INSERT OR UPDATE OR DELETE ON public.lead_activities
  FOR EACH ROW EXECUTE FUNCTION public.zzz_audit_trigger();

-- event_attendees
CREATE TRIGGER zzz_audit_event_attendees
  AFTER INSERT OR UPDATE OR DELETE ON public.event_attendees
  FOR EACH ROW EXECUTE FUNCTION public.zzz_audit_trigger();

-- pa_manager_assignments
CREATE TRIGGER zzz_audit_pa_manager_assignments
  AFTER INSERT OR UPDATE OR DELETE ON public.pa_manager_assignments
  FOR EACH ROW EXECUTE FUNCTION public.zzz_audit_trigger();

-- ─── 5. Retention: auto-delete audit rows older than 180 days ───────────────

SELECT cron.schedule(
  'audit-log-cleanup',
  '0 3 * * 0',  -- weekly Sunday 3am UTC
  $$DELETE FROM public.audit_log WHERE created_at < now() - interval '180 days'$$
);
