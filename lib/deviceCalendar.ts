/**
 * Add-to-device-calendar via expo-calendar.
 *
 * OTA-safety + EMERGENCY KILL-SWITCH.
 *
 * DISABLED as of 2026-07-08: the shipped 1.5.0 iOS build (build 33) crashes at
 * launch with a fatal ExpoCalendar.MissingCalendarPListValueException — its
 * Info.plist is missing a required calendar usage-description key, so ANY touch of
 * the native module is an uncatchable native fatal (Sentry APPLE-IOS-6).
 * `CALENDAR_FEATURE_ENABLED` keeps every entry point from loading expo-calendar on
 * ALL binaries until a fixed native build ships (1.5.1: correct Info.plist + bumped
 * runtimeVersion). Re-enable by flipping the flag in that same build's PR.
 *
 * When re-enabled: expo-calendar is NEVER imported at module top level. On binaries
 * that predate the native module, `require('expo-calendar')` native-crashes (its
 * ExpoCalendar.js runs requireNativeModule at import), so we first probe the registry
 * with requireOptionalNativeModule (returns null, never crashes) and only import the
 * wrapper when the module is present.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AgencyEvent } from '@/types/event';

const STORAGE_KEY = '@device_calendar_event_ids';
const REMINDER_MINUTES_BEFORE = 60;

type ExpoCalendarModule = typeof import('expo-calendar');

// Emergency kill-switch — see file header. While false, NO code path loads or
// touches expo-calendar on any binary (stops the MissingCalendarPListValue crash
// on the 1.5.0 build AND the missing-module crash on 1.4.0 builds). Flip to true
// only in the native build that ships the Info.plist fix + runtimeVersion bump.
const CALENDAR_FEATURE_ENABLED = false;

function loadModule(): ExpoCalendarModule | null {
    if (!CALENDAR_FEATURE_ENABLED) return null;
    try {
        // Probe the native registry WITHOUT importing the wrapper — on binaries
        // lacking the module, require('expo-calendar') would native-crash;
        // requireOptionalNativeModule returns null instead.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const core = require('expo-modules-core') as {
            requireOptionalNativeModule?: (name: string) => unknown;
        };
        if (!core.requireOptionalNativeModule?.('ExpoCalendar')) return null;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        return require('expo-calendar') as ExpoCalendarModule;
    } catch {
        return null;
    }
}

/** False while the feature is disabled, or on binaries without the native module. */
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
