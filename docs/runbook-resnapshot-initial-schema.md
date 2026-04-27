# Runbook: Re-snapshot the initial schema migration

## Why

`supabase/migrations/00000000000000_initial_schema.sql` was generated as a
point-in-time snapshot on 2026-03-08 and is now incomplete. The live schema
has 40+ tables; the snapshot has 18. As a result:

- `supabase db push` against a **clean** database fails around migration #20
  when `member_invitations` is first referenced — that table doesn't exist
  in the snapshot and isn't created until much later.
- Disaster recovery from migrations alone is broken. The only way to rebuild
  the schema today is from a Supabase backup.
- New environments (e.g., a fresh staging clone) can't be initialized from
  the migration history.

This runbook regenerates the snapshot so it matches current prod, making
migrations replayable end-to-end.

## When to run

- Before any planned full-restore drill
- Before spinning up a new staging or preview environment
- Quarterly, as part of routine DR hygiene
- **Not** as an emergency operation — this is a controlled refresh, not an
  incident response

## Pre-flight

1. **Confirm prod is healthy.** Don't snapshot during an incident.
2. **Lock migrations briefly.** Coordinate so no one applies a new migration
   while you're running `db dump` (otherwise the snapshot may capture half
   of an in-progress change).
3. **Verify Supabase CLI is logged in:**
   ```bash
   supabase --version
   supabase projects list
   ```
4. **Ensure the working tree is clean** so the regenerated file is the only
   diff you commit.

## Steps

```bash
cd ~/lyfe-master/lyfe-app

# 1. Take the dump from the production project. --schema-only keeps it small
#    and replayable; the migration system seeds reference data through later
#    migrations, not the snapshot.
supabase db dump \
    --project-ref nvtedkyjwulkzjeoqjgx \
    --schema public,auth,storage \
    --schema-only \
    -f supabase/migrations/00000000000000_initial_schema.sql.new

# 2. Sanity-check the file. It should be ~3000+ lines and include all the
#    tables you expect (members_invitations, candidate_profiles, invitations,
#    jobs, progress_signals, notifications, audit_log, roadmap_*, disc_*,
#    candidate_milestones, candidate_paper_attempts, candidate_prep_course_bookings).
wc -l supabase/migrations/00000000000000_initial_schema.sql.new
grep -E "^CREATE TABLE.*member_invitations|candidate_profiles|invitations|jobs|progress_signals|audit_log|notifications" supabase/migrations/00000000000000_initial_schema.sql.new | sort -u | head -30

# 3. If the dump looks complete, swap it in.
mv supabase/migrations/00000000000000_initial_schema.sql.new \
   supabase/migrations/00000000000000_initial_schema.sql

# 4. Verify replayability against a clean local Postgres. This is the
#    actual DR test — it should run end-to-end without error.
supabase db reset  # nukes local DB, replays every migration in order

# 5. If `supabase db reset` succeeds, commit:
git add supabase/migrations/00000000000000_initial_schema.sql
git commit -m "chore(db): re-snapshot initial schema (replayable from blank)"
```

## Verification after merge

- Apply nothing to staging or prod. The snapshot only affects new clean
  environments and DR rebuilds. Existing prod has all migrations applied
  in order; replacing the snapshot file doesn't change prod state.
- Run `supabase db reset` locally one more time after merge to confirm the
  history is still consistent.

## Rollback

If the regenerated snapshot turns out to be broken (e.g., references a type
that's defined in a later migration), simply revert the commit:

```bash
git revert <commit-sha>
```

The previous (incomplete) snapshot was the status quo for weeks; reverting
returns to that baseline.

## Caveats

- **RLS policies, functions, triggers, and views** all dump cleanly with
  `--schema-only`. Reference data (seed rows in `roadmap_programmes`, etc.)
  does NOT dump — those continue to live in their respective migrations.
- **Storage buckets** dump as DDL but bucket *contents* are not snapshotted.
  This is fine — the snapshot is for schema replayability, not data.
- **`auth` schema** is included because some functions reference `auth.users`
  directly. The Supabase platform will skip rows it manages.
- The snapshot timestamp (`00000000000000_`) is intentional — it sorts
  before any real migration so the migration runner applies it first.
