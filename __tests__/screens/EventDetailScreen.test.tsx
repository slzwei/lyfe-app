/**
 * Tests for app/(tabs)/events/[eventId].tsx — Event detail screen
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import EventDetailScreen from '@/app/(tabs)/events/[eventId]';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useViewMode } from '@/contexts/ViewModeContext';
import { useEventDetail } from '@/hooks/useEventDetail';
import { useCheckInFlow } from '@/hooks/useCheckInFlow';
import { useActivityLog } from '@/hooks/useActivityLog';
import { useManagerOverride } from '@/hooks/useManagerOverride';
import { Colors } from '@/constants/Colors';

jest.mock('@/lib/supabase');
jest.mock('@/contexts/AuthContext');
jest.mock('@/contexts/ThemeContext');
jest.mock('@/contexts/ViewModeContext');
jest.mock('@/hooks/useEventDetail');
jest.mock('@/hooks/useCheckInFlow');
jest.mock('@/hooks/useActivityLog');
jest.mock('@/hooks/useManagerOverride');
jest.mock('@/lib/events');
jest.mock('@/lib/roadshow');
jest.mock('@/components/ScreenHeader', () => {
    const { Text } = require('react-native');
    return function MockScreenHeader({ title }: { title: string }) {
        return <Text>{title}</Text>;
    };
});
jest.mock('@/components/Confetti', () => {
    const { View } = require('react-native');
    const mock = function MockConfetti() {
        return <View />;
    };
    mock.CONFETTI_DURATION = 3000;
    return { __esModule: true, default: mock, CONFETTI_DURATION: 3000 };
});

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
    ...jest.requireActual('expo-router'),
    useLocalSearchParams: () => ({ eventId: 'event-1' }),
}));
jest.mock('@/hooks/useTypedRouter', () => ({
    useTypedRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn() }),
}));

function setupMocks(overrides: Partial<ReturnType<typeof useEventDetail>> = {}) {
    (useTheme as jest.Mock).mockReturnValue({
        colors: Colors.light,
        isDark: false,
        mode: 'light',
        resolved: 'light',
        setMode: jest.fn(),
    });
    (useAuth as jest.Mock).mockReturnValue({
        user: { id: 'user-1', role: 'agent', full_name: 'Test Agent' },
    });
    (useViewMode as jest.Mock).mockReturnValue({ viewMode: 'agent' });
    (useEventDetail as jest.Mock).mockReturnValue({
        event: null,
        attendance: [],
        activities: [],
        isLoading: true,
        error: null,
        refresh: jest.fn(),
        ...overrides,
    });
    (useCheckInFlow as jest.Mock).mockReturnValue({
        isCheckedIn: false,
        pledgeCount: '',
        setPledgeCount: jest.fn(),
        handleCheckIn: jest.fn(),
        handleCheckOut: jest.fn(),
        isSubmitting: false,
    });
    (useActivityLog as jest.Mock).mockReturnValue({
        activities: [],
        isLogging: false,
        handleLogActivity: jest.fn(),
    });
    (useManagerOverride as jest.Mock).mockReturnValue({
        showOverride: false,
        setShowOverride: jest.fn(),
        handleOverride: jest.fn(),
    });
}

beforeEach(() => {
    jest.clearAllMocks();
});

const MOCK_EVENT = {
    id: 'event-1',
    title: 'Team Roadshow',
    type: 'roadshow',
    date: '2026-04-05',
    start_time: '09:00',
    end_time: '17:00',
    location: 'Marina Bay Sands',
    description: 'Big event',
    created_by: 'mgr-1',
    created_at: '2026-03-01T00:00:00Z',
    is_recurring: false,
};

describe('EventDetailScreen', () => {
    it('shows loading state', () => {
        setupMocks({ isLoading: true });
        const { getByText } = render(<EventDetailScreen />);
        expect(getByText('Event')).toBeTruthy();
    });

    it('shows error state when event not found', async () => {
        setupMocks({ isLoading: false, event: null });
        const { getByText } = render(<EventDetailScreen />);
        await waitFor(() => {
            expect(getByText('Event not found')).toBeTruthy();
        });
    });
});
