/**
 * Tests for components/roadmap/CandidateProgressView
 *
 * Business rules verified:
 * - Shows loading spinner on mount while fetchCandidateRoadmap is pending
 * - Shows error banner when fetch returns an error string
 * - Renders ProgressSummaryCard in default (non-expanded) mode
 * - Renders expanded detail view with programme sections when expanded=true
 * - Hides internal header when hideHeader=true
 * - Shows unlock button for locked programmes when canMarkComplete=true
 * - Does NOT show unlock button when canMarkComplete=false
 * - Calls onViewFull callback when provided in summary mode
 */
import React from 'react';
import { render, waitFor, fireEvent, act } from '@testing-library/react-native';

import CandidateProgressView from '@/components/roadmap/CandidateProgressView';
import type { ProgrammeWithModules, RoadmapModuleWithProgress } from '@/types/roadmap';

// ── Mock react-native-reanimated (used by UnlockConfirmSheet + Confetti) ──
jest.mock('react-native-reanimated', () => {
    const { View } = require('react-native');
    return {
        __esModule: true,
        default: {
            View: (props: any) => <View {...props} />,
        },
        useSharedValue: jest.fn((v: number) => ({ value: v })),
        useAnimatedStyle: jest.fn(() => ({})),
        withTiming: jest.fn((v: number) => v),
        withSpring: jest.fn((v: number) => v),
        cancelAnimation: jest.fn(),
        Easing: {
            out: jest.fn(() => jest.fn()),
            quad: jest.fn(),
            linear: jest.fn(),
        },
    };
});

// ── Mock @/lib/roadmap ──
const mockFetchCandidateRoadmap = jest.fn();
const mockUpdateModuleProgress = jest.fn();
const mockUpdateModuleNotes = jest.fn();
const mockUnlockProgrammeForCandidate = jest.fn();

jest.mock('@/lib/roadmap', () => ({
    fetchCandidateRoadmap: (...args: any[]) => mockFetchCandidateRoadmap(...args),
    updateModuleProgress: (...args: any[]) => mockUpdateModuleProgress(...args),
    updateModuleNotes: (...args: any[]) => mockUpdateModuleNotes(...args),
    unlockProgrammeForCandidate: (...args: any[]) => mockUnlockProgrammeForCandidate(...args),
    fetchModuleItemsWithProgress: jest.fn().mockResolvedValue({ data: [], error: null }),
    updateModuleItemProgress: jest.fn().mockResolvedValue({ error: null }),
}));

// ── Theme mock ──
const COLORS: any = {
    textPrimary: '#111',
    textSecondary: '#555',
    textTertiary: '#999',
    background: '#FFF',
    border: '#E5E5E5',
    accent: '#FF7600',
    success: '#22C55E',
    surfacePrimary: '#F5F5F5',
    error: '#DC2626',
    errorBg: '#FEE2E2',
    cardBackground: '#FFF',
    accentLight: '#FFF3E6',
};

// ── Fixtures ──

function makeModule(overrides: Partial<RoadmapModuleWithProgress> = {}): RoadmapModuleWithProgress {
    return {
        id: 'mod-1',
        programme_id: 'prog-1',
        title: 'Introduction to Sales',
        description: null,
        learning_objectives: null,
        module_type: 'training',
        display_order: 1,
        is_active: true,
        is_required: true,
        estimated_minutes: 30,
        exam_paper_id: null,
        icon_name: null,
        icon_color: null,
        archived_at: null,
        archived_by: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        progress: null,
        resources: [],
        itemSummary: null,
        isLocked: false,
        examPaper: null,
        prerequisiteIds: [],
        isArchived: false,
        ...overrides,
    };
}

function makeProgramme(overrides: Partial<ProgrammeWithModules> = {}): ProgrammeWithModules {
    return {
        id: 'prog-1',
        slug: 'seedlyfe',
        title: 'SeedLYFE',
        description: 'Foundation programme',
        display_order: 1,
        icon_type: 'seedling',
        is_active: true,
        archived_at: null,
        archived_by: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        modules: [makeModule()],
        completedCount: 0,
        totalCount: 1,
        percentage: 0,
        isLocked: false,
        manuallyUnlocked: false,
        unlockedByName: null,
        ...overrides,
    };
}

const defaultProps = {
    candidateId: 'candidate-1',
    candidateName: 'Alice',
    reviewerId: 'reviewer-1',
    canMarkComplete: true,
    colors: COLORS,
};

beforeEach(() => {
    jest.clearAllMocks();
});

describe('CandidateProgressView', () => {
    it('shows loading indicator initially', () => {
        // Keep fetch pending (never resolve during this test)
        mockFetchCandidateRoadmap.mockReturnValue(new Promise(() => {}));

        const { getByTestId, UNSAFE_getAllByType } = render(<CandidateProgressView {...defaultProps} />);
        // ActivityIndicator is rendered during loading
        const { ActivityIndicator } = require('react-native');
        const indicators = UNSAFE_getAllByType(ActivityIndicator);
        expect(indicators.length).toBeGreaterThan(0);
    });

    it('shows error banner when fetchCandidateRoadmap returns error', async () => {
        mockFetchCandidateRoadmap.mockResolvedValue({
            data: null,
            error: 'Failed to load roadmap data',
        });

        const { findByText } = render(<CandidateProgressView {...defaultProps} />);

        expect(await findByText('Failed to load roadmap data')).toBeTruthy();
    });

    it('shows ProgressSummaryCard in default (non-expanded) mode', async () => {
        const programmes = [makeProgramme()];
        mockFetchCandidateRoadmap.mockResolvedValue({ data: programmes, error: null });

        const { findByText } = render(<CandidateProgressView {...defaultProps} />);

        // ProgressSummaryCard shows "Development Roadmap" header and "View Full Progress"
        expect(await findByText('Development Roadmap')).toBeTruthy();
        expect(await findByText('View Full Progress')).toBeTruthy();
    });

    it('shows expanded detail view when expanded=true', async () => {
        const programmes = [makeProgramme({ title: 'SeedLYFE' })];
        mockFetchCandidateRoadmap.mockResolvedValue({ data: programmes, error: null });

        const { findByText, queryByText } = render(<CandidateProgressView {...defaultProps} expanded />);

        // Expanded view shows programme title and candidate name in header
        expect(await findByText("Alice's Progress")).toBeTruthy();
        expect(await findByText('SeedLYFE')).toBeTruthy();
        // Should not show summary card elements
        expect(queryByText('Development Roadmap')).toBeNull();
    });

    it('hides header when hideHeader=true in expanded mode', async () => {
        const programmes = [makeProgramme({ title: 'SeedLYFE' })];
        mockFetchCandidateRoadmap.mockResolvedValue({ data: programmes, error: null });

        const { findByText, queryByText } = render(<CandidateProgressView {...defaultProps} expanded hideHeader />);

        // Programme title should still show (part of programme section, not header)
        expect(await findByText('SeedLYFE')).toBeTruthy();
        // But the header text "[name]'s Progress" should not render
        expect(queryByText("Alice's Progress")).toBeNull();
    });

    it('shows unlock button for locked programmes when canMarkComplete=true', async () => {
        const programmes = [
            makeProgramme({
                id: 'prog-2',
                title: 'SproutLYFE',
                isLocked: true,
            }),
        ];
        mockFetchCandidateRoadmap.mockResolvedValue({ data: programmes, error: null });

        const { findByText } = render(<CandidateProgressView {...defaultProps} expanded canMarkComplete />);

        expect(await findByText('Unlock SproutLYFE Early')).toBeTruthy();
    });

    it('does NOT show unlock button when canMarkComplete=false', async () => {
        const programmes = [
            makeProgramme({
                id: 'prog-2',
                title: 'SproutLYFE',
                isLocked: true,
            }),
        ];
        mockFetchCandidateRoadmap.mockResolvedValue({ data: programmes, error: null });

        const { findByText, queryByText } = render(
            <CandidateProgressView {...defaultProps} expanded canMarkComplete={false} />,
        );

        // Wait for loading to finish
        expect(await findByText('SproutLYFE')).toBeTruthy();
        expect(queryByText('Unlock SproutLYFE Early')).toBeNull();
    });

    it('calls onViewFull when provided (summary mode)', async () => {
        const programmes = [makeProgramme()];
        mockFetchCandidateRoadmap.mockResolvedValue({ data: programmes, error: null });

        const onViewFull = jest.fn();
        const { findByText } = render(<CandidateProgressView {...defaultProps} onViewFull={onViewFull} />);

        const viewFullBtn = await findByText('View Full Progress');
        fireEvent.press(viewFullBtn);
        expect(onViewFull).toHaveBeenCalledTimes(1);
    });

    it('shows empty state when programmes array is empty', async () => {
        mockFetchCandidateRoadmap.mockResolvedValue({ data: [], error: null });

        const { getByText } = render(<CandidateProgressView {...defaultProps} />);

        await waitFor(() => {
            expect(mockFetchCandidateRoadmap).toHaveBeenCalled();
        });

        // Should show empty state with candidate name
        await waitFor(() => {
            expect(getByText('No roadmap assigned to Alice')).toBeTruthy();
        });
    });
});
