-- Private storage bucket for PDPA "right to access" data exports. The
-- export-user-data edge function uploads a per-request JSON file and
-- returns a 1-hour signed URL; nothing else reads from the bucket.
--
-- Bucket is private (no public read). RLS denies all client access —
-- the edge function uses the service-role key which bypasses RLS.
-- Files are organised as <user_id>/<unix_ms>.json so a single user
-- can't accidentally read another user's export through path enumeration.

INSERT INTO storage.buckets (id, name, public)
VALUES ('user-data-exports', 'user-data-exports', false)
ON CONFLICT (id) DO NOTHING;

-- No policies. Service-role-only via edge function.
--
-- (The earlier draft ended with `COMMENT ON COLUMN storage.buckets.id IS NULL`
-- as a no-op to "keep the file non-empty." That fails on managed Supabase
-- with `must be owner of relation buckets` because storage.buckets is owned
-- by `supabase_storage_admin`, not the migration role. The INSERT above is
-- sufficient content for the migration runner.)
