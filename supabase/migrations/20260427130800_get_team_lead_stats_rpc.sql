-- Server-side aggregation of lead stats per assigned-agent. Replaces the
-- client-side fan-out in lib/team.ts:fetchTeamMembers, which today pulls
-- every lead for every team member into the phone via:
--
--   .from('leads').select('assigned_to, status, updated_at').in('assigned_to', userIds)
--
-- At 200 agents × 500 leads each, that's 100,000 rows transmitted to a
-- mobile device for the team tab. The RPC pre-aggregates per user_id
-- so the client receives one row per agent instead of one row per lead.
--
-- Auth model: SECURITY DEFINER. The function does NOT check the caller's
-- access to each p_user_ids entry — that gate happens in the lib layer
-- (fetchTeamMembers already filters userIds by role hierarchy before
-- calling). Effectively the RPC trusts its input list, and the lib layer
-- is responsible for never passing a UUID the caller can't see. To keep
-- the contract honest we also enforce the caller has at least one of:
-- admin, director, manager, pa role — anything else gets an empty result.

CREATE OR REPLACE FUNCTION public.get_team_lead_stats(
    p_user_ids uuid[],
    p_stale_days int DEFAULT 7
)
RETURNS TABLE(
    user_id uuid,
    total_count bigint,
    open_count bigint,
    stale_count bigint,
    won_count bigint,
    last_updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    -- Caller capability gate. Empty result for non-staff roles keeps the
    -- contract simple: staff get the aggregates, everyone else gets nothing.
    SELECT
        l.assigned_to AS user_id,
        COUNT(*)::bigint AS total_count,
        COUNT(*) FILTER (WHERE l.status NOT IN ('won', 'lost'))::bigint AS open_count,
        COUNT(*) FILTER (
            WHERE l.status NOT IN ('won', 'lost')
              AND l.updated_at < (now() - (p_stale_days || ' days')::interval)
        )::bigint AS stale_count,
        COUNT(*) FILTER (WHERE l.status = 'won')::bigint AS won_count,
        MAX(l.updated_at) AS last_updated_at
    FROM public.leads l
    WHERE
        l.assigned_to = ANY(p_user_ids)
        AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'director', 'manager', 'pa')
    GROUP BY l.assigned_to;
$$;

REVOKE ALL ON FUNCTION public.get_team_lead_stats(uuid[], int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_team_lead_stats(uuid[], int) TO authenticated;

COMMENT ON FUNCTION public.get_team_lead_stats(uuid[], int) IS
    'Pre-aggregated lead stats per agent for the Team tab. Replaces a client-side O(N) leads scan with a single round-trip aggregate. Caller must be admin/director/manager/pa; non-staff callers receive an empty result.';
