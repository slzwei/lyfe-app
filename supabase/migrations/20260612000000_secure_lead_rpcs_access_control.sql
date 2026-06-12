-- ============================================================================
-- Secure the lead-mutation RPCs (audit H1)
-- ============================================================================
-- Problem:
--   assign_lead_with_activity() and update_lead_status_with_activity() are
--   SECURITY DEFINER (they bypass RLS) but only verified that the caller's
--   auth.uid() matched the p_acting_user_id / p_user_id argument. Any
--   authenticated user — including a trainee candidate — could therefore
--   reassign or change the status of ANY lead by passing their own id,
--   bypassing the leads RLS policies entirely.
--
-- Fix:
--   Re-create both functions with the same behaviour PLUS an authorization
--   gate that mirrors the leads RLS model:
--     * caller must match p_acting_user_id / p_user_id (unchanged), and
--     * caller must have a relationship to the target lead, evaluated via the
--       canonical can_access_lead(assigned_to, created_by) helper using the
--       lead's CURRENT (server-side) ownership — not client-supplied values.
--   Reassignment additionally requires the reassign_leads capability
--   (admin / director / manager per the role matrix); status changes are a
--   normal owning-agent action and only require lead access.
--
-- Drift note:
--   Both functions previously existed ONLY in production (created via the
--   Dashboard, in no migration). This migration codifies them into the
--   canonical chain. CREATE OR REPLACE applies cleanly whether or not the
--   functions already exist, so it is a strict no-op on a built schema except
--   for the added authorization checks.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- assign_lead_with_activity: reassign a lead + log a 'reassignment' activity
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_lead_with_activity(
    p_lead_id uuid,
    p_agent_id uuid,
    p_acting_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_previous_agent uuid;
    v_created_by uuid;
    v_caller_role text := auth.jwt() -> 'app_metadata' ->> 'role';
BEGIN
    IF auth.uid() IS NULL OR auth.uid() != p_acting_user_id THEN
        RAISE EXCEPTION 'Unauthorized: caller must match p_acting_user_id';
    END IF;

    SELECT assigned_to, created_by
      INTO v_previous_agent, v_created_by
      FROM leads
     WHERE id = p_lead_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lead not found: %', p_lead_id USING ERRCODE = 'no_data_found';
    END IF;

    -- Access control: caller must have a relationship to the lead (mirrors the
    -- leads_update RLS policy, which this SECURITY DEFINER function bypasses).
    IF NOT can_access_lead(v_previous_agent, v_created_by) THEN
        RAISE EXCEPTION 'Forbidden: no access to this lead' USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Reassignment is a manager-and-above capability (reassign_leads).
    IF COALESCE(v_caller_role, '') NOT IN ('admin', 'director', 'manager') THEN
        RAISE EXCEPTION 'Forbidden: reassigning leads requires manager role or above'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    UPDATE leads SET assigned_to = p_agent_id, updated_at = now() WHERE id = p_lead_id;
    INSERT INTO lead_activities (lead_id, user_id, type, description, metadata)
    VALUES (p_lead_id, p_acting_user_id, 'reassignment'::lead_activity_type,
            CASE WHEN v_previous_agent IS NOT NULL THEN 'Lead reassigned by manager' ELSE 'Lead assigned by manager' END,
            jsonb_build_object('from_agent_id', v_previous_agent, 'to_agent_id', p_agent_id));
    RETURN jsonb_build_object('success', true);
END;
$function$;

-- ----------------------------------------------------------------------------
-- update_lead_status_with_activity: change status + log a 'status_change'
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_lead_status_with_activity(
    p_lead_id uuid,
    p_new_status text,
    p_old_status text,
    p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_assigned_to uuid;
    v_created_by uuid;
BEGIN
    IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
        RAISE EXCEPTION 'Unauthorized: caller must match p_user_id';
    END IF;

    SELECT assigned_to, created_by
      INTO v_assigned_to, v_created_by
      FROM leads
     WHERE id = p_lead_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lead not found: %', p_lead_id USING ERRCODE = 'no_data_found';
    END IF;

    -- Access control: caller must have a relationship to the lead (mirrors the
    -- leads_update RLS policy, which this SECURITY DEFINER function bypasses).
    IF NOT can_access_lead(v_assigned_to, v_created_by) THEN
        RAISE EXCEPTION 'Forbidden: no access to this lead' USING ERRCODE = 'insufficient_privilege';
    END IF;

    UPDATE leads SET status = p_new_status::lead_status, updated_at = now() WHERE id = p_lead_id;
    INSERT INTO lead_activities (lead_id, user_id, type, description, metadata)
    VALUES (p_lead_id, p_user_id, 'status_change'::lead_activity_type, NULL,
            jsonb_build_object('from_status', p_old_status, 'to_status', p_new_status));
    RETURN jsonb_build_object('success', true);
END;
$function$;

-- Preserve the production execute grants (the internal auth.uid() gate makes
-- the anon grant a no-op: anonymous callers have a NULL auth.uid()).
GRANT EXECUTE ON FUNCTION public.assign_lead_with_activity(uuid, uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_lead_status_with_activity(uuid, text, text, uuid) TO anon, authenticated, service_role;
