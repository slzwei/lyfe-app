/**
 * Notification types for the in-app notification inbox.
 */
import type { Tables } from './shared/database.types';
import type { UserRole } from './database';
import type { IconName } from '@/types/ui';

export type AppNotification = Tables<'notifications'>;

export type NotificationType =
    // Existing (implemented)
    | 'roadshow_pledge'
    | 'new_lead'
    // Data-change driven
    | 'candidate_update'
    | 'lead_milestone'
    | 'lead_reassigned'
    | 'interview_scheduled'
    | 'interview_updated'
    | 'candidate_assigned'
    | 'agent_invite_accepted'
    | 'module_completed'
    | 'roadmap_unlocked'
    | 'new_manager_joined'
    | 'lead_reassigned_global'
    // Scheduled
    | 'event_reminder'
    | 'interview_reminder'
    | 'lead_stale'
    // User-initiated
    | 'agency_announcement'
    | 'roadshow_summary'
    | 'system_alert';

export const NOTIFICATION_TYPE_CONFIG: Record<NotificationType, { icon: IconName; label: string }> = {
    // Existing
    roadshow_pledge: { icon: 'hand-left', label: 'Roadshow Pledge' },
    new_lead: { icon: 'person-add', label: 'New Lead' },
    // Data-change driven
    candidate_update: { icon: 'people', label: 'Candidate Update' },
    lead_milestone: { icon: 'trophy', label: 'Lead Milestone' },
    lead_reassigned: { icon: 'swap-horizontal', label: 'Lead Reassigned' },
    interview_scheduled: { icon: 'calendar', label: 'Interview Scheduled' },
    interview_updated: { icon: 'calendar-outline', label: 'Interview Updated' },
    candidate_assigned: { icon: 'person-add', label: 'Candidate Assigned' },
    agent_invite_accepted: { icon: 'checkmark-circle', label: 'Invite Accepted' },
    module_completed: { icon: 'checkmark-done', label: 'Module Completed' },
    roadmap_unlocked: { icon: 'lock-open', label: 'Programme Unlocked' },
    new_manager_joined: { icon: 'briefcase', label: 'New Manager' },
    lead_reassigned_global: { icon: 'globe', label: 'Cross-Team Reassignment' },
    // Scheduled
    event_reminder: { icon: 'alarm', label: 'Event Reminder' },
    interview_reminder: { icon: 'time', label: 'Interview Reminder' },
    lead_stale: { icon: 'alert-circle', label: 'Stale Lead' },
    // User-initiated
    agency_announcement: { icon: 'megaphone', label: 'Announcements' },
    roadshow_summary: { icon: 'stats-chart', label: 'Roadshow Summary' },
    system_alert: { icon: 'warning', label: 'System Alert' },
};

/** Notification types relevant to each role (for the settings screen) */
export const ROLE_NOTIFICATION_TYPES: Record<UserRole, NotificationType[]> = {
    candidate: [
        'event_reminder',
        'interview_scheduled',
        'interview_updated',
        'module_completed',
        'roadmap_unlocked',
        'agency_announcement',
    ],
    agent: ['new_lead', 'lead_reassigned', 'event_reminder', 'roadshow_summary', 'agency_announcement'],
    pa: ['candidate_update', 'candidate_assigned', 'interview_reminder', 'event_reminder', 'agency_announcement'],
    ro: ['candidate_update', 'candidate_assigned', 'interview_reminder', 'event_reminder', 'agency_announcement'],
    manager: [
        'roadshow_pledge',
        'lead_milestone',
        'lead_stale',
        'candidate_update',
        'interview_scheduled',
        'agent_invite_accepted',
        'event_reminder',
        'roadshow_summary',
        'agency_announcement',
    ],
    director: [
        'roadshow_pledge',
        'lead_milestone',
        'lead_stale',
        'candidate_update',
        'interview_scheduled',
        'agent_invite_accepted',
        'new_manager_joined',
        'event_reminder',
        'roadshow_summary',
        'agency_announcement',
    ],
    admin: [
        'roadshow_pledge',
        'lead_milestone',
        'lead_stale',
        'lead_reassigned_global',
        'candidate_update',
        'interview_scheduled',
        'agent_invite_accepted',
        'new_manager_joined',
        'event_reminder',
        'roadshow_summary',
        'agency_announcement',
        'system_alert',
    ],
};
