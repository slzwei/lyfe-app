import React from 'react';
import { render, act, waitFor, fireEvent } from '@testing-library/react-native';
import EventsScreen from '@/app/(tabs)/events/index';
import { fetchEvents, fetchTeamEvents } from '@/lib/events';

// ── Mocks ──────────────────────────────────────────────────────
jest.mock('@/lib/supabase');
jest.mock('@/lib/events');
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('@/components/events/InlineCalendar', () => {
    const { View, Text, TouchableOpacity } = require('react-native');
    return {
        __esModule: true,
        default: ({ selectedDate, onSelectDate, scrollToTodayRef }: any) => {
            // Mirror the real component's contract: expose a jump-to-today
            // callback through the ref so tab re-press behavior is testable.
            if (scrollToTodayRef) {
                scrollToTodayRef.current = () => onSelectDate(new Date().toLocaleDateString('en-CA'));
            }
            return (
                <View testID="inline-calendar">
                    <Text testID="selected-date">{selectedDate}</Text>
                    <TouchableOpacity testID="select-apr9" onPress={() => onSelectDate('2026-04-09')} />
                    <TouchableOpacity testID="select-apr17" onPress={() => onSelectDate('2026-04-17')} />
                    <TouchableOpacity testID="select-apr23" onPress={() => onSelectDate('2026-04-23')} />
                    <TouchableOpacity testID="select-may27" onPress={() => onSelectDate('2026-05-27')} />
                </View>
            );
        },
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
let mockRole = 'agent';
jest.mock('@/contexts/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 'user-1', role: mockRole, full_name: 'Kevin' },
    }),
}));
let mockViewMode = 'agent';
jest.mock('@/contexts/ViewModeContext', () => ({
    useViewMode: () => ({ viewMode: mockViewMode, canToggle: false, setViewMode: jest.fn() }),
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
// Tab navigator stub: captures tabPress handlers and serves a configurable
// navigation state so the re-press-only jump-to-today logic is testable.
const mockTabPressHandlers: ((e: { target?: string }) => void)[] = [];
const EVENTS_ROUTE = { key: 'events-key-1', name: 'events' };
const HOME_ROUTE = { key: 'home-key-1', name: 'home' };
let mockParentState: { index: number; routes: { key: string; name: string }[] };

jest.mock('expo-router', () => ({
    useRouter: () => ({ push: jest.fn() }),
    useNavigation: () => ({
        getParent: () => ({
            addListener: (type: string, cb: (e: { target?: string }) => void) => {
                if (type === 'tabPress') mockTabPressHandlers.push(cb);
                return () => {};
            },
            getState: () => mockParentState,
        }),
    }),
    // Real useFocusEffect re-runs while focused whenever the callback
    // identity changes — mirror that so scope switches refetch.
    useFocusEffect: (cb: () => void) => {
        const React = require('react');
        React.useEffect(() => {
            cb();
        }, [cb]);
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
const mockedFetchTeamEvents = fetchTeamEvents as jest.MockedFunction<typeof fetchTeamEvents>;

beforeEach(() => {
    jest.clearAllMocks();
    mockRole = 'agent';
    mockViewMode = 'agent';
    mockTabPressHandlers.length = 0;
    mockParentState = { index: 0, routes: [EVENTS_ROUTE] };
    mockedFetchEvents.mockResolvedValue({ data: mockEvents as any, error: null });
    mockedFetchTeamEvents.mockResolvedValue({ data: mockEvents as any, error: null });
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

    it('shows a taught empty state when no events exist at all', async () => {
        mockedFetchEvents.mockResolvedValue({ data: [] as any, error: null });
        const { getByText, queryAllByText } = render(<EventsScreen />);

        await waitFor(() => expect(getByText('No events yet')).toBeTruthy());
        // Agents can't create events — no CTA, and no bare "No Events" rows
        expect(queryAllByText('No Events')).toHaveLength(0);
        expect(queryAllByText('Create an event')).toHaveLength(0);
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

// ── Tab re-press → jump to today ───────────────────────────────
describe('EventsScreen tab-press behavior', () => {
    const todayStr = new Date().toLocaleDateString('en-CA');

    async function renderBrowsedAwayFromToday() {
        const utils = render(<EventsScreen />);
        await waitFor(() => expect(utils.getByTestId('inline-calendar')).toBeTruthy());
        fireEvent.press(utils.getByTestId('select-apr9'));
        expect(utils.getByTestId('selected-date').props.children).toBe('2026-04-09');
        return utils;
    }

    it('re-pressing the Events tab while focused jumps to today', async () => {
        const utils = await renderBrowsedAwayFromToday();

        act(() => {
            mockTabPressHandlers.forEach((h) => h({ target: EVENTS_ROUTE.key }));
        });

        expect(utils.getByTestId('selected-date').props.children).toBe(todayStr);
    });

    it('pressing a different tab while on Events preserves the position', async () => {
        const utils = await renderBrowsedAwayFromToday();

        act(() => {
            mockTabPressHandlers.forEach((h) => h({ target: HOME_ROUTE.key }));
        });

        expect(utils.getByTestId('selected-date').props.children).toBe('2026-04-09');
    });

    it('switching into Events from another tab preserves the position', async () => {
        const utils = await renderBrowsedAwayFromToday();

        // Home is focused at press time (tabPress fires before navigation)
        mockParentState = { index: 0, routes: [HOME_ROUTE, EVENTS_ROUTE] };
        act(() => {
            mockTabPressHandlers.forEach((h) => h({ target: EVENTS_ROUTE.key }));
        });

        expect(utils.getByTestId('selected-date').props.children).toBe('2026-04-09');
    });
});

// ── Live banner formatting ─────────────────────────────────────
describe('EventsScreen live banner', () => {
    it('formats DB times (HH:MM:SS) as 12-hour on the live banner', async () => {
        const today = new Date().toLocaleDateString('en-CA');
        mockedFetchEvents.mockResolvedValue({
            data: [
                {
                    id: 'evt-live',
                    title: 'AMK Hub, Atrium',
                    event_date: today,
                    start_time: '00:00:00',
                    end_time: '23:59:00',
                    event_type: 'roadshow',
                    location: 'AMK Hub',
                    created_by: 'user-1',
                    attendees: [],
                },
            ] as any,
            error: null,
        });

        const { getByText, queryByText } = render(<EventsScreen />);

        await waitFor(() => expect(getByText(/12:00 AM – 11:59 PM · tap to open/)).toBeTruthy());
        expect(queryByText(/00:00:00/)).toBeNull();
    });
});

// ── Team scope toggle (manager/director in manager view) ───────
describe('EventsScreen team scope', () => {
    it('shows no Mine/Team toggle for agents', async () => {
        const { queryByTestId, getByTestId } = render(<EventsScreen />);
        await waitFor(() => expect(getByTestId('inline-calendar')).toBeTruthy());
        expect(queryByTestId('events-scope-team')).toBeNull();
    });

    it('manager in manager view can switch to the team calendar', async () => {
        mockRole = 'manager';
        mockViewMode = 'manager';

        const { getByTestId } = render(<EventsScreen />);
        await waitFor(() => expect(getByTestId('events-scope-team')).toBeTruthy());
        expect(mockedFetchTeamEvents).not.toHaveBeenCalled();

        await act(async () => {
            fireEvent.press(getByTestId('events-scope-team'));
        });

        await waitFor(() => expect(mockedFetchTeamEvents).toHaveBeenCalledWith('user-1', 'manager'));
    });

    it('manager browsing in agent view keeps the personal calendar (no toggle)', async () => {
        mockRole = 'manager';
        mockViewMode = 'agent';

        const { queryByTestId, getByTestId } = render(<EventsScreen />);
        await waitFor(() => expect(getByTestId('inline-calendar')).toBeTruthy());
        expect(queryByTestId('events-scope-team')).toBeNull();
        expect(mockedFetchTeamEvents).not.toHaveBeenCalled();
    });
});
