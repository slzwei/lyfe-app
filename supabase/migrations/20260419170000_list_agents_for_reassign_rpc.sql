-- Companion RPC to reassign_agent_upline (20260419160000).
-- PAs (and directors/admins) need a way to list agents for the picker
-- screen, but RLS on public.users limits their SELECT visibility. This
-- SECURITY DEFINER function returns every active agent along with the
-- current upline name, accessible only to roles with the reassign_agents
-- capability.

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
BEGIN
    caller_role := auth.jwt() -> 'app_metadata' ->> 'role';

    IF caller_role IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: no role on JWT';
    END IF;

    IF caller_role NOT IN ('admin', 'director', 'pa') THEN
        RAISE EXCEPTION 'Forbidden: reassign_agents capability required (got %)', caller_role;
    END IF;

    RETURN QUERY
    SELECT u.id, u.full_name, u.email, u.reports_to, h.full_name
    FROM public.users u
    LEFT JOIN public.users h ON h.id = u.reports_to
    WHERE u.role = 'agent' AND u.is_active = TRUE
    ORDER BY u.full_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_agents_for_reassign() TO authenticated;
