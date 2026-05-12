-- ════════════════════════════════════════════════════════════════════
-- 20260512110000 — distinct notification type for organic /join-us applicants
--
-- WHY:
--   Candidates currently come from two paths:
--     1. PA / RO / manager invites them (most volume) — happy path.
--     2. Strangers apply via the public /join-us form (organic leads) —
--        hardcoded to assigned_manager_id = STEVEN_ID in lyfe-sg.
--   Both fired the SAME `candidate_assigned` notification, so Steven
--   couldn't tell at a glance whether a fresh ping was a normal PA
--   action or a real organic applicant. We want organic applicants to
--   stand out.
--
-- WHAT THIS MIGRATION DOES:
--   1. Adds `candidates.source` column ('invited' default | 'organic')
--      with a CHECK constraint so callers can't drift.
--   2. Extends chk_notification_type to allow the new
--      `organic_application` type.
--   3. Rewrites `trigger_notify_candidate_assigned` to branch on
--      NEW.source — emits `organic_application` (title "New Public
--      Application") when source='organic', and the existing
--      `candidate_assigned` path otherwise. Everything else (recipient,
--      data.route shape) is preserved.
--
-- DEPENDENCIES:
--   * lyfe-sg /join-us/actions.ts must set source='organic' when
--     inserting the candidates row (separate commit). Until that lands,
--     organic applicants still emit `candidate_assigned` — harmless.
--   * lyfe-app types/notification.ts adds `organic_application` to its
--     NotificationType union + role visibility (separate commit) so
--     the inbox renders a proper icon/label.
--
-- ROLLBACK:
--   DROP TRIGGER trg_notify_candidate_assigned ON candidates;
--   <restore prior trigger_notify_candidate_assigned body from
--    migration 20260313100000>;
--   ALTER TABLE candidates DROP COLUMN source;
--   <restore prior chk_notification_type>;
-- ════════════════════════════════════════════════════════════════════

-- 1. Source column ──────────────────────────────────────────────────────
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'invited';

ALTER TABLE public.candidates DROP CONSTRAINT IF EXISTS chk_candidates_source;
ALTER TABLE public.candidates
  ADD CONSTRAINT chk_candidates_source
  CHECK (source IN ('invited', 'organic'));

COMMENT ON COLUMN public.candidates.source IS
  '''invited'' = staff-initiated (PA/RO/manager invite). ''organic'' = '
  'self-service via the public /join-us form. Drives notification '
  'differentiation in trigger_notify_candidate_assigned.';

-- 2. Allow new notification type ────────────────────────────────────────
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS chk_notification_type;

ALTER TABLE public.notifications ADD CONSTRAINT chk_notification_type
CHECK (type = ANY (ARRAY[
  'roadshow_pledge',
  'new_lead',
  'candidate_update',
  'lead_milestone',
  'lead_reassigned',
  'lead_reassigned_global',
  'interview_scheduled',
  'interview_updated',
  'candidate_assigned',
  'agent_invite_accepted',
  'module_completed',
  'roadmap_unlocked',
  'new_manager_joined',
  'event_reminder',
  'interview_reminder',
  'lead_stale',
  'agency_announcement',
  'roadshow_summary',
  'system_alert',
  'lead_assigned',
  'candidate_deleted',
  'profile_completed',
  'disc_completed',
  'enneagram_completed',
  'candidate_reassigned',
  'reassignment',
  'organic_application'
]));

-- 3. Branched trigger ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_notify_candidate_assigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Guard: nullable assigned_manager_id has been allowed since
    -- migration 20260419150000. Skip silently when there's no manager
    -- to notify; the row is still created.
    IF NEW.assigned_manager_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.source = 'organic' THEN
        -- Public /join-us applicant. Distinct copy so Steven can tell
        -- it apart from a normal PA-initiated invite at a glance.
        PERFORM notify_insert(
            NEW.assigned_manager_id,
            'organic_application',
            'New Public Application',
            NEW.name || ' applied via the public form',
            jsonb_build_object(
                'route', '/(tabs)/candidates/' || NEW.id,
                'candidateId', NEW.id,
                'source', 'organic'
            )
        );
    ELSE
        -- Default 'invited' path — preserves the original behavior.
        PERFORM notify_insert(
            NEW.assigned_manager_id,
            'candidate_assigned',
            'New Candidate Assigned',
            NEW.name || ' has been added to your candidates',
            jsonb_build_object(
                'route', '/(tabs)/pa/candidate/' || NEW.id,
                'candidateId', NEW.id
            )
        );
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trigger_notify_candidate_assigned() IS
  'Fires on candidates INSERT. Branches on NEW.source: ''organic'' '
  '(public /join-us) → organic_application notification with distinct '
  'copy; ''invited'' (default, all staff flows) → candidate_assigned.';

-- The trigger itself (created in 20260313100000) stays as-is. Only the
-- function body changes; the CREATE OR REPLACE above is enough.
