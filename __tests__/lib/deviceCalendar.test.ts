import { assembleEventDates, isDeviceCalendarAvailable, addEventToDeviceCalendar } from '@/lib/deviceCalendar';

// expo-calendar was REMOVED from the app (2026-07-10): its ExpoCalendar native module
// fatally checked NSCalendarsFullAccessUsageDescription at startup and that plist key
// would not land in EAS builds (Sentry APPLE-IOS-6 — 1.5.0/1.5.1/1.5.2 all crash-looped).
// The lib is now inert no-ops; these tests pin that it never touches a calendar module.

const BASE_EVENT = {
    id: 'evt-1',
    title: 'AMK Roadshow',
    description: 'Booth duty',
    event_date: '2026-07-15',
    start_time: '09:00:00',
    end_time: '17:30:00',
    location: 'AMK Hub',
};

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

describe('calendar feature removed — inert no-ops', () => {
    it('reports unavailable so AddToCalendarRow renders nothing', () => {
        expect(isDeviceCalendarAvailable()).toBe(false);
    });

    it('addEventToDeviceCalendar returns the not-available result (no native call)', async () => {
        const { nativeId, error } = await addEventToDeviceCalendar(BASE_EVENT);
        expect(nativeId).toBeNull();
        expect(error).toMatch(/not available/i);
    });
});
