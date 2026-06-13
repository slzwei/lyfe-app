-- Pre-fix fixture for audit H5 — the public.leads DELETE policies exactly as
-- they stood in PROD before the fix: the canonical deny (USING false) AND a
-- Dashboard-created, prod-only allow policy (leads_delete) that gates on
-- can_access_lead. Both are PERMISSIVE, FOR DELETE, role `authenticated`, so
-- PostgreSQL OR-combines them to `false OR can_access_lead(...)` and the deny
-- is neutralised. (leads_delete lives in no migration — this fixture is the
-- only place its CREATE is captured.)
--
-- Used two ways:
--   * leadsDeleteAccessControl.test.ts parses it and asserts a surviving
--     allow DELETE policy IS detected — proving the suite's "deny-only" check
--     discriminates (fail-before / pass-after).
--   * scripts/leads-delete-rls-test.sql applies it via `\i :mig` as the pre-fix
--     baseline; an agent's DELETE of its own lead then succeeds and the harness
--     RAISEs 'VULNERABLE', so verify-leads-delete-rls.sh exits non-zero.

CREATE POLICY deny_delete_leads ON public.leads
  FOR DELETE TO authenticated USING (false);

CREATE POLICY leads_delete ON public.leads
  FOR DELETE TO authenticated
  USING (can_access_lead(assigned_to, created_by));
