-- =====================================================================
-- 1.18 — Switch notify_push_dispatcher to vault-backed X-Webhook-Secret
--
-- WHY:
--   The trigger has been sending `Authorization: Bearer <service_role_key>`
--   read from `current_setting('supabase.service_role_key', true)`. Two
--   problems:
--     (a) The send-push-notification edge function authenticates via
--         the `X-Webhook-Secret` header (timing-safe compare against
--         env WEBHOOK_SECRET) and ignores Authorization. So every
--         dispatch has been 401-ing.
--     (b) The GUC `supabase.service_role_key` is not injected into
--         pg_cron / trigger contexts (same root cause as the cron
--         failure fixed in 1.17 / migration 20260510130000). The NULL
--         guard added in 20260331070000_phase1_critical_security.sql
--         just RAISE WARNINGs and skips — pushes silently dropped.
--
--   Verified 2026-05-11 via Management API:
--     * `supabase secrets list --project-ref nvtedkyjwulkzjeoqjgx`
--       previously contained no WEBHOOK_SECRET (now seeded — see
--       DEPENDENCIES).
--     * Push EF index.ts:53-60 rejects with 401 when WEBHOOK_SECRET
--       env unset OR header missing.
--
-- IMPACT OF OUTAGE:
--   Every Expo push notification dispatched via the notifications
--   table INSERT trigger has been failing silently since the schema
--   was deployed. Affected flows: new MKTR leads, candidate milestone
--   updates, interview reminders, event reminders, roadshow summaries,
--   broadcast announcements. Users see in-app badge updates (Realtime
--   subscription works) but no device push.
--
-- WHAT THIS MIGRATION DOES:
--   1. Replaces notify_push_dispatcher to read vault.send_push_secret
--      (NOT the service-role key) and send it via X-Webhook-Secret.
--   2. Adds `timeout_milliseconds := 15000` to pg_net.http_post so
--      a slow EF cold-start doesn't pile up indefinite-wait rows in
--      pg_net's response table.
--   3. RAISE EXCEPTION (not WARNING) if vault secret missing — fail
--      loud so we don't silently lose pushes again. Trigger fires on
--      AFTER INSERT, so the exception aborts the trigger but the
--      notification row is already committed (per Postgres trigger
--      semantics with `AFTER INSERT`). Actually: AFTER triggers run
--      inside the same transaction as the INSERT, so RAISE EXCEPTION
--      WILL roll back the INSERT. We don't want that — a missing
--      vault secret should not block notification writes. So we
--      RAISE WARNING + skip, but ALSO log the user_id so it's
--      diagnosable via Postgres logs. (The vault seed in DEPENDENCIES
--      is a hard prerequisite — if it's missing this migration
--      shouldn't have been applied.)
--
-- DEPENDENCIES (must be done BEFORE applying):
--   * vault.secrets row name='send_push_secret' must exist.
--     Seeded 2026-05-11 via Management API SQL endpoint
--     (UUID 89e8d623-9f36-4820-80b2-a898182b179f), 64-char base64url.
--   * Supabase EF env WEBHOOK_SECRET must equal the same value.
--     Set 2026-05-11 via `supabase secrets set --project-ref
--     nvtedkyjwulkzjeoqjgx WEBHOOK_SECRET=<value>`.
--
-- POST-DEPLOY VERIFICATION:
--   1. INSERT INTO notifications (...) VALUES (...) -- any test row
--   2. SELECT id, status_code, error_msg, created::text
--        FROM net._http_response
--       WHERE created > now() - interval '5 minutes'
--         AND id IN (
--           SELECT id FROM net.http_request_queue
--            WHERE url LIKE '%send-push-notification%'
--         )
--       ORDER BY created DESC LIMIT 5;
--      Expect status_code=200 (was 401 before this migration).
--
-- ROLLBACK:
--   Re-run the prior CREATE OR REPLACE FUNCTION body from migration
--   20260331070000_phase1_critical_security.sql (the v_key /
--   current_setting variant). Pushes will go back to silent 401.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.notify_push_dispatcher()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
    v_secret text;
BEGIN
    SELECT decrypted_secret INTO v_secret
      FROM vault.decrypted_secrets
     WHERE name = 'send_push_secret';

    IF v_secret IS NULL OR v_secret = '' THEN
        -- Fail loud in logs but do NOT abort the notification INSERT.
        -- AFTER trigger raising EXCEPTION would roll back the row, which
        -- would lose the in-app notification too. The vault seed is a
        -- hard prerequisite for this migration so this branch should
        -- never fire in practice.
        RAISE WARNING '[push] vault.send_push_secret not seeded — push notification skipped for notification % (user %)', NEW.id, NEW.user_id;
        RETURN NEW;
    END IF;

    -- EF index.ts:66 rejects unless payload.type === 'INSERT'. The
    -- prior trigger body omitted this field but since auth was failing
    -- upstream nothing surfaced. Send it explicitly now.
    PERFORM net.http_post(
        url := 'https://nvtedkyjwulkzjeoqjgx.supabase.co/functions/v1/send-push-notification',
        body := jsonb_build_object(
            'type', 'INSERT',
            'record', jsonb_build_object(
                'id', NEW.id,
                'user_id', NEW.user_id,
                'type', NEW.type,
                'title', NEW.title,
                'body', NEW.body,
                'data', NEW.data
            )
        ),
        headers := jsonb_build_object(
            'Content-Type',     'application/json',
            'X-Webhook-Secret', v_secret
        ),
        timeout_milliseconds := 15000
    );
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.notify_push_dispatcher() IS
  'AFTER INSERT trigger on notifications. Posts to send-push-notification '
  'EF with X-Webhook-Secret header read from vault.send_push_secret. '
  'Replaces the broken Authorization: Bearer <service_role_key> pattern '
  'from migration 20260331070000 — the EF only accepts X-Webhook-Secret '
  'and the service_role_key GUC was never injected into trigger context.';
