-- Phase G: fn_activate_agent(candidate_uuid, activated_by_uuid)
--
-- Atomically promotes a candidate to an active agent. All mutations happen in
-- a single transaction so a partial flip is impossible.
--
-- Preconditions (each surfaced as a distinct exception message so the client
-- can present actionable guidance):
--   - Candidate exists and status='licensed'
--   - BDM milestone has status='completed'
--   - BES Induction milestone has status='completed'
--   - RNF milestone has status='issued'
--   - Sales Authority milestone has status='issued'
--   - candidate_profiles.user_id is populated (we need the auth user to flip)
--
-- Effects:
--   - candidates: status='active_agent', converted_to_agent_at=now()
--   - public.users: role='agent'
--
-- Does NOT update auth.users.app_metadata — the edge function handles that via
-- auth.admin so the JWT reflects the new role. (public.users is editable from
-- SQL; auth.users.app_metadata is owned by GoTrue.)

CREATE OR REPLACE FUNCTION public.fn_activate_agent(
    p_candidate_id uuid,
    p_activated_by_user_id uuid
)
RETURNS TABLE (user_id uuid, candidate_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_status candidate_status;
    v_bdm text;
    v_bes text;
    v_rnf text;
    v_sa text;
BEGIN
    -- Lock the candidate row so the readiness check + update is a single
    -- atomic read/write, preventing concurrent activations.
    SELECT c.status, cp.user_id
    INTO v_status, v_user_id
    FROM candidates c
    LEFT JOIN candidate_profiles cp ON cp.candidate_id = c.id
    WHERE c.id = p_candidate_id
    FOR UPDATE OF c;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'Candidate not found' USING ERRCODE = 'P0002';
    END IF;

    IF v_status <> 'licensed' THEN
        RAISE EXCEPTION 'Candidate must be licensed before activation (current status: %)', v_status
          USING ERRCODE = 'P0001';
    END IF;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Candidate has no linked auth user (candidate_profiles.user_id is NULL)'
          USING ERRCODE = 'P0001';
    END IF;

    -- Milestone gates.
    SELECT status INTO v_bdm FROM candidate_milestones
      WHERE candidate_id = p_candidate_id AND milestone_code = 'bdm';
    SELECT status INTO v_bes FROM candidate_milestones
      WHERE candidate_id = p_candidate_id AND milestone_code = 'bes_induction';
    SELECT status INTO v_rnf FROM candidate_milestones
      WHERE candidate_id = p_candidate_id AND milestone_code = 'rnf';
    SELECT status INTO v_sa FROM candidate_milestones
      WHERE candidate_id = p_candidate_id AND milestone_code = 'sales_authority';

    IF COALESCE(v_bdm, 'not_started') <> 'completed' THEN
        RAISE EXCEPTION 'BDM Interview must be completed' USING ERRCODE = 'P0001';
    END IF;
    IF COALESCE(v_bes, 'not_started') <> 'completed' THEN
        RAISE EXCEPTION 'BES Induction must be completed' USING ERRCODE = 'P0001';
    END IF;
    IF COALESCE(v_rnf, 'not_started') <> 'issued' THEN
        RAISE EXCEPTION 'RNF must be issued' USING ERRCODE = 'P0001';
    END IF;
    IF COALESCE(v_sa, 'not_started') <> 'issued' THEN
        RAISE EXCEPTION 'Sales Authority must be issued' USING ERRCODE = 'P0001';
    END IF;

    -- All gates passed. Perform the flip.
    UPDATE candidates
       SET status = 'active_agent',
           converted_to_agent_at = now()
     WHERE id = p_candidate_id;

    UPDATE public.users
       SET role = 'agent'
     WHERE id = v_user_id;

    -- p_activated_by_user_id is accepted for audit-log downstreams (currently
    -- unused; future: write to an activations audit table if needed).
    PERFORM p_activated_by_user_id;

    RETURN QUERY SELECT v_user_id, p_candidate_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_activate_agent(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_activate_agent(uuid, uuid) TO service_role;
