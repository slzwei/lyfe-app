-- Fix candidate-targeted notification triggers that could FK-violate on
-- notifications.user_id (→ users.id), rolling back the STAFF write that fired them.
--
-- ROOT CAUSE (verified live 2026-07-04, rolled-back reproduction):
--   trigger_notify_roadmap_unlocked fires on candidate_programme_enrollment, whose
--   candidate_id → candidates(id). It called notify_insert(NEW.candidate_id), i.e.
--   INSERT notifications(user_id = a candidates.id). notifications.user_id has an FK
--   to users(id), so a candidates.id raises 23503 (notifications_user_id_fkey) and
--   the manager's manual programme-unlock is rolled back. Latent only because prod
--   has 0 manual unlocks today.
--
--   trigger_notify_module_completed fires on candidate_module_progress, whose
--   candidate_id currently → users(id) (the FK was never re-pointed to candidates(id)
--   despite 20260331020000's comment/RLS-helper assuming it was). So its
--   notify_insert(NEW.candidate_id) happens to satisfy the notifications FK TODAY —
--   but it would break the day that FK drift is reconciled to candidates(id).
--
-- FIX (design-agnostic): resolve the notification recipient to a real users.id via a
--   helper that accepts EITHER id shape — returns the id directly when it is already a
--   users.id, otherwise bridges candidates.id → candidate_profiles.user_id (active
--   linked auth user, most-recent if >1). Both candidate-targeted triggers route
--   through it and skip cleanly (no row, no error) when the candidate has no linked
--   auth user yet. This is correct whether candidate_module_progress.candidate_id
--   stays users(id) or is later re-pointed to candidates(id).
--
--   NON-DESTRUCTIVE: CREATE OR REPLACE only; no data touched; triggers unchanged
--   except for the recipient resolution. Idempotent / clean on from-zero rebuild.

-- ── Recipient resolver ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.resolve_candidate_notify_user(p_ref uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        -- p_ref is already a users.id (current candidate_module_progress.candidate_id).
        (SELECT u.id FROM users u WHERE u.id = p_ref),
        -- p_ref is a candidates.id (candidate_programme_enrollment.candidate_id, and
        -- candidate_module_progress after any future FK re-point) → bridge to the
        -- linked active auth user via candidate_profiles.
        (SELECT cp.user_id
           FROM candidate_profiles cp
           JOIN users u ON u.id = cp.user_id
          WHERE cp.candidate_id = p_ref
            AND u.is_active IS TRUE
          ORDER BY u.created_at DESC
          LIMIT 1)
    );
$$;

COMMENT ON FUNCTION public.resolve_candidate_notify_user(uuid) IS
    'Maps a candidate reference (either a users.id or a candidates.id) to the candidate''s auth users.id for notifications.user_id. Returns NULL when no active linked auth user exists (caller then skips the notification instead of FK-violating). Used by trigger_notify_module_completed + trigger_notify_roadmap_unlocked.';

-- ── 8. module_completed (candidate_module_progress) — route through resolver ──
CREATE OR REPLACE FUNCTION trigger_notify_module_completed()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_module_title text;
    v_completer_name text;
    v_recipient uuid;
BEGIN
    IF NEW.status = 'completed'
       AND (OLD.status IS NULL OR OLD.status IS DISTINCT FROM NEW.status)
       AND NEW.completed_by IS NOT NULL
       AND NEW.completed_by IS DISTINCT FROM NEW.candidate_id THEN

        v_recipient := public.resolve_candidate_notify_user(NEW.candidate_id);

        -- Skip when unresolved, or when the completer IS the candidate (self-mark).
        IF v_recipient IS NOT NULL AND v_recipient IS DISTINCT FROM NEW.completed_by THEN
            SELECT title INTO v_module_title FROM roadmap_modules WHERE id = NEW.module_id;
            SELECT full_name INTO v_completer_name FROM users WHERE id = NEW.completed_by;

            PERFORM notify_insert(
                v_recipient,
                'module_completed',
                'Module Marked Complete',
                coalesce(v_module_title, 'A module') || ' was marked complete by ' || coalesce(v_completer_name, 'your manager'),
                jsonb_build_object(
                    'route', '/(tabs)/roadmap',
                    'moduleId', NEW.module_id
                )
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- ── 9. roadmap_unlocked (candidate_programme_enrollment) — route through resolver ──
CREATE OR REPLACE FUNCTION trigger_notify_roadmap_unlocked()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_programme_title text;
    v_recipient uuid;
BEGIN
    IF NEW.manually_unlocked = true THEN
        v_recipient := public.resolve_candidate_notify_user(NEW.candidate_id);

        IF v_recipient IS NOT NULL THEN
            SELECT title INTO v_programme_title FROM roadmap_programmes WHERE id = NEW.programme_id;

            PERFORM notify_insert(
                v_recipient,
                'roadmap_unlocked',
                'Programme Unlocked',
                coalesce(v_programme_title, 'A programme') || ' is now unlocked for you!',
                jsonb_build_object(
                    'route', '/(tabs)/roadmap',
                    'programmeId', NEW.programme_id
                )
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
