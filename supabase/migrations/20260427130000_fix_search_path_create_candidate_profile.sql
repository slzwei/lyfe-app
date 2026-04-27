-- Lock search_path on create_candidate_profile_on_insert(), a SECURITY DEFINER
-- trigger function created in 20260322093325 — well after the 9-function
-- search_path sweep in 20260305100456, so it was missed. SECURITY DEFINER
-- functions with mutable search_path can be hijacked by an attacker who can
-- create a malicious function in a writable schema (e.g., public) that
-- shadows pg_catalog operators.
--
-- Fix: pin search_path to public. Pure metadata change — function body
-- continues to operate on tables in `public` exactly as before.

ALTER FUNCTION public.create_candidate_profile_on_insert() SET search_path = public;

COMMENT ON FUNCTION public.create_candidate_profile_on_insert() IS
    'Trigger function on candidates INSERT — auto-creates a candidate_profiles row, matched to auth.users by phone when possible. SECURITY DEFINER + SET search_path=public.';
