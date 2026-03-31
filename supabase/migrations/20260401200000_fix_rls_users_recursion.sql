-- Fix: "Staff can read staff users" policy joins users table inside users RLS,
-- causing potential infinite recursion. Replace with JWT claim-based check.
-- See: production readiness review 2026-04-01, finding RLS-3.

DROP POLICY IF EXISTS "Staff can read staff users" ON public.users;

CREATE POLICY "Staff can read staff users"
  ON public.users FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'director', 'manager', 'agent', 'pa')
  );
