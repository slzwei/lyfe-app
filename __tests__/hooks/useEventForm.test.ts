import { renderHook, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEventForm } from '@/hooks/useEventForm';

jest.mock('@/lib/supabase');

const mockCreateEvent = jest.fn();
const mockUpdateEvent = jest.fn();
const mockCreateRoadshowBulk = jest.fn();
const mockFetchEventById = jest.fn();
const mockFetchRoadshowConfig = jest.fn();
const mockSaveRoadshowConfig = jest.fn();

jest.mock('@/lib/events', () => ({
    createEvent: (...args: any[]) => mockCreateEvent(...args),
    updateEvent: (...args: any[]) => mockUpdateEvent(...args),
    fetchEventById: (...args: any[]) => mockFetchEventById(...args),
    fetchAllUsers: jest.fn().mockResolvedValue({ data: [], error: null }),
}));

jest.mock('@/lib/roadshow', () => ({
    createRoadshowBulk: (...args: any[]) => mockCreateRoadshowBulk(...args),
    fetchRoadshowConfig: (...args: any[]) => mockFetchRoadshowConfig(...args),
    saveRoadshowConfig: (...args: any[]) => mockSaveRoadshowConfig(...args),
}));

// Real pure helpers on purpose — a hand-rolled dateRange mock once
// reimplemented the same UTC bug the real one had, hiding it from this
// suite. Only the clock-dependent todayLocalStr stays stubbed.
jest.mock('@/lib/dateTime', () => ({
    ...jest.requireActual('@/lib/dateTime'),
    todayLocalStr: () => '2026-03-09',
}));

jest.mock('@/constants/ui', () => ({
    PICKER_HOURS: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
    PICKER_MINUTES: ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'],
    AMPM: ['AM', 'PM'],
    pickerToHHMM24: (h: number, m: number, ampm: number) => {
        const hour = ampm === 0 ? (h + 1 === 12 ? 0 : h + 1) : h + 1 === 12 ? 12 : h + 13;
        return `${String(hour).padStart(2, '0')}:${String(m * 5).padStart(2, '0')}`;
    },
    hhmm24ToPickerState: (hhmm: string) => {
        const [h, m] = hhmm.split(':').map(Number);
        return { hour: (h % 12) - 1, minIdx: Math.floor(m / 5), ampm: h >= 12 ? 1 : 0 };
    },
    formatPickerTime: (h: number, m: number, ampm: number) => {
        return `${h + 1}:${String(m * 5).padStart(2, '0')} ${ampm === 0 ? 'AM' : 'PM'}`;
    },
}));

jest.mock('@/contexts/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 'user-1', role: 'manager' },
    }),
}));

const mockRouterBack = jest.fn();

describe('useEventForm', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (useLocalSearchParams as jest.Mock).mockReturnValue({});
        (useRouter as jest.Mock).mockReturnValue({
            push: jest.fn(),
            replace: jest.fn(),
            back: mockRouterBack,
        });
        mockCreateEvent.mockResolvedValue({ data: { id: 'new-event' }, error: null });
        mockUpdateEvent.mockResolvedValue({ data: { id: 'updated-event' }, error: null });
        mockCreateRoadshowBulk.mockResolvedValue({ data: null, error: null });
    });

    it('initializes with default state for new event', () => {
        const { result } = renderHook(() => useEventForm());
        expect(result.current.isEditing).toBe(false);
        expect(result.current.title).toBe('');
        expect(result.current.eventType).toBe('team_meeting');
        expect(result.current.eventDate).toBe('2026-03-09');
        expect(result.current.submitting).toBe(false);
        expect(result.current.loadingEvent).toBe(false);
        expect(result.current.errors).toEqual({});
    });

    it('validate returns false when title is empty', async () => {
        const { result } = renderHook(() => useEventForm());

        await act(async () => {
            await result.current.handleSubmit();
        });

        expect(result.current.errors.title).toBe('Title is required');
        expect(mockCreateEvent).not.toHaveBeenCalled();
    });

    it('handleSubmit creates a normal event', async () => {
        const { result } = renderHook(() => useEventForm());

        act(() => {
            result.current.setTitle('Team Standup');
            result.current.setLocation('Office');
            result.current.setDescription('Weekly standup');
        });

        await act(async () => {
            await result.current.handleSubmit();
        });

        expect(mockCreateEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'Team Standup',
                event_type: 'team_meeting',
                event_date: '2026-03-09',
                location: 'Office',
                description: 'Weekly standup',
            }),
            'user-1',
        );
        expect(mockRouterBack).toHaveBeenCalled();
    });

    it('handleSubmit sets error when createEvent fails', async () => {
        mockCreateEvent.mockResolvedValue({ data: null, error: 'Server error' });
        const { result } = renderHook(() => useEventForm());

        act(() => {
            result.current.setTitle('Failing Event');
        });

        await act(async () => {
            await result.current.handleSubmit();
        });

        expect(result.current.errors._submit).toBe('Server error');
        expect(result.current.submitting).toBe(false);
        expect(mockRouterBack).not.toHaveBeenCalled();
    });

    it('handleClearError clears specific error key', () => {
        const { result } = renderHook(() => useEventForm());

        // Trigger validation to set errors
        act(() => {
            result.current.handleSubmit();
        });

        act(() => {
            result.current.handleClearError('title');
        });

        expect(result.current.errors.title).toBe('');
    });

    it('handleCloseAttendeePicker resets picker state', () => {
        const { result } = renderHook(() => useEventForm());

        act(() => {
            result.current.handleCloseAttendeePicker();
        });

        expect(result.current.attendeePicker.showAttendeePicker).toBe(false);
        expect(result.current.attendeePicker.userSearch).toBe('');
        expect(result.current.attendeePicker.externalName).toBe('');
    });

    it('handleAddExternal does nothing when external name is empty', () => {
        const { result } = renderHook(() => useEventForm());
        const initialLen = result.current.attendeePicker.externalAttendees.length;

        act(() => {
            result.current.handleAddExternal();
        });

        expect(result.current.attendeePicker.externalAttendees.length).toBe(initialLen);
    });

    it('handleAddExternal adds external attendee', () => {
        const { result } = renderHook(() => useEventForm());

        act(() => {
            result.current.attendeePicker.setExternalName('External Person');
        });

        act(() => {
            result.current.handleAddExternal();
        });

        expect(result.current.attendeePicker.externalAttendees).toHaveLength(1);
        expect(result.current.attendeePicker.externalAttendees[0].name).toBe('External Person');
    });

    it('handleRemoveAttendee removes attendee by user_id', () => {
        const { result } = renderHook(() => useEventForm());

        // Add attendees via the picker
        act(() => {
            result.current.attendeePicker.setSelectedAttendees([
                { user_id: 'u1', full_name: 'Alice', role: 'agent', attendee_role: 'attendee' },
                { user_id: 'u2', full_name: 'Bob', role: 'agent', attendee_role: 'attendee' },
            ]);
        });

        act(() => {
            result.current.handleRemoveAttendee('u1');
        });

        expect(result.current.attendeePicker.selectedAttendees).toHaveLength(1);
        expect(result.current.attendeePicker.selectedAttendees[0].user_id).toBe('u2');
    });

    it('handleUpdateExternalRole updates role for external attendee', () => {
        const { result } = renderHook(() => useEventForm());

        act(() => {
            result.current.attendeePicker.setExternalAttendees([
                { _key: 'ext_1', name: 'Guest', attendee_role: 'attendee' },
            ]);
        });

        act(() => {
            result.current.handleUpdateExternalRole('ext_1', 'speaker');
        });

        expect(result.current.attendeePicker.externalAttendees[0].attendee_role).toBe('speaker');
    });

    it('handleRemoveExternal removes external attendee by key', () => {
        const { result } = renderHook(() => useEventForm());

        act(() => {
            result.current.attendeePicker.setExternalAttendees([
                { _key: 'ext_1', name: 'Guest', attendee_role: 'attendee' },
                { _key: 'ext_2', name: 'Guest 2', attendee_role: 'attendee' },
            ]);
        });

        act(() => {
            result.current.handleRemoveExternal('ext_1');
        });

        expect(result.current.attendeePicker.externalAttendees).toHaveLength(1);
        expect(result.current.attendeePicker.externalAttendees[0]._key).toBe('ext_2');
    });

    it('validate catches invalid event date', async () => {
        const { result } = renderHook(() => useEventForm());

        act(() => {
            result.current.setTitle('Valid Title');
            result.current.setEventDate('not-a-date');
        });

        await act(async () => {
            await result.current.handleSubmit();
        });

        expect(result.current.errors.eventDate).toBe('Enter a valid date (YYYY-MM-DD)');
    });

    it('validate catches roadshow validation errors', async () => {
        const { result } = renderHook(() => useEventForm());

        act(() => {
            result.current.setTitle('Roadshow');
            result.current.setEventType('roadshow');
        });

        // Set invalid roadshow config
        act(() => {
            result.current.roadshowCfg.setRsStartDate('not-a-date');
            result.current.roadshowCfg.setRsEndDate('not-a-date');
            result.current.roadshowCfg.setRsWeeklyCost('');
        });

        await act(async () => {
            await result.current.handleSubmit();
        });

        expect(result.current.errors.rsStartDate).toBe('Enter a valid start date (YYYY-MM-DD)');
        expect(result.current.errors.rsEndDate).toBe('Enter a valid end date (YYYY-MM-DD)');
        expect(result.current.errors.rsWeeklyCost).toBe('Enter a valid weekly cost');
    });

    it('validate catches roadshow end date before start date', async () => {
        const { result } = renderHook(() => useEventForm());

        act(() => {
            result.current.setTitle('Roadshow');
            result.current.setEventType('roadshow');
        });

        act(() => {
            result.current.roadshowCfg.setRsStartDate('2026-03-15');
            result.current.roadshowCfg.setRsEndDate('2026-03-10');
            result.current.roadshowCfg.setRsWeeklyCost('500');
        });

        await act(async () => {
            await result.current.handleSubmit();
        });

        expect(result.current.errors.rsEndDate).toBe('End date must be on or after start date');
    });

    it('setters update state correctly', () => {
        const { result } = renderHook(() => useEventForm());

        act(() => {
            result.current.setTitle('New Title');
            result.current.setEventType('training');
            result.current.setEventDate('2026-04-01');
            result.current.setLocation('Room A');
            result.current.setDescription('Training session');
            result.current.setShowDatePicker('single');
        });

        expect(result.current.title).toBe('New Title');
        expect(result.current.eventType).toBe('training');
        expect(result.current.eventDate).toBe('2026-04-01');
        expect(result.current.location).toBe('Room A');
        expect(result.current.description).toBe('Training session');
        expect(result.current.showDatePicker).toBe('single');
    });

    it('handleSubmit creates roadshow events for short range', async () => {
        const { result } = renderHook(() => useEventForm());

        act(() => {
            result.current.setTitle('Roadshow');
            result.current.setEventType('roadshow');
        });

        act(() => {
            result.current.roadshowCfg.setRsStartDate('2026-03-10');
            result.current.roadshowCfg.setRsEndDate('2026-03-12');
            result.current.roadshowCfg.setRsWeeklyCost('500');
        });

        await act(async () => {
            await result.current.handleSubmit();
        });

        expect(mockCreateRoadshowBulk).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({ event_date: '2026-03-10' }),
                expect.objectContaining({ event_date: '2026-03-11' }),
                expect.objectContaining({ event_date: '2026-03-12' }),
            ]),
            expect.objectContaining({
                weekly_cost: 500,
            }),
            expect.any(Array),
            'user-1',
        );
    });

    it('handleSubmit sets error when roadshow bulk create fails', async () => {
        mockCreateRoadshowBulk.mockResolvedValue({ data: null, error: 'Bulk create failed' });
        const { result } = renderHook(() => useEventForm());

        act(() => {
            result.current.setTitle('Roadshow');
            result.current.setEventType('roadshow');
        });

        act(() => {
            result.current.roadshowCfg.setRsStartDate('2026-03-10');
            result.current.roadshowCfg.setRsEndDate('2026-03-12');
            result.current.roadshowCfg.setRsWeeklyCost('500');
        });

        await act(async () => {
            await result.current.handleSubmit();
        });

        expect(result.current.errors._submit).toBe('Bulk create failed');
        expect(result.current.submitting).toBe(false);
    });

    it('handleSubmit shows confirmation for large roadshow (>14 days)', async () => {
        // Mock Alert.alert to auto-press "Cancel" so the Promise resolves
        const alertSpy = jest
            .spyOn(Alert, 'alert')
            .mockImplementation((title: string, message?: string, buttons?: any[]) => {
                const cancelBtn = buttons?.find((b: any) => b.text === 'Cancel');
                if (cancelBtn?.onPress) cancelBtn.onPress();
            });
        const { result } = renderHook(() => useEventForm());

        act(() => {
            result.current.setTitle('Long Roadshow');
            result.current.setEventType('roadshow');
        });

        act(() => {
            result.current.roadshowCfg.setRsStartDate('2026-03-01');
            result.current.roadshowCfg.setRsEndDate('2026-03-20');
            result.current.roadshowCfg.setRsWeeklyCost('500');
        });

        await act(async () => {
            await result.current.handleSubmit();
        });

        expect(alertSpy).toHaveBeenCalledWith(
            'Large Roadshow',
            expect.stringContaining('20 events'),
            expect.any(Array),
        );

        alertSpy.mockRestore();
    });

    it('handleSubmit trims whitespace from title and location', async () => {
        const { result } = renderHook(() => useEventForm());

        act(() => {
            result.current.setTitle('  Trimmed Event  ');
            result.current.setLocation('  Room B  ');
            result.current.setDescription('  Desc  ');
        });

        await act(async () => {
            await result.current.handleSubmit();
        });

        expect(mockCreateEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'Trimmed Event',
                location: 'Room B',
                description: 'Desc',
            }),
            'user-1',
        );
    });

    it('handleSubmit handles edit mode with updateEvent', async () => {
        (useLocalSearchParams as jest.Mock).mockReturnValue({ eventId: 'ev-123' });
        mockFetchEventById.mockResolvedValue({
            data: {
                id: 'ev-123',
                title: 'Existing Event',
                event_type: 'team_meeting',
                event_date: '2026-03-09',
                start_time: '09:00',
                end_time: null,
                location: 'Office',
                description: 'Existing description',
                attendees: [],
                external_attendees: [],
            },
        });

        const { result } = renderHook(() => useEventForm());

        // Wait for edit loading to complete
        await act(async () => {
            await new Promise((r) => setTimeout(r, 10));
        });

        expect(result.current.isEditing).toBe(true);

        act(() => {
            result.current.setTitle('Updated Title');
        });

        await act(async () => {
            await result.current.handleSubmit();
        });

        expect(mockUpdateEvent).toHaveBeenCalledWith('ev-123', expect.objectContaining({ title: 'Updated Title' }));
    });

    it('returns sub-hook objects', () => {
        const { result } = renderHook(() => useEventForm());
        expect(result.current.timePicker).toBeDefined();
        expect(result.current.attendeePicker).toBeDefined();
        expect(result.current.roadshowCfg).toBeDefined();
        expect(result.current.router).toBeDefined();
    });

    it('validate catches roadshow range exceeding 31 days', async () => {
        const { result } = renderHook(() => useEventForm());

        act(() => {
            result.current.setTitle('Roadshow');
            result.current.setEventType('roadshow');
        });

        act(() => {
            result.current.roadshowCfg.setRsStartDate('2026-03-01');
            result.current.roadshowCfg.setRsEndDate('2026-04-15');
            result.current.roadshowCfg.setRsWeeklyCost('500');
        });

        await act(async () => {
            await result.current.handleSubmit();
        });

        expect(result.current.errors.rsEndDate).toBe('Range cannot exceed 31 days');
    });

    it('validate catches slots < 1', async () => {
        const { result } = renderHook(() => useEventForm());

        act(() => {
            result.current.setTitle('Roadshow');
            result.current.setEventType('roadshow');
        });

        act(() => {
            result.current.roadshowCfg.setRsStartDate('2026-03-10');
            result.current.roadshowCfg.setRsEndDate('2026-03-12');
            result.current.roadshowCfg.setRsWeeklyCost('500');
            result.current.roadshowCfg.setRsSlots(0);
        });

        await act(async () => {
            await result.current.handleSubmit();
        });

        expect(result.current.errors.rsSlots).toBe('Slots must be at least 1');
    });

    it('handleSubmit saves roadshow config when editing a roadshow event', async () => {
        (useLocalSearchParams as jest.Mock).mockReturnValue({ eventId: 'ev-rs' });
        mockFetchEventById.mockResolvedValue({
            data: {
                id: 'ev-rs',
                title: 'Roadshow',
                event_type: 'roadshow',
                event_date: '2026-03-10',
                start_time: '09:00',
                end_time: '17:00',
                location: 'Mall',
                description: null,
                attendees: [],
                external_attendees: [],
            },
        });
        mockFetchRoadshowConfig.mockResolvedValue({
            data: {
                weekly_cost: 100,
                slots_per_day: 5,
                expected_start_time: '09:00',
                late_grace_minutes: 15,
                suggested_sitdowns: 3,
                suggested_pitches: 2,
                suggested_closed: 1,
            },
        });
        mockSaveRoadshowConfig.mockResolvedValue({ error: null });

        // Need to mock supabase for roadshow_attendance check
        const mockSupa = require('@/lib/supabase').supabase;
        mockSupa.__resetChains();
        const attChain = mockSupa.__getChain('roadshow_attendance');
        attChain.__resolveWith({ data: [], error: null });

        const { result } = renderHook(() => useEventForm());

        await act(async () => {
            await new Promise((r) => setTimeout(r, 50));
        });

        expect(result.current.isEditing).toBe(true);

        await act(async () => {
            await result.current.handleSubmit();
        });

        expect(mockUpdateEvent).toHaveBeenCalledWith('ev-rs', expect.objectContaining({ title: 'Roadshow' }));
        expect(mockSaveRoadshowConfig).toHaveBeenCalledWith(
            'ev-rs',
            expect.objectContaining({
                weekly_cost: 100,
                slots_per_day: 5,
            }),
        );
    });

    it('handleSubmit shows partial save alert when roadshow config save fails', async () => {
        const alertSpy = jest.spyOn(Alert, 'alert');
        (useLocalSearchParams as jest.Mock).mockReturnValue({ eventId: 'ev-rs' });
        mockFetchEventById.mockResolvedValue({
            data: {
                id: 'ev-rs',
                title: 'Roadshow',
                event_type: 'roadshow',
                event_date: '2026-03-10',
                start_time: '09:00',
                end_time: '17:00',
                location: 'Mall',
                description: null,
                attendees: [],
                external_attendees: [],
            },
        });
        mockFetchRoadshowConfig.mockResolvedValue({
            data: {
                weekly_cost: 100,
                slots_per_day: 5,
                expected_start_time: '09:00',
                late_grace_minutes: 15,
                suggested_sitdowns: 3,
                suggested_pitches: 2,
                suggested_closed: 1,
            },
        });
        mockSaveRoadshowConfig.mockResolvedValue({ error: 'Config save failed' });

        const mockSupa = require('@/lib/supabase').supabase;
        mockSupa.__resetChains();
        const attChain = mockSupa.__getChain('roadshow_attendance');
        attChain.__resolveWith({ data: [], error: null });

        const { result } = renderHook(() => useEventForm());

        await act(async () => {
            await new Promise((r) => setTimeout(r, 50));
        });

        await act(async () => {
            await result.current.handleSubmit();
        });

        expect(alertSpy).toHaveBeenCalledWith('Partial Save', expect.any(String));
    });

    it('loads roadshow config and detects locked state when attendance exists', async () => {
        (useLocalSearchParams as jest.Mock).mockReturnValue({ eventId: 'ev-locked' });
        mockFetchEventById.mockResolvedValue({
            data: {
                id: 'ev-locked',
                title: 'Locked Roadshow',
                event_type: 'roadshow',
                event_date: '2026-03-10',
                start_time: '09:00',
                end_time: '17:00',
                location: 'Mall',
                description: null,
                attendees: [],
                external_attendees: [],
            },
        });
        mockFetchRoadshowConfig.mockResolvedValue({
            data: {
                weekly_cost: 100,
                slots_per_day: 5,
                expected_start_time: '09:00',
                late_grace_minutes: 15,
                suggested_sitdowns: 3,
                suggested_pitches: 2,
                suggested_closed: 1,
            },
        });

        const mockSupa = require('@/lib/supabase').supabase;
        mockSupa.__resetChains();
        const attChain = mockSupa.__getChain('roadshow_attendance');
        attChain.__resolveWith({ data: [{ id: 'att-1' }], error: null }); // has attendance → locked

        const { result } = renderHook(() => useEventForm());

        await act(async () => {
            await new Promise((r) => setTimeout(r, 50));
        });

        expect(result.current.isEditing).toBe(true);
        expect(result.current.roadshowCfg.rsConfigLocked).toBe(true);
    });

    it('handleSubmit with empty description passes null', async () => {
        const { result } = renderHook(() => useEventForm());

        act(() => {
            result.current.setTitle('Event');
            result.current.setDescription('');
            result.current.setLocation('');
        });

        await act(async () => {
            await result.current.handleSubmit();
        });

        expect(mockCreateEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                description: null,
                location: null,
            }),
            'user-1',
        );
    });
});
