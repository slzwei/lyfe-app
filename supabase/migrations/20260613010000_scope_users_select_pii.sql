-- ============================================================================
-- Scope user PII reads + lock push_token to service_role (audit H3)
-- ============================================================================
-- Problem:
--   A permissive SELECT policy `users_select_authenticated USING (true)` on
--   public.users let EVERY authenticated role — including a trainee candidate,
--   the lowest-privilege account — read every row of the users table. Verified
--   live: impersonating a candidate returned all 137 user rows (70 phone
--   numbers, 54 emails, and the Expo push_token of every device that had
--   registered one). A leaked push_token lets anyone send arbitrary push
--   notifications to that specific device via the unauthenticated Expo Push
--   API, so it is a spoofing/phishing capability, not just contact PII.
--
--   Drift note: like the H1/H2 objects, this policy existed ONLY in production
--   (created via the Dashboard, in no migration). A fresh rebuild never had it
--   — the canonical chain already ships the correctly-scoped policy set:
--     users_select_own      (auth.uid() = id)            — self
--     users_select_admin    (jwt role = 'admin')         — admin sees all
--     users_select_team     (reports_to = auth.uid())    — direct reports
--     users_select_pa       (pa_manager_assignments)     — PA → their managers
--     "Staff can read staff users" (jwt role IN staff)   — staff directory
--   The blanket USING(true) policy silently widened that to "everyone".
--
-- Fix (two parts):
--   1. DROP the blanket policy. On production this removes the over-exposure
--      (candidates/non-staff are scoped back to their own row only). On a fresh
--      rebuild the DROP IF EXISTS is a strict no-op — the policy was never in
--      the chain — so this also closes that drift (it was flagged for removal
--      in the 20260320173000 baseline header → audit H3).
--
--   2. Lock push_token to service_role only. RLS is row-level and cannot hide a
--      single column, and the "Staff can read staff users" policy legitimately
--      grants staff read access to peers' rows (the app needs peer
--      name/phone/email for team listings, lead ownership, pickers). push_token
--      has NO legitimate client read path: the app only ever WRITES its own
--      (AuthContext, gated by users_update_own) and the ONLY reader is the
--      send-push-notification edge function via the service role. So we drop
--      the table-level SELECT for anon/authenticated and re-grant SELECT on
--      every column EXCEPT push_token — making the token readable by
--      service_role only, for ALL clients (staff included), not just candidates.
--
--   Verified that no anon/authenticated caller does `select=*` on users that
--   would 403 against the column grant: lyfe-sg admin pages, the co-located
--   admin panel, and the MKTR edge functions all use the service-role client;
--   lyfe-app's only `select=*` is the self-profile fetch, switched in the same
--   change to an explicit column list (excludes push_token).
--
-- MAINTENANCE: because anon/authenticated now hold COLUMN-level SELECT on
-- public.users, a future `ALTER TABLE public.users ADD COLUMN` is NOT
-- automatically readable by clients — add the new column to the GRANT below
-- (and to USER_PROFILE_COLUMNS in contexts/AuthContext.tsx). Keep push_token
-- out of both unless the client genuinely needs to read it.
-- ============================================================================

-- 1. Remove the prod-only blanket read policy (no-op on a fresh rebuild).
DROP POLICY IF EXISTS users_select_authenticated ON public.users;

-- 2. Restrict push_token to service_role: switch anon/authenticated from a
--    table-wide SELECT to a column-level SELECT that omits push_token only.
REVOKE SELECT ON public.users FROM anon, authenticated;

GRANT SELECT (
    id,
    email,
    phone,
    full_name,
    avatar_url,
    role,
    reports_to,
    lifecycle_stage,
    date_of_birth,
    last_login_at,
    is_active,
    created_at,
    updated_at,
    external_id,
    notification_preferences,
    onboarding_complete,
    email_verified,
    last_seen_at,
    face_registered_at,
    consent_tos_at,
    consent_privacy_at,
    consent_operational_push_at,
    consent_marketing_at,
    is_test_data
) ON public.users TO anon, authenticated;

-- service_role retains its table-level SELECT (untouched above) so the
-- send-push-notification edge function and admin/service-role clients keep
-- full access, including push_token.
