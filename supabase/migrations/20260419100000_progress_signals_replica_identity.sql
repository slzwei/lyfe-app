-- Fix: useCandidateRealtime was stuck on TIMED_OUT because progress_signals
-- has RLS enabled but default REPLICA IDENTITY (primary key only). Supabase
-- Realtime requires REPLICA IDENTITY FULL for RLS-enabled tables subscribed
-- on UPDATE events — without it, the realtime server has insufficient old-row
-- data in the WAL to evaluate the SELECT policy and silently rejects the
-- subscription join (surfaced on the client as TIMED_OUT).
--
-- Other tables we subscribe to (leads, roadshow_activities, roadshow_attendance)
-- are INSERT-only, which doesn't require OLD row data, so they've been fine
-- with DEFAULT identity.
--
-- progress_signals is a single-row signal table so the extra WAL volume is
-- negligible.

ALTER TABLE public.progress_signals REPLICA IDENTITY FULL;
