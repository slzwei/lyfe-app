/**
 * Add-to-device-calendar — REMOVED 2026-07-10.
 *
 * expo-calendar was uninstalled from the app. Its ExpoCalendar native module fatally
 * checks NSCalendarsFullAccessUsageDescription (iOS 17+) at STARTUP — below the JS
 * layer — and that plist key would not land in EAS builds, so every build that shipped
 * the module crash-looped on launch (Sentry APPLE-IOS-6: 1.5.0 build 33, 1.5.1 build 34,
 * 1.5.2 build 35). A JS feature flag could not stop it because the crash is in the native
 * module, not the JS. The only certain fix was to remove the native module from the binary.
 *
 * These functions are kept as inert no-ops so callers (AddToCalendarRow) still compile
 * and render nothing. To re-add the feature: reinstall expo-calendar, then VERIFY the
 * built .ipa's Info.plist actually contains NSCalendarsFullAccessUsageDescription
 * (extract + inspect the artifact) BEFORE any production release.
 */

/** Always false — the calendar feature is removed. */
export function isDeviceCalendarAvailable(): boolean {
    return false;
}

/**
 * Build local-time start/end Dates from an event's date + HH:MM(:SS) strings.
 * No end time → one hour. Pure helper, kept for reuse + tests.
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

/** No-op — the feature is removed. */
export async function getDeviceCalendarId(_eventId?: string): Promise<string | null> {
    return null;
}

/** No-op — the feature is removed. */
export async function addEventToDeviceCalendar(_event?: unknown): Promise<{ nativeId: string | null; error: string | null }> {
    return { nativeId: null, error: 'Calendar is not available in this app version' };
}

/** No-op — the feature is removed. */
export async function removeEventFromDeviceCalendar(_eventId?: string): Promise<{ error: string | null }> {
    return { error: null };
}
