/**
 * Shared UI constants — colour palettes, picker data, and display configs
 */
import type { AttendeeRole } from '@/types/event';

// ── Avatar colour palettes ─────────────────────────────────────
export const AVATAR_COLORS = ['#6366F1', '#0D9488', '#E11D48', '#F59E0B', '#8B5CF6'];
export const PA_MANAGER_COLORS = ['#6366F1', '#0D9488', '#E11D48', '#F59E0B', '#8B5CF6'];

/** Deterministic avatar colour from a name string */
export function getAvatarColor(name: string): string {
    return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

// ── Attendee role display config ────────────────────────────────
export const ATTENDEE_ROLE_ORDER: AttendeeRole[] = ['host', 'duty_manager', 'presenter', 'attendee'];
export const ATTENDEE_ROLE_LABELS: Record<AttendeeRole, string> = {
    host: 'Host',
    duty_manager: 'Duty Manager',
    presenter: 'Presenter',
    attendee: 'Attendee',
};
export const ATTENDEE_ROLE_COLORS: Record<AttendeeRole, string> = {
    host: '#EC4899',
    duty_manager: '#6366F1',
    presenter: '#0A7E6B',
    attendee: '#8E8E93',
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

// ── Roadshow constants ──────────────────────────────────────────
export const ROADSHOW_PINK = '#EC4899';

export function activityLabel(type: string): string {
    if (type === 'sitdown') return 'Sitdown';
    if (type === 'pitch') return 'Pitch';
    if (type === 'case_closed') return 'Case Closed';
    if (type === 'check_in') return 'Checked in';
    if (type === 'departure') return 'Left booth';
    return type;
}

export function activityTypeColor(type: string, fallback: string): string {
    if (type === 'case_closed') return '#F59E0B';
    if (type === 'check_in') return '#0D9488';
    if (type === 'departure') return '#8E8E93';
    return fallback;
}
