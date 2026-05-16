-- Fix: column reference "candidate_id" is ambiguous in fn_activate_agent.
--
-- The function declares RETURNS TABLE (user_id uuid, candidate_id uuid).
-- Inside plpgsql, those OUT params live in the function scope and shadow
-- column references with the same name. The original definition's milestone
-- lookups used unqualified `WHERE candidate_id = p_candidate_id`, which
-- pgsql resolved as ambiguous at runtime (default plpgsql.variable_conflict
-- = 'error') and aborted the activation with HTTP 409.
--
-- Discovered during synthetic monitoring B1.2 — the activate-agent probe is
-- the first time this code path was actually exercised end-to-end.
--
-- Fix: alias candidate_milestones as `cm` and qualify all column refs.
-- Also alias the public.users UPDATE for consistency. Otherwise functionally
-- identical to 20260418130000_fn_activate_agent.sql.

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

    SELECT cm.status INTO v_bdm FROM candidate_milestones cm
      WHERE cm.candidate_id = p_candidate_id AND cm.milestone_code = 'bdm';
    SELECT cm.status INTO v_bes FROM candidate_milestones cm
      WHERE cm.candidate_id = p_candidate_id AND cm.milestone_code = 'bes_induction';
    SELECT cm.status INTO v_rnf FROM candidate_milestones cm
      WHERE cm.candidate_id = p_candidate_id AND cm.milestone_code = 'rnf';
    SELECT cm.status INTO v_sa FROM candidate_milestones cm
      WHERE cm.candidate_id = p_candidate_id AND cm.milestone_code = 'sales_authority';

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

    UPDATE candidates
       SET status = 'active_agent',
           converted_to_agent_at = now()
     WHERE id = p_candidate_id;

    UPDATE public.users u
       SET role = 'agent'
     WHERE u.id = v_user_id;

    PERFORM p_activated_by_user_id;

    RETURN QUERY SELECT v_user_id, p_candidate_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_activate_agent(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_activate_agent(uuid, uuid) TO service_role;
