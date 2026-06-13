-- Pre-fix fixture for audit H3 (used to prove the behavioral suite FAILS
-- against the vulnerable tree). It is a deliberate NO-OP: the blanket
-- `users_select_authenticated USING (true)` policy and the table-wide SELECT
-- grant established by the baseline in users-pii-rls-test.sql are left in place,
-- so a candidate still reads every row and push_token is still exposed. The
-- candidate assertion then RAISEs 'VULNERABLE', exiting non-zero.
--
--   USERS_PII_SQL=__tests__/supabase/__fixtures__/users-select-vulnerable.sql \
--     ./scripts/verify-users-pii-rls.sh   # must FAIL
SELECT 'no-op: H3 fix not applied (pre-fix baseline)' AS fixture;
