-- Allow 'enneagram_completed' as a notification type so the
-- trigger_notify_enneagram_completed trigger (from 20260419120000) can
-- insert its manager/PA notifications without hitting chk_notification_type.

alter table public.notifications drop constraint if exists chk_notification_type;

alter table public.notifications add constraint chk_notification_type
check (type = any (array[
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
  'reassignment'
]));
