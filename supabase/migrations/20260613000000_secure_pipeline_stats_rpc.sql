-- ============================================================================
-- Secure the pipeline-stats RPC + codify it into the chain (audit H2)
-- ============================================================================
-- Problem:
--   The home dashboard calls the 2-argument overload
--   get_lead_pipeline_stats(p_user_id uuid, p_is_manager boolean), which
--   returns a rich JSONB summary (totalLeads, newThisWeek, conversionRate,
--   activeFollowUps, pipeline). It is SECURITY DEFINER (bypasses RLS) but
--   performs NO authorization check: any authenticated caller — including a
--   trainee candidate — could pass another manager's id with
--   p_is_manager => true and read that manager's entire team pipeline
--   (totals + conversion). Verified live: a candidate read an unrelated
--   manager's 7-lead pipeline before this fix.
--
--   Second half of the bug: this 2-arg overload existed ONLY in production
--   (created via the Dashboard, in no migration). A fresh `supabase db reset`
--   produced only the 1-arg overload, so the dashboard's RPC call errored out
--   ("Could not find the function ... (uuid, boolean)") on any rebuilt DB.
--
-- Fix:
--   CREATE OR REPLACE the 2-arg overload with identical aggregation logic
--   PLUS an authorization gate that mirrors the 1-arg overload hardened in
--   20260404000000_audit_fixes (audit C1): the caller may read p_user_id's
--   pipeline only if they are that user, an admin/director, or that user's
--   direct manager (reports_to = auth.uid()). Unauthenticated callers are
--   rejected. The same gate covers both p_is_manager paths because the
--   question is always "may you see p_user_id's stats", whether or not those
--   stats roll up a team. The app always passes p_user_id = the current user,
--   so legitimate dashboard loads are unaffected.
--
-- Drift note:
--   This codifies the (uuid, boolean) overload into the canonical chain for
--   the first time (the 20260320173000 baseline flagged it as deliberately
--   un-codified → H2). CREATE OR REPLACE applies cleanly whether or not the
--   function already exists, so on built production it is a strict no-op
--   except for the added authorization checks. The 1-arg overload is left
--   intact (already guarded, in-migration, currently unused by any caller).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_lead_pipeline_stats(
    p_user_id uuid,
    p_is_manager boolean
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_role text;
    v_agent_ids   uuid[];
    v_week_ago    timestamptz := now() - INTERVAL '7 days';
    v_result      jsonb;
BEGIN
    -- Must be authenticated.
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: not authenticated';
    END IF;

    v_caller_role := auth.jwt() -> 'app_metadata' ->> 'role';

    -- Authorization: caller may read p_user_id's pipeline stats only if they
    -- are that user, an admin/director (see all), or that user's direct
    -- manager. Mirrors the 1-arg overload guarded in 20260404000000 (C1) and
    -- the leads RLS model this SECURITY DEFINER path bypasses.
    IF NOT (
        auth.uid() = p_user_id
        OR v_caller_role IN ('admin', 'director')
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = p_user_id
              AND u.reports_to = auth.uid()
        )
    ) THEN
        RAISE EXCEPTION 'Unauthorized: caller does not have access to user % pipeline stats', p_user_id;
    END IF;

    -- Aggregation scope: a manager rolls up their active agents + themselves;
    -- everyone else sees only their own leads.
    IF p_is_manager THEN
        SELECT array_agg(u.id) INTO v_agent_ids
        FROM users u
        WHERE u.reports_to = p_user_id AND u.role = 'agent' AND u.is_active = true;
        v_agent_ids := COALESCE(v_agent_ids, ARRAY[]::uuid[]) || p_user_id;
    ELSE
        v_agent_ids := ARRAY[p_user_id];
    END IF;

    SELECT jsonb_build_object(
        'totalLeads', COUNT(*),
        'newThisWeek', COUNT(*) FILTER (WHERE l.status = 'new' AND l.created_at >= v_week_ago),
        'conversionRate', CASE WHEN COUNT(*) FILTER (WHERE l.status IN ('won','lost')) > 0
            THEN ROUND(COUNT(*) FILTER (WHERE l.status = 'won')::numeric / COUNT(*) FILTER (WHERE l.status IN ('won','lost')) * 100)
            ELSE 0 END,
        'activeFollowUps', COUNT(*) FILTER (WHERE l.status IN ('contacted','qualified','proposed')),
        'pipeline', COALESCE(
            (SELECT jsonb_agg(jsonb_build_object('status', s.status, 'count', COALESCE(c.cnt, 0)) ORDER BY s.ord)
             FROM (VALUES ('new'::lead_status,1),('contacted'::lead_status,2),('qualified'::lead_status,3),
                          ('proposed'::lead_status,4),('won'::lead_status,5),('lost'::lead_status,6)) AS s(status,ord)
             LEFT JOIN (SELECT l2.status, COUNT(*) AS cnt FROM leads l2 WHERE l2.assigned_to = ANY(v_agent_ids) GROUP BY l2.status) c
               ON c.status = s.status),
            '[]'::jsonb)
    ) INTO v_result
    FROM leads l
    WHERE l.assigned_to = ANY(v_agent_ids);

    RETURN v_result;
END;
$$;

-- Preserve the production execute grants (the internal auth.uid() gate makes
-- the anon grant a no-op: anonymous callers have a NULL auth.uid()).
GRANT EXECUTE ON FUNCTION public.get_lead_pipeline_stats(uuid, boolean) TO anon, authenticated, service_role;
