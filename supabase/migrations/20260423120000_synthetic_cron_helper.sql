-- Synthetic monitoring — pg_cron freshness helper.
--
-- The `cron` schema is not exposed to PostgREST by default, so the R3 probe
-- cannot SELECT `cron.job_run_details` via the JS client. This function
-- wraps the query with SECURITY DEFINER so the service_role can call it as
-- an RPC (`supabase.rpc('get_synthetic_cron_freshness')`).
--
-- Safe on prod: function returns only aggregate metadata (job name + last
-- successful run time + last status + last return message) for an allowlist
-- of job names. No user PII is exposed.

CREATE OR REPLACE FUNCTION public.get_synthetic_cron_freshness()
RETURNS TABLE (
    jobname text,
    last_success_at timestamptz,
    last_end_at timestamptz,
    last_status text,
    last_return_message text
)
LANGUAGE sql
SECURITY DEFINER
-- Pin search_path so a role-level override can't redirect the cron.* lookup.
SET search_path = cron, public, pg_catalog
AS $$
    SELECT
        j.jobname,
        MAX(d.end_time) FILTER (WHERE d.status = 'succeeded') AS last_success_at,
        MAX(d.end_time) AS last_end_at,
        (ARRAY_AGG(d.status ORDER BY d.end_time DESC NULLS LAST))[1] AS last_status,
        (ARRAY_AGG(d.return_message ORDER BY d.end_time DESC NULLS LAST))[1] AS last_return_message
    FROM cron.job j
    LEFT JOIN cron.job_run_details d ON d.jobid = j.jobid
    WHERE j.jobname IN (
        'send-event-reminders',
        'send-interview-reminders',
        'check-stale-leads',
        'send-roadshow-summary'
    )
    GROUP BY j.jobname;
$$;

-- Lock it down: only service_role can invoke. Anon and authed users have no
-- business reading cron telemetry.
REVOKE ALL ON FUNCTION public.get_synthetic_cron_freshness() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_synthetic_cron_freshness() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_synthetic_cron_freshness() TO service_role;

COMMENT ON FUNCTION public.get_synthetic_cron_freshness() IS
    'R3 probe helper. Returns last-run metadata for the four scheduled edge-function cron jobs. SECURITY DEFINER because cron.* is not PostgREST-exposed. service_role only.';
