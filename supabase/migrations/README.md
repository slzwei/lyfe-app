# Supabase Migrations

This directory is the **canonical source** for all Supabase schema migrations across the Lyfe platform. Both lyfe-app and lyfe-sg share the same Supabase project (`nvtedkyjwulkzjeoqjgx`, ap-southeast-1).

## Structure

- `00000000000000_initial_schema.sql` — Deliberate no-op (retired snapshot; see its header). The real chain starts at `20260228103319_create_users_and_roles.sql`.
- `20260320173000_baseline_dashboard_tables.sql` — Baseline for objects originally created by hand in the Dashboard (candidate_profiles, disc_responses, disc_results, invitations + their original policies). Audit C3, 2026-06-12.
- `202602XX+_*.sql` — Incremental migrations applied in timestamp order

## Important Notes

- **Never add migrations in lyfe-sg** — that directory redirects here
- Migrations are tracked in `supabase_migrations.schema_migrations` — do not rename or delete applied files
- After adding a migration, regenerate types: `npm run gen:types` from root `lyfe-master/`
- **Never create/alter schema via the Dashboard or ad-hoc MCP `apply_migration` without committing the file here** — that is how the C3 "repo cannot rebuild the database" incident happened
- The whole chain is rebuild-verified: `scripts/verify-db-rebuild.sh` replays every file on a throwaway PostgreSQL 17 (no Docker; `brew install postgresql@17`), and `__tests__/supabase/migrationsRebuildable.test.ts` statically blocks references to tables no migration creates

## March 29 Migration Chain

The `20260329_*` series (17 files) contains iterative debug/fix cycles for the `handle_new_user` trigger and invitation system. The final state is in `20260329190000_cleanup_and_hardening.sql`. These files cannot be squashed because they're already applied to the live database.

## Phase 1-3 Security Migrations

- `20260331000000_phase1_security_fixes.sql` — Notifications INSERT block, drop assign_candidate_role
- `20260331010000_fix_search_path_security.sql` — SET search_path on 6 SECURITY DEFINER functions
- `20260331020000_phase2_data_integrity.sql` — Data integrity fixes
- `20260331030000_phase2_rls_hardening.sql` — RLS policies for invitations, member_invitations
- `20260331040000_phase3_security_hardening.sql` — Exam RLS JWT, email_otp_codes block, notification cleanup
