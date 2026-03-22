-- Notification triggers for candidate milestones from lyfe-sg:
--   1. DISC quiz completed → notify assigned manager
--   2. Onboarding profile completed → notify assigned manager
-- Uses the existing notify_insert() helper and send-push-notification webhook.

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. disc_completed — disc_results INSERT
--    Recipient: candidates.assigned_manager_id (via candidate_profiles bridge)
-- ══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION trigger_notify_disc_completed()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_candidate record;
BEGIN
    -- Find candidate via candidate_profiles bridge
    SELECT c.id, c.name, c.assigned_manager_id, c.created_by_id
    INTO v_candidate
    FROM candidate_profiles cp
    JOIN candidates c ON c.id = cp.candidate_id
    WHERE cp.user_id = NEW.user_id;

    IF v_candidate IS NULL THEN
        RETURN NEW;
    END IF;

    -- Notify assigned manager
    PERFORM notify_insert(
        v_candidate.assigned_manager_id,
        'disc_completed',
        'DISC Quiz Completed',
        v_candidate.name || ' has completed their DISC assessment',
        jsonb_build_object(
            'route', '/(tabs)/candidates/' || v_candidate.id,
            'candidateId', v_candidate.id,
            'discType', NEW.disc_type
        )
    );

    -- Notify PA (created_by) if different from manager
    IF v_candidate.created_by_id IS DISTINCT FROM v_candidate.assigned_manager_id THEN
        PERFORM notify_insert(
            v_candidate.created_by_id,
            'disc_completed',
            'DISC Quiz Completed',
            v_candidate.name || ' has completed their DISC assessment',
            jsonb_build_object(
                'route', '/(tabs)/pa/candidate/' || v_candidate.id,
                'candidateId', v_candidate.id,
                'discType', NEW.disc_type
            )
        );
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_disc_completed
    AFTER INSERT ON disc_results
    FOR EACH ROW
    EXECUTE FUNCTION trigger_notify_disc_completed();


-- ══════════════════════════════════════════════════════════════════════════════
-- 2. profile_completed — candidate_profiles.completed flips to true
--    Recipient: candidates.assigned_manager_id (via candidate_id FK)
-- ══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION trigger_notify_profile_completed()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_candidate record;
BEGIN
    IF NEW.candidate_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT c.id, c.name, c.assigned_manager_id, c.created_by_id
    INTO v_candidate
    FROM candidates c
    WHERE c.id = NEW.candidate_id;

    IF v_candidate IS NULL THEN
        RETURN NEW;
    END IF;

    -- Notify assigned manager
    PERFORM notify_insert(
        v_candidate.assigned_manager_id,
        'profile_completed',
        'Application Submitted',
        v_candidate.name || ' has submitted their application form',
        jsonb_build_object(
            'route', '/(tabs)/candidates/' || v_candidate.id,
            'candidateId', v_candidate.id
        )
    );

    -- Notify PA (created_by) if different from manager
    IF v_candidate.created_by_id IS DISTINCT FROM v_candidate.assigned_manager_id THEN
        PERFORM notify_insert(
            v_candidate.created_by_id,
            'profile_completed',
            'Application Submitted',
            v_candidate.name || ' has submitted their application form',
            jsonb_build_object(
                'route', '/(tabs)/pa/candidate/' || v_candidate.id,
                'candidateId', v_candidate.id
            )
        );
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_profile_completed
    AFTER UPDATE OF completed ON candidate_profiles
    FOR EACH ROW
    WHEN (NEW.completed = true AND OLD.completed = false)
    EXECUTE FUNCTION trigger_notify_profile_completed();
