/**
 * Tests for components/home/HomePipelineSection.tsx — boxed 3-section
 * pipeline card on the Home tab.
 *
 * The component is presentational: the Home screen owns the pipeline snapshot
 * (via useCandidatePipeline) and passes rows/counts/isLoading/error as props.
 * These tests exercise the rendering branches (loading / error / empty /
 * populated) by passing those props directly.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import HomePipelineSection from '@/components/home/HomePipelineSection';
import type { PipelineSnapshot } from '@/lib/recruitment/pipelineFetch';
import type { NextStep, Urgency } from '@/lib/recruitment/pipeline';

jest.mock('@/contexts/ThemeContext', () => {
    const { Colors } = require('@/constants/Colors');
    return {
        useTheme: () => ({
            colors: Colors.light,
            isDark: false,
            mode: 'light',
            resolved: 'light',
        }),
    };
});
jest.mock('@/lib/analytics', () => ({
    pipelineAnalytics: {
        homeSectionSeeAllTapped: jest.fn(),
        homeRowTapped: jest.fn(),
        snapshotLoaded: jest.fn(),
        sortModeChanged: jest.fn(),
        flaggedRowOpened: jest.fn(),
    },
}));

const onCandidatePress = jest.fn();
const onSeeAll = jest.fn();

function makeRow(id: string, name: string, urgency: Urgency, signal?: string) {
    return {
        candidate: { id, name } as any,
        nextStep: { urgency, text: `Do something for ${name}`, signal } as NextStep,
    };
}

const EMPTY_COUNTS = { 'at-risk': 0, 'this-week': 0, ready: 0, 'on-track': 0, hidden: 0 } as const;

type Props = {
    rows?: PipelineSnapshot['rows'];
    counts?: PipelineSnapshot['counts'];
    isLoading?: boolean;
    error?: string | null;
};

function renderSection({ rows = [], counts = { ...EMPTY_COUNTS }, isLoading = false, error = null }: Props) {
    return render(
        <HomePipelineSection
            rows={rows}
            counts={counts}
            isLoading={isLoading}
            error={error}
            onCandidatePress={onCandidatePress}
            onSeeAll={onSeeAll}
        />,
    );
}

beforeEach(() => {
    jest.clearAllMocks();
});

describe('HomePipelineSection', () => {
    it('renders a loading card while the snapshot is loading', () => {
        const { getByText } = renderSection({ isLoading: true });
        expect(getByText(/Loading your pipeline/)).toBeTruthy();
    });

    it('renders nothing visible when an error is reported (silent fail)', () => {
        const { queryByText } = renderSection({ error: 'rls denied' });
        expect(queryByText(/Loading your pipeline/)).toBeNull();
        expect(queryByText('Inbox zero on the pipeline.')).toBeNull();
        expect(queryByText('Needs you')).toBeNull();
    });

    it('renders the inbox-zero empty state when no candidates need action', () => {
        const { getByText } = renderSection({ counts: { ...EMPTY_COUNTS, 'on-track': 5 } });
        expect(getByText('Inbox zero on the pipeline.')).toBeTruthy();
    });

    it('renders the section header with the actionable total', () => {
        const { getByText } = renderSection({
            rows: [makeRow('cand-1', 'Alex', 'at-risk'), makeRow('cand-2', 'Bea', 'this-week')],
            counts: { ...EMPTY_COUNTS, 'at-risk': 1, 'this-week': 2 },
        });
        expect(getByText('Pipeline')).toBeTruthy();
        expect(getByText('3 need action')).toBeTruthy();
    });

    it('renders only buckets with candidates (skips empty ones)', () => {
        const { getByText, queryByText } = renderSection({
            rows: [makeRow('cand-1', 'Alex', 'at-risk', '7 days idle')],
            counts: { ...EMPTY_COUNTS, 'at-risk': 1 },
        });

        expect(getByText('Needs you')).toBeTruthy();
        expect(getByText('Alex')).toBeTruthy();
        expect(getByText('Do something for Alex')).toBeTruthy();
        expect(getByText('7 days idle')).toBeTruthy();
        expect(queryByText('This week')).toBeNull();
        expect(queryByText('Ready')).toBeNull();
    });

    it('caps each bucket at MAX_ROWS_PER_SECTION (2) and shows the total in the header', () => {
        const rows = [
            makeRow('cand-1', 'Alex', 'at-risk'),
            makeRow('cand-2', 'Bea', 'at-risk'),
            makeRow('cand-3', 'Cam', 'at-risk'),
            makeRow('cand-4', 'Dee', 'at-risk'),
        ];
        const { getByText, queryByText } = renderSection({ rows, counts: { ...EMPTY_COUNTS, 'at-risk': 4 } });

        expect(getByText('Alex')).toBeTruthy();
        expect(getByText('Bea')).toBeTruthy();
        expect(queryByText('Cam')).toBeNull();
        expect(queryByText('Dee')).toBeNull();
        // Bucket header shows the total count (4), not the visible-row count (2).
        expect(getByText('4')).toBeTruthy();
    });

    it('fires onCandidatePress with the row id when a row is tapped', () => {
        const { getByText } = renderSection({
            rows: [makeRow('cand-9', 'Priya', 'this-week')],
            counts: { ...EMPTY_COUNTS, 'this-week': 1 },
        });

        fireEvent.press(getByText('Priya'));
        expect(onCandidatePress).toHaveBeenCalledWith('cand-9');
    });

    it('fires onSeeAll when the section "See all" link is tapped', () => {
        const { getByText } = renderSection({
            rows: [makeRow('cand-1', 'Alex', 'ready')],
            counts: { ...EMPTY_COUNTS, ready: 1 },
        });

        fireEvent.press(getByText('See all →'));
        expect(onSeeAll).toHaveBeenCalledTimes(1);
    });

    it('renders all three buckets when each has candidates', () => {
        const { getByText } = renderSection({
            rows: [
                makeRow('cand-1', 'Alex', 'at-risk'),
                makeRow('cand-2', 'Bea', 'this-week'),
                makeRow('cand-3', 'Cam', 'ready'),
            ],
            counts: { ...EMPTY_COUNTS, 'at-risk': 1, 'this-week': 1, ready: 1 },
        });

        expect(getByText('Needs you')).toBeTruthy();
        expect(getByText('This week')).toBeTruthy();
        expect(getByText('Ready')).toBeTruthy();
    });
});
