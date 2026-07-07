import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import LiveEventBar from '@/components/LiveEventBar';
import { fetchEvents } from '@/lib/events';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useTypedRouter } from '@/hooks/useTypedRouter';
import type { AgencyEvent } from '@/types/event';

jest.mock('@/lib/events', () => ({
    fetchEvents: jest.fn(),
}));

jest.mock('@/contexts/AuthContext', () => ({
    useAuth: jest.fn(),
}));

jest.mock('@/contexts/ThemeContext', () => ({
    useTheme: jest.fn(),
}));

jest.mock('@/hooks/useTypedRouter', () => ({
    useTypedRouter: jest.fn(),
}));

const mockUsePathname = jest.fn().mockReturnValue('/home');
const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({
    useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() })),
    useNavigation: jest.fn(() => ({ navigate: mockNavigate, dispatch: jest.fn() })),
    useLocalSearchParams: jest.fn(() => ({})),
    useFocusEffect: jest.fn((cb: () => void) => cb()),
    usePathname: () => mockUsePathname(),
    Link: 'Link',
    Tabs: { Screen: 'Screen' },
}));

const COLORS = {
    cardBackground: '#FFFFFF',
    textPrimary: '#000000',
    textTertiary: '#999999',
    accent: '#007AFF',
    borderLight: '#E5E5E5',
    statusLive: '#7A8C6B',
};

const mockPush = jest.fn();

function makeLiveEvent(overrides: Partial<AgencyEvent> = {}): AgencyEvent {
    const now = new Date();
    const startH = now.getHours() - 1;
    const endH = now.getHours() + 1;
    const pad = (n: number) => n.toString().padStart(2, '0');
    const today = now.toLocaleDateString('en-CA');

    return {
        id: 'evt-1',
        title: 'Live Roadshow',
        description: null,
        event_type: 'roadshow',
        event_date: today,
        start_time: `${pad(startH)}:00`,
        end_time: `${pad(endH)}:00`,
        location: 'Tampines Mall',
        created_by: 'user-1',
        creator_name: 'Admin',
        created_at: '2026-03-08T00:00:00Z',
        updated_at: '2026-03-08T00:00:00Z',
        attendees: [],
        external_attendees: [],
        ...overrides,
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    mockUsePathname.mockReturnValue('/home');
    (useAuth as jest.Mock).mockReturnValue({ user: { id: 'user-1', role: 'agent' } });
    (useTheme as jest.Mock).mockReturnValue({ colors: COLORS });
    (useTypedRouter as jest.Mock).mockReturnValue({ push: mockPush, replace: jest.fn(), back: jest.fn() });
    (fetchEvents as jest.Mock).mockResolvedValue({ data: [], error: null });
});

describe('LiveEventBar', () => {
    it('renders nothing when no live events', async () => {
        (fetchEvents as jest.Mock).mockResolvedValue({ data: [], error: null });
        const { queryByText } = render(<LiveEventBar />);
        await waitFor(() => expect(fetchEvents).toHaveBeenCalled());
        expect(queryByText('LIVE')).toBeNull();
    });

    it('renders live event when one is happening now', async () => {
        const liveEvent = makeLiveEvent();
        (fetchEvents as jest.Mock).mockResolvedValue({ data: [liveEvent], error: null });

        const { getByText } = render(<LiveEventBar />);
        await waitFor(() => expect(getByText('Live Roadshow')).toBeTruthy());
        expect(getByText('LIVE')).toBeTruthy();
    });

    it('tints the LIVE chip from the theme (no hardcoded green)', async () => {
        const liveEvent = makeLiveEvent();
        (fetchEvents as jest.Mock).mockResolvedValue({ data: [liveEvent], error: null });

        const { getByTestId, getByText } = render(<LiveEventBar />);
        await waitFor(() => expect(getByText('LIVE')).toBeTruthy());

        const chipStyle = StyleSheet.flatten(getByTestId('live-event-bar-chip').props.style);
        expect(chipStyle.backgroundColor).toBe(COLORS.statusLive + '18');
    });

    it('shows location in meta text', async () => {
        const liveEvent = makeLiveEvent({ location: 'Hillion Mall' });
        (fetchEvents as jest.Mock).mockResolvedValue({ data: [liveEvent], error: null });

        const { getByText } = render(<LiveEventBar />);
        await waitFor(() => expect(getByText(/Hillion Mall/)).toBeTruthy());
    });

    it('does not show events that are not live', async () => {
        const futureEvent = makeLiveEvent({
            id: 'evt-future',
            title: 'Future Event',
            event_date: '2030-01-01',
            start_time: '09:00',
            end_time: '17:00',
        });
        (fetchEvents as jest.Mock).mockResolvedValue({ data: [futureEvent], error: null });

        const { queryByText } = render(<LiveEventBar />);
        await waitFor(() => expect(fetchEvents).toHaveBeenCalled());
        expect(queryByText('Future Event')).toBeNull();
    });

    it('does not show events with null end_time', async () => {
        const noEndEvent = makeLiveEvent({ id: 'evt-noend', title: 'No End', end_time: null });
        (fetchEvents as jest.Mock).mockResolvedValue({ data: [noEndEvent], error: null });

        const { queryByText } = render(<LiveEventBar />);
        await waitFor(() => expect(fetchEvents).toHaveBeenCalled());
        expect(queryByText('No End')).toBeNull();
    });

    it('dismisses all live events on X tap', async () => {
        const liveEvent = makeLiveEvent();
        (fetchEvents as jest.Mock).mockResolvedValue({ data: [liveEvent], error: null });

        const { getByText, getByLabelText, queryByText } = render(<LiveEventBar />);
        await waitFor(() => expect(getByText('Live Roadshow')).toBeTruthy());

        fireEvent.press(getByLabelText('Dismiss live events bar'));
        expect(queryByText('Live Roadshow')).toBeNull();
    });

    it('navigates to event detail on tap (agent)', async () => {
        const liveEvent = makeLiveEvent({ id: 'evt-42' });
        (fetchEvents as jest.Mock).mockResolvedValue({ data: [liveEvent], error: null });

        const { getByLabelText } = render(<LiveEventBar />);
        await waitFor(() => expect(getByLabelText(/Live Roadshow/)).toBeTruthy());

        fireEvent.press(getByLabelText(/Live Roadshow/));
        // Nested navigate with `initial: false` so the events stack includes
        // the calendar (index) below [eventId] — back returns to calendar
        // instead of falling through to home.
        expect(mockNavigate).toHaveBeenCalledWith('(tabs)', {
            screen: 'events',
            params: {
                screen: '[eventId]',
                initial: false,
                params: { eventId: 'evt-42' },
            },
        });
    });

    it('navigates to PA event route for PA role', async () => {
        (useAuth as jest.Mock).mockReturnValue({ user: { id: 'user-1', role: 'pa' } });
        const liveEvent = makeLiveEvent({ id: 'evt-42' });
        (fetchEvents as jest.Mock).mockResolvedValue({ data: [liveEvent], error: null });

        const { getByLabelText } = render(<LiveEventBar />);
        await waitFor(() => expect(getByLabelText(/Live Roadshow/)).toBeTruthy());

        fireEvent.press(getByLabelText(/Live Roadshow/));
        expect(mockPush).toHaveBeenCalledWith('/(tabs)/pa/event/evt-42');
    });

    it('hides on events tab (animated off-screen, pointer events disabled)', async () => {
        mockUsePathname.mockReturnValue('/events');
        const liveEvent = makeLiveEvent();
        (fetchEvents as jest.Mock).mockResolvedValue({ data: [liveEvent], error: null });

        const { getByTestId } = render(<LiveEventBar />);
        await waitFor(() => expect(fetchEvents).toHaveBeenCalled());
        // Bar stays mounted for exit animation but is non-interactive
        expect(getByTestId('live-event-bar').props.pointerEvents).toBe('none');
    });

    it('renders dot indicators for multiple live events', async () => {
        const event1 = makeLiveEvent({ id: 'evt-1', title: 'Event 1' });
        const event2 = makeLiveEvent({ id: 'evt-2', title: 'Event 2' });
        (fetchEvents as jest.Mock).mockResolvedValue({ data: [event1, event2], error: null });

        const { getByText, queryByText } = render(<LiveEventBar />);
        // Cross-fade shows one event at a time, starting with the first
        await waitFor(() => expect(getByText('Event 1')).toBeTruthy());
        expect(queryByText('Event 2')).toBeNull();
    });

    it('cross-fades to next event after interval', async () => {
        jest.useFakeTimers();
        const event1 = makeLiveEvent({ id: 'evt-1', title: 'Event 1' });
        const event2 = makeLiveEvent({ id: 'evt-2', title: 'Event 2' });
        (fetchEvents as jest.Mock).mockResolvedValue({ data: [event1, event2], error: null });

        const { getByText, queryByText } = render(<LiveEventBar />);

        // Wait for initial render with first event
        await waitFor(() => expect(getByText('Event 1')).toBeTruthy());
        expect(queryByText('Event 2')).toBeNull();

        // Advance past the slide interval + fade duration
        await act(async () => {
            jest.advanceTimersByTime(5000 + 400);
        });

        // Should now show the second event
        await waitFor(() => expect(getByText('Event 2')).toBeTruthy());
        expect(queryByText('Event 1')).toBeNull();

        jest.useRealTimers();
    });

    it('dismiss state resets on remount (app restart)', async () => {
        const liveEvent = makeLiveEvent();
        (fetchEvents as jest.Mock).mockResolvedValue({ data: [liveEvent], error: null });

        const { getByText, getByLabelText, queryByText, unmount } = render(<LiveEventBar />);
        await waitFor(() => expect(getByText('Live Roadshow')).toBeTruthy());

        // Dismiss
        fireEvent.press(getByLabelText('Dismiss live events bar'));
        expect(queryByText('Live Roadshow')).toBeNull();

        // Remount (simulates app restart)
        unmount();
        const { getByText: getByText2 } = render(<LiveEventBar />);
        await waitFor(() => expect(getByText2('Live Roadshow')).toBeTruthy());
    });
});
