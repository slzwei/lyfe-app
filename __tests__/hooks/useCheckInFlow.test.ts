import { renderHook, act } from '@testing-library/react-native';
import { useCheckInFlow } from '@/hooks/useCheckInFlow';

jest.mock('@/lib/supabase');

const mockLogRoadshowAttendanceWithPledge = jest.fn();
const mockHasUserCheckedIn = jest.fn();
const mockLogRoadshowActivity = jest.fn();

jest.mock('@/lib/roadshow', () => ({
    logRoadshowAttendanceWithPledge: (...args: any[]) => mockLogRoadshowAttendanceWithPledge(...args),
    hasUserCheckedIn: (...args: any[]) => mockHasUserCheckedIn(...args),
    logRoadshowActivity: (...args: any[]) => mockLogRoadshowActivity(...args),
}));

describe('useCheckInFlow', () => {
    const defaultParams = {
        eventId: 'e1',
        userId: 'user1',
        userFullName: 'Test User',
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
        onCheckedIn: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockLogRoadshowActivity.mockResolvedValue({ data: null, error: null });
    });

    it('handleOpenCheckin sets pledge defaults from config', () => {
        const { result } = renderHook(() => useCheckInFlow(defaultParams));

        act(() => {
            result.current.handleOpenCheckin();
        });

        expect(result.current.showPledgeSheet).toBe(true);
        expect(result.current.pledgeSitdowns).toBe(8);
        expect(result.current.pledgePitches).toBe(6);
        expect(result.current.pledgeClosed).toBe(2);
    });

    it('handleConfirmPledge calls attendance function on success', async () => {
        mockHasUserCheckedIn.mockResolvedValue({ data: false, error: null });
        mockLogRoadshowAttendanceWithPledge.mockResolvedValue({ error: null });

        const { result } = renderHook(() => useCheckInFlow(defaultParams));

        // Open pledge sheet first
        act(() => {
            result.current.handleOpenCheckin();
        });

        await act(async () => {
            await result.current.handleConfirmPledge();
        });

        expect(mockHasUserCheckedIn).toHaveBeenCalledWith('e1', 'user1');
        expect(mockLogRoadshowAttendanceWithPledge).toHaveBeenCalledWith('e1', 'user1', null, {
            sitdowns: 8,
            pitches: 6,
            closed: 2,
            afyc: 0,
        });
        expect(defaultParams.onCheckedIn).toHaveBeenCalled();
        expect(result.current.showPledgeSheet).toBe(false);
    });

    it('shows error on pledge failure', async () => {
        mockHasUserCheckedIn.mockResolvedValue({ data: false, error: null });
        mockLogRoadshowAttendanceWithPledge.mockResolvedValue({ error: 'Network error' });

        const { result } = renderHook(() => useCheckInFlow(defaultParams));

        await act(async () => {
            await result.current.handleConfirmPledge();
        });

        expect(result.current.checkinError).toBe('Network error');
        expect(defaultParams.onCheckedIn).not.toHaveBeenCalled();
    });

    it('shows error when hasUserCheckedIn fails', async () => {
        mockHasUserCheckedIn.mockResolvedValue({ data: false, error: 'Network error' });

        const { result } = renderHook(() => useCheckInFlow(defaultParams));

        await act(async () => {
            await result.current.handleConfirmPledge();
        });

        expect(result.current.checkinError).toBe('Network error');
        expect(mockLogRoadshowAttendanceWithPledge).not.toHaveBeenCalled();
        expect(defaultParams.onCheckedIn).not.toHaveBeenCalled();
    });

    it('handles already checked in case', async () => {
        mockHasUserCheckedIn.mockResolvedValue({ data: true, error: null });

        const { result } = renderHook(() => useCheckInFlow(defaultParams));

        act(() => {
            result.current.handleOpenCheckin();
        });

        await act(async () => {
            await result.current.handleConfirmPledge();
        });

        expect(mockLogRoadshowAttendanceWithPledge).not.toHaveBeenCalled();
        expect(defaultParams.onCheckedIn).toHaveBeenCalled();
        expect(result.current.showPledgeSheet).toBe(false);
    });
});
