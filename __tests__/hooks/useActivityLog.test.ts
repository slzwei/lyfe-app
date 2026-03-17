import { renderHook, act } from '@testing-library/react-native';
import { useActivityLog } from '@/hooks/useActivityLog';

const mockLogRoadshowActivity = jest.fn();

jest.mock('@/lib/roadshow', () => ({
    logRoadshowActivity: (...args: any[]) => mockLogRoadshowActivity(...args),
}));

jest.mock('@/constants/ui', () => ({
    PICKER_MINUTES: ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'],
}));

describe('useActivityLog', () => {
    const mockSetActivities = jest.fn((updater) => {
        if (typeof updater === 'function') updater([]);
    });

    const defaultParams = {
        eventId: 'e1',
        userId: 'user1',
        userFullName: 'Test User',
        myAttendance: {
            id: 'att1',
            event_id: 'e1',
            user_id: 'user1',
            full_name: 'Test User',
            checked_in_at: '2026-03-09T01:00:00.000Z',
            is_late: false,
            minutes_late: 0,
            late_reason: null,
            checked_in_by: null,
            pledged_sitdowns: 5,
            pledged_pitches: 3,
            pledged_closed: 1,
            pledged_afyc: 2000,
        } as any,
        activities: [] as any[],
        setActivities: mockSetActivities as any,
        onMilestone: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockLogRoadshowActivity.mockResolvedValue({ data: null, error: null });
    });

    it('handleLogActivity creates optimistic update', async () => {
        const { result } = renderHook(() => useActivityLog(defaultParams));

        await act(async () => {
            await result.current.handleLogActivity('sitdown');
        });

        // setActivities should have been called for optimistic update
        expect(mockSetActivities).toHaveBeenCalled();
        expect(mockLogRoadshowActivity).toHaveBeenCalledWith('e1', 'user1', 'sitdown', undefined, expect.any(String));
    });

    it('initLogTime sets current time values', () => {
        const { result } = renderHook(() => useActivityLog(defaultParams));

        act(() => {
            result.current.initLogTime();
        });

        // logHour, logMinuteIdx, logAmPm should be set to some valid values
        expect(result.current.logHour).toBeGreaterThanOrEqual(0);
        expect(result.current.logHour).toBeLessThanOrEqual(11);
        expect(result.current.logMinuteIdx).toBeGreaterThanOrEqual(0);
        expect(result.current.logMinuteIdx).toBeLessThanOrEqual(11);
        expect([0, 1]).toContain(result.current.logAmPm);
    });

    it('handleLogCaseClosed with AFYC amount', async () => {
        const { result } = renderHook(() => useActivityLog(defaultParams));

        // Set an AFYC input
        act(() => {
            result.current.setAfycInput('2000');
        });

        await act(async () => {
            await result.current.handleLogCaseClosed();
        });

        expect(mockLogRoadshowActivity).toHaveBeenCalledWith('e1', 'user1', 'case_closed', 2000, expect.any(String));
        expect(defaultParams.onMilestone).toHaveBeenCalled();
    });

    it('handleLogActivity triggers milestone when hitting pledged target', async () => {
        const activitiesWithData = [
            {
                id: '1',
                event_id: 'e1',
                user_id: 'user1',
                type: 'sitdown',
                afyc_amount: null,
                logged_at: '',
                full_name: 'Test',
            },
            {
                id: '2',
                event_id: 'e1',
                user_id: 'user1',
                type: 'sitdown',
                afyc_amount: null,
                logged_at: '',
                full_name: 'Test',
            },
            {
                id: '3',
                event_id: 'e1',
                user_id: 'user1',
                type: 'sitdown',
                afyc_amount: null,
                logged_at: '',
                full_name: 'Test',
            },
            {
                id: '4',
                event_id: 'e1',
                user_id: 'user1',
                type: 'sitdown',
                afyc_amount: null,
                logged_at: '',
                full_name: 'Test',
            },
        ] as any[];

        const onMilestone = jest.fn();
        // pledged_sitdowns=5, current=4, so the next sitdown hits the target
        const { result } = renderHook(() =>
            useActivityLog({ ...defaultParams, activities: activitiesWithData, onMilestone }),
        );

        await act(async () => {
            await result.current.handleLogActivity('sitdown');
        });

        expect(onMilestone).toHaveBeenCalled();
    });

    it('handleLogActivity debounces repeated calls', async () => {
        const { result } = renderHook(() => useActivityLog(defaultParams));

        await act(async () => {
            await result.current.handleLogActivity('sitdown');
        });

        // Second call should be debounced
        await act(async () => {
            await result.current.handleLogActivity('sitdown');
        });

        // logRoadshowActivity should only be called once
        expect(mockLogRoadshowActivity).toHaveBeenCalledTimes(1);
    });

    it('handleLogActivity removes optimistic update on error', async () => {
        mockLogRoadshowActivity.mockResolvedValueOnce({ data: null, error: 'Server error' });
        const alertSpy = jest.spyOn(require('react-native').Alert, 'alert');

        const { result } = renderHook(() => useActivityLog(defaultParams));

        await act(async () => {
            await result.current.handleLogActivity('pitch');
        });

        expect(alertSpy).toHaveBeenCalledWith('Failed', 'Could not log activity. Please try again.');
    });

    it('logTimeToISO returns valid ISO string', () => {
        const { result } = renderHook(() => useActivityLog(defaultParams));

        act(() => {
            result.current.initLogTime();
        });

        const iso = result.current.logTimeToISO();
        expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('handleLogDeparture shows confirmation alert', () => {
        const alertSpy = jest.spyOn(require('react-native').Alert, 'alert');
        const { result } = renderHook(() => useActivityLog(defaultParams));

        act(() => {
            result.current.handleLogDeparture();
        });

        expect(alertSpy).toHaveBeenCalledWith('Leave Roadshow?', expect.any(String), expect.any(Array));
    });

    it('handleReturnToBooth logs check_in activity', async () => {
        const { result } = renderHook(() => useActivityLog(defaultParams));

        await act(async () => {
            await result.current.handleReturnToBooth();
        });

        expect(mockLogRoadshowActivity).toHaveBeenCalledWith('e1', 'user1', 'check_in');
        expect(mockSetActivities).toHaveBeenCalled();
    });

    it('handleReturnToBooth removes optimistic update on error', async () => {
        mockLogRoadshowActivity.mockResolvedValueOnce({ data: null, error: 'Network error' });
        const { result } = renderHook(() => useActivityLog(defaultParams));

        await act(async () => {
            await result.current.handleReturnToBooth();
        });

        // setActivities called twice: once for optimistic add, once for removal
        expect(mockSetActivities).toHaveBeenCalledTimes(2);
    });

    it('myCounts returns zeros when myAttendance is null', () => {
        const { result } = renderHook(() => useActivityLog({ ...defaultParams, myAttendance: null }));

        expect(result.current.myCounts).toEqual({
            sitdowns: 0,
            pitches: 0,
            closed: 0,
            afyc: 0,
        });
    });

    it('handleLogCaseClosed shows confirm for $0 AFYC', async () => {
        // Mock Alert.alert to auto-press "Cancel" so the Promise resolves
        const alertSpy = jest
            .spyOn(require('react-native').Alert, 'alert')
            .mockImplementation((_title: string, _message?: string, buttons?: any[]) => {
                const cancelBtn = buttons?.find((b: any) => b.text === 'Cancel');
                if (cancelBtn?.onPress) cancelBtn.onPress();
            });
        const { result } = renderHook(() => useActivityLog(defaultParams));

        // Leave afycInput empty/0
        await act(async () => {
            await result.current.handleLogCaseClosed();
        });

        expect(alertSpy).toHaveBeenCalledWith('Log $0 AFYC?', expect.any(String), expect.any(Array));
        alertSpy.mockRestore();
    });

    it('handleLogCaseClosed with $0 proceeds when confirmed', async () => {
        // Mock Alert.alert to auto-press "Log" so it proceeds
        const alertSpy = jest
            .spyOn(require('react-native').Alert, 'alert')
            .mockImplementation((_title: string, _message?: string, buttons?: any[]) => {
                const logBtn = buttons?.find((b: any) => b.text === 'Log');
                if (logBtn?.onPress) logBtn.onPress();
            });
        const { result } = renderHook(() => useActivityLog(defaultParams));

        await act(async () => {
            await result.current.handleLogCaseClosed();
        });

        expect(mockLogRoadshowActivity).toHaveBeenCalledWith('e1', 'user1', 'case_closed', 0, expect.any(String));
        alertSpy.mockRestore();
    });

    it('handleLogCaseClosed reverts on error', async () => {
        mockLogRoadshowActivity.mockResolvedValueOnce({ data: null, error: 'Network error' });
        const alertSpy = jest.spyOn(require('react-native').Alert, 'alert');
        const { result } = renderHook(() => useActivityLog(defaultParams));

        act(() => {
            result.current.setAfycInput('5000');
        });

        await act(async () => {
            await result.current.handleLogCaseClosed();
        });

        expect(alertSpy).toHaveBeenCalledWith('Failed', 'Could not log case closed.');
        expect(result.current.loggingActivity).toBe(false);
    });

    it('setters for log time work', () => {
        const { result } = renderHook(() => useActivityLog(defaultParams));

        act(() => {
            result.current.setLogHour(5);
            result.current.setLogMinuteIdx(3);
            result.current.setLogAmPm(1);
        });

        expect(result.current.logHour).toBe(5);
        expect(result.current.logMinuteIdx).toBe(3);
        expect(result.current.logAmPm).toBe(1);
    });

    it('confirmActivity and showAfycSheet can be set', () => {
        const { result } = renderHook(() => useActivityLog(defaultParams));

        act(() => result.current.setConfirmActivity('sitdown'));
        expect(result.current.confirmActivity).toBe('sitdown');

        act(() => result.current.setShowAfycSheet(true));
        expect(result.current.showAfycSheet).toBe(true);
    });

    it('computes myCounts from activities', () => {
        const activitiesWithData = [
            {
                id: '1',
                event_id: 'e1',
                user_id: 'user1',
                type: 'sitdown',
                afyc_amount: null,
                logged_at: '',
                full_name: 'Test',
            },
            {
                id: '2',
                event_id: 'e1',
                user_id: 'user1',
                type: 'sitdown',
                afyc_amount: null,
                logged_at: '',
                full_name: 'Test',
            },
            {
                id: '3',
                event_id: 'e1',
                user_id: 'user1',
                type: 'pitch',
                afyc_amount: null,
                logged_at: '',
                full_name: 'Test',
            },
            {
                id: '4',
                event_id: 'e1',
                user_id: 'user1',
                type: 'case_closed',
                afyc_amount: 500,
                logged_at: '',
                full_name: 'Test',
            },
            {
                id: '5',
                event_id: 'e1',
                user_id: 'other',
                type: 'sitdown',
                afyc_amount: null,
                logged_at: '',
                full_name: 'Other',
            },
        ] as any[];

        const { result } = renderHook(() => useActivityLog({ ...defaultParams, activities: activitiesWithData }));

        expect(result.current.myCounts).toEqual({
            sitdowns: 2,
            pitches: 1,
            closed: 1,
            afyc: 500,
        });
    });
});
