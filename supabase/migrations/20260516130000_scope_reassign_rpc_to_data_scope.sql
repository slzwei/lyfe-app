-- Keep agent reassignment RPCs inside the caller's production/test data scope.
-- The app filters pickers by users.is_test_data, but these SECURITY DEFINER
-- functions also need to enforce the same rule server-side.

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
    caller_is_test boolean := false;
    agent_is_test boolean;
    manager_is_test boolean;
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

    SELECT COALESCE((
        SELECT u.is_test_data
        FROM public.users u
        WHERE u.id = auth.uid()
    ), false)
    INTO caller_is_test;

    SELECT u.is_test_data
    INTO agent_is_test
    FROM public.users u
    WHERE u.id = p_agent_id
      AND u.role = 'agent';

    IF agent_is_test IS NULL THEN
        RAISE EXCEPTION 'Agent % not found', p_agent_id;
    END IF;

    IF agent_is_test <> caller_is_test THEN
        RAISE EXCEPTION 'Forbidden: agent is outside caller data scope';
    END IF;

    IF p_new_manager_id IS NOT NULL THEN
        SELECT u.is_test_data
        INTO manager_is_test
        FROM public.users u
        WHERE u.id = p_new_manager_id
          AND u.role IN ('manager', 'director')
          AND u.is_active = TRUE;

        IF manager_is_test IS NULL THEN
            RAISE EXCEPTION 'Manager % not found or inactive', p_new_manager_id;
        END IF;

        IF manager_is_test <> caller_is_test THEN
            RAISE EXCEPTION 'Forbidden: manager is outside caller data scope';
        END IF;
    END IF;

    UPDATE public.users
    SET reports_to = p_new_manager_id
    WHERE id = p_agent_id
      AND role = 'agent';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agent % not found', p_agent_id;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reassign_agent_upline(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_agents_for_reassign()
RETURNS TABLE (
    id uuid,
    full_name text,
    email text,
    reports_to uuid,
    reports_to_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
    caller_role text;
    caller_is_test boolean := false;
BEGIN
    caller_role := auth.jwt() -> 'app_metadata' ->> 'role';

    IF caller_role IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: no role on JWT';
    END IF;

    IF caller_role NOT IN ('admin', 'director', 'pa') THEN
        RAISE EXCEPTION 'Forbidden: reassign_agents capability required (got %)', caller_role;
    END IF;

    SELECT COALESCE((
        SELECT u.is_test_data
        FROM public.users u
        WHERE u.id = auth.uid()
    ), false)
    INTO caller_is_test;

    RETURN QUERY
    SELECT u.id, u.full_name, u.email, u.reports_to, h.full_name
    FROM public.users u
    LEFT JOIN public.users h ON h.id = u.reports_to
    WHERE u.role = 'agent'
      AND u.is_active = TRUE
      AND u.is_test_data = caller_is_test
    ORDER BY u.full_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_agents_for_reassign() TO authenticated;
