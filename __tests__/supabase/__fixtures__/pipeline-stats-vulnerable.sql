-- FIXTURE (audit H2) — the ORIGINAL, vulnerable production definition of the
-- 2-argument get_lead_pipeline_stats overload, captured verbatim from prod
-- before the fix. It is SECURITY DEFINER but performs NO authorization check,
-- so any authenticated caller could read any user's pipeline stats.
--
-- pipelineStatsRpcAccessControl.test.ts loads this file to prove its
-- assertions actually discriminate: the guard checks PASS against the real
-- migration and FAIL against this fixture (fail-before / pass-after).
-- This file is NOT a migration and is never applied to any database.

CREATE OR REPLACE FUNCTION public.get_lead_pipeline_stats(p_user_id uuid, p_is_manager boolean)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_agent_ids UUID[];
    v_week_ago  TIMESTAMPTZ := now() - INTERVAL '7 days';
    v_result    JSONB;
BEGIN
    IF p_is_manager THEN
        SELECT array_agg(u.id) INTO v_agent_ids
        FROM users u WHERE u.reports_to = p_user_id AND u.role = 'agent' AND u.is_active = true;
        v_agent_ids := COALESCE(v_agent_ids, ARRAY[]::UUID[]) || p_user_id;
    ELSE
        v_agent_ids := ARRAY[p_user_id];
    END IF;
    SELECT jsonb_build_object(
        'totalLeads', COUNT(*),
        'newThisWeek', COUNT(*) FILTER (WHERE l.status = 'new' AND l.created_at >= v_week_ago),
        'conversionRate', CASE WHEN COUNT(*) FILTER (WHERE l.status IN ('won','lost')) > 0
            THEN ROUND(COUNT(*) FILTER (WHERE l.status = 'won')::NUMERIC / COUNT(*) FILTER (WHERE l.status IN ('won','lost')) * 100)
            ELSE 0 END,
        'activeFollowUps', COUNT(*) FILTER (WHERE l.status IN ('contacted','qualified','proposed')),
        'pipeline', COALESCE(
            (SELECT jsonb_agg(jsonb_build_object('status', s.status, 'count', COALESCE(c.cnt, 0)) ORDER BY s.ord)
            FROM (VALUES ('new'::lead_status,1),('contacted'::lead_status,2),('qualified'::lead_status,3),
                         ('proposed'::lead_status,4),('won'::lead_status,5),('lost'::lead_status,6)) AS s(status,ord)
            LEFT JOIN (SELECT l2.status, COUNT(*) AS cnt FROM leads l2 WHERE l2.assigned_to = ANY(v_agent_ids) GROUP BY l2.status) c ON c.status = s.status),
            '[]'::jsonb)
    ) INTO v_result FROM leads l WHERE l.assigned_to = ANY(v_agent_ids);
    RETURN v_result;
END;
$$;
