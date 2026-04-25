/**
 * Tests for lib/analytics.ts — Sentry-breadcrumb-backed event tracking.
 *
 * The implementation is thin (pass-through to Sentry.addBreadcrumb), so the
 * tests focus on payload shape — call sites depend on stable event names +
 * data keys when querying breadcrumbs in Sentry.
 */
import { pipelineAnalytics, track } from '@/lib/analytics';
import { Sentry } from '@/lib/sentry';

jest.mock('@/lib/sentry', () => ({
    Sentry: {
        addBreadcrumb: jest.fn(),
    },
}));

const addBreadcrumb = Sentry.addBreadcrumb as jest.Mock;

beforeEach(() => {
    addBreadcrumb.mockClear();
});

describe('track', () => {
    it('forwards a Sentry breadcrumb with the supplied category, action message, and data', () => {
        track('ui', { action: 'tab-switched', from: 'home', to: 'leads' });
        expect(addBreadcrumb).toHaveBeenCalledTimes(1);
        expect(addBreadcrumb).toHaveBeenCalledWith({
            category: 'ui',
            type: 'user',
            level: 'info',
            message: 'tab-switched',
            data: { action: 'tab-switched', from: 'home', to: 'leads' },
        });
    });

    it('supports the recruitment category', () => {
        track('recruitment', { action: 'candidate-flagged' });
        expect(addBreadcrumb).toHaveBeenCalledWith(expect.objectContaining({ category: 'recruitment' }));
    });
});

describe('pipelineAnalytics', () => {
    it('sortModeChanged records a pipeline breadcrumb with the new mode', () => {
        pipelineAnalytics.sortModeChanged('urgency');
        expect(addBreadcrumb).toHaveBeenCalledWith(
            expect.objectContaining({
                category: 'pipeline',
                message: 'sort-mode-changed',
                data: expect.objectContaining({ action: 'sort-mode-changed', mode: 'urgency' }),
            }),
        );
    });

    it('flaggedRowOpened includes the candidate id and urgency tag', () => {
        pipelineAnalytics.flaggedRowOpened('cand-42', 'at-risk');
        expect(addBreadcrumb).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    action: 'flagged-row-opened',
                    candidateId: 'cand-42',
                    urgency: 'at-risk',
                }),
            }),
        );
    });

    it('homeSectionSeeAllTapped tags the section name', () => {
        pipelineAnalytics.homeSectionSeeAllTapped('this-week');
        expect(addBreadcrumb).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ action: 'home-see-all-tapped', section: 'this-week' }),
            }),
        );
    });

    it('homeRowTapped records candidate + urgency for the home tap', () => {
        pipelineAnalytics.homeRowTapped('cand-7', 'ready');
        expect(addBreadcrumb).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ action: 'home-row-tapped', candidateId: 'cand-7', urgency: 'ready' }),
            }),
        );
    });

    describe('snapshotLoaded', () => {
        it('aggregates total candidates across all urgency buckets and records elapsed time', () => {
            pipelineAnalytics.snapshotLoaded({ 'at-risk': 2, 'this-week': 3, ready: 1, 'on-track': 5, hidden: 4 }, 123);
            expect(addBreadcrumb).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        action: 'snapshot-loaded',
                        totalCandidates: 15,
                        atRisk: 2,
                        thisWeek: 3,
                        ready: 1,
                        elapsedMs: 123,
                    }),
                }),
            );
        });

        it('falls back to 0 when an urgency bucket is missing from the counts map', () => {
            pipelineAnalytics.snapshotLoaded({}, 0);
            expect(addBreadcrumb).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        totalCandidates: 0,
                        atRisk: 0,
                        thisWeek: 0,
                        ready: 0,
                        elapsedMs: 0,
                    }),
                }),
            );
        });
    });
});
