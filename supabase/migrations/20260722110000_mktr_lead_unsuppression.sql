-- lead.unsuppressed consumer support + watermark rework (resubscribe lift,
-- contract §6 — mktr-platform/docs/reference/webhook-propagation-contract.md).
--
-- v2 of the suppression state model (Codex resub-round #2): the tombstone is
-- now a PERSISTENT per-lead state row — never deleted — carrying
-- state ('suppressed'|'lifted') + the occurred_at WATERMARK. Deleting it on
-- lift would destroy the watermark, letting a repaired delivery of an OLDER
-- lead.suppressed re-suppress a lifted person forever, and discarding lifts
-- that arrive before their suppression. Merge rules:
--   - scope 'all' (erasure) is a latch: marketing events never touch it;
--   - suppression applies when strictly newer, OR on an equal watermark when
--     the row is lifted (ties resolve toward suppressed — fail-safe);
--   - lift applies only when strictly newer, and INSERTS a lifted row when
--     none exists (the pre-arrival watermark hold);
--   - lead columns stamp only from a resulting suppressed state; lifts clear
--     marketing-scope columns only.
-- Idempotent throughout; safe under db push after MCP apply.

ALTER TYPE public.lead_activity_type ADD VALUE IF NOT EXISTS 'resubscribed';

ALTER TABLE public.mktr_lead_suppressions
  ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'suppressed';
DO $$ BEGIN
  ALTER TABLE public.mktr_lead_suppressions
    ADD CONSTRAINT chk_mls_state CHECK (state IN ('suppressed', 'lifted'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- v2 suppression merge (replaces 20260721160000's version).
CREATE OR REPLACE FUNCTION public.apply_mktr_lead_suppression(
  p_source_name text, p_external_id text, p_scope text, p_reason text,
  p_occurred_at timestamptz, p_delivery_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_t mktr_lead_suppressions%ROWTYPE; v_lead leads%ROWTYPE;
        v_apply boolean := false; v_found boolean := false; v_changed boolean := false;
BEGIN
  -- Insert-or-LOCK claim (Codex resub-round-3 #1): a fresh insert returns the
  -- row (we hold its lock for this txn); otherwise lock the existing row FOR
  -- UPDATE so every per-lead merge — including concurrent unordered
  -- deliveries — serializes here. Decisions below run against the LOCKED row.
  INSERT INTO mktr_lead_suppressions
    (source_name, external_id, scope, reason, occurred_at, delivery_id, state)
  VALUES (p_source_name, p_external_id, p_scope, p_reason, p_occurred_at, p_delivery_id, 'suppressed')
  ON CONFLICT (source_name, external_id) DO NOTHING
  RETURNING * INTO v_t;
  IF FOUND THEN
    v_apply := true;
  ELSE
    SELECT * INTO v_t FROM mktr_lead_suppressions
     WHERE source_name = p_source_name AND external_id = p_external_id
     FOR UPDATE;
  END IF;
  IF v_apply THEN
    NULL; -- fresh insert: applied
  ELSIF v_t.scope = 'all' THEN
    -- Latch: an erasure row never downgrades. Same-scope 'all' refreshes the
    -- watermark forward only.
    IF p_scope = 'all' AND p_occurred_at > v_t.occurred_at THEN
      UPDATE mktr_lead_suppressions
         SET reason = p_reason, occurred_at = p_occurred_at,
             delivery_id = p_delivery_id, updated_at = now()
       WHERE source_name = p_source_name AND external_id = p_external_id;
    END IF;
    v_apply := false; -- lead already latched; no re-stamp needed
  ELSIF p_scope = 'all' THEN
    -- Erasure outranks any marketing state regardless of timestamps.
    UPDATE mktr_lead_suppressions
       SET scope = 'all', state = 'suppressed', reason = p_reason,
           occurred_at = p_occurred_at, delivery_id = p_delivery_id, updated_at = now()
     WHERE source_name = p_source_name AND external_id = p_external_id;
    v_apply := true;
  ELSIF p_occurred_at > v_t.occurred_at
        OR (p_occurred_at = v_t.occurred_at AND v_t.state = 'lifted') THEN
    -- Marketing vs marketing: strictly newer wins; ties resolve toward
    -- suppressed (fail-safe direction).
    UPDATE mktr_lead_suppressions
       SET state = 'suppressed', reason = p_reason,
           occurred_at = p_occurred_at, delivery_id = p_delivery_id, updated_at = now()
     WHERE source_name = p_source_name AND external_id = p_external_id;
    v_apply := true;
  END IF;

  IF v_apply THEN
    SELECT * INTO v_lead FROM leads
     WHERE external_id = p_external_id AND source_name = p_source_name;
    v_found := FOUND;
    IF v_found THEN
      UPDATE leads SET
        do_not_contact_at = COALESCE(do_not_contact_at, p_occurred_at),
        do_not_contact_scope = CASE
          WHEN do_not_contact_scope = 'all' THEN 'all' ELSE p_scope END,
        updated_at = now()
       WHERE id = v_lead.id
         AND (do_not_contact_at IS NULL
              OR (do_not_contact_scope IS DISTINCT FROM 'all' AND p_scope = 'all')
              OR do_not_contact_scope IS NULL);
      v_changed := FOUND;
      IF v_changed THEN
        INSERT INTO lead_activities (lead_id, user_id, type, description, metadata)
        VALUES (v_lead.id, v_lead.created_by, 'suppressed',
                'Do-not-contact from MKTR (' || p_scope || ')',
                jsonb_build_object('source', 'mktr', 'delivery_id', p_delivery_id,
                                   'reason', p_reason, 'scope', p_scope));
      END IF;
    END IF;
  END IF;
  RETURN jsonb_build_object('applied', v_apply, 'lead_found', v_found, 'changed', v_changed);
END $$;

-- The lift.
CREATE OR REPLACE FUNCTION public.apply_mktr_lead_unsuppression(
  p_source_name text, p_external_id text, p_occurred_at timestamptz, p_delivery_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_t mktr_lead_suppressions%ROWTYPE; v_lead leads%ROWTYPE;
        v_found boolean := false; v_changed boolean := false;
BEGIN
  -- Insert-or-LOCK claim (Codex resub-round-3 #1): fresh insert = the
  -- pre-arrival watermark hold (an older suppression delivery can no longer
  -- re-apply later); otherwise the merge runs against the FOR-UPDATE-locked
  -- row, serializing concurrent unordered deliveries.
  INSERT INTO mktr_lead_suppressions
    (source_name, external_id, scope, reason, occurred_at, delivery_id, state)
  VALUES (p_source_name, p_external_id, 'marketing', 'resubscribe', p_occurred_at, p_delivery_id, 'lifted')
  ON CONFLICT (source_name, external_id) DO NOTHING
  RETURNING * INTO v_t;
  IF FOUND THEN
    RETURN jsonb_build_object('applied', true, 'lead_found', false, 'changed', false);
  END IF;
  SELECT * INTO v_t FROM mktr_lead_suppressions
   WHERE source_name = p_source_name AND external_id = p_external_id
   FOR UPDATE;
  IF v_t.scope <> 'marketing' OR p_occurred_at <= v_t.occurred_at THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'latched_or_stale');
  END IF;

  UPDATE mktr_lead_suppressions
     SET state = 'lifted', reason = 'resubscribe',
         occurred_at = p_occurred_at, delivery_id = p_delivery_id, updated_at = now()
   WHERE source_name = p_source_name AND external_id = p_external_id;

  SELECT * INTO v_lead FROM leads
   WHERE external_id = p_external_id AND source_name = p_source_name;
  v_found := FOUND;
  IF v_found AND v_lead.do_not_contact_scope = 'marketing' THEN
    UPDATE leads SET
      do_not_contact_at = NULL,
      do_not_contact_scope = NULL,
      updated_at = now()
     WHERE id = v_lead.id;
    v_changed := true;
    INSERT INTO lead_activities (lead_id, user_id, type, description, metadata)
    VALUES (v_lead.id, v_lead.created_by, 'resubscribed',
            'Person re-consented via MKTR — marketing contact allowed again',
            jsonb_build_object('source', 'mktr', 'delivery_id', p_delivery_id));
  END IF;
  RETURN jsonb_build_object('applied', true, 'lead_found', v_found, 'changed', v_changed);
END $$;

REVOKE ALL ON FUNCTION public.apply_mktr_lead_suppression(text, text, text, text, timestamptz, uuid)
  FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_mktr_lead_unsuppression(text, text, timestamptz, uuid)
  FROM anon, authenticated;
