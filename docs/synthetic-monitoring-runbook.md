# Synthetic Monitoring — Runbook

Companion to `docs/synthetic-monitoring-audit.md`. Every operational scenario
you will hit while living with synthetic probes.

---

## 1. A probe is paging me and I don't have time to fix it

1. Open the repo's GitHub Settings → Environments → `synthetic-monitoring`.
2. Under **Variables**, set `SYNTHETIC_KILL_SWITCH=true`.
3. Within one workflow cycle all probes exit `0` at their first step.
4. Open a TODO to unset this and fix the probe.

_To disable one probe but not the others_: comment out its `schedule:` block
in `.github/workflows/synthetic-*.yml` and land a PR. The kill switch is for
everything.

---

## 2. A probe is flaky — failing sometimes, passing sometimes

1. Check `synthetic_probe_runs` on staging:

    ```sql
    SELECT run_at, status, duration_ms, error_code, error_message
    FROM public.synthetic_probe_runs
    WHERE probe_name = 'NAME'
    ORDER BY run_at DESC
    LIMIT 50;
    ```

2. Classify:
    - **Timeouts** (`status='timeout'`) → raise `timeoutMs` in the probe, or
      investigate staging latency.
    - **Transient network errors** → add a single retry inside the probe body
      (not in the wrapper — we want one retry per probe, not a global policy).
    - **Real regressions** → good, the probe did its job; fix the system.

3. If the root cause is staging-only flake (e.g. cron job on staging runs
   less reliably than prod), document it in the probe's header comment and
   raise its timeout or widen its freshness window.

---

## 3. A secret rotated

| Secret | Symptom | Fix |
|---|---|---|
| `STAGING_SUPABASE_SERVICE_ROLE_KEY` | All probes fail at connection / telemetry write. | Copy new key into the `synthetic-monitoring` environment. |
| `STAGING_SUPABASE_ANON_KEY` | Only RLS probes (Phase 3) fail. | Same. |
| `MKTR_WEBHOOK_SECRET_STAGING` | `receive-mktr-lead` probe 401s. | Rotate in both MKTR and GH. |
| `MKTR_API_KEY_STAGING` | `mktr-agents` probe 401s. | Same. |
| `SYNTHETIC_GH_TOKEN` | Probes pass but no issues open on failure. | Generate a new fine-grained PAT with `issues:write` only. |
| `PROBE_ACCOUNT_PASSWORD` | Any probe that signs in as a probe user fails. | Update secret, then run `npm run seed` from `scripts/synthetic/` to update the auth users. |

---

## 4. The staging project was wiped / re-created

1. Apply every migration from `supabase/migrations/` via `supabase db push`
   linked to staging.
2. Apply the synthetic seed:

    ```bash
    psql "$STAGING_DB_URL" -f supabase/seed-synthetic.sql
    ```

3. Re-create the probe users:

    ```bash
    cd scripts/synthetic && npm run seed
    ```

4. Manually trigger `Synthetic — hello` via Actions tab to confirm the
   pipeline is healthy.

---

## 5. I need to add a new probe

1. Copy `00-hello.mjs` to `NN-your-probe.mjs` (N = next available number).
2. Inside, call `runProbe('your-probe', async () => { ... })`.
3. **First line of the probe body** after the client is created:
   `await assertStagingMarker(client);`
4. Write the probe body. Keep it under ~80 lines. If it needs more, extract
   helpers into `_lib/`.
5. Copy `.github/workflows/synthetic-hello.yml` to
   `.github/workflows/synthetic-your-probe.yml`. Update:
    - Workflow name
    - `schedule:` cron (leave commented for first 48 h)
    - Command at the end (`node NN-your-probe.mjs`)
    - Any extra env vars the probe needs
6. Follow the per-probe rollout checklist below.

### Per-probe rollout checklist

- [ ] Run locally against staging 5 times — passes idempotently.
- [ ] Deliberately break it (bad secret, empty table, wrong signature) —
      confirm alert fires with correct label + run URL.
- [ ] PR lands with `schedule:` commented, `workflow_dispatch:` only.
- [ ] Manually trigger 5 times in GH UI; confirm:
    - First failure → opens issue.
    - Subsequent failures → comment on same issue, not new one.
    - First pass after failure → closes issue with recovery comment.
- [ ] Uncomment `schedule:`; land follow-up PR.
- [ ] Soak 48 h. Check `synthetic_probe_runs` for unexpected failures.
- [ ] Mark the probe `ACTIVE` in the roadmap table inside
      `docs/synthetic-monitoring-audit.md`.

---

## 6. A synthetic probe accidentally wrote to prod

This should be structurally impossible — the URL guard, the sentinel row,
and the host allowlist each refuse independently. If it still happened:

1. **Stop the bleed:** set `SYNTHETIC_KILL_SWITCH=true` immediately.
2. **Confirm the blast:** `SELECT * FROM public.synthetic_probe_runs WHERE env='prod'` on prod — there should be zero rows. If there are, you know the scope.
3. **Root cause:** read the offending probe's run log in GH Actions. Where did the URL point?
4. **Remediate the guard:** which layer failed? Was it bypassed, removed, commented out? Restore it. Add a regression test.
5. **Report:** open an incident in the repo with label `synthetic-monitor`, `postmortem`.

---

## 7. I need to delete / rotate the probe auth users

1. Pause probes (`SYNTHETIC_KILL_SWITCH=true`).
2. Delete users in Supabase Studio → Authentication, filtered by email
   `probe+*@lyfe.sg`.
3. Re-run `npm run seed` from `scripts/synthetic/`.
4. Unpause probes.
