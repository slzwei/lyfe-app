-- Phase 4: delete-account orphan detection + soft-delete
-- Detects public.users rows without a corresponding auth.users entry
-- and deactivates them (soft-delete) rather than hard-deleting,
-- to avoid FK constraint failures from leads, events, candidates, etc.

CREATE OR REPLACE FUNCTION public.cleanup_orphaned_users()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  orphan_count integer;
  orphan_record RECORD;
BEGIN
  -- Safety: abort if auth.users appears empty (likely a connectivity issue)
  IF NOT EXISTS (SELECT 1 FROM auth.users LIMIT 1) THEN
    RAISE WARNING '[cleanup] auth.users appears empty — skipping to prevent false positives';
    RETURN 0;
  END IF;

  -- Log each orphan before deactivating
  FOR orphan_record IN
    SELECT u.id, u.full_name, u.role
    FROM users u
    LEFT JOIN auth.users au ON au.id = u.id
    WHERE au.id IS NULL
      AND u.is_active = true
  LOOP
    RAISE NOTICE '[cleanup] deactivating orphan user % (%, role=%)',
      orphan_record.id, orphan_record.full_name, orphan_record.role;
  END LOOP;

  -- Soft-delete: deactivate orphaned users instead of deleting
  -- This avoids FK constraint failures and preserves audit trail
  WITH orphans AS (
    SELECT u.id
    FROM users u
    LEFT JOIN auth.users au ON au.id = u.id
    WHERE au.id IS NULL
      AND u.is_active = true
  )
  UPDATE users SET is_active = false
  WHERE id IN (SELECT id FROM orphans);

  GET DIAGNOSTICS orphan_count = ROW_COUNT;

  IF orphan_count > 0 THEN
    RAISE NOTICE '[cleanup] deactivated % orphaned user(s)', orphan_count;
  END IF;

  RETURN orphan_count;
END;
$$;

-- Schedule weekly orphan check (Sundays at 4am SGT = 8pm UTC Saturday)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'cleanup-orphaned-users',
      '0 20 * * 6',
      $cron$SELECT public.cleanup_orphaned_users()$cron$
    );
  END IF;
END;
$$;
