-- Track when users were last active in the app.
--
-- NOTE: This migration was originally applied directly to the remote database
-- on 2026-04-10 via the Supabase Dashboard SQL editor and never committed to
-- git. Backfilled into version control on 2026-04-13 by reading the statements
-- out of supabase_migrations.schema_migrations. The content below exactly
-- matches what was executed on the remote.
ALTER TABLE public.users ADD COLUMN last_seen_at TIMESTAMPTZ;

-- No new RLS policy needed:
--   users_update_own already allows users to UPDATE their own row
--   users_select_team already allows directors/managers to SELECT team members
