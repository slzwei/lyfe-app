-- Push channel: Lyfe → MKTR for user-table changes.
--
-- WHY:
--   Polling sync runs every 10 minutes (mktr-platform agentSyncService).
--   That introduces up to 10 min of lag — when an agent is deactivated
--   in Lyfe, leads can still route to them for up to 10 min until the
--   next poll. This trigger closes that window to seconds while polling
--   stays as a safety net.
--
-- HOW:
--   AFTER trigger on public.users → calls net.http_post (pg_net) to
--   POST a JSON body to mktr's webhook endpoint with a bearer secret.
--   pg_net is async (non-blocking) — the trigger returns immediately
--   and the request is delivered out-of-band.
--
-- FILTERING:
--   Trigger only fires for role IN (agent, manager, director) AND
--   is_test_data = false. Test data and candidates do NOT propagate.
--
-- SECRET STORAGE:
--   Webhook URL + secret are stored in Supabase Vault under names
--   `mktr_webhook_url` and `mktr_webhook_secret`. The trigger reads them
--   from `vault.decrypted_secrets` at fire time.
--
--   Vault rows are inserted via the Supabase Management API outside this
--   migration (so the live secret is not committed to git). The trigger
--   no-ops harmlessly if either vault entry is missing — safe to ship the
--   migration before the secrets are seeded.
--
--   GUC-style storage (ALTER DATABASE SET app.mktr_webhook_secret = ...)
--   was rejected because hosted Supabase blocks ALTER DATABASE for the
--   project owner role.
--
-- IDEMPOTENCY:
--   mktr's receiver is row-level upsert by lyfeId. Replays cause no
--   double-writes. Polling and push converge to the same final state.

CREATE OR REPLACE FUNCTION public.notify_mktr_user_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
  v_url    text;
  v_secret text;
  v_role   text;
  v_is_test boolean;
  v_record jsonb;
BEGIN
  -- Read live config from Vault. Missing-OK: trigger no-ops if either
  -- secret hasn't been seeded yet — migration is safe to ship before
  -- the vault entries land.
  SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'mktr_webhook_url';
  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'mktr_webhook_secret';

  IF v_url IS NULL OR v_url = '' OR v_secret IS NULL OR v_secret = '' THEN
    RETURN NULL;
  END IF;

  -- Determine the row of interest based on op.
  IF TG_OP = 'DELETE' THEN
    v_role := OLD.role;
    v_is_test := COALESCE(OLD.is_test_data, false);
  ELSE
    v_role := NEW.role;
    v_is_test := COALESCE(NEW.is_test_data, false);
  END IF;

  -- Only mirror agent-class production users.
  IF v_role NOT IN ('agent', 'manager', 'director') THEN
    RETURN NULL;
  END IF;
  IF v_is_test THEN
    RETURN NULL;
  END IF;

  v_record := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'record', CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE row_to_json(NEW)::jsonb END,
    'old_record', CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE row_to_json(OLD)::jsonb END
  );

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := v_record,
    timeout_milliseconds := 5000
  );

  RETURN NULL;  -- AFTER trigger, return value unused
END;
$$;

COMMENT ON FUNCTION public.notify_mktr_user_change IS
  'Push channel: posts to MKTR /api/integrations/lyfe/users-webhook on every INSERT/UPDATE/DELETE of public.users where role IN (agent,manager,director) AND is_test_data=false. Reads target URL and bearer secret from app.mktr_webhook_url and app.mktr_webhook_secret database settings. Async via pg_net.';

DROP TRIGGER IF EXISTS users_notify_mktr ON public.users;

CREATE TRIGGER users_notify_mktr
AFTER INSERT OR UPDATE OR DELETE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.notify_mktr_user_change();
