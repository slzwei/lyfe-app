import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useEventDetail } from '@/hooks/useEventDetail';

// Mock dependencies
jest.mock('@/lib/supabase');
jest.mock('@/hooks/useRoadshowRealtime', () => ({
    useRoadshowRealtime: jest.fn(),
}));

const mockFetchEventById = jest.fn();
const mockFetchRoadshowConfig = jest.fn();
const mockFetchRoadshowAttendance = jest.fn();
const mockFetchRoadshowActivities = jest.fn();

jest.mock('@/lib/events', () => ({
    fetchEventById: (...args: any[]) => mockFetchEventById(...args),
}));

jest.mock('@/lib/roadshow', () => ({
    fetchRoadshowConfig: (...args: any[]) => mockFetchRoadshowConfig(...args),
    fetchRoadshowAttendance: (...args: any[]) => mockFetchRoadshowAttendance(...args),
    fetchRoadshowActivities: (...args: any[]) => mockFetchRoadshowActivities(...args),
}));

jest.mock('@/lib/dateTime', () => ({
    todayLocalStr: () => '2026-03-09',
}));

// Mock useFocusEffect to fire immediately
jest.mock('expo-router', () => ({
    useFocusEffect: (cb: () => void) => {
        const { useEffect } = require('react');
        useEffect(() => {
            cb();
        }, [cb]);
    },
    useLocalSearchParams: () => ({ eventId: 'e1' }),
    useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));

describe('useEventDetail', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFetchEventById.mockResolvedValue({
            data: {
                id: 'e1',
                title: 'Test Event',
                event_type: 'training',
                event_date: '2026-03-09',
                start_time: '09:00',
                end_time: '17:00',
                attendees: [],
            },
        });
    });

    it('loads event data on mount', async () => {
        const { result } = renderHook(() => useEventDetail('e1', 'user1'));

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.event).toBeTruthy();
        expect(result.current.event!.title).toBe('Test Event');
        expect(mockFetchEventById).toHaveBeenCalledWith('e1');
    });

    it('tracks refreshing state', async () => {
        const { result } = renderHook(() => useEventDetail('e1', 'user1'));

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        // After initial load, calling loadEvent(true) should set refreshing
        await act(async () => {
            result.current.loadEvent(true);
        });

        // After resolution, refreshing should be false
        await waitFor(() => {
            expect(result.current.refreshing).toBe(false);
        });
    });

    it('loads roadshow config for roadshow events', async () => {
        const mockConfig = {
            id: 'cfg1',
            event_id: 'e1',
            weekly_cost: 500,
            daily_cost: 100,
            slot_cost: 25,
            slots_per_day: 4,
            expected_start_time: '09:00',
            late_grace_minutes: 15,
            suggested_sitdowns: 5,
            suggested_pitches: 3,
            suggested_closed: 1,
        };

        mockFetchEventById.mockResolvedValue({
            data: {
                id: 'e1',
                title: 'Roadshow',
                event_type: 'roadshow',
                event_date: '2026-03-09',
                start_time: '09:00',
                end_time: '17:00',
                attendees: [],
            },
        });
        mockFetchRoadshowConfig.mockResolvedValue({ data: mockConfig });
        mockFetchRoadshowAttendance.mockResolvedValue({ data: [] });
        mockFetchRoadshowActivities.mockResolvedValue({ data: [] });

        const { result } = renderHook(() => useEventDetail('e1', 'user1'));

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.roadshowConfig).toEqual(mockConfig);
        expect(mockFetchRoadshowConfig).toHaveBeenCalledWith('e1');
        expect(mockFetchRoadshowActivities).toHaveBeenCalledWith('e1');
    });

    it('passes an onResync callback that reloads roadshow data on reconnect', async () => {
        // Audit H6: on a realtime reconnect the live roadshow view must backfill
        // any inserts missed while offline — useEventDetail wires that to a reload.
        const { useRoadshowRealtime } = require('@/hooks/useRoadshowRealtime');
        mockFetchEventById.mockResolvedValue({
            data: {
                id: 'e1',
                title: 'Roadshow',
                event_type: 'roadshow',
                event_date: '2026-03-09',
                start_time: '09:00',
                end_time: '17:00',
                attendees: [],
            },
        });
        mockFetchRoadshowConfig.mockResolvedValue({ data: null });
        mockFetchRoadshowAttendance.mockResolvedValue({ data: [] });
        mockFetchRoadshowActivities.mockResolvedValue({ data: [] });

        renderHook(() => useEventDetail('e1', 'user1'));
        await waitFor(() => expect(mockFetchEventById).toHaveBeenCalled());

        const calls = (useRoadshowRealtime as jest.Mock).mock.calls;
        const onResync = calls[calls.length - 1][5];
        expect(typeof onResync).toBe('function');

        mockFetchEventById.mockClear();
        await act(async () => {
            onResync();
        });
        expect(mockFetchEventById).toHaveBeenCalledWith('e1'); // resync re-fetched event data
    });

    it('returns null event when eventId is undefined', async () => {
        const { result } = renderHook(() => useEventDetail(undefined, 'user1'));

        // Should stay loading since loadEvent returns early
        expect(result.current.event).toBeNull();
        expect(mockFetchEventById).not.toHaveBeenCalled();
    });
});
