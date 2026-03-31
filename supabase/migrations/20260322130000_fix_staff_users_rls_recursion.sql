-- Fix: "Staff can read staff users" policy caused infinite recursion
-- by querying public.users inside a policy on public.users.
-- Use auth.jwt() -> 'app_metadata' ->> 'role' instead.

DROP POLICY IF EXISTS "Staff can read staff users" ON public.users;

CREATE POLICY "Staff can read staff users"
  ON public.users FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'director', 'manager', 'agent', 'pa')
  );
