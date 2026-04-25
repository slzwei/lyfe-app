/**
 * Lyfe App — UI constants.
 *
 * Tropic design tokens (AVATAR_COLORS, PA_MANAGER_COLORS, getAvatarColor, ANIM,
 * SPACING, ICON) live in the root design system and are re-exported here for
 * backwards compatibility. Edit them in `lyfe-design/src/` and run
 * `npm run sync:design` from lyfe-master.
 *
 * Lyfe-app-specific configs (attendee roles, picker helpers, interview status,
 * roadshow constants, pledged defaults) are defined in this file.
 */
import type { AttendeeRole } from '@/types/event';

import { ACTIVITY_TYPE_CONFIG } from './displayConfigs';
import type { RoadshowActivityType } from '@/types/event';

// ── Tropic design tokens (re-exported from @/design) ─────────────────
export { AVATAR_COLORS, PA_MANAGER_COLORS, getAvatarColor } from '@/design/avatar-palette';
export { ANIM } from '@/design/motion';
export { SPACING, ICON } from '@/design/spacing';

// ── Attendee role display config ────────────────────────────────
export const ATTENDEE_ROLE_ORDER: AttendeeRole[] = ['host', 'duty_manager', 'presenter', 'attendee'];
export const ATTENDEE_ROLE_LABELS: Record<AttendeeRole, string> = {
    host: 'Host',
    duty_manager: 'Duty Manager',
    presenter: 'Presenter',
    attendee: 'Attendee',
};
// Tropic-family (was hot pink + AI-indigo + orange + iOS grey — replaced 2026-04-22).
// Roles stay visually distinct while living within the warm palette.
export const ATTENDEE_ROLE_COLORS: Record<AttendeeRole, string> = {
    host: '#B27AAE', // Dusty plum — warm-cool bridge, reads as "host"
    duty_manager: '#5C7A9E', // Dusty slate-blue (matches info token) — authoritative
    presenter: '#D6552B', // Terracotta accent — the spotlight role
    attendee: '#8B857A', // Textured warm-grey (matches textTertiary)
};

export const ATTENDEE_ROLES: { key: AttendeeRole; label: string }[] = [
    { key: 'attendee', label: 'Attendee' },
    { key: 'host', label: 'Host' },
    { key: 'duty_manager', label: 'Duty Mgr' },
    { key: 'presenter', label: 'Presenter' },
];

// ── User role display labels ────────────────────────────────────
export const ROLE_LABELS: Record<string, string> = {
    admin: 'Administrator',
    director: 'Director',
    manager: 'Manager',
    agent: 'Agent',
    pa: 'Personal Assistant',
    candidate: 'Candidate',
};

// ── Time picker constants ───────────────────────────────────────
export const PICKER_HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
export const PICKER_MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];
export const PICKER_AMPM = ['AM', 'PM'];
export const TIME_PICKER_VISIBLE = 3;

export function formatPickerTime(hour: number, minIdx: number, ampm: number): string {
    return `${hour + 1}:${PICKER_MINUTES[minIdx]} ${PICKER_AMPM[ampm]}`;
}

export function hhmm24ToPickerState(hhmm: string): { hour: number; minIdx: number; ampm: number } {
    const parts = hhmm.split(':');
    let h = parseInt(parts[0] ?? '9', 10);
    const rawMin = parseInt(parts[1] ?? '0', 10);
    const ampm = h >= 12 ? 1 : 0;
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    const minIdx = Math.max(0, Math.min(PICKER_MINUTES.length - 1, Math.round(rawMin / 5)));
    return { hour: h - 1, minIdx, ampm };
}

export function pickerToHHMM24(hour: number, minIdx: number, ampm: number): string {
    let h = hour + 1;
    if (ampm === 1 && h !== 12) h += 12;
    if (ampm === 0 && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${PICKER_MINUTES[minIdx]}`;
}

// ── Error banner colours ──────────────────────────────────────
// Retuned 2026-04-22 toward Tropic danger palette (was generic bright red).
// Consumers without theme-context access still use these as safe fallbacks.
export const ERROR_BG = '#F7DDD6'; // matches Colors.light.dangerLight
export const ERROR_TEXT = '#B33A2E'; // matches Colors.light.danger

// ── Interview status colours ─────────────────────────────────
// Retuned 2026-04-22 from iOS defaults (systemGreen/Red/Purple/Yellow)
// toward Tropic palette: sage success, danger, dusty plum, butter warning.
export const INTERVIEW_STATUS_COLORS: Record<string, string> = {
    completed: '#7A8C6B', // sage (matches success)
    cancelled: '#B33A2E', // danger
    rescheduled: '#B27AAE', // dusty plum (matches statusProposed)
    scheduled: '#C89B3C', // butter/ochre (matches warning)
};

// ── Roadshow constants ──────────────────────────────────────────
// Retuned 2026-04-22 from hot pink '#EC4899' (AI-default magenta) toward
// Tropic dusty-plum. Used only as a 6% tint on the leaderboard "self" row;
// the role is "warm self-highlight", not brand identity.
export const ROADSHOW_PINK = '#B27AAE';

/** Default pledge values when no roadshow config is provided */
export const DEFAULT_PLEDGED_SITDOWNS = 5;
export const DEFAULT_PLEDGED_PITCHES = 3;
export const DEFAULT_PLEDGED_CLOSED = 1;

export function activityLabel(type: string): string {
    return ACTIVITY_TYPE_CONFIG[type as RoadshowActivityType]?.label ?? type;
}

export function activityTypeColor(type: string, fallback: string): string {
    return ACTIVITY_TYPE_CONFIG[type as RoadshowActivityType]?.color ?? fallback;
}
