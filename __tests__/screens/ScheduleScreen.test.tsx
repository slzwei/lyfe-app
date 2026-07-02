/**
 * Tests for app/(tabs)/home/schedule.tsx — the candidate "What's next" agenda screen.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/Colors';
import { useCandidateSchedule } from '@/hooks/useCandidateSchedule';
import type { CandidateScheduleItem } from '@/lib/recruitment/schedule';
import ScheduleScreen from '@/app/(tabs)/home/schedule';

jest.mock('@/lib/supabase');
jest.mock('@/contexts/ThemeContext');
jest.mock('@/hooks/useCandidateSchedule');

const items: CandidateScheduleItem[] = [
    {
        kind: 'interview',
        id: 'iv1',
        code: 'zoom',
        startAt: '2026-07-04T07:00:00+08:00',
        endAt: null,
        location: null,
        isOnline: true,
        status: 'scheduled',
    },
    {
        kind: 'paper',
        id: 'pa1',
        code: 'M9',
        startAt: '2026-07-08T02:00:00+08:00',
        endAt: null,
        location: null,
        isOnline: false,
        status: 'scheduled',
    },
];

beforeEach(() => {
    jest.clearAllMocks();
    (useTheme as jest.Mock).mockReturnValue({ colors: Colors.light, isDark: false });
});

describe('ScheduleScreen', () => {
    it('renders a row per upcoming item', () => {
        (useCandidateSchedule as jest.Mock).mockReturnValue({
            items,
            isLoading: false,
            error: null,
            refresh: jest.fn(),
        });
        const { getByText } = render(<ScheduleScreen />);
        expect(getByText('Interview')).toBeTruthy();
        expect(getByText('M9 exam')).toBeTruthy();
    });

    it('shows the teaching empty state when there is nothing scheduled', () => {
        (useCandidateSchedule as jest.Mock).mockReturnValue({
            items: [],
            isLoading: false,
            error: null,
            refresh: jest.fn(),
        });
        const { getByText } = render(<ScheduleScreen />);
        expect(getByText('Nothing scheduled')).toBeTruthy();
    });

    it('does not render the empty state while loading', () => {
        (useCandidateSchedule as jest.Mock).mockReturnValue({
            items: [],
            isLoading: true,
            error: null,
            refresh: jest.fn(),
        });
        const { queryByText } = render(<ScheduleScreen />);
        expect(queryByText('Nothing scheduled')).toBeNull();
    });
});
