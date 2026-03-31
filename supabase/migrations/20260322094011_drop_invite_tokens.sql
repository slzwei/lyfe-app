-- Phase 4: Drop unused invite_tokens table (0 rows, never used in production)
-- The invitations table is the canonical invitation system

DROP TRIGGER IF EXISTS trg_agent_invite_accepted ON invite_tokens;
DROP FUNCTION IF EXISTS notify_agent_invite_accepted();

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'invite_tokens' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON invite_tokens', pol.policyname);
  END LOOP;
END $$;

DROP INDEX IF EXISTS idx_invite_tokens_token;
DROP INDEX IF EXISTS idx_invite_tokens_created_by;
DROP INDEX IF EXISTS idx_invite_tokens_consumed_by;
DROP INDEX IF EXISTS idx_invite_tokens_assigned_manager_id;

DROP TABLE IF EXISTS invite_tokens;
