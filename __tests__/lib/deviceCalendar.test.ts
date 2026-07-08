import { assembleEventDates, isDeviceCalendarAvailable, addEventToDeviceCalendar } from '@/lib/deviceCalendar';

// expo-calendar is lazy-required by the lib; mock it per-file so the
// native-module probe succeeds in tests.
const mockRequestPermissions = jest.fn();
const mockGetDefaultCalendar = jest.fn();
const mockGetCalendars = jest.fn();
const mockCreateEvent = jest.fn();
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
    mockRequestPermissions.mockResolvedValue({ status: 'granted' });
    mockGetDefaultCalendar.mockResolvedValue({ id: 'cal-1' });
    mockCreateEvent.mockResolvedValue('native-123');
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

describe('calendar feature kill-switch (disabled — see deviceCalendar header)', () => {
    it('reports unavailable so AddToCalendarRow renders nothing', () => {
        expect(isDeviceCalendarAvailable()).toBe(false);
    });

    it('no-ops addEventToDeviceCalendar WITHOUT touching the native module', async () => {
        // The whole point of the kill-switch: while disabled, expo-calendar is
        // never loaded or called, so the native MissingCalendarPListValueException
        // (1.5.0 build crash, Sentry APPLE-IOS-6) and the missing-module crash
        // (1.4.0 builds) cannot happen.
        const { nativeId, error } = await addEventToDeviceCalendar(BASE_EVENT);
        expect(nativeId).toBeNull();
        expect(error).toMatch(/not available/i);
        expect(mockRequestPermissions).not.toHaveBeenCalled();
        expect(mockGetDefaultCalendar).not.toHaveBeenCalled();
        expect(mockGetCalendars).not.toHaveBeenCalled();
        expect(mockCreateEvent).not.toHaveBeenCalled();
    });
});

// NOTE: the enabled-flow tests (permission grant/deny, default-vs-writable
// calendar selection, 1h reminder) were removed with the kill-switch. Restore
// them in the PR that flips CALENDAR_FEATURE_ENABLED back to true alongside the
// 1.5.1 Info.plist fix.
