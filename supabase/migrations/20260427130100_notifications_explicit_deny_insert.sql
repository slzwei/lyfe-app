-- Codify the deny-INSERT contract on `public.notifications`. Today the table
-- has SELECT/UPDATE/DELETE policies but no INSERT policy — RLS treats this
-- as an implicit deny for the `authenticated` role. The intended writers are
-- the SECURITY DEFINER `notify_insert()` function and edge functions that
-- use the service-role key (both of which bypass RLS).
--
-- This migration adds an explicit deny so that future code mistakenly
-- inserting via the regular client surfaces a clear policy-violation error
-- instead of silently no-opping.
--
-- No behavioral change for existing call sites — it just makes intent explicit.

DROP POLICY IF EXISTS notifications_no_anon_insert ON public.notifications;

CREATE POLICY notifications_no_anon_insert
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (false);

COMMENT ON POLICY notifications_no_anon_insert ON public.notifications IS
    'Deny direct INSERT from authenticated clients. Notifications must be inserted via notify_insert() SECURITY DEFINER or edge functions using the service-role key. Codifies the previously-implicit deny behavior so future client-side INSERT attempts fail with a clear error.';
