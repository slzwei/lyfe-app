-- M4 (2026-06-12 production-readiness audit): check_phone_eligible was an
-- anon-executable SECURITY DEFINER phone-enumeration oracle.
--
-- public.check_phone_eligible(text) normalizes a phone and returns
--   { eligible: bool,
--     reason : 'existing_user' | 'pending_invitation' | 'invitation_expired'
--            | 'not_found' | 'invalid_phone' }
-- by reading public.users + public.member_invitations + public.invitations.
-- Because it is SECURITY DEFINER with EXECUTE granted to PUBLIC/anon/
-- authenticated, ANY unauthenticated caller could probe arbitrary phone numbers
-- one at a time via POST /rest/v1/rpc/check_phone_eligible and learn which SG
-- numbers are registered/invited at the agency — with NO DB-level rate limit.
-- That yields a members directory + a ready-made phishing target list. Confirmed
-- live on 2026-06-12: acting as the `anon` role the function returned
-- 'existing_user' for a real registered number vs 'not_found' for a random one,
-- and get_advisors flagged anon_security_definer_function_executable.
--
-- CALLER ANALYSIS (why revoking anon/authenticated is safe):
--   * The ONLY caller is the lyfe-app mobile pre-OTP login screen
--     (contexts/AuthContext.tsx -> checkPhoneEligible -> supabase.rpc(
--     'check_phone_eligible', ...)), invoked with the anon key BEFORE auth.
--   * That caller is FAIL-OPEN BY DESIGN: its try/catch returns
--     { eligible: true, reason: 'existing_user' } on ANY RPC error and proceeds
--     to send the OTP. After this REVOKE the RPC returns a permission error, so
--     the pre-flight becomes a no-op and login is NOT broken for legitimate
--     (invited / existing) users.
--   * Eligibility is still enforced where it matters: the custom-sms-hook auth
--     hook gates OTP delivery to invited / +65 numbers and Supabase Auth
--     rate-limits OTP sends. Uninvited numbers are still rejected — now at the
--     throttled OTP step instead of via the unlimited raw RPC.
--   * lyfe-sg does not call it (type-only reference). No RLS policy and no other
--     DB function reference it, so RLS evaluation and triggers are unaffected.
--
-- TRADE-OFF: the pre-flight "you're not invited / invitation expired" message is
-- lost (uninvited users now see a generic OTP-send rejection). The UX value of
-- that message IS the leak — it cannot be kept for anonymous callers without
-- authenticating or throttling them. Restoring it cleanly means fronting the
-- check with a rate-limited edge function (service-role) that the mobile app
-- calls; tracked as a follow-up, out of scope for closing the oracle.
--
-- Fix: lock EXECUTE to service_role only (same pattern as append_invitation_file
-- / notify_insert / delete_candidate_cascade). Body unchanged — the function is
-- defined in 20260405000000_phone_eligibility_check.sql; this migration only
-- adjusts privileges.

REVOKE ALL ON FUNCTION public.check_phone_eligible(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_phone_eligible(text) TO service_role;

COMMENT ON FUNCTION public.check_phone_eligible(text) IS
  'Service-role-only pre-OTP eligibility check. Returns {eligible, reason} from users + member_invitations. EXECUTE revoked from PUBLIC/anon/authenticated per M4 audit 2026-06-12 (anonymous phone-enumeration oracle); the mobile login pre-flight fails open and the custom-sms-hook + Supabase OTP rate limits remain the enforced gate.';
