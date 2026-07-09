import { assembleEventDates, isDeviceCalendarAvailable, addEventToDeviceCalendar } from '@/lib/deviceCalendar';

// expo-calendar is mocked only so we can ASSERT it is never called while the
// feature kill-switch is off (CALENDAR_FEATURE_ENABLED=false). Disabled after the
// 1.5.1 build STILL crashed on iOS with MissingCalendarPListValueException — the
// feature is compiled out until a real build proves NSCalendarsFullAccessUsageDescription
// actually ships. Re-enable = flip the flag + restore the enabled-flow + guard tests.
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
        // The whole point of the kill-switch: while disabled, expo-calendar is never
        // loaded or called, so the native MissingCalendarPListValueException (Sentry
        // APPLE-IOS-6 — iOS 1.5.0 build 33 + 1.5.1 build 34) cannot happen.
        const { nativeId, error } = await addEventToDeviceCalendar(BASE_EVENT);
        expect(nativeId).toBeNull();
        expect(error).toMatch(/not available/i);
        expect(mockRequestPermissions).not.toHaveBeenCalled();
        expect(mockGetDefaultCalendar).not.toHaveBeenCalled();
        expect(mockGetCalendars).not.toHaveBeenCalled();
        expect(mockCreateEvent).not.toHaveBeenCalled();
    });
});

// NOTE: the enabled-flow tests (permission grant/deny, default-vs-writable calendar,
// 1h reminder) + the requireOptionalNativeModule guard tests were removed with the
// kill-switch. Restore them in the PR that flips CALENDAR_FEATURE_ENABLED back to true
// — and ONLY after a real build is verified to ship NSCalendarsFullAccessUsageDescription.
