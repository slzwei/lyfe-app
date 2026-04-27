# Runbook: Recover from a bad migration

## Symptoms

- `supabase db push` errored mid-stream and the schema is in a half-applied state.
- A migration applied successfully but broke a feature (RLS too tight, column rename missed callers, trigger logic wrong).
- The app's edge functions or queries are now failing with errors that map back to the schema.

## Pre-flight (before any recovery action)

1. **Don't panic — Supabase has PITR.** Confirm we're on Pro tier (Dashboard → Settings → Billing). If yes, you have 7-day point-in-time recovery available.
2. **Snapshot the current state immediately**:
   ```bash
   supabase db dump --project-ref nvtedkyjwulkzjeoqjgx --schema-only \
     -f /tmp/lyfe-broken-$(date +%s).sql
   ```
   This captures the broken schema for forensics; do NOT overwrite the existing migration files until you've recovered.
3. **Notify in `#agents` Slack** that the database is in a degraded state and you're working on it.
4. **Disable MKTR webhook** (in Render dashboard) so you don't accumulate failed webhook deliveries during recovery.

## Decision tree

### Path A — The migration applied cleanly but broke a feature

Your migration ran without error but is incorrect. Roll forward with a fix:

1. Write a NEW migration that corrects the issue. Don't edit the broken migration file — that creates drift between local and prod.
2. Test on staging (`ajjxkasvikeigapnzdak`) first.
3. `supabase db push --project-ref nvtedkyjwulkzjeoqjgx` to apply.

For RLS tightening that locks people out, the corrective migration is usually a `DROP POLICY` + `CREATE POLICY` with the broader rule.

### Path B — The migration partially applied; schema is half-baked

Your migration errored mid-statement. PostgreSQL transactions usually save you, but `ALTER TYPE ADD VALUE` and a few other DDL statements are not transactional and can leave permanent residue.

1. Check `supabase migration list --project-ref nvtedkyjwulkzjeoqjgx` — is the migration marked applied or not?
2. **If marked applied** but the schema is wrong → Path A (write a corrective migration).
3. **If NOT marked applied** but some DDL ran → use `supabase migration repair`:
   ```bash
   # Mark the broken one as reverted so the runner ignores it on next push:
   supabase migration repair <broken-timestamp> --status reverted \
     --project-ref nvtedkyjwulkzjeoqjgx
   ```
   Then write a corrective migration that finishes whatever the broken one started, with `IF NOT EXISTS` / `DROP IF EXISTS` guards so it's idempotent.

### Path C — The migration deleted/corrupted data and you need a restore

This is the nuclear path. PITR restores the entire database to a point in time — there's no per-table or per-row PITR.

1. Decide on the RPO window: how much data loss is acceptable? Anything written between the recovery point and now will be lost.
2. **Schedule the restore for a maintenance window** unless the alternative is worse (data corruption that's actively spreading).
3. **Notify customers in `#agents`** that they will be signed out and need to re-do any work from the last X minutes.
4. **Restore via Supabase Dashboard** → Settings → Database → Point in Time Recovery → pick a timestamp.
5. **Re-apply migrations** that landed AFTER the restore point but were correct. Read `supabase migration list` to identify them.
6. **Verify state**: run synthetic probes manually, sample-test the affected tables, confirm row counts are sensible.
7. **Re-enable MKTR webhook** in Render.

## Specific migration footguns to watch for

### `ALTER TYPE ... ADD VALUE`
Not transactional in PostgreSQL. Once you've added an enum value, it's permanent even if the rest of the migration rolls back. The schema cleanup is manual: `ALTER TYPE` doesn't have a `DROP VALUE` — you have to recreate the type from scratch (data migration required).

### RLS policy changes
Apply to staging FIRST. Walk through every role's user flow on staging. RLS bugs are silent — they don't error, they just return empty result sets that look like normal "no data" UI states.

### Column renames
Postgres allows column renames but PostgREST caches schema introspection — Supabase Realtime, edge functions, and client SDKs may continue talking to the old name for up to 5 minutes. If you must rename, prefer:
1. Add the new column.
2. Backfill from the old column.
3. Update all callers to use the new column.
4. Drop the old column in a separate migration after verifying nothing references it.

### `DROP TABLE` / `TRUNCATE`
**Always require explicit user instruction.** This runbook does not authorize destructive operations.

## Prevention (long-term)

The following items reduce the chance of needing this runbook:

- **Apply to staging first**, always. The clone-prod-to-staging script (per `scripts/SUPABASE-ENV-SWITCH.md`) gives you a realistic mirror.
- **Run synthetic probes on staging immediately after any migration**, before you touch prod.
- **Re-snapshot the initial schema** (per `docs/runbook-resnapshot-initial-schema.md`) so a clean rebuild is possible. Currently the snapshot is incomplete.
- **Add a CI gate** that runs `supabase db reset` against a clean local Postgres on every PR that touches `supabase/migrations/`. This catches non-replayable migrations before they land.

## Related
- `scripts/SUPABASE-ENV-SWITCH.md` — env switching + clone procedures
- `docs/runbook-resnapshot-initial-schema.md` — the planned baseline refresh
- `docs/runbook-rotate-service-role-key.md` — if recovery requires key rotation
