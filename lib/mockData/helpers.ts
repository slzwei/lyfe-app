/**
 * Mock data date helpers — used to generate relative dates for dev/demo mode.
 */

const _now = Date.now();
const _today = new Date();

/** ISO string N days in the past */
export function daysAgo(days: number): string {
    return new Date(_now - days * 86400000).toISOString();
}

/** ISO string N hours in the past */
export function hoursAgo(hours: number): string {
    return new Date(_now - hours * 3600000).toISOString();
}

/** YYYY-MM-DD string N days from today (positive = future, negative = past) */
export function futureDateStr(daysFromNow: number): string {
    const dt = new Date(_today);
    dt.setDate(dt.getDate() + daysFromNow);
    return dt.toISOString().split('T')[0];
}

/** Current ISO string */
export function nowIso(): string {
    return _today.toISOString();
}
