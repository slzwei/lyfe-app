-- Set REPLICA IDENTITY FULL on the four RLS-enabled tables in the
-- supabase_realtime publication that emit UPDATE events. Without this,
-- Supabase Realtime cannot evaluate row-level RLS policies on the OLD row
-- of an UPDATE, and silently drops the event for subscribers — exactly
-- the symptom that triggered the same fix on `progress_signals` in
-- 20260419100000_progress_signals_replica_identity.sql.
--
-- Cost: marginal increase in WAL volume per UPDATE (full row instead of
-- just changed columns + PK). Required for correctness on these tables
-- whose Realtime UPDATE subscribers (lyfe-sg primarily) need to see
-- changes filtered through RLS.

ALTER TABLE public.candidate_profiles REPLICA IDENTITY FULL;
ALTER TABLE public.disc_responses REPLICA IDENTITY FULL;
ALTER TABLE public.disc_results REPLICA IDENTITY FULL;
ALTER TABLE public.invitations REPLICA IDENTITY FULL;
