/**
 * Centralized display configurations for entities across the app.
 * Single source of truth for labels and icons; colors live in the theme
 * (design/colors.ts `eventType` / `activityType`) so every surface renders
 * correctly in both light and dark mode — no hardcoded hex here.
 */
import type { EventType, RoadshowActivityType } from '@/types/event';
import type { ThemeColors } from '@/types/theme';
import type { IconName } from '@/types/ui';

// ── Event type display config ──
export const EVENT_TYPE_CONFIG: Record<EventType, { label: string; icon: IconName }> = {
    team_meeting: { label: 'Team Meeting', icon: 'people' },
    training: { label: 'Training', icon: 'school' },
    agency_event: { label: 'Company Event', icon: 'business' },
    roadshow: { label: 'Roadshow', icon: 'megaphone' },
    exam: { label: 'Exam', icon: 'school' },
    other: { label: 'Other', icon: 'ellipsis-horizontal' },
};

/** Theme-aware event-type accent (time bars, type badges, selectors). */
export function getEventTypeColor(type: EventType, colors: ThemeColors): string {
    return colors.eventType[type] ?? colors.textTertiary;
}

// ── Roadshow activity type display config ──
export const ACTIVITY_TYPE_CONFIG: Record<RoadshowActivityType, { label: string; icon: IconName }> = {
    sitdown: { label: 'Sitdown', icon: 'people' },
    pitch: { label: 'Pitch', icon: 'megaphone' },
    case_closed: { label: 'Case Closed', icon: 'checkmark-circle' },
    check_in: { label: 'Checked in', icon: 'checkmark' },
    departure: { label: 'Left booth', icon: 'exit' },
};

/** Theme-aware roadshow activity accent (live booth feed rows). */
export function getActivityTypeColor(type: RoadshowActivityType, colors: ThemeColors): string {
    return colors.activityType[type] ?? colors.textSecondary;
}

// ── Re-exports from type files (avoid moving to prevent import churn) ──
export { STATUS_CONFIG, PRODUCT_LABELS, SOURCE_LABELS, ACTIVITY_ICONS } from '@/types/lead';
export { CANDIDATE_STATUS_CONFIG } from '@/types/recruitment';
