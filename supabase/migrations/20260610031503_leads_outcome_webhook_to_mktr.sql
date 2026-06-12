-- Recovered 2026-06-12 (audit C3): this migration was applied to production
-- on 2026-06-10 (via MCP, during mktr-platform work) but the file was never
-- committed here. Content restored verbatim from
-- supabase_migrations.schema_migrations.statements for version 20260610031503.

CREATE OR REPLACE FUNCTION public.leads_notify_mktr_outcome()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault, pg_temp
AS $$
DECLARE
  v_url     text;
  v_secret  text;
  v_payload jsonb;
  v_body    text;
  v_sig     text;
  v_ts      text;
BEGIN
  -- Fire only on the first transition INTO a tracked status, for MKTR-origin leads.
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NULL;
  END IF;
  IF NEW.status NOT IN ('qualified', 'won') THEN
    RETURN NULL;
  END IF;
  IF NEW.source_name IS DISTINCT FROM 'mktr' THEN
    RETURN NULL;
  END IF;

  -- Best-effort: a Vault/HMAC/HTTP error must never roll back the status update.
  BEGIN
    SELECT decrypted_secret INTO v_url
      FROM vault.decrypted_secrets WHERE name = 'mktr_lead_outcome_url';
    SELECT decrypted_secret INTO v_secret
      FROM vault.decrypted_secrets WHERE name = 'mktr_lead_outcome_secret';

    IF v_url IS NULL OR v_url = '' OR v_secret IS NULL OR v_secret = '' THEN
      RETURN NULL;  -- secrets not seeded yet — safe no-op
    END IF;

    v_ts := to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');

    v_payload := jsonb_build_object(
      'external_id', NEW.external_id,
      'lead_id',     NEW.id,
      'new_status',  NEW.status,
      'old_status',  OLD.status,
      'agent_id',    NEW.assigned_to,
      'occurred_at', v_ts
    );

    -- Sign timestamp || '.' || body; v_body is the canonical jsonb text pg_net transmits.
    v_body := v_payload::text;
    v_sig  := encode(extensions.hmac(v_ts || '.' || v_body, v_secret, 'sha256'), 'hex');

    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type',        'application/json',
        'X-Webhook-Signature', 'sha256=' || v_sig,
        'X-Webhook-Timestamp', v_ts
      ),
      body := v_payload,
      timeout_milliseconds := 5000
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[leads_notify_mktr_outcome] dispatch failed: %', SQLERRM;
  END;

  RETURN NULL;  -- AFTER trigger, return value unused
END;
$$;

COMMENT ON FUNCTION public.leads_notify_mktr_outcome IS
  'Push channel: posts to MKTR /api/integrations/lyfe/lead-outcome on the first transition of public.leads.status into (qualified, won) for source_name=mktr leads, firing Meta CAPI ConfirmedResident/ClosedWon. HMAC-SHA256 over timestamp.body using Vault secret mktr_lead_outcome_secret. Async via pg_net; best-effort (never blocks the status update).';

DROP TRIGGER IF EXISTS leads_notify_mktr_outcome ON public.leads;

CREATE TRIGGER leads_notify_mktr_outcome
AFTER UPDATE OF status ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.leads_notify_mktr_outcome();
