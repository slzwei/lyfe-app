-- Add is_test_data flag to users and member_invitations.
--
-- Purpose: provide schema-level separation between production and test/E2E
-- data so that downstream consumers (MKTR sync, lyfe-app/sg staff UIs) can
-- exclude test rows without resorting to fragile email-pattern matching.
--
-- Defense-in-depth: even when E2E tests correctly target a separate Supabase
-- project, this flag ensures any leakage into production is contained.
--
-- Rollout:
--   1. Migration adds column with DEFAULT false NOT NULL — backwards compatible
--   2. Backfill of existing E2E rows in prod is a separate one-shot UPDATE
--   3. E2E test factories set is_test_data=true on every insert
--   4. MKTR LyfeAdapter and staff-facing queries filter is_test_data=false

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_test_data boolean NOT NULL DEFAULT false;

ALTER TABLE public.member_invitations
  ADD COLUMN IF NOT EXISTS is_test_data boolean NOT NULL DEFAULT false;

-- Indexes: most queries filter on is_test_data=false, so partial index on the
-- minority case keeps lookups cheap.
CREATE INDEX IF NOT EXISTS users_is_test_data_idx
  ON public.users (is_test_data) WHERE is_test_data = true;

CREATE INDEX IF NOT EXISTS member_invitations_is_test_data_idx
  ON public.member_invitations (is_test_data) WHERE is_test_data = true;

COMMENT ON COLUMN public.users.is_test_data IS
  'True for synthetic users created by E2E tests, fixtures, or seeds. Production reads (MKTR sync, staff UIs) MUST filter is_test_data=false.';

COMMENT ON COLUMN public.member_invitations.is_test_data IS
  'True for invitations created by E2E tests. Mirrors users.is_test_data for consistency.';
