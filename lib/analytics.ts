/**
 * Lightweight analytics — wraps Sentry breadcrumbs so every event gets the
 * structured tag + data shape Sentry can query across sessions.
 *
 * Why not a separate analytics vendor (Amplitude / Mixpanel / etc.)?
 *   • Sentry already records user context (id, role) — no dual setup cost.
 *   • Breadcrumbs flow along with errors, so we can see "what did the user
 *     do before this crash" for free.
 *   • DSN already wired; zero new infra to ship this.
 *
 * Convention:
 *   • category = 'pipeline' for candidate-pipeline events
 *   • category = 'ui' for generic interaction events
 *   • action names are kebab-case and verb-led: 'sort-changed', 'flagged-row-opened'
 *
 * If we later move to a dedicated analytics vendor, swap the implementation
 * here — call sites don't change.
 */
import { Sentry } from '@/lib/sentry';

type EventCategory = 'pipeline' | 'ui' | 'recruitment';

interface EventData {
    action: string;
    [key: string]: unknown;
}

/** Log a user-action event. Shows in Sentry breadcrumbs + prepended to any error the session captures. */
export function track(category: EventCategory, data: EventData): void {
    Sentry.addBreadcrumb({
        category,
        type: 'user',
        level: 'info',
        message: data.action,
        data,
    });
}

// ── Pipeline-specific helpers (typed so call sites can't typo event names) ──

export const pipelineAnalytics = {
    /** User changed the Candidates list sort mode. */
    sortModeChanged(mode: 'urgency' | 'updated' | 'added' | 'alpha' | 'status'): void {
        track('pipeline', { action: 'sort-mode-changed', mode });
    },

    /** User tapped a candidate row while on the pipeline (urgency) sort. */
    flaggedRowOpened(candidateId: string, urgency: string): void {
        track('pipeline', { action: 'flagged-row-opened', candidateId, urgency });
    },

    /** User tapped "See all" from a Home pipeline section. */
    homeSectionSeeAllTapped(section: 'at-risk' | 'this-week' | 'ready'): void {
        track('pipeline', { action: 'home-see-all-tapped', section });
    },

    /** User tapped a row from a Home pipeline section. */
    homeRowTapped(candidateId: string, urgency: string): void {
        track('pipeline', { action: 'home-row-tapped', candidateId, urgency });
    },

    /** Snapshot fetched successfully — useful for measuring payload size / adoption. */
    snapshotLoaded(counts: Record<string, number>, elapsedMs: number): void {
        track('pipeline', {
            action: 'snapshot-loaded',
            totalCandidates: Object.values(counts).reduce((a, b) => a + b, 0),
            atRisk: counts['at-risk'] ?? 0,
            thisWeek: counts['this-week'] ?? 0,
            ready: counts.ready ?? 0,
            elapsedMs,
        });
    },
};
