-- Temporary diagnostic for useCandidateRealtime TIMED_OUT investigation.
-- Function is dropped by the follow-up migration 20260419110100.

CREATE OR REPLACE FUNCTION public._diag_realtime_state()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT jsonb_build_object(
    'tables', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'table', c.relname,
          'replica_identity', c.relreplident::text,
          'in_supabase_realtime', EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime' AND tablename = c.relname
          )
        )
        ORDER BY c.relname
      )
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname IN ('progress_signals','leads')
    ),
    'progress_signals_policies', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'name', polname,
          'roles', (
            SELECT array_agg(r.rolname)
            FROM unnest(polroles) x(oid)
            JOIN pg_roles r ON r.oid = x.oid
          ),
          'cmd', polcmd::text,
          'qual', pg_get_expr(polqual, polrelid)
        )
      )
      FROM pg_policy
      WHERE polrelid = 'public.progress_signals'::regclass
    ),
    'publication_tables_count', (
      SELECT count(*) FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
    )
  );
$$;

REVOKE ALL ON FUNCTION public._diag_realtime_state() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._diag_realtime_state() FROM anon;
REVOKE ALL ON FUNCTION public._diag_realtime_state() FROM authenticated;
GRANT EXECUTE ON FUNCTION public._diag_realtime_state() TO service_role;
