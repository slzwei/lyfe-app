import { renderHook, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useInterviewScheduler } from '@/hooks/useInterviewScheduler';
import type { Interview } from '@/types/recruitment';

jest.mock('@/lib/supabase');
jest.mock('@/lib/recruitment', () => ({
    scheduleInterview: jest.fn().mockResolvedValue({
        data: {
            id: 'iv_new',
            candidate_id: 'c1',
            manager_id: 'm1',
            scheduled_by_id: 'u1',
            round_number: 1,
            type: 'zoom',
            datetime: '2026-04-01T10:00:00.000Z',
            location: null,
            zoom_link: null,
            google_calendar_event_id: null,
            status: 'scheduled',
            notes: null,
            recommendation: null,
            created_at: '2026-03-09T00:00:00.000Z',
        },
        error: null,
    }),
    updateInterview: jest.fn().mockResolvedValue({
        data: {
            id: 'iv_1',
            candidate_id: 'c1',
            manager_id: 'm1',
            scheduled_by_id: 'u1',
            round_number: 1,
            type: 'in_person',
            datetime: '2026-04-02T14:00:00.000Z',
            location: 'Office',
            zoom_link: null,
            google_calendar_event_id: null,
            status: 'scheduled',
            notes: null,
            recommendation: null,
            created_at: '2026-03-09T00:00:00.000Z',
        },
        error: null,
    }),
    deleteInterview: jest.fn().mockResolvedValue({ error: null }),
}));

const { scheduleInterview, updateInterview, deleteInterview } = require('@/lib/recruitment');

const mockInterview: Interview = {
    id: 'iv_1',
    candidate_id: 'c1',
    manager_id: 'm1',
    scheduled_by_id: 'u1',
    round_number: 1,
    type: 'zoom',
    datetime: '2026-04-01T10:00:00.000Z',
    location: null,
    zoom_link: 'https://zoom.us/j/123',
    google_calendar_event_id: null,
    status: 'scheduled',
    notes: 'Test notes',
    recommendation: null,
    created_at: '2026-03-09T00:00:00.000Z',
};

const defaultParams = {
    candidateId: 'c1',
    candidateManagerId: 'm1',
    candidateInterviewCount: 0,
    userId: 'u1',
    onInterviewChanged: jest.fn(),
};

describe('useInterviewScheduler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('initializes with default state', () => {
        const { result } = renderHook(() => useInterviewScheduler(defaultParams));
        expect(result.current.showScheduleSheet).toBe(false);
        expect(result.current.editingInterview).toBeNull();
        expect(result.current.scheduleType).toBe('zoom');
        expect(result.current.scheduleAmPm).toBe('AM');
        expect(result.current.isScheduling).toBe(false);
        expect(result.current.scheduleError).toBeNull();
        expect(result.current.scheduleRecommendation).toBeNull();
    });

    it('openNewInterview resets form state and opens sheet', () => {
        const { result } = renderHook(() => useInterviewScheduler(defaultParams));
        // First edit an interview to change state
        act(() => result.current.openEditInterview(mockInterview));
        expect(result.current.editingInterview).toBe(mockInterview);

        // Now open a new interview — should reset
        act(() => result.current.openNewInterview());
        expect(result.current.showScheduleSheet).toBe(true);
        expect(result.current.editingInterview).toBeNull();
        expect(result.current.scheduleType).toBe('zoom');
        expect(result.current.scheduleLink).toBe('');
        expect(result.current.scheduleNotes).toBe('');
        expect(result.current.scheduleHour).toBe(10);
        expect(result.current.scheduleMinute).toBe(0);
        expect(result.current.scheduleAmPm).toBe('AM');
    });

    it('openEditInterview populates from existing interview', () => {
        const { result } = renderHook(() => useInterviewScheduler(defaultParams));
        act(() => result.current.openEditInterview(mockInterview));

        expect(result.current.showScheduleSheet).toBe(true);
        expect(result.current.editingInterview).toBe(mockInterview);
        expect(result.current.scheduleType).toBe('zoom');
        expect(result.current.scheduleLink).toBe('https://zoom.us/j/123');
        expect(result.current.scheduleNotes).toBe('Test notes');
        expect(result.current.scheduleStatus).toBe('scheduled');
    });

    it('submitSchedule calls scheduleInterview for new interview', async () => {
        // Use a future date to avoid the "past date" alert
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7);

        const { result } = renderHook(() => useInterviewScheduler(defaultParams));
        act(() => result.current.openNewInterview());
        act(() => result.current.setScheduleDate(futureDate));

        await act(async () => {
            await result.current.handleSubmitSchedule();
        });

        expect(scheduleInterview).toHaveBeenCalledWith(
            expect.objectContaining({
                candidateId: 'c1',
                managerId: 'm1',
                scheduledById: 'u1',
                roundNumber: 1,
                type: 'zoom',
            }),
        );
        expect(defaultParams.onInterviewChanged).toHaveBeenCalledWith('created', expect.any(Object));
    });

    it('handleDeleteInterview calls deleteInterview', async () => {
        const onChanged = jest.fn();
        const { result } = renderHook(() => useInterviewScheduler({ ...defaultParams, onInterviewChanged: onChanged }));

        const alertSpy = jest.spyOn(Alert, 'alert');
        act(() => result.current.handleDeleteInterview(mockInterview));

        expect(alertSpy).toHaveBeenCalledWith(
            'Delete Interview',
            expect.stringContaining('Round 1'),
            expect.any(Array),
        );

        // Simulate pressing "Delete" (now async — awaits deleteInterview before calling onChanged)
        const deleteBtn = alertSpy.mock.calls[0][2]!.find((b: any) => b.text === 'Delete');
        await act(async () => deleteBtn!.onPress!());

        expect(deleteInterview).toHaveBeenCalledWith('iv_1');
        expect(onChanged).toHaveBeenCalledWith('deleted', mockInterview);
    });

    it('dismissScheduleSheet shows alert when editing', () => {
        const { result } = renderHook(() => useInterviewScheduler(defaultParams));
        act(() => result.current.openEditInterview(mockInterview));

        const alertSpy = jest.spyOn(Alert, 'alert');
        act(() => result.current.dismissScheduleSheet());

        expect(alertSpy).toHaveBeenCalledWith('Discard changes?', expect.any(String), expect.any(Array));
    });

    it('dismissScheduleSheet closes directly when not editing', () => {
        const { result } = renderHook(() => useInterviewScheduler(defaultParams));
        act(() => result.current.openNewInterview());
        expect(result.current.showScheduleSheet).toBe(true);

        act(() => result.current.dismissScheduleSheet());
        expect(result.current.showScheduleSheet).toBe(false);
    });

    it('closeScheduleSheet resets form and closes sheet', () => {
        const { result } = renderHook(() => useInterviewScheduler(defaultParams));
        act(() => result.current.openEditInterview(mockInterview));
        expect(result.current.showScheduleSheet).toBe(true);
        expect(result.current.editingInterview).toBe(mockInterview);

        act(() => result.current.closeScheduleSheet());
        expect(result.current.showScheduleSheet).toBe(false);
        expect(result.current.editingInterview).toBeNull();
        expect(result.current.scheduleType).toBe('zoom');
    });

    it('handleSubmitSchedule validates zoom link format', async () => {
        const { result } = renderHook(() => useInterviewScheduler(defaultParams));
        act(() => result.current.openNewInterview());

        act(() => {
            result.current.setScheduleLink('not-a-url');
        });

        await act(async () => {
            await result.current.handleSubmitSchedule();
        });

        expect(result.current.scheduleError).toBe('Zoom link must start with http:// or https://');
    });

    it('handleSubmitSchedule accepts empty zoom link', async () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7);

        const { result } = renderHook(() => useInterviewScheduler(defaultParams));
        act(() => result.current.openNewInterview());
        act(() => {
            result.current.setScheduleDate(futureDate);
            result.current.setScheduleLink('');
        });

        await act(async () => {
            await result.current.handleSubmitSchedule();
        });

        expect(scheduleInterview).toHaveBeenCalled();
    });

    it('handleSubmitSchedule sets error when not authenticated', async () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7);

        const { result } = renderHook(() => useInterviewScheduler({ ...defaultParams, userId: undefined }));
        act(() => result.current.openNewInterview());
        act(() => result.current.setScheduleDate(futureDate));

        await act(async () => {
            await result.current.handleSubmitSchedule();
        });

        expect(result.current.scheduleError).toBe('Not authenticated');
    });

    it('handleSubmitSchedule calls updateInterview when editing', async () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7);

        const onChanged = jest.fn();
        const { result } = renderHook(() => useInterviewScheduler({ ...defaultParams, onInterviewChanged: onChanged }));

        // Open edit mode with the mock interview
        act(() => result.current.openEditInterview(mockInterview));

        // Set a future date to avoid past-date alert
        act(() => {
            result.current.setScheduleDate(futureDate);
            result.current.setScheduleType('in_person');
            result.current.setScheduleLocation('Office');
        });

        await act(async () => {
            await result.current.handleSubmitSchedule();
        });

        expect(updateInterview).toHaveBeenCalledWith(
            'iv_1',
            expect.objectContaining({
                type: 'in_person',
                location: 'Office',
            }),
        );
        expect(onChanged).toHaveBeenCalledWith('updated', expect.any(Object));
    });

    it('handleSubmitSchedule sets error when update fails', async () => {
        updateInterview.mockResolvedValueOnce({ data: null, error: 'Update failed' });
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7);

        const { result } = renderHook(() => useInterviewScheduler(defaultParams));
        act(() => result.current.openEditInterview(mockInterview));
        act(() => result.current.setScheduleDate(futureDate));

        await act(async () => {
            await result.current.handleSubmitSchedule();
        });

        expect(result.current.scheduleError).toBe('Update failed');
    });

    it('handleSubmitSchedule sets error when schedule fails', async () => {
        scheduleInterview.mockResolvedValueOnce({ data: null, error: 'Schedule failed' });
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7);

        const { result } = renderHook(() => useInterviewScheduler(defaultParams));
        act(() => result.current.openNewInterview());
        act(() => result.current.setScheduleDate(futureDate));

        await act(async () => {
            await result.current.handleSubmitSchedule();
        });

        expect(result.current.scheduleError).toBe('Schedule failed');
    });

    it('handleSubmitSchedule shows alert for past date', async () => {
        const alertSpy = jest.spyOn(Alert, 'alert');
        const pastDate = new Date('2020-01-01T10:00:00');

        const { result } = renderHook(() => useInterviewScheduler(defaultParams));
        act(() => result.current.openNewInterview());
        act(() => result.current.setScheduleDate(pastDate));

        await act(async () => {
            await result.current.handleSubmitSchedule();
        });

        expect(alertSpy).toHaveBeenCalledWith('Date in the past', expect.any(String), expect.any(Array));
    });

    it('openEditInterview handles PM time correctly', () => {
        const pmInterview: Interview = {
            ...mockInterview,
            datetime: '2026-04-01T14:30:00.000Z', // 2 PM
        };

        const { result } = renderHook(() => useInterviewScheduler(defaultParams));
        act(() => result.current.openEditInterview(pmInterview));

        expect(result.current.scheduleAmPm).toBe('PM');
    });

    it('openEditInterview parses datetime and populates fields', () => {
        // Use a known datetime that will parse consistently
        const dt = new Date(2026, 3, 1, 14, 30); // April 1, 2026 2:30 PM local
        const interview: Interview = {
            ...mockInterview,
            datetime: dt.toISOString(),
        };

        const { result } = renderHook(() => useInterviewScheduler(defaultParams));
        act(() => result.current.openEditInterview(interview));

        expect(result.current.scheduleHour).toBe(2); // 2 PM -> h12=2
        expect(result.current.scheduleAmPm).toBe('PM');
        expect(result.current.scheduleMinute).toBe(30);
    });

    it('openEditInterview handles AM time correctly', () => {
        const dt = new Date(2026, 3, 1, 9, 15); // 9:15 AM local
        const interview: Interview = {
            ...mockInterview,
            datetime: dt.toISOString(),
        };

        const { result } = renderHook(() => useInterviewScheduler(defaultParams));
        act(() => result.current.openEditInterview(interview));

        expect(result.current.scheduleHour).toBe(9);
        expect(result.current.scheduleAmPm).toBe('AM');
        expect(result.current.scheduleMinute).toBe(15);
    });

    it('setters update state', () => {
        const { result } = renderHook(() => useInterviewScheduler(defaultParams));

        act(() => {
            result.current.setScheduleHour(3);
            result.current.setScheduleMinute(30);
            result.current.setScheduleAmPm('PM');
            result.current.setScheduleType('in_person');
            result.current.setScheduleLink('https://zoom.us');
            result.current.setScheduleLocation('Room A');
            result.current.setScheduleNotes('Some notes');
            result.current.setScheduleStatus('completed');
            result.current.setScheduleRecommendation('second_interview');
        });

        expect(result.current.scheduleHour).toBe(3);
        expect(result.current.scheduleMinute).toBe(30);
        expect(result.current.scheduleAmPm).toBe('PM');
        expect(result.current.scheduleType).toBe('in_person');
        expect(result.current.scheduleLink).toBe('https://zoom.us');
        expect(result.current.scheduleLocation).toBe('Room A');
        expect(result.current.scheduleNotes).toBe('Some notes');
        expect(result.current.scheduleStatus).toBe('completed');
        expect(result.current.scheduleRecommendation).toBe('second_interview');
    });

    it('openEditInterview populates recommendation from existing interview', () => {
        const interviewWithRec: Interview = {
            ...mockInterview,
            recommendation: 'on_hold',
        };
        const { result } = renderHook(() => useInterviewScheduler(defaultParams));
        act(() => result.current.openEditInterview(interviewWithRec));

        expect(result.current.scheduleRecommendation).toBe('on_hold');
    });

    it('recommendation resets to null on openNewInterview', () => {
        const interviewWithRec: Interview = {
            ...mockInterview,
            recommendation: 'pass',
        };
        const { result } = renderHook(() => useInterviewScheduler(defaultParams));
        act(() => result.current.openEditInterview(interviewWithRec));
        expect(result.current.scheduleRecommendation).toBe('pass');

        act(() => result.current.openNewInterview());
        expect(result.current.scheduleRecommendation).toBeNull();
    });

    it('handleSubmitSchedule with in_person type passes location not link', async () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7);

        const { result } = renderHook(() => useInterviewScheduler(defaultParams));
        act(() => result.current.openNewInterview());
        act(() => {
            result.current.setScheduleDate(futureDate);
            result.current.setScheduleType('in_person');
            result.current.setScheduleLocation('Office');
            result.current.setScheduleLink('https://zoom.us/j/123');
        });

        await act(async () => {
            await result.current.handleSubmitSchedule();
        });

        expect(scheduleInterview).toHaveBeenCalledWith(
            expect.objectContaining({
                location: 'Office',
                zoomLink: null,
            }),
        );
    });

    it('handleSubmitSchedule converts 12 AM to hour 0', async () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7);

        const { result } = renderHook(() => useInterviewScheduler(defaultParams));
        act(() => result.current.openNewInterview());
        act(() => {
            result.current.setScheduleDate(futureDate);
            result.current.setScheduleHour(12);
            result.current.setScheduleAmPm('AM');
        });

        await act(async () => {
            await result.current.handleSubmitSchedule();
        });

        // The datetime should have hour 0
        expect(scheduleInterview).toHaveBeenCalled();
    });
});
