-- RPC that lets roles with the reassign_agents capability (admin, director,
-- pa) change a user's reports_to. RLS on public.users currently only
-- permits admins to UPDATE, so without this function PAs and directors
-- could not reassign agents even though the business rule grants them that
-- capability.
--
-- SECURITY DEFINER so the function bypasses the caller's row-level
-- permissions on public.users. The validate_reports_to_role trigger from
-- migration 20260419140000 still fires and ensures the new upline is a
-- manager or director (or NULL).

CREATE OR REPLACE FUNCTION public.reassign_agent_upline(
    p_agent_id uuid,
    p_new_manager_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
    caller_role text;
BEGIN
    caller_role := auth.jwt() -> 'app_metadata' ->> 'role';

    IF caller_role IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: no role on JWT';
    END IF;

    IF caller_role NOT IN ('admin', 'director', 'pa') THEN
        RAISE EXCEPTION 'Forbidden: reassign_agents capability required (got %)', caller_role;
    END IF;

    IF p_agent_id IS NULL THEN
        RAISE EXCEPTION 'agent id is required';
    END IF;

    UPDATE public.users
    SET reports_to = p_new_manager_id
    WHERE id = p_agent_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agent % not found', p_agent_id;
    END IF;
    -- trigger validate_reports_to_role validates p_new_manager_id role/active
END;
$$;

GRANT EXECUTE ON FUNCTION public.reassign_agent_upline(uuid, uuid) TO authenticated;
