-- Restrict fn_activate_agent RPC execution to service_role only.
--
-- The activate-agent edge function performs caller JWT/capability checks, then
-- invokes this SECURITY DEFINER RPC using the service-role client. The RPC is
-- not safe to expose directly to anon/authenticated PostgREST callers because
-- it trusts p_activated_by_user_id and performs the candidate -> agent flip.
--
-- Supabase advisor caught explicit anon/authenticated EXECUTE grants after
-- 20260516050000 fixed the function body. Revoking PUBLIC is not enough when
-- explicit role grants already exist.

REVOKE ALL ON FUNCTION public.fn_activate_agent(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_activate_agent(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.fn_activate_agent(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_activate_agent(uuid, uuid) TO service_role;
