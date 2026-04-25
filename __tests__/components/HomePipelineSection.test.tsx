/**
 * Tests for components/home/HomePipelineSection.tsx — boxed 3-section
 * pipeline card on the Home tab.
 *
 * Strategy: mock useCandidatePipeline so the test exercises the rendering
 * branches (loading / error / empty / populated) directly without touching
 * the fetch layer (which has its own tests).
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import HomePipelineSection from '@/components/home/HomePipelineSection';
import { useCandidatePipeline } from '@/hooks/useCandidatePipeline';
import type { NextStep, Urgency } from '@/lib/recruitment/pipeline';

jest.mock('@/lib/supabase');
jest.mock('@/contexts/AuthContext', () => ({
    useAuth: jest.fn(() => ({ user: { id: 'user-1' } })),
}));
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
jest.mock('@/hooks/useCandidatePipeline');
jest.mock('@/lib/analytics', () => ({
    pipelineAnalytics: {
        homeSectionSeeAllTapped: jest.fn(),
        homeRowTapped: jest.fn(),
        snapshotLoaded: jest.fn(),
        sortModeChanged: jest.fn(),
        flaggedRowOpened: jest.fn(),
    },
}));

const mockUsePipeline = useCandidatePipeline as jest.MockedFunction<typeof useCandidatePipeline>;
const onCandidatePress = jest.fn();
const onSeeAll = jest.fn();

function makeRow(id: string, name: string, urgency: Urgency, signal?: string) {
    return {
        candidate: { id, name } as any,
        nextStep: { urgency, text: `Do something for ${name}`, signal } as NextStep,
    };
}

const EMPTY_COUNTS = { 'at-risk': 0, 'this-week': 0, ready: 0, 'on-track': 0, hidden: 0 } as const;

beforeEach(() => {
    jest.clearAllMocks();
});

describe('HomePipelineSection', () => {
    it('renders a loading card while the snapshot is loading', () => {
        mockUsePipeline.mockReturnValue({
            rows: [],
            counts: { ...EMPTY_COUNTS },
            isLoading: true,
            isRefreshing: false,
            error: null,
            refresh: jest.fn(),
        });

        const { getByText } = render(
            <HomePipelineSection isManagerView onCandidatePress={onCandidatePress} onSeeAll={onSeeAll} />,
        );

        expect(getByText(/Loading your pipeline/)).toBeTruthy();
    });

    it('renders nothing visible when an error is reported (silent fail)', () => {
        mockUsePipeline.mockReturnValue({
            rows: [],
            counts: { ...EMPTY_COUNTS },
            isLoading: false,
            isRefreshing: false,
            error: 'rls denied',
            refresh: jest.fn(),
        });

        const { queryByText } = render(
            <HomePipelineSection isManagerView onCandidatePress={onCandidatePress} onSeeAll={onSeeAll} />,
        );

        expect(queryByText(/Loading your pipeline/)).toBeNull();
        expect(queryByText('Inbox zero on the pipeline.')).toBeNull();
        expect(queryByText('Needs you')).toBeNull();
    });

    it('renders the inbox-zero empty state when no candidates need action', () => {
        mockUsePipeline.mockReturnValue({
            rows: [],
            counts: { ...EMPTY_COUNTS, 'on-track': 5 },
            isLoading: false,
            isRefreshing: false,
            error: null,
            refresh: jest.fn(),
        });

        const { getByText } = render(
            <HomePipelineSection isManagerView onCandidatePress={onCandidatePress} onSeeAll={onSeeAll} />,
        );

        expect(getByText('Inbox zero on the pipeline.')).toBeTruthy();
    });

    it('renders only buckets with candidates (skips empty ones)', () => {
        mockUsePipeline.mockReturnValue({
            rows: [makeRow('cand-1', 'Alex', 'at-risk', '7 days idle')],
            counts: { ...EMPTY_COUNTS, 'at-risk': 1 },
            isLoading: false,
            isRefreshing: false,
            error: null,
            refresh: jest.fn(),
        });

        const { getByText, queryByText } = render(
            <HomePipelineSection isManagerView onCandidatePress={onCandidatePress} onSeeAll={onSeeAll} />,
        );

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
        mockUsePipeline.mockReturnValue({
            rows,
            counts: { ...EMPTY_COUNTS, 'at-risk': 4 },
            isLoading: false,
            isRefreshing: false,
            error: null,
            refresh: jest.fn(),
        });

        const { getByText, queryByText } = render(
            <HomePipelineSection isManagerView onCandidatePress={onCandidatePress} onSeeAll={onSeeAll} />,
        );

        expect(getByText('Alex')).toBeTruthy();
        expect(getByText('Bea')).toBeTruthy();
        expect(queryByText('Cam')).toBeNull();
        expect(queryByText('Dee')).toBeNull();
        // Header shows the total count (4), not the visible-row count (2).
        expect(getByText('4')).toBeTruthy();
    });

    it('fires onCandidatePress with the row id when a row is tapped', () => {
        mockUsePipeline.mockReturnValue({
            rows: [makeRow('cand-9', 'Priya', 'this-week')],
            counts: { ...EMPTY_COUNTS, 'this-week': 1 },
            isLoading: false,
            isRefreshing: false,
            error: null,
            refresh: jest.fn(),
        });

        const { getByText } = render(
            <HomePipelineSection isManagerView onCandidatePress={onCandidatePress} onSeeAll={onSeeAll} />,
        );

        fireEvent.press(getByText('Priya'));
        expect(onCandidatePress).toHaveBeenCalledWith('cand-9');
    });

    it('fires onSeeAll when the section "See all" link is tapped', () => {
        mockUsePipeline.mockReturnValue({
            rows: [makeRow('cand-1', 'Alex', 'ready')],
            counts: { ...EMPTY_COUNTS, ready: 1 },
            isLoading: false,
            isRefreshing: false,
            error: null,
            refresh: jest.fn(),
        });

        const { getByText } = render(
            <HomePipelineSection isManagerView onCandidatePress={onCandidatePress} onSeeAll={onSeeAll} />,
        );

        fireEvent.press(getByText('See all →'));
        expect(onSeeAll).toHaveBeenCalledTimes(1);
    });

    it('renders all three buckets when each has candidates', () => {
        mockUsePipeline.mockReturnValue({
            rows: [
                makeRow('cand-1', 'Alex', 'at-risk'),
                makeRow('cand-2', 'Bea', 'this-week'),
                makeRow('cand-3', 'Cam', 'ready'),
            ],
            counts: { ...EMPTY_COUNTS, 'at-risk': 1, 'this-week': 1, ready: 1 },
            isLoading: false,
            isRefreshing: false,
            error: null,
            refresh: jest.fn(),
        });

        const { getByText } = render(
            <HomePipelineSection isManagerView onCandidatePress={onCandidatePress} onSeeAll={onSeeAll} />,
        );

        expect(getByText('Needs you')).toBeTruthy();
        expect(getByText('This week')).toBeTruthy();
        expect(getByText('Ready')).toBeTruthy();
    });
});
