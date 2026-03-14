/**
 * Shared types and constants for Roadshow live screens (T1, T2, Past).
 * No JSX — just interfaces, color tokens, and helpers.
 */

/** Per-user activity tallies (sitdowns, pitches, cases closed, AFYC). */
export interface ActivityCounts {
    sitdowns: number;
    pitches: number;
    closed: number;
    afyc: number;
}

/**
 * Aggregate booth totals — actuals plus pledged targets.
 * Used by the T2 manager view and Past summary.
 */
export interface BoothTotals extends ActivityCounts {
    pledgedSitdowns: number;
    pledgedPitches: number;
    pledgedClosed: number;
    pledgedAfyc: number;
}

// ── Roadshow-specific color tokens (used by T1 & T2 inline) ──
export const PITCH_COLOR = '#E67700';
export const CASE_CLOSED_COLOR = '#F59E0B';
