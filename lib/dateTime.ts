/**
 * Shared date/time formatting utilities
 */

/** Format HH:MM (24h) to "H:MM AM/PM" */
export function formatTime(time: string): string {
    const [h, m] = time.split(':').map(Number);
    return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** Format ISO timestamp to "H:MM AM/PM" */
export function formatCheckinTime(iso: string): string {
    const d = new Date(iso);
    return `${d.getHours() % 12 || 12}:${d.getMinutes().toString().padStart(2, '0')} ${d.getHours() >= 12 ? 'PM' : 'AM'}`;
}

/** Format YYYY-MM-DD as "Monday, 8 March 2026" */
export function formatDateLong(dateStr: string): string {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-SG', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

/** Format YYYY-MM-DD as "Mon, 8 Mar" */
export function formatDateShort(dateStr: string): string {
    const dt = new Date(dateStr + 'T00:00:00');
    return dt.toLocaleDateString('en-SG', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Format YYYY-MM-DD as "Sat, 8 Mar" (used in create form) */
export function formatDateLabel(s: string): string {
    return new Date(s + 'T00:00:00').toLocaleDateString('en-SG', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
    });
}

/** Format ISO timestamp as "8 Mar 2026" */
export function formatCreatedAt(iso: string): string {
    return new Date(iso).toLocaleDateString('en-SG', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Format ISO timestamp as "8 Mar 2026, 09:00 AM" (date + time) */
export function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleDateString('en-SG', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/** Format ISO date/timestamp as "Mar 2026" (month + year only) */
export function formatMonthYear(iso: string): string {
    return new Date(iso).toLocaleDateString('en-SG', { month: 'short', year: 'numeric' });
}

/** Today as YYYY-MM-DD using locale-safe method */
export function todayLocalStr(): string {
    return new Date().toLocaleDateString('en-CA');
}

/** Today as YYYY-MM-DD (ISO split) */
export function todayStr(): string {
    return new Date().toISOString().split('T')[0];
}

/** Validates YYYY-MM-DD */
export function isValidDate(s: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());
}

/** Number of calendar days between two YYYY-MM-DD strings */
export function dateDiffDays(start: string, end: string): number {
    const a = new Date(start + 'T00:00:00');
    const b = new Date(end + 'T00:00:00');
    return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/** Generate YYYY-MM-DD strings for each day in [start, end] inclusive */
export function dateRange(start: string, end: string): string[] {
    const dates: string[] = [];
    const cur = new Date(start + 'T00:00:00');
    const last = new Date(end + 'T00:00:00');
    while (cur <= last) {
        dates.push(cur.toISOString().split('T')[0]);
        cur.setDate(cur.getDate() + 1);
    }
    return dates;
}

/** Convert Date to YYYY-MM-DD (local timezone) */
export function toDateStr(d: Date): string {
    return d.toLocaleDateString('en-CA');
}

/**
 * Determine roadshow live/past status based on event date and time window.
 * Returns 'live' if now is within [start_time, end_time) on event_date,
 * 'past' if event_date is before today or end_time has passed today,
 * 'upcoming' otherwise.
 */
export function getRoadshowStatus(
    eventDate: string,
    startTime: string | null,
    endTime: string | null,
    now?: Date,
): 'live' | 'past' | 'upcoming' {
    const n = now ?? new Date();
    const today = toDateStr(n);
    if (eventDate < today) return 'past';
    if (eventDate > today) return 'upcoming';
    // eventDate === today — check time window
    const nowMins = n.getHours() * 60 + n.getMinutes();
    if (startTime) {
        const [sh, sm] = startTime.split(':').map(Number);
        if (nowMins < sh * 60 + sm) return 'upcoming';
    }
    if (endTime) {
        const [eh, em] = endTime.split(':').map(Number);
        if (nowMins >= eh * 60 + em) return 'past';
    }
    return 'live';
}

/**
 * Determine if an event is currently live based on date and time window.
 * Events with null end_time are excluded (can't determine when they end).
 */
export function isEventLive(eventDate: string, startTime: string | null, endTime: string | null, now?: Date): boolean {
    if (!startTime || !endTime) return false;
    return getRoadshowStatus(eventDate, startTime, endTime, now) === 'live';
}

/** Format ISO timestamp as relative time (e.g. "now", "5m ago", "2h ago", "3d ago") */
export function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' });
}
