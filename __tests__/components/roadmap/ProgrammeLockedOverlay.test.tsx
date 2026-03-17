/**
 * Tests for components/roadmap/ProgrammeLockedOverlay
 *
 * Business rules verified:
 * - Locked state: shows "SproutLYFE is Locked" title with lock icon
 * - Shows SeedLYFE progress (count and percentage) from seedProgramme prop
 * - Shows "Complete SeedLYFE to unlock" subtitle
 * - Manually unlocked with name: shows "Unlocked early by [name]"
 * - Manually unlocked without name: shows generic "Unlocked early by your manager"
 * - No seedProgramme: shows 0/0 and 0%
 */
import React from 'react';
import { render } from '@testing-library/react-native';

import ProgrammeLockedOverlay from '@/components/roadmap/ProgrammeLockedOverlay';
import type { ProgrammeWithModules } from '@/types/roadmap';

// ── Mock react-native-reanimated ──
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
        Easing: {
            out: jest.fn(() => jest.fn()),
            quad: jest.fn(),
        },
    };
});

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
};

// ── Fixtures ──

function makeSeedProgramme(overrides: Partial<ProgrammeWithModules> = {}): ProgrammeWithModules {
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
        modules: [],
        completedCount: 5,
        totalCount: 14,
        percentage: 36,
        isLocked: false,
        manuallyUnlocked: false,
        unlockedByName: null,
        ...overrides,
    };
}

beforeEach(() => jest.clearAllMocks());

describe('ProgrammeLockedOverlay', () => {
    it('shows locked state with "SproutLYFE is Locked" title when not manually unlocked', () => {
        const { getByText } = render(<ProgrammeLockedOverlay seedProgramme={makeSeedProgramme()} colors={COLORS} />);

        expect(getByText('SproutLYFE is Locked')).toBeTruthy();
    });

    it('shows SeedLYFE progress (count and percentage) from seedProgramme prop', () => {
        const seed = makeSeedProgramme({ completedCount: 5, totalCount: 14, percentage: 36 });
        const { getByText } = render(<ProgrammeLockedOverlay seedProgramme={seed} colors={COLORS} />);

        expect(getByText('5/14')).toBeTruthy();
        expect(getByText('36% complete')).toBeTruthy();
    });

    it('shows "Complete SeedLYFE to unlock" subtitle', () => {
        const { getByText } = render(<ProgrammeLockedOverlay seedProgramme={makeSeedProgramme()} colors={COLORS} />);

        expect(getByText(/Complete SeedLYFE to unlock/)).toBeTruthy();
    });

    it('shows manually unlocked banner with name when manuallyUnlocked=true and unlockedByName provided', () => {
        const { getByText, queryByText } = render(
            <ProgrammeLockedOverlay manuallyUnlocked unlockedByName="John Tan" colors={COLORS} />,
        );

        expect(getByText('Unlocked early by John Tan')).toBeTruthy();
        // Should NOT show the locked state
        expect(queryByText('SproutLYFE is Locked')).toBeNull();
    });

    it('shows generic "Unlocked early by your manager" when manuallyUnlocked=true but no name', () => {
        const { getByText } = render(<ProgrammeLockedOverlay manuallyUnlocked colors={COLORS} />);

        expect(getByText('Unlocked early by your manager')).toBeTruthy();
    });

    it('shows 0/0 and 0% when no seedProgramme provided', () => {
        const { getByText } = render(<ProgrammeLockedOverlay colors={COLORS} />);

        expect(getByText('0/0')).toBeTruthy();
        expect(getByText('0% complete')).toBeTruthy();
    });
});
