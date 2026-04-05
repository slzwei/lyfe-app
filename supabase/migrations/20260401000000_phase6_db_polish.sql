-- Phase 6: Database Polish & Integrity
-- 6.1: CHECK constraint on notifications.type
-- 6.2: CHECK constraint on event_attendees.attendee_role (includes 'host')
-- 6.3: Fix notify_progress_change to use UPSERT
-- 6.5: Source-control get_lead_pipeline_stats RPC
-- 6.13: Make candidate_profiles.candidate_id NOT NULL
-- 6.14: Add missing indexes on status/date columns


-- =====================================================================
-- 6.1: CHECK constraint on notifications.type
-- Includes all 19 TypeScript NotificationType values + 'lead_assigned'
-- (used in seed data for backward compat)
-- =====================================================================

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS chk_notification_type;

ALTER TABLE public.notifications
  ADD CONSTRAINT chk_notification_type CHECK (type IN (
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
    'lead_assigned'
  )) NOT VALID;


-- =====================================================================
-- 6.2: CHECK constraint on event_attendees.attendee_role
-- TypeScript AttendeeRole includes 'host'; seed data uses it for creators.
-- =====================================================================

-- Drop existing constraint if any (from 20260306062740)
ALTER TABLE public.event_attendees DROP CONSTRAINT IF EXISTS event_attendees_attendee_role_check;
ALTER TABLE public.event_attendees DROP CONSTRAINT IF EXISTS chk_attendee_role;

ALTER TABLE public.event_attendees
  ADD CONSTRAINT chk_attendee_role CHECK (attendee_role IN (
    'attendee', 'duty_manager', 'presenter', 'host'
  ));


-- =====================================================================
-- 6.3: Fix notify_progress_change to use UPSERT
-- Currently UPDATE only — if singleton row deleted, all signals fail.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.notify_progress_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO progress_signals (id, updated_at)
  VALUES (1, now())
  ON CONFLICT (id) DO UPDATE SET updated_at = now();
  RETURN COALESCE(NEW, OLD);
END;
$$;


-- =====================================================================
-- 6.5: Source-control get_lead_pipeline_stats RPC
-- Created via dashboard, not in any migration. Add for fresh deploys.
-- Guarded with DO block in case it already exists.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_lead_pipeline_stats(p_user_id uuid)
RETURNS TABLE(
  status text,
  count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.status::text,
    COUNT(*)::bigint
  FROM leads l
  WHERE l.assigned_to = p_user_id
  GROUP BY l.status;
$$;


-- =====================================================================
-- 6.13: Make candidate_profiles.candidate_id NOT NULL
-- All INSERT paths (trigger + migrations) already set candidate_id.
-- Backfill migration 20260322093245 already resolved NULLs.
-- =====================================================================

-- Safety: verify no NULLs before applying (fails if any exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.candidate_profiles WHERE candidate_id IS NULL) THEN
    RAISE EXCEPTION 'Cannot add NOT NULL: candidate_profiles has NULL candidate_id values. Backfill first.';
  END IF;
END;
$$;

ALTER TABLE public.candidate_profiles ALTER COLUMN candidate_id SET NOT NULL;


-- =====================================================================
-- 6.14: Add missing indexes on status/date columns
-- Performance: these columns are used in WHERE/ORDER BY but lack indexes.
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_candidate_module_progress_status
  ON public.candidate_module_progress (status);

CREATE INDEX IF NOT EXISTS idx_invitations_user_id
  ON public.invitations (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invitations_status
  ON public.invitations (status);

CREATE INDEX IF NOT EXISTS idx_candidate_profiles_user_id
  ON public.candidate_profiles (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_roadshow_attendance_checked_in_at
  ON public.roadshow_attendance (checked_in_at);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
  ON public.audit_log (created_at);

CREATE INDEX IF NOT EXISTS idx_email_otp_codes_expires_at
  ON public.email_otp_codes (expires_at);
