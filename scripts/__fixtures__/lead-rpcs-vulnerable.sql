-- FIXTURE (not used in production) — the pre-fix definitions of the two lead
-- RPCs as they existed in production before audit H1 was closed. Used by
-- scripts/verify-lead-rpc-authz.sh to prove the behavioral test FAILS against
-- the vulnerable code (the candidate back door is open) and PASSES against the
-- fixed migration. Do not load this anywhere except the H1 test harness.

CREATE OR REPLACE FUNCTION public.assign_lead_with_activity(p_lead_id uuid, p_agent_id uuid, p_acting_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_previous_agent uuid;
BEGIN
    IF auth.uid() IS NULL OR auth.uid() != p_acting_user_id THEN
        RAISE EXCEPTION 'Unauthorized: caller must match p_acting_user_id';
    END IF;
    SELECT assigned_to INTO v_previous_agent FROM leads WHERE id = p_lead_id;
    UPDATE leads SET assigned_to = p_agent_id, updated_at = now() WHERE id = p_lead_id;
    INSERT INTO lead_activities (lead_id, user_id, type, description, metadata)
    VALUES (p_lead_id, p_acting_user_id, 'reassignment'::lead_activity_type,
            CASE WHEN v_previous_agent IS NOT NULL THEN 'Lead reassigned by manager' ELSE 'Lead assigned by manager' END,
            jsonb_build_object('from_agent_id', v_previous_agent, 'to_agent_id', p_agent_id));
    RETURN jsonb_build_object('success', true);
END; $function$;

CREATE OR REPLACE FUNCTION public.update_lead_status_with_activity(p_lead_id uuid, p_new_status text, p_old_status text, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
        RAISE EXCEPTION 'Unauthorized: caller must match p_user_id';
    END IF;
    UPDATE leads SET status = p_new_status::lead_status, updated_at = now() WHERE id = p_lead_id;
    INSERT INTO lead_activities (lead_id, user_id, type, description, metadata)
    VALUES (p_lead_id, p_user_id, 'status_change'::lead_activity_type, NULL,
            jsonb_build_object('from_status', p_old_status, 'to_status', p_new_status));
    RETURN jsonb_build_object('success', true);
END; $function$;
