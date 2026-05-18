-- Block flipping is_test_data: false → true on active users.
--
-- Background: migration 20260504100000_add_is_test_data_flag.sql introduced
-- the is_test_data flag to separate E2E/synthetic rows from production rows.
-- A one-shot backfill UPDATE marked legitimate seeded staff (Steven Teo,
-- Shawn, Daniel, the only director + two real managers) as is_test_data=true,
-- which hid them from listAssignableManagers and from the
-- resolveAssignedManagerId fallback in lyfe-sg — breaking the staff invite
-- flow (no dropdown, "No manager or director available to assign" error).
--
-- Invariant enforced here: you cannot flip is_test_data: false → true on a
-- user where is_active = true. Active users are in production use and must
-- not silently disappear from staff-facing queries.
--
-- Bypass paths (intentionally narrow):
--   • Deactivate first: UPDATE users SET is_active=false, is_test_data=true …
--     (the trigger checks NEW.is_active, so both columns in the same SET
--     allows the flip)
--   • Insert rows as is_test_data=true at INSERT time (synthetic seeders
--     already do this — trigger only fires on UPDATE)
--
-- Service-role, REST PATCH, SQL editor, and future migrations all fire the
-- trigger. The only bypasses are TRUNCATE (irrelevant here), DISABLE
-- TRIGGER (table owner only), or session_replication_role='replica'
-- (superuser only).

CREATE OR REPLACE FUNCTION public.prevent_active_user_test_data_flip()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_test_data = true
     AND OLD.is_test_data = false
     AND NEW.is_active = true THEN
    RAISE EXCEPTION
      'Cannot flip is_test_data: false → true on active user % (role=%). Deactivate the user first (set is_active=false in the same UPDATE), or insert test rows with is_test_data=true at INSERT time.',
      NEW.id, NEW.role
      USING ERRCODE = 'check_violation',
            HINT = 'See migration 20260518040000_prevent_active_user_test_data_flip.sql for rationale.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_active_user_test_data_flip ON public.users;
CREATE TRIGGER trg_prevent_active_user_test_data_flip
  BEFORE UPDATE OF is_test_data ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_active_user_test_data_flip();

COMMENT ON FUNCTION public.prevent_active_user_test_data_flip() IS
  'Blocks UPDATE flipping is_test_data: false → true on active users. Added 2026-05-18 after a backfill UPDATE silently hid the only director + two real managers, breaking the invite flow.';
