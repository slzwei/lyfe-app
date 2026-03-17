import { renderHook, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useManagerOverride } from '@/hooks/useManagerOverride';

const mockManagerCheckIn = jest.fn();
const mockLogRoadshowActivity = jest.fn();

jest.mock('@/lib/roadshow', () => ({
    managerCheckIn: (...args: any[]) => mockManagerCheckIn(...args),
    logRoadshowActivity: (...args: any[]) => mockLogRoadshowActivity(...args),
}));

jest.mock('@/lib/dateTime', () => ({
    formatCheckinTime: (iso: string) => '10:00 AM',
}));

describe('useManagerOverride', () => {
    const defaultParams = {
        eventId: 'e1',
        userId: 'manager1',
        roadshowConfig: {
            id: 'cfg1',
            event_id: 'e1',
            weekly_cost: 500,
            daily_cost: 100,
            slot_cost: 25,
            slots_per_day: 4,
            expected_start_time: '09:00',
            late_grace_minutes: 15,
            suggested_sitdowns: 8,
            suggested_pitches: 6,
            suggested_closed: 2,
        } as any,
        onOverrideComplete: jest.fn(),
    };

    const mockAgent = {
        id: 'att1',
        event_id: 'e1',
        user_id: 'agent1',
        full_name: 'Agent Smith',
        attendee_role: 'attendee' as const,
        avatar_url: null,
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockLogRoadshowActivity.mockResolvedValue({ data: null, error: null });
    });

    it('openOverride sets defaults from config', () => {
        const { result } = renderHook(() => useManagerOverride(defaultParams));

        act(() => {
            result.current.openOverride(mockAgent as any);
        });

        expect(result.current.overrideTarget).toEqual(mockAgent);
        expect(result.current.overrideTime).toBe('10:00 AM');
        expect(result.current.overridePledgeSitdowns).toBe(8);
        expect(result.current.overridePledgePitches).toBe(6);
        expect(result.current.overridePledgeClosed).toBe(2);
        expect(result.current.overrideLateReason).toBe('');
        expect(result.current.overridePledgeAfyc).toBe('');
        expect(result.current.overrideError).toBeNull();
    });

    it('handleConfirmOverride validates time format', async () => {
        const { result } = renderHook(() => useManagerOverride(defaultParams));

        act(() => {
            result.current.openOverride(mockAgent as any);
        });

        // Set invalid time
        act(() => {
            result.current.setOverrideTime('invalid');
        });

        await act(async () => {
            await result.current.handleConfirmOverride();
        });

        expect(result.current.overrideError).toBe('Enter time as HH:MM AM/PM');
        expect(mockManagerCheckIn).not.toHaveBeenCalled();
    });

    it('handleConfirmOverride calls managerCheckIn on confirm', async () => {
        mockManagerCheckIn.mockResolvedValue({ error: null });

        // Spy on Alert.alert to capture the confirm callback
        const alertSpy = jest.spyOn(Alert, 'alert');

        const { result } = renderHook(() => useManagerOverride(defaultParams));

        act(() => {
            result.current.openOverride(mockAgent as any);
        });

        // Set a valid past time — use 12:01 AM which is always in the past (unless test runs at midnight)
        act(() => {
            result.current.setOverrideTime('12:01 AM');
        });

        await act(async () => {
            await result.current.handleConfirmOverride();
        });

        // If the time was treated as future, overrideError would be set
        if (result.current.overrideError === 'Arrival time cannot be in the future.') {
            // Skip this assertion if we happen to run at exactly midnight
            alertSpy.mockRestore();
            return;
        }

        // Alert.alert should have been called with confirm button
        expect(alertSpy).toHaveBeenCalledWith(
            'Confirm Override',
            expect.stringContaining('Agent Smith'),
            expect.any(Array),
        );

        // Simulate pressing Confirm
        const buttons = alertSpy.mock.calls[0][2] as any[];
        const confirmBtn = buttons.find((b: any) => b.text === 'Confirm');

        await act(async () => {
            await confirmBtn.onPress();
        });

        expect(mockManagerCheckIn).toHaveBeenCalledWith(
            'e1',
            'agent1',
            expect.any(String),
            null,
            { sitdowns: 8, pitches: 6, closed: 2, afyc: 0 },
            'manager1',
        );
        expect(defaultParams.onOverrideComplete).toHaveBeenCalled();

        alertSpy.mockRestore();
    });

    it('returns without action when no override target', async () => {
        const { result } = renderHook(() => useManagerOverride(defaultParams));

        await act(async () => {
            await result.current.handleConfirmOverride();
        });

        expect(mockManagerCheckIn).not.toHaveBeenCalled();
    });
});
