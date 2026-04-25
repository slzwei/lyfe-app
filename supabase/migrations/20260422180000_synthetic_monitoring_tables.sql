-- Synthetic monitoring infrastructure.
--
-- Tables here are owned by scripts/synthetic/* and written to via the
-- service-role key only. They are SAFE to apply to both prod and staging
-- because nothing is seeded by this migration itself — the staging sentinel
-- row in synthetic_env_marker is seeded separately (supabase/seed-synthetic.sql)
-- on staging only.
--
-- Why this exists:
--   1. synthetic_env_marker — a row with env='staging' is present only on
--      staging. Every synthetic probe SELECTs this row before doing anything
--      and aborts if missing. First line of defence against a misconfigured
--      probe accidentally hitting prod.
--   2. synthetic_probe_runs — telemetry. One row per probe invocation.
--   3. synthetic_invariant_violations — reserved for Phase 4 (R6 in the audit).

-- ── synthetic_env_marker ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.synthetic_env_marker (
    env text PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.synthetic_env_marker IS
    'Sentinel. Seeded with env=''staging'' on the staging project only. '
    'Probes MUST assert a matching row before doing any work — missing row '
    'means this is prod (or a fresh clone) and the probe must refuse to run.';

ALTER TABLE public.synthetic_env_marker ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: service role bypasses RLS; anon/authed clients
-- cannot read or write. Keeps the sentinel out of user-facing query plans.


-- ── synthetic_probe_runs ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.synthetic_probe_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    probe_name text NOT NULL,
    run_at timestamptz NOT NULL DEFAULT now(),
    duration_ms integer,
    status text NOT NULL CHECK (status IN ('pass', 'fail', 'timeout', 'error', 'skipped')),
    error_code text,
    error_message text,
    env text NOT NULL CHECK (env IN ('staging', 'prod'))
);

CREATE INDEX IF NOT EXISTS idx_synthetic_probe_runs_probe_run
    ON public.synthetic_probe_runs (probe_name, run_at DESC);

CREATE INDEX IF NOT EXISTS idx_synthetic_probe_runs_failing
    ON public.synthetic_probe_runs (probe_name, run_at DESC)
    WHERE status <> 'pass';

ALTER TABLE public.synthetic_probe_runs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.synthetic_probe_runs IS
    'Telemetry for synthetic probes. One row per invocation. Retained 30 days.';


-- ── synthetic_invariant_violations ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.synthetic_invariant_violations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invariant_name text NOT NULL,
    subject_id text,
    subject_type text,
    detected_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz,
    details jsonb
);

CREATE INDEX IF NOT EXISTS idx_synthetic_invariant_violations_open
    ON public.synthetic_invariant_violations (invariant_name, detected_at DESC)
    WHERE resolved_at IS NULL;

ALTER TABLE public.synthetic_invariant_violations ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.synthetic_invariant_violations IS
    'Reserved for R6 (DB-invariant sweep). Populated by a pg_cron job; drained '
    'hourly by scripts/synthetic/ into GitHub issues.';


-- ── Retention: auto-prune probe runs older than 30 days ─────────────────────
-- Runs inside pg_cron when the rest of synthetic monitoring ships. For now
-- the function is defined but not scheduled.

CREATE OR REPLACE FUNCTION public.prune_synthetic_probe_runs()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    DELETE FROM public.synthetic_probe_runs
    WHERE run_at < now() - interval '30 days';
$$;

COMMENT ON FUNCTION public.prune_synthetic_probe_runs() IS
    'Deletes probe run telemetry older than 30 days. Schedule via pg_cron once '
    'probe volume justifies it (see Phase 4 in docs/synthetic-monitoring-audit.md).';
