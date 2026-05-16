# scripts/synthetic

Probes that run against the **staging** Supabase project
(`ajjxkasvikeigapnzdak`) to catch silent regressions end-to-end.

## Zero-prod guarantee

Every probe goes through `_lib/env.mjs::guardStaging()` before any network
call. That function:

1. Reads the hardcoded `STAGING_PROJECT_REF` constant (string literal — not an
   env var).
2. Asserts `STAGING_SUPABASE_URL` contains that ref.
3. Asserts the URL's hostname matches `${ref}.supabase.co`.
4. Honours `SYNTHETIC_KILL_SWITCH=true` by exiting `0` without running.

Every write-path probe additionally calls `assertStagingMarker(client)` which
fails closed if the `public.synthetic_env_marker` row (`env='staging'`) is
missing.

## First-time setup

1. Apply the migration to staging:

    ```bash
    # from lyfe-app/
    supabase db push --linked   # ensure --linked points at staging first
    ```

2. Apply the SQL seed to staging (Supabase SQL editor or psql):

    ```bash
    psql "$STAGING_DB_URL" -f supabase/seed-synthetic.sql
    ```

3. From this folder, install dependencies and create the probe accounts:

    ```bash
    cd scripts/synthetic
    npm ci
    STAGING_SUPABASE_URL=https://ajjxkasvikeigapnzdak.supabase.co \
    STAGING_SUPABASE_SERVICE_ROLE_KEY=... \
    PROBE_ACCOUNT_PASSWORD=... \
        npm run seed
    ```

4. Set the six secrets below in the **`synthetic-monitoring`** GitHub
   Environment (Repo Settings → Environments → New environment):

    | Secret | Value |
    |---|---|
    | `STAGING_SUPABASE_URL` | `https://ajjxkasvikeigapnzdak.supabase.co` |
    | `STAGING_SUPABASE_SERVICE_ROLE_KEY` | staging service role |
    | `STAGING_SUPABASE_ANON_KEY` | staging anon |
    | `PROBE_ACCOUNT_PASSWORD` | ≥16 char random |
    | `MKTR_WEBHOOK_SECRET_STAGING` | staging MKTR webhook secret (Phase 2) |
    | `MKTR_API_KEY_STAGING` | staging MKTR API key (Phase 2) |
    | `SYNTHETIC_GH_TOKEN` | fine-grained PAT with `issues:write` only, or omit and the workflow falls back to `GITHUB_TOKEN` |

5. Trigger `Synthetic — hello` via the Actions tab (**workflow_dispatch**)
   and watch the run. Expected: green checkmark, one row in
   `synthetic_probe_runs` with `status='pass'`, no GH issue opened.

6. Deliberately break it (unset `STAGING_SUPABASE_SERVICE_ROLE_KEY` in the
   environment) and trigger again. Expected: red run, issue opened with title
   `[synthetic] hello failing`.

7. Restore the secret and re-trigger. Expected: green run, recovery comment
   on the issue, issue auto-closed.

8. Once 6 + 7 work, uncomment the `schedule:` block in
   `.github/workflows/synthetic-hello.yml` and commit. Soak 48 h.

## Kill switch

Set an environment variable `SYNTHETIC_KILL_SWITCH=true` on the
`synthetic-monitoring` GitHub Environment (not a secret — use Variables).
Every synthetic workflow logs the kill switch as its first step and gates
checkout, dependency install, and probe execution while it is set. The Node
guard also receives the same variable as a second layer.
Flip back to unset or `false` to re-enable.

## Files

| Path | Purpose |
|---|---|
| `_lib/env.mjs` | Staging guard + allowlisted fetch wrapper. |
| `_lib/supabase.mjs` | Service-role / anon clients + sentinel assertion. |
| `_lib/hmac.mjs` | MKTR webhook signing (Phase 2). |
| `_lib/alert.mjs` | GitHub Issue alerter: open, comment, close on recovery. |
| `_lib/run.mjs` | Probe wrapper: timeout, telemetry, alerting, exit code. |
| `00-hello.mjs` | Phase 0 smoke test. |
| `seed.mjs` | One-time: create the seven probe auth users on staging. |
| `package.json` | `@supabase/supabase-js` only; isolated from the RN app deps. |

## Adding a new probe

1. Create `NN-name.mjs` (e.g. `01-cron-freshness.mjs`).
2. Use `runProbe('name', async () => { ... })`.
3. Inside, call `assertStagingMarker(client)` before any write.
4. Add a workflow `.github/workflows/synthetic-name.yml` modelled on
   `synthetic-hello.yml`.
5. Follow the per-probe rollout checklist in
   `docs/synthetic-monitoring-runbook.md`.
