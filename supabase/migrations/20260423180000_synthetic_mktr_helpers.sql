-- Synthetic monitoring — MKTR webhook cleanup helper.
--
-- R1 probes generate leads with external_id prefixed 'SYN-' and
-- source_name='mktr'. This function atomically removes those leads and
-- their dependent rows (lead_activities + notifications) in a single
-- transaction. Called at the start of every MKTR probe run as a
-- self-healing step (in case a previous run failed to clean up) and again
-- at the end.
--
-- SAFE on prod: the function will find zero rows because probes never
-- write to prod. Leaving it defined on prod costs nothing; scheduling it
-- there would be a bug.

CREATE OR REPLACE FUNCTION public.cleanup_synthetic_leads()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    deleted_count integer := 0;
BEGIN
    WITH syn AS (
        SELECT id
        FROM public.leads
        WHERE source_name = 'mktr' AND external_id LIKE 'SYN-%'
    ),
    del_notifications AS (
        DELETE FROM public.notifications
        WHERE (data ->> 'leadId') IN (SELECT id::text FROM syn)
        RETURNING 1
    ),
    del_activities AS (
        DELETE FROM public.lead_activities
        WHERE lead_id IN (SELECT id FROM syn)
        RETURNING 1
    ),
    del_leads AS (
        DELETE FROM public.leads
        WHERE id IN (SELECT id FROM syn)
        RETURNING 1
    )
    SELECT count(*) INTO deleted_count FROM del_leads;

    RETURN deleted_count;
END
$$;

REVOKE ALL ON FUNCTION public.cleanup_synthetic_leads() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_synthetic_leads() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_synthetic_leads() TO service_role;

COMMENT ON FUNCTION public.cleanup_synthetic_leads() IS
    'R1 probe helper. Deletes all leads with source_name=''mktr'' and external_id prefix ''SYN-'' plus dependent activities and notifications. Returns count of deleted leads.';
