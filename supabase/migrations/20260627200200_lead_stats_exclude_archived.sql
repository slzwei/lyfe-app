-- Leads parity (Phase 5): exclude archived leads from the aggregate stat RPCs.
--
-- Archiving hides a lead from active lists; it must ALSO drop out of every
-- pipeline/dashboard aggregate, or counts diverge from the visible lists.
-- App-side `.from('leads')` reads were filtered in lib/leads/stats.ts + lib/team.ts;
-- these SECURITY DEFINER functions aggregate server-side, so the filter goes in
-- the SQL. CREATE OR REPLACE preserves the existing (authenticated-only) grants.

-- 1-arg pipeline stats (per-user status counts).
CREATE OR REPLACE FUNCTION public.get_lead_pipeline_stats(p_user_id uuid)
 RETURNS TABLE(status text, count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: not authenticated';
  END IF;
  v_caller_role := auth.jwt() -> 'app_metadata' ->> 'role';
  IF auth.uid() = p_user_id
     OR v_caller_role IN ('admin', 'director')
     OR EXISTS (SELECT 1 FROM users u WHERE u.id = p_user_id AND u.reports_to = auth.uid())
  THEN
    RETURN QUERY
      SELECT l.status::text, COUNT(*)::bigint
      FROM leads l
      WHERE l.assigned_to = p_user_id AND l.archived_at IS NULL
      GROUP BY l.status;
  ELSE
    RAISE EXCEPTION 'Unauthorized: caller does not have access to user % pipeline stats', p_user_id;
  END IF;
END;
$function$;

-- 2-arg pipeline stats (manager roll-up; jsonb summary).
CREATE OR REPLACE FUNCTION public.get_lead_pipeline_stats(p_user_id uuid, p_is_manager boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_caller_role text;
    v_agent_ids   uuid[];
    v_week_ago    timestamptz := now() - INTERVAL '7 days';
    v_result      jsonb;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: not authenticated';
    END IF;
    v_caller_role := auth.jwt() -> 'app_metadata' ->> 'role';
    IF NOT (
        auth.uid() = p_user_id
        OR v_caller_role IN ('admin', 'director')
        OR EXISTS (SELECT 1 FROM users u WHERE u.id = p_user_id AND u.reports_to = auth.uid())
    ) THEN
        RAISE EXCEPTION 'Unauthorized: caller does not have access to user % pipeline stats', p_user_id;
    END IF;
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
             LEFT JOIN (SELECT l2.status, COUNT(*) AS cnt FROM leads l2 WHERE l2.assigned_to = ANY(v_agent_ids) AND l2.archived_at IS NULL GROUP BY l2.status) c
               ON c.status = s.status),
            '[]'::jsonb)
    ) INTO v_result
    FROM leads l
    WHERE l.assigned_to = ANY(v_agent_ids) AND l.archived_at IS NULL;
    RETURN v_result;
END;
$function$;

-- Team lead stats (per-agent rollup for managers/directors/admins/pa).
CREATE OR REPLACE FUNCTION public.get_team_lead_stats(p_user_ids uuid[], p_stale_days integer DEFAULT 7)
 RETURNS TABLE(user_id uuid, total_count bigint, open_count bigint, stale_count bigint, won_count bigint, last_updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        AND l.archived_at IS NULL
        AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'director', 'manager', 'pa')
    GROUP BY l.assigned_to;
$function$;
