-- Fix: an UPDATE to an agent, manager or director whose full_name holds a newline, a double quote or a backslash
-- failed with 22P02 "invalid input syntax for type bytea", so the user row could not be changed at all.
--
-- notify_mktr_user_change signed the webhook body with hmac(v_body_text::bytea, ...). A text -> bytea cast reads
-- the text in bytea escape format, where a backslash starts an escape. jsonb::text writes a newline as \n and a
-- quote as \", which are not valid bytea escapes, so the cast raised and rolled back the user's UPDATE. A literal
-- backslash (\\) did not raise but collapsed to one byte, so the signature no longer matched the bytes pg_net sends
-- and MKTR rejected the webhook. Seen on 2026-10-22 when a candidate named "New\n  User" was promoted to manager.
--
-- convert_to(text, 'UTF8') takes the text's bytes as they are, which is what pg_net does with the body
-- (convert_to(body::text, 'UTF8')). For text with no backslash both give the same bytes, so signatures for every
-- name that worked before are unchanged.
--
-- This HMAC version of the function was applied to the live database outside the migration chain (the last
-- version in this repo is the bearer-token one in 20260504150000). This file records the full live definition with
-- the fix, so the repo can rebuild it.

CREATE OR REPLACE FUNCTION public.notify_mktr_user_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_url       text;
  v_secret    text;
  v_role      text;
  v_is_test   boolean;
  v_record    jsonb;
  v_body_text text;
  v_signature text;
  v_timestamp text;
BEGIN
  -- Read live config from Vault. Missing-OK: trigger no-ops if either
  -- secret hasn't been seeded yet, so this migration is safe to ship
  -- even if the vault entries land later.
  SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'mktr_webhook_url';
  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'mktr_webhook_secret';

  IF v_url IS NULL OR v_url = '' OR v_secret IS NULL OR v_secret = '' THEN
    RETURN NULL;
  END IF;

  -- Determine the row of interest based on op.
  IF TG_OP = 'DELETE' THEN
    v_role := OLD.role::text;
    v_is_test := COALESCE(OLD.is_test_data, false);
  ELSE
    v_role := NEW.role::text;
    v_is_test := COALESCE(NEW.is_test_data, false);
  END IF;

  -- Only mirror agent-class production users.
  IF v_role NOT IN ('agent', 'manager', 'director') THEN
    RETURN NULL;
  END IF;
  IF v_is_test THEN
    RETURN NULL;
  END IF;

  -- Build the redacted payload (7 fields the receiver consumes).
  v_record := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'record', CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE
      jsonb_build_object(
        'id',           NEW.id,
        'full_name',    NEW.full_name,
        'phone',        NEW.phone,
        'email',        NEW.email,
        'role',         NEW.role::text,
        'is_active',    NEW.is_active,
        'is_test_data', NEW.is_test_data
      )
    END,
    'old_record', CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE
      jsonb_build_object(
        'id',           OLD.id,
        'role',         OLD.role::text,
        'is_active',    OLD.is_active,
        'is_test_data', OLD.is_test_data
      )
    END
  );

  -- Canonical jsonb→text. These bytes are what pg_net will transmit and
  -- what MKTR's verify hook will see in req.rawBody.
  v_body_text := v_record::text;

  -- HMAC-SHA256 hex digest. pgcrypto's hmac(bytea, bytea, text) returns
  -- bytea; encode(_, 'hex') gives lowercase hex. convert_to, not ::bytea:
  -- the cast parses backslashes as escapes (see the header). Matches the
  -- convention in mktr-platform/backend/src/services/webhookService.js (the
  -- inverse direction) and receive-mktr-lead/index.ts (the receiver pattern).
  v_signature := 'sha256=' || encode(
    extensions.hmac(convert_to(v_body_text, 'UTF8'), convert_to(v_secret, 'UTF8'), 'sha256'),
    'hex'
  );

  -- ISO 8601 UTC, second resolution. Date.parse() in Node handles this.
  -- 5-min tolerance on the receiver side absorbs clock drift.
  v_timestamp := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');

  PERFORM net.http_post(
    url := v_url,
    body := v_record,
    headers := jsonb_build_object(
      'Content-Type',         'application/json',
      'X-Webhook-Signature',  v_signature,
      'X-Webhook-Timestamp',  v_timestamp
    ),
    -- 30s tolerates Render container cold-start (~25s observed during
    -- deploy under load). Receiver itself responds in <100ms when warm.
    timeout_milliseconds := 30000
  );

  RETURN NULL;  -- AFTER trigger, return value unused
END;
$function$;

COMMENT ON FUNCTION public.notify_mktr_user_change IS
  'Push channel: posts to MKTR /api/integrations/lyfe/users-webhook on every INSERT/UPDATE/DELETE of public.users where role IN (agent,manager,director) AND is_test_data=false. HMAC-SHA256 signed (X-Webhook-Signature) with 5-minute timestamp window (X-Webhook-Timestamp). Sends only the 7 fields MKTR consumes (id, full_name, phone, email, role, is_active, is_test_data). Reads URL+secret from Vault. Async via pg_net. Audit Sprint 2.1, 2026-05-12.';
