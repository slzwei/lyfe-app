/**
 * Tests for app/(tabs)/roadmap/index.tsx — Roadmap screen
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useRoadmap } from '@/hooks/useRoadmap';
import { Colors } from '@/constants/Colors';

jest.mock('@/lib/supabase');
jest.mock('@/contexts/AuthContext');
jest.mock('@/contexts/ThemeContext');
jest.mock('@/hooks/useRoadmap');
jest.mock('react-native-reanimated', () => {
    return {
        useReducedMotion: () => false,
        default: {
            View: 'Animated.View',
            createAnimatedComponent: (comp: any) => comp,
        },
    };
});

jest.mock('@/components/ScreenHeader', () => {
    const { Text } = require('react-native');
    return function MockScreenHeader({ title }: { title: string }) {
        return <Text>{title}</Text>;
    };
});

jest.mock('@/components/ErrorBanner', () => {
    const { Text } = require('react-native');
    return function MockErrorBanner({ message }: { message: string }) {
        return <Text>{message}</Text>;
    };
});

jest.mock('@/components/roadmap/ProgrammeHero', () => {
    const { Text } = require('react-native');
    return function MockProgrammeHero({ title }: { title: string }) {
        return <Text testID="programme-hero">{title}</Text>;
    };
});

jest.mock('@/components/roadmap/ProgrammeTabs', () => {
    const { Text } = require('react-native');
    return function MockProgrammeTabs() {
        return <Text testID="programme-tabs">Tabs</Text>;
    };
});

jest.mock('@/components/roadmap/RoadmapGrid', () => {
    const { View, Text } = require('react-native');
    return function MockRoadmapGrid({ modules, ListHeaderComponent }: any) {
        return (
            <View testID="roadmap-grid">
                {ListHeaderComponent}
                <Text>Modules: {modules?.length ?? 0}</Text>
            </View>
        );
    };
});

jest.mock('@/components/roadmap/ProgrammeLockedOverlay', () => {
    const { Text } = require('react-native');
    return function MockProgrammeLockedOverlay({ manuallyUnlocked }: any) {
        return (
            <Text testID="locked-overlay">
                {manuallyUnlocked ? 'Unlocked early' : 'Programme locked'}
            </Text>
        );
    };
});

import RoadmapScreen from '@/app/(tabs)/roadmap/index';

beforeEach(() => {
    jest.clearAllMocks();

    (useTheme as jest.Mock).mockReturnValue({
        colors: Colors.light,
        isDark: false,
        mode: 'light',
        resolved: 'light',
        setMode: jest.fn(),
    });

    (useAuth as jest.Mock).mockReturnValue({
        user: { id: 'user-1', full_name: 'Test User', role: 'candidate' },
    });
});

describe('RoadmapScreen', () => {
    it('shows loading spinner while fetching data', () => {
        (useRoadmap as jest.Mock).mockReturnValue({
            programmes: [],
            nodeStates: new Map(),
            isLoading: true,
            isRefreshing: false,
            error: null,
            refresh: jest.fn(),
            activeProgrammeIndex: 0,
            setActiveProgrammeIndex: jest.fn(),
        });

        const { getByText } = render(<RoadmapScreen />);
        expect(getByText('Loading your roadmap...')).toBeTruthy();
    });

    it('shows empty state when no programmes exist', () => {
        (useRoadmap as jest.Mock).mockReturnValue({
            programmes: [],
            nodeStates: new Map(),
            isLoading: false,
            isRefreshing: false,
            error: null,
            refresh: jest.fn(),
            activeProgrammeIndex: 0,
            setActiveProgrammeIndex: jest.fn(),
        });

        const { getByText } = render(<RoadmapScreen />);
        expect(getByText('No roadmap assigned yet')).toBeTruthy();
        expect(getByText('Contact your manager to get started.')).toBeTruthy();
    });

    it('renders programmes with modules', () => {
        (useRoadmap as jest.Mock).mockReturnValue({
            programmes: [
                {
                    id: 'prog-1',
                    title: 'SeedLYFE',
                    slug: 'seedlyfe',
                    icon_type: 'seedling',
                    completedCount: 2,
                    totalCount: 5,
                    percentage: 40,
                    isLocked: false,
                    manuallyUnlocked: false,
                    unlockedByName: null,
                    modules: [
                        {
                            id: 'mod-1',
                            title: 'Module 1',
                            is_active: true,
                            isArchived: false,
                        },
                    ],
                },
            ],
            nodeStates: new Map(),
            isLoading: false,
            isRefreshing: false,
            error: null,
            refresh: jest.fn(),
            activeProgrammeIndex: 0,
            setActiveProgrammeIndex: jest.fn(),
        });

        const { getByText, getByTestId } = render(<RoadmapScreen />);
        expect(getByText('My Roadmap')).toBeTruthy();
        expect(getByTestId('roadmap-grid')).toBeTruthy();
        expect(getByText('Modules: 1')).toBeTruthy();
    });

    it('shows locked overlay for locked programme', () => {
        (useRoadmap as jest.Mock).mockReturnValue({
            programmes: [
                {
                    id: 'prog-1',
                    title: 'SeedLYFE',
                    slug: 'seedlyfe',
                    icon_type: 'seedling',
                    completedCount: 5,
                    totalCount: 5,
                    percentage: 100,
                    isLocked: false,
                    manuallyUnlocked: false,
                    unlockedByName: null,
                    modules: [],
                },
                {
                    id: 'prog-2',
                    title: 'SproutLYFE',
                    slug: 'sproutlyfe',
                    icon_type: 'sprout',
                    completedCount: 0,
                    totalCount: 5,
                    percentage: 0,
                    isLocked: true,
                    manuallyUnlocked: false,
                    unlockedByName: null,
                    modules: [
                        {
                            id: 'mod-2',
                            title: 'Module 2',
                            is_active: true,
                            isArchived: false,
                        },
                    ],
                },
            ],
            nodeStates: new Map(),
            isLoading: false,
            isRefreshing: false,
            error: null,
            refresh: jest.fn(),
            activeProgrammeIndex: 1,
            setActiveProgrammeIndex: jest.fn(),
        });

        const { getByText } = render(<RoadmapScreen />);
        expect(getByText('Programme locked')).toBeTruthy();
        // When locked, modules should be empty (filtered out)
        expect(getByText('Modules: 0')).toBeTruthy();
    });

    it('shows error banner when there is an error', () => {
        (useRoadmap as jest.Mock).mockReturnValue({
            programmes: [],
            nodeStates: new Map(),
            isLoading: false,
            isRefreshing: false,
            error: 'Failed to load roadmap',
            refresh: jest.fn(),
            activeProgrammeIndex: 0,
            setActiveProgrammeIndex: jest.fn(),
        });

        const { getByText } = render(<RoadmapScreen />);
        expect(getByText('Failed to load roadmap')).toBeTruthy();
    });

    it('shows unlocked-early banner for manually unlocked programme', () => {
        (useRoadmap as jest.Mock).mockReturnValue({
            programmes: [
                {
                    id: 'prog-1',
                    title: 'SproutLYFE',
                    slug: 'sproutlyfe',
                    icon_type: 'sprout',
                    completedCount: 0,
                    totalCount: 5,
                    percentage: 0,
                    isLocked: false,
                    manuallyUnlocked: true,
                    unlockedByName: 'Manager Joe',
                    modules: [
                        { id: 'mod-1', title: 'Mod 1', is_active: true, isArchived: false },
                    ],
                },
            ],
            nodeStates: new Map(),
            isLoading: false,
            isRefreshing: false,
            error: null,
            refresh: jest.fn(),
            activeProgrammeIndex: 0,
            setActiveProgrammeIndex: jest.fn(),
        });

        const { getByText } = render(<RoadmapScreen />);
        expect(getByText('Unlocked early')).toBeTruthy();
    });

    it('filters out archived and inactive modules', () => {
        (useRoadmap as jest.Mock).mockReturnValue({
            programmes: [
                {
                    id: 'prog-1',
                    title: 'SeedLYFE',
                    slug: 'seedlyfe',
                    icon_type: 'seedling',
                    completedCount: 1,
                    totalCount: 3,
                    percentage: 33,
                    isLocked: false,
                    manuallyUnlocked: false,
                    unlockedByName: null,
                    modules: [
                        { id: 'mod-1', title: 'Active', is_active: true, isArchived: false },
                        { id: 'mod-2', title: 'Inactive', is_active: false, isArchived: false },
                        { id: 'mod-3', title: 'Archived', is_active: true, isArchived: true },
                    ],
                },
            ],
            nodeStates: new Map(),
            isLoading: false,
            isRefreshing: false,
            error: null,
            refresh: jest.fn(),
            activeProgrammeIndex: 0,
            setActiveProgrammeIndex: jest.fn(),
        });

        const { getByText } = render(<RoadmapScreen />);
        expect(getByText('Modules: 1')).toBeTruthy();
    });
});
