import { assembleEventDates, isDeviceCalendarAvailable, addEventToDeviceCalendar } from '@/lib/deviceCalendar';

const mockRequestPermissions = jest.fn();
const mockGetDefaultCalendar = jest.fn();
const mockGetCalendars = jest.fn();
const mockCreateEvent = jest.fn();

// loadModule probes the native registry via requireOptionalNativeModule BEFORE
// importing the expo-calendar wrapper (native-crash guard for OTA'd old binaries).
// Mock it so we control whether the ExpoCalendar native module "exists".
const mockRequireOptionalNativeModule = jest.fn();
jest.mock('expo-modules-core', () => ({
    requireOptionalNativeModule: (...a: unknown[]) => mockRequireOptionalNativeModule(...a),
}));
jest.mock('expo-calendar', () => ({
    EntityTypes: { EVENT: 'event' },
    requestCalendarPermissionsAsync: (...a: unknown[]) => mockRequestPermissions(...a),
    getDefaultCalendarAsync: (...a: unknown[]) => mockGetDefaultCalendar(...a),
    getCalendarsAsync: (...a: unknown[]) => mockGetCalendars(...a),
    createEventAsync: (...a: unknown[]) => mockCreateEvent(...a),
    deleteEventAsync: jest.fn(),
}));

const BASE_EVENT = {
    id: 'evt-1',
    title: 'AMK Roadshow',
    description: 'Booth duty',
    event_date: '2026-07-15',
    start_time: '09:00:00',
    end_time: '17:30:00',
    location: 'AMK Hub',
};

beforeEach(() => {
    jest.clearAllMocks();
    // Default: the ExpoCalendar native module is present (post-1.5.1 binary).
    mockRequireOptionalNativeModule.mockReturnValue({});
    mockRequestPermissions.mockResolvedValue({ status: 'granted' });
    mockGetDefaultCalendar.mockResolvedValue({ id: 'cal-1' });
    mockCreateEvent.mockResolvedValue('native-123');
});

describe('isDeviceCalendarAvailable — OTA-safety on pre-expo-calendar binaries', () => {
    it('returns false when the native ExpoCalendar module is absent (the old-binary crash scenario)', () => {
        // OTA'd binary built before expo-calendar: native module missing. loadModule
        // must bail via the safe probe and NOT import the wrapper (whose top-level
        // requireNativeModule would native-crash, uncatchable, unseen by Sentry).
        mockRequireOptionalNativeModule.mockReturnValue(null);
        expect(isDeviceCalendarAvailable()).toBe(false);
    });

    it('probes the ExpoCalendar native module by name before touching the wrapper', () => {
        isDeviceCalendarAvailable();
        expect(mockRequireOptionalNativeModule).toHaveBeenCalledWith('ExpoCalendar');
    });

    it('is available when the native module is present', () => {
        expect(isDeviceCalendarAvailable()).toBe(true);
    });
});

describe('assembleEventDates', () => {
    it('builds local-time start/end from date + HH:MM:SS strings', () => {
        const { start, end } = assembleEventDates('2026-07-15', '09:00:00', '17:30:00');
        expect(start.getFullYear()).toBe(2026);
        expect(start.getMonth()).toBe(6);
        expect(start.getDate()).toBe(15);
        expect(start.getHours()).toBe(9);
        expect(start.getMinutes()).toBe(0);
        expect(end.getHours()).toBe(17);
        expect(end.getMinutes()).toBe(30);
    });

    it('defaults a missing end time to one hour', () => {
        const { start, end } = assembleEventDates('2026-07-15', '09:00', null);
        expect(end.getTime() - start.getTime()).toBe(60 * 60 * 1000);
    });
});

describe('addEventToDeviceCalendar', () => {
    it('creates the native event with a 1h reminder and remembers the id', async () => {
        const { nativeId, error } = await addEventToDeviceCalendar(BASE_EVENT);

        expect(error).toBeNull();
        expect(nativeId).toBe('native-123');
        const [calendarId, details] = mockCreateEvent.mock.calls[0];
        expect(calendarId).toBe('cal-1');
        expect(details.title).toBe('AMK Roadshow');
        expect(details.location).toBe('AMK Hub');
        expect(details.alarms).toEqual([{ relativeOffset: -60 }]);
    });

    it('surfaces a friendly error when permission is declined', async () => {
        mockRequestPermissions.mockResolvedValue({ status: 'denied' });

        const { nativeId, error } = await addEventToDeviceCalendar(BASE_EVENT);
        expect(nativeId).toBeNull();
        expect(error).toBe('Calendar permission was declined');
        expect(mockCreateEvent).not.toHaveBeenCalled();
    });

    it('falls back to the first writable calendar when no default exists', async () => {
        mockGetDefaultCalendar.mockRejectedValue(new Error('not supported'));
        mockGetCalendars.mockResolvedValue([
            { id: 'ro-cal', allowsModifications: false },
            { id: 'rw-cal', allowsModifications: true },
        ]);

        const { nativeId } = await addEventToDeviceCalendar(BASE_EVENT);
        expect(nativeId).toBe('native-123');
        expect(mockCreateEvent.mock.calls[0][0]).toBe('rw-cal');
    });
});
