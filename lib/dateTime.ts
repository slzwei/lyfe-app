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

/** Format ISO timestamp to "HH:MM" (24h) */
export function formatActivityTime(iso: string): string {
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

/** Format YYYY-MM-DD as "Monday, 8 March 2026" */
export function formatDateLong(dateStr: string): string {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-SG', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
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
        weekday: 'short', day: 'numeric', month: 'short',
    });
}

/** Format ISO timestamp as "8 Mar 2026" */
export function formatCreatedAt(iso: string): string {
    return new Date(iso).toLocaleDateString('en-SG', { month: 'short', day: 'numeric', year: 'numeric' });
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

/** Convert Date to YYYY-MM-DD */
export function toDateStr(d: Date): string {
    return d.toISOString().split('T')[0];
}
