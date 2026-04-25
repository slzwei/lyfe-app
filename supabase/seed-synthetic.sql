-- Synthetic monitoring seed — STAGING ONLY.
--
-- This file is NOT a migration. It is applied manually to the staging
-- Supabase project (ref ajjxkasvikeigapnzdak) via the SQL editor or psql.
--
--     psql "$STAGING_DB_URL" -f supabase/seed-synthetic.sql
--
-- NEVER apply to production. The guard below raises on any DB that already
-- has a non-empty synthetic_env_marker with env='prod' — but your eyes are
-- the real guard. Check \conninfo (psql) or the Supabase dashboard title
-- bar before running.
--
-- What this seeds:
--   1. synthetic_env_marker row with env='staging'
--   2. SYN_PROBE exam paper + one canned question (for R4 exam RPC probe)
--
-- Probe users (6 auth users) are created separately by
-- scripts/synthetic/seed.mjs because auth.users creation must go through
-- the Supabase admin API, not SQL.

BEGIN;

-- Hard guard: fail if someone mis-targets this at prod by mistake.
DO $$
DECLARE
    has_prod_marker boolean;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM public.synthetic_env_marker WHERE env = 'prod'
    ) INTO has_prod_marker;
    IF has_prod_marker THEN
        RAISE EXCEPTION 'Refusing to seed: synthetic_env_marker contains env=''prod''. This does not look like staging.';
    END IF;

    -- Soft sanity: print which database we are about to seed.
    RAISE NOTICE 'Seeding synthetic monitoring on database=%, current_user=%', current_database(), current_user;
END
$$;


-- ── 1. Mark this database as staging ────────────────────────────────────────

INSERT INTO public.synthetic_env_marker (env)
VALUES ('staging')
ON CONFLICT (env) DO NOTHING;


-- ── 2. SYN_PROBE exam paper ─────────────────────────────────────────────────
-- A tiny, deterministic paper owned by synthetic monitoring. The exam RPC
-- probe (R4) submits known answers and asserts the returned score.
--
-- Using stable UUIDs (v5-style, hand-picked) so re-runs are idempotent.

INSERT INTO public.exam_papers (
    id,
    code,
    title,
    duration_minutes,
    pass_percentage,
    question_count,
    is_active,
    is_mandatory,
    display_order
)
VALUES (
    '00000000-5ea1-4000-8000-000000000001'::uuid,
    'SYN_PROBE',
    'Synthetic monitoring probe paper (do not display)',
    60,
    70,
    1,
    false,       -- is_active=false so it never renders in the app's exam list
    false,
    9999
)
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    is_active = EXCLUDED.is_active,
    display_order = EXCLUDED.display_order;

-- One question, one correct answer. Enough to score deterministically.
INSERT INTO public.exam_questions (
    id,
    paper_id,
    question_number,
    question_text,
    options,
    correct_answer
)
VALUES (
    '00000000-5ea1-4000-8000-000000000002'::uuid,
    '00000000-5ea1-4000-8000-000000000001'::uuid,
    1,
    'Synthetic probe: answer is always B.',
    '{"A":"Wrong","B":"Correct","C":"Wrong","D":"Wrong"}'::jsonb,
    'B'
)
ON CONFLICT (id) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    options = EXCLUDED.options,
    correct_answer = EXCLUDED.correct_answer;

-- ── 3. Schedule the R6 invariant sweeper on staging only ───────────────────
-- This cron job never runs on prod because the seed never runs on prod.
-- Hourly sweep writes to synthetic_invariant_violations; the drain workflow
-- reads it hourly and opens/closes GH issues.

-- pg_cron is idempotent on job names: unschedule-if-exists then re-schedule.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sweep-synthetic-invariants') THEN
        PERFORM cron.unschedule('sweep-synthetic-invariants');
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- pg_cron not installed or not accessible — ignore on dev DBs.
    RAISE NOTICE 'Could not unschedule sweep-synthetic-invariants: %', SQLERRM;
END
$$;

SELECT cron.schedule(
    'sweep-synthetic-invariants',
    '17 * * * *',  -- :17 past the hour, out of band from other jobs
    $cmd$ SELECT public.sweep_synthetic_invariants(); $cmd$
);

COMMIT;

-- Verify.
SELECT 'synthetic_env_marker' AS table_name, env, created_at::text AS details
FROM public.synthetic_env_marker
UNION ALL
SELECT 'exam_papers (SYN_PROBE)', code, title
FROM public.exam_papers
WHERE code = 'SYN_PROBE'
UNION ALL
SELECT 'cron.job (sweep-synthetic-invariants)', jobname, schedule
FROM cron.job
WHERE jobname = 'sweep-synthetic-invariants';
