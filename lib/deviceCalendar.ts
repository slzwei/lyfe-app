/**
 * Add-to-device-calendar via expo-calendar.
 *
 * OTA-safety contract (review-mandated): expo-calendar is NEVER imported at
 * module top level. The native module only exists in binaries built after
 * 2026-07; OTA-updated older binaries would crash on a static import. Every
 * entry point lazy-requires inside try/catch and callers hide the feature
 * when `isDeviceCalendarAvailable()` is false.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AgencyEvent } from '@/types/event';

const STORAGE_KEY = '@device_calendar_event_ids';
const REMINDER_MINUTES_BEFORE = 60;

type ExpoCalendarModule = typeof import('expo-calendar');

function loadModule(): ExpoCalendarModule | null {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require('expo-calendar') as ExpoCalendarModule;
        // Touching a constant forces the native-module lookup on some
        // platforms, so absence surfaces here instead of mid-flow.
        void mod.EntityTypes;
        return mod;
    } catch {
        return null;
    }
}

/** False on binaries that predate the expo-calendar native module. */
export function isDeviceCalendarAvailable(): boolean {
    return loadModule() !== null;
}

/**
 * Build local-time start/end Dates from an event's date + HH:MM(:SS)
 * strings. No end time → one hour. Exported for tests.
 */
export function assembleEventDates(
    eventDate: string,
    startTime: string,
    endTime: string | null,
): { start: Date; end: Date } {
    const [y, m, d] = eventDate.split('-').map(Number);
    const [sh, sm] = startTime.split(':').map(Number);
    const start = new Date(y, m - 1, d, sh, sm, 0);
    let end: Date;
    if (endTime) {
        const [eh, em] = endTime.split(':').map(Number);
        end = new Date(y, m - 1, d, eh, em, 0);
    } else {
        end = new Date(start.getTime() + 60 * 60 * 1000);
    }
    return { start, end };
}

async function readIdMap(): Promise<Record<string, string>> {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as Record<string, string>) : {};
    } catch {
        return {};
    }
}

async function writeIdMap(map: Record<string, string>): Promise<void> {
    try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {
        // best-effort — losing the map only loses the "Added ✓" state
    }
}

/** Native calendar event id previously created for this Lyfe event, if any. */
export async function getDeviceCalendarId(eventId: string): Promise<string | null> {
    const map = await readIdMap();
    return map[eventId] ?? null;
}

/**
 * Write the event into the user's default (or first writable) calendar
 * with a 1-hour-before alarm. Returns the native event id, or an error
 * string for the caller to surface.
 */
export async function addEventToDeviceCalendar(
    event: Pick<AgencyEvent, 'id' | 'title' | 'description' | 'event_date' | 'start_time' | 'end_time' | 'location'>,
): Promise<{ nativeId: string | null; error: string | null }> {
    const Calendar = loadModule();
    if (!Calendar) return { nativeId: null, error: 'Calendar is not available in this app version' };

    try {
        const { status } = await Calendar.requestCalendarPermissionsAsync();
        if (status !== 'granted') {
            return { nativeId: null, error: 'Calendar permission was declined' };
        }

        let calendarId: string | undefined;
        try {
            const defaultCal = await Calendar.getDefaultCalendarAsync();
            calendarId = defaultCal?.id;
        } catch {
            // Android has no default-calendar API on some versions — fall through
        }
        if (!calendarId) {
            const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
            calendarId = calendars.find((c) => c.allowsModifications)?.id;
        }
        if (!calendarId) return { nativeId: null, error: 'No writable calendar found on this device' };

        const { start, end } = assembleEventDates(event.event_date, event.start_time, event.end_time);
        const nativeId = await Calendar.createEventAsync(calendarId, {
            title: event.title,
            startDate: start,
            endDate: end,
            location: event.location ?? undefined,
            notes: event.description ?? undefined,
            alarms: [{ relativeOffset: -REMINDER_MINUTES_BEFORE }],
        });

        const map = await readIdMap();
        map[event.id] = nativeId;
        await writeIdMap(map);

        return { nativeId, error: null };
    } catch {
        return { nativeId: null, error: 'Could not add the event to your calendar' };
    }
}

/** Remove a previously added native event (best-effort) and forget it. */
export async function removeEventFromDeviceCalendar(eventId: string): Promise<{ error: string | null }> {
    const Calendar = loadModule();
    const map = await readIdMap();
    const nativeId = map[eventId];
    if (!nativeId) return { error: null };

    try {
        if (Calendar) await Calendar.deleteEventAsync(nativeId);
    } catch {
        // The user may have deleted it from their calendar app — forget it anyway
    }
    delete map[eventId];
    await writeIdMap(map);
    return { error: null };
}
