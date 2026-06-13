-- M4 follow-up to H5 (2026-06-13): notify_insert was an anon-executable
-- SECURITY DEFINER mutator — the same class of bug as append_invitation_file.
--
-- public.notify_insert(uuid, text, text, text, jsonb) does a bare
--   INSERT INTO notifications (user_id, type, title, body, data) VALUES (...)
-- with NO auth/ownership check, and had EXECUTE granted to PUBLIC/anon/
-- authenticated. Because it is SECURITY DEFINER, ANY caller — including
-- unauthenticated `anon` — could inject a notification for ANY user id with
-- attacker-controlled title/body/data via POST /rest/v1/rpc/notify_insert
-- (push-spam / phishing). Confirmed live via get_advisors
-- (anon_security_definer_function_executable) on 2026-06-13.
--
-- CALLER ANALYSIS (why revoking anon/authenticated is safe):
--   * No application code calls notify_insert directly (no supabase.rpc()).
--   * Its only callers are 14 SECURITY DEFINER trigger functions
--     (alert_candidate_deleted + trigger_notify_*). A SECURITY DEFINER trigger
--     runs as its owner (postgres), so its internal call to notify_insert is
--     authorized as postgres — NOT as the logged-in user. Revoking EXECUTE from
--     PUBLIC/anon/authenticated therefore does NOT break trigger-fired
--     notifications; postgres (owner) and service_role retain EXECUTE.
--
-- Fix: lock EXECUTE to service_role only (same pattern as
-- append_invitation_file / delete_candidate_cascade). Body unchanged. The
-- function is defined in 20260313100000_notification_triggers.sql, so this
-- migration only adjusts privileges.

REVOKE ALL ON FUNCTION public.notify_insert(uuid, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_insert(uuid, text, text, text, jsonb) TO service_role;

COMMENT ON FUNCTION public.notify_insert(uuid, text, text, text, jsonb) IS
  'Inserts a notification row. Invoked by SECURITY DEFINER trigger functions (run as owner) and, if needed, the service-role backend. EXECUTE revoked from PUBLIC/anon/authenticated per M4/H5 audit 2026-06-13 — it has no internal auth check, so it must never be client-callable.';
