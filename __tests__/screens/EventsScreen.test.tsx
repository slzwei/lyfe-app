import React from 'react';
import { render, act, waitFor, fireEvent } from '@testing-library/react-native';
import EventsScreen from '@/app/(tabs)/events/index';
import { fetchEvents } from '@/lib/events';

// ── Mocks ──────────────────────────────────────────────────────
jest.mock('@/lib/supabase');
jest.mock('@/lib/events');
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('@/components/events/InlineCalendar', () => {
    const { View, Text, TouchableOpacity } = require('react-native');
    return {
        __esModule: true,
        default: ({ selectedDate, onSelectDate }: any) => (
            <View testID="inline-calendar">
                <Text testID="selected-date">{selectedDate}</Text>
                <TouchableOpacity testID="select-apr9" onPress={() => onSelectDate('2026-04-09')} />
                <TouchableOpacity testID="select-apr17" onPress={() => onSelectDate('2026-04-17')} />
                <TouchableOpacity testID="select-apr23" onPress={() => onSelectDate('2026-04-23')} />
                <TouchableOpacity testID="select-may27" onPress={() => onSelectDate('2026-05-27')} />
            </View>
        ),
    };
});
jest.mock('@/components/events/EventCard', () => {
    const { View, Text } = require('react-native');
    return {
        __esModule: true,
        default: ({ event }: any) => (
            <View testID={`event-card-${event.id}`}>
                <Text>{event.title}</Text>
            </View>
        ),
    };
});
jest.mock('@/components/LoadingState', () => {
    const { View } = require('react-native');
    return { __esModule: true, default: () => <View testID="loading" /> };
});
jest.mock('@/components/ScreenHeader', () => {
    const { View, Text } = require('react-native');
    return {
        __esModule: true,
        default: ({ title }: any) => (
            <View>
                <Text>{title}</Text>
            </View>
        ),
    };
});
jest.mock('@/contexts/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 'user-1', role: 'agent', full_name: 'Kevin' },
    }),
}));
jest.mock('@/contexts/ThemeContext', () => ({
    useTheme: () => ({
        colors: require('@/constants/Colors').Colors.dark,
        isDark: true,
        mode: 'dark',
        resolved: 'dark',
        setMode: jest.fn(),
    }),
}));
jest.mock('expo-router', () => ({
    useRouter: () => ({ push: jest.fn() }),
    useNavigation: () => ({ getParent: () => null }),
    useFocusEffect: (cb: () => void) => {
        const React = require('react');
        React.useEffect(() => {
            cb();
        }, []);
    },
}));
jest.mock('react-native-safe-area-context', () => ({
    SafeAreaView: ({ children, ...props }: any) => {
        const { View } = require('react-native');
        return <View {...props}>{children}</View>;
    },
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

// ── Test data ──────────────────────────────────────────────────
const mockEvents = [
    {
        id: 'evt-1',
        title: 'M9 Exam',
        event_date: '2026-04-09',
        start_time: '09:00',
        end_time: '12:00',
        event_type: 'exam',
        location: 'SCI Exam Centre',
        created_by: 'user-1',
        attendees: [],
    },
    {
        id: 'evt-2',
        title: 'HI Exam',
        event_date: '2026-04-23',
        start_time: '09:00',
        end_time: '12:00',
        event_type: 'exam',
        location: 'SCI Exam Centre',
        created_by: 'user-1',
        attendees: [],
    },
];

const mockedFetchEvents = fetchEvents as jest.MockedFunction<typeof fetchEvents>;

beforeEach(() => {
    jest.clearAllMocks();
    mockedFetchEvents.mockResolvedValue({ data: mockEvents as any, error: null });
});

describe('EventsScreen', () => {
    it('renders all event dates as sections', async () => {
        const { getByText } = render(<EventsScreen />);
        await waitFor(() => expect(getByText('M9 Exam')).toBeTruthy());
        expect(getByText('HI Exam')).toBeTruthy();
    });

    it('shows context days around selected date', async () => {
        const { getByText, getByTestId } = render(<EventsScreen />);
        await waitFor(() => expect(getByText('M9 Exam')).toBeTruthy());

        // Select April 17 — no events, should show 17th + 18th + 19th as context
        await act(async () => {
            fireEvent.press(getByTestId('select-apr17'));
        });

        expect(getByText('17/4/26')).toBeTruthy();
        expect(getByText('18/4/26')).toBeTruthy();
        expect(getByText('19/4/26')).toBeTruthy();
    });

    it('shows "No Events" inline for empty dates', async () => {
        const { getAllByText, getByTestId, getByText } = render(<EventsScreen />);
        await waitFor(() => expect(getByText('M9 Exam')).toBeTruthy());

        // Select April 17 — no events on this date
        await act(async () => {
            fireEvent.press(getByTestId('select-apr17'));
        });

        // Multiple empty dates should have "No Events" text
        expect(getAllByText('No Events').length).toBeGreaterThanOrEqual(1);
    });

    it('keeps past events visible (not filtered out)', async () => {
        const { getByText, getByTestId } = render(<EventsScreen />);
        await waitFor(() => expect(getByText('M9 Exam')).toBeTruthy());

        // Select April 23 — the April 9 event should still exist in the tree
        await act(async () => {
            fireEvent.press(getByTestId('select-apr23'));
        });

        expect(getByText('M9 Exam')).toBeTruthy();
        expect(getByText('HI Exam')).toBeTruthy();
    });

    it('sections are in chronological order', async () => {
        const { getAllByText, getByTestId, getByText } = render(<EventsScreen />);
        await waitFor(() => expect(getByText('M9 Exam')).toBeTruthy());

        // Select April 17 to add context days between event dates
        await act(async () => {
            fireEvent.press(getByTestId('select-apr17'));
        });

        const dateTexts = getAllByText(/^\d+\/\d+\/26$/).map((el: any) => el.props.children);
        const sortable = dateTexts.map((t: string) => {
            const [d, m] = t.split('/').map(Number);
            return m * 100 + d;
        });

        for (let i = 1; i < sortable.length; i++) {
            expect(sortable[i]).toBeGreaterThanOrEqual(sortable[i - 1]);
        }
    });

    it('shows empty state when no events exist at all', async () => {
        mockedFetchEvents.mockResolvedValue({ data: [] as any, error: null });
        const { getAllByText } = render(<EventsScreen />);

        // Should show context days with "No Events" — no crash
        await waitFor(() => expect(getAllByText('No Events').length).toBeGreaterThanOrEqual(1));
    });

    it('does not duplicate section headers for event dates', async () => {
        const { getAllByText, getByText } = render(<EventsScreen />);
        await waitFor(() => expect(getByText('M9 Exam')).toBeTruthy());

        // 9/4/26 should appear exactly once
        expect(getAllByText('9/4/26')).toHaveLength(1);
        // 23/4/26 should appear exactly once
        expect(getAllByText('23/4/26')).toHaveLength(1);
    });
});
