-- Push channel: Lyfe → MKTR for down-funnel lead OUTCOMES (SC/PR confirmation).
--
-- WHY:
--   MKTR runs Meta ads for insurance products only Singapore Citizens/PRs can
--   buy. Whether a lead is actually SC/PR is only known here in Lyfe, when an
--   agent advances a lead to `qualified` (= agent CONFIRMED SC/PR — the
--   liar-proof version of the self-declared landing-page gate) or `won` (bought
--   a policy). This trigger pushes that verified signal back to MKTR, which
--   fires a server-side Meta CAPI conversion (ConfirmedResident / ClosedWon) so
--   Meta learns to find more genuine residents. See mktr-platform CLAUDE.md
--   "Down-funnel CAPI events".
--
-- HOW:
--   AFTER UPDATE OF status on public.leads → net.http_post (pg_net, async) to
--   MKTR's POST /api/integrations/lyfe/lead-outcome. pg_net is async — the
--   trigger returns immediately; the request is delivered out-of-band and never
--   blocks or rolls back the agent's status update.
--
-- AUTH:
--   HMAC-SHA256 over `timestamp || '.' || body` (the timestamp is INSIDE the
--   signature → a captured body+signature cannot be replayed with a fresh
--   timestamp), using a Vault secret. The MKTR receiver verifies the same over
--   `X-Webhook-Timestamp + "." + req.rawBody`.
--
-- FILTERING:
--   Fires only on a real status TRANSITION into ('qualified','won') for
--   MKTR-origin leads (source_name = 'mktr'). The MKTR receiver is idempotent
--   (deterministic event_id + mark-on-success marker), so a re-fire is a no-op.
--
-- SECRET STORAGE (seed via Supabase Vault / Management API — NOT in git):
--   mktr_lead_outcome_url     = https://api.mktr.sg/api/integrations/lyfe/lead-outcome
--   mktr_lead_outcome_secret  = <same value as LYFE_LEAD_OUTCOME_SECRET on MKTR>
--   Missing-OK: the trigger no-ops if either is unseeded — safe to ship this
--   migration before the secrets land.
--
-- BYTE-ALIGNMENT:
--   The MKTR receiver verifies the HMAC over the exact bytes pg_net transmits
--   (req.rawBody). supabase/pg_net `http_post(body jsonb)` queues
--   convert_to(body::text,'UTF8'), so signing v_payload::text and sending
--   body := v_payload is byte-aligned (UTF-8 DB encoding). Mirrors the proven
--   notify_mktr_user_change trigger, which likewise sends a jsonb body.

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

  -- Best-effort notification: a Vault/HMAC/HTTP error must NEVER block or roll
  -- back the agent's status update. Swallow with a warning; the MKTR-side
  -- reconciliation backfill is the safety net for a dropped notification.
  BEGIN
    SELECT decrypted_secret INTO v_url
      FROM vault.decrypted_secrets WHERE name = 'mktr_lead_outcome_url';
    SELECT decrypted_secret INTO v_secret
      FROM vault.decrypted_secrets WHERE name = 'mktr_lead_outcome_secret';

    IF v_url IS NULL OR v_url = '' OR v_secret IS NULL OR v_secret = '' THEN
      RETURN NULL;  -- secrets not seeded yet — safe no-op
    END IF;

    v_ts := to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');

    -- external_id is the MKTR prospect id stored on the lead at ingestion.
    v_payload := jsonb_build_object(
      'external_id', NEW.external_id,
      'lead_id',     NEW.id,
      'new_status',  NEW.status,
      'old_status',  OLD.status,
      'agent_id',    NEW.assigned_to,
      'occurred_at', v_ts
    );

    -- Sign timestamp || '.' || body. v_body is the canonical jsonb text — the
    -- exact bytes pg_net transmits for body := v_payload (see BYTE-ALIGNMENT).
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
