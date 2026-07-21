-- lead.suppressed consumer support (mktr-platform tracker "propagate").
-- Contract: mktr-platform/docs/reference/webhook-propagation-contract.md
-- Plan:     mktr-platform/docs/plans/propagate-consumer-lyfe.md
--
-- "Stop contacting the person behind this lead; keep the lead." The EF
-- (receive-mktr-lead) records suppressions via ONE atomic RPC; the tombstone
-- table catches suppressions that arrive before (or without) their lead —
-- deliveries are unordered/concurrent — and the lead-arrival paths consult it.
-- State is MONOTONIC: scope 'all' dominates 'marketing'; nothing downgrades
-- (no un-suppression event exists in contract v1).
-- Everything here is idempotent (safe under db push after MCP apply).

-- leads: suppression columns (timestamp-as-flag, matches archived_at style)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS do_not_contact_at timestamptz,
  ADD COLUMN IF NOT EXISTS do_not_contact_scope text;

DO $$ BEGIN
  ALTER TABLE public.leads
    ADD CONSTRAINT chk_leads_dnc_scope
      CHECK (do_not_contact_scope IN ('marketing', 'all') OR do_not_contact_scope IS NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tombstone: suppression keyed by the MKTR lead identity, applied on arrival.
CREATE TABLE IF NOT EXISTS public.mktr_lead_suppressions (
  source_name text NOT NULL,
  external_id text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('marketing', 'all')),
  reason text NOT NULL,
  occurred_at timestamptz NOT NULL,
  delivery_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_name, external_id)
);

-- Service-role only, ENFORCED: RLS on with zero policies denies app roles
-- (service_role bypasses RLS; the EF is the only writer/reader).
ALTER TABLE public.mktr_lead_suppressions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mktr_lead_suppressions FROM anon, authenticated;

-- Activity enum value (precedent: 20260427180000 added 'unassignment').
ALTER TYPE public.lead_activity_type ADD VALUE IF NOT EXISTS 'suppressed';

-- The atomic monotonic merge. lyfe has no delivery-dedup table, so atomicity
-- and EFFECT-idempotency live here: repairs re-send with NEW delivery ids and
-- must not duplicate activities — lead effects fire only when the merged
-- state actually changes (first application, or marketing→all escalation).
CREATE OR REPLACE FUNCTION public.apply_mktr_lead_suppression(
  p_source_name text, p_external_id text, p_scope text, p_reason text,
  p_occurred_at timestamptz, p_delivery_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_lead leads%ROWTYPE; v_found boolean := false; v_changed boolean := false;
BEGIN
  INSERT INTO mktr_lead_suppressions AS t
    (source_name, external_id, scope, reason, occurred_at, delivery_id)
  VALUES (p_source_name, p_external_id, p_scope, p_reason, p_occurred_at, p_delivery_id)
  ON CONFLICT (source_name, external_id) DO UPDATE SET
    scope = CASE WHEN t.scope = 'all' THEN 'all' ELSE excluded.scope END,
    reason = CASE WHEN t.scope = 'all' AND excluded.scope <> 'all' THEN t.reason ELSE excluded.reason END,
    occurred_at = GREATEST(t.occurred_at, excluded.occurred_at),
    delivery_id = excluded.delivery_id,
    updated_at = now();

  SELECT * INTO v_lead FROM leads
   WHERE external_id = p_external_id AND source_name = p_source_name;
  v_found := FOUND;  -- captured: later statements overwrite FOUND
  IF v_found THEN
    UPDATE leads SET
      do_not_contact_at = COALESCE(do_not_contact_at, p_occurred_at),
      do_not_contact_scope = CASE
        WHEN do_not_contact_scope = 'all' THEN 'all' ELSE p_scope END,
      updated_at = now()
     WHERE id = v_lead.id
       AND (do_not_contact_at IS NULL
            OR (do_not_contact_scope IS DISTINCT FROM 'all' AND p_scope = 'all'));
    v_changed := FOUND;
    IF v_changed THEN
      INSERT INTO lead_activities (lead_id, user_id, type, description, metadata)
      VALUES (v_lead.id, v_lead.created_by, 'suppressed',
              'Do-not-contact from MKTR (' || p_scope || ')',
              jsonb_build_object('source', 'mktr', 'delivery_id', p_delivery_id,
                                 'reason', p_reason, 'scope', p_scope));
    END IF;
  END IF;
  RETURN jsonb_build_object('lead_found', v_found, 'changed', v_changed);
END $$;

REVOKE ALL ON FUNCTION public.apply_mktr_lead_suppression(text, text, text, text, timestamptz, uuid)
  FROM anon, authenticated;
