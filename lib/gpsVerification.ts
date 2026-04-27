/**
 * GPS proximity verification for roadshow check-in.
 *
 * Two layers:
 *   - checkProximity(lat, lng, radius) — low-level helper, takes raw coords
 *     and returns whether the device is within range. Used by tests and any
 *     future caller that already has the target coords.
 *   - checkEventProximity(eventId) — high-level helper, fetches the event's
 *     stored latitude / longitude / location_radius_meters from Supabase and
 *     calls checkProximity(). Returns the same structured result shape so
 *     callers (useCheckInFlow, FailedOverlay, etc.) can branch on a reason
 *     code without parsing strings.
 */
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { Sentry } from './sentry';
import { supabase } from './supabase';

// ── Types ──────────────────────────────────────────────────

export type ProximityFailReason =
    | 'no_location_set' // event.latitude / longitude is null (TBC)
    | 'permission_denied' // user declined the location permission prompt
    | 'location_unavailable' // GPS hardware / network failed
    | 'mocked_location' // Android fake-GPS app detected (prod only)
    | 'stale_fix' // OS returned a cached position too old to trust
    | 'out_of_range' // got a fix, but it's outside the radius
    | 'event_not_found'; // eventId doesn't resolve

// Maximum age of a position fix we'll trust. 60s is permissive on
// purpose — cold-start GPS legitimately takes 20–30s and we don't want
// to false-fail honest agents.
const MAX_FIX_AGE_MS = 60_000;

export type ProximityResult =
    | { ok: true; distanceMeters: number; requiredMeters: number }
    | {
          ok: false;
          reason: ProximityFailReason;
          message: string;
          distanceMeters?: number;
          requiredMeters?: number;
      };

// ── Low-level helper ───────────────────────────────────────

/**
 * Check if the device is within `radiusMetres` of (targetLat, targetLng).
 * Requests foreground location permission if not already granted.
 */
export async function checkProximity(
    targetLat: number,
    targetLng: number,
    radiusMetres: number,
): Promise<ProximityResult> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
        return {
            ok: false,
            reason: 'permission_denied',
            message: 'Location permission is required to check in. Enable it in Settings.',
            requiredMeters: radiusMetres,
        };
    }

    let fix: Location.LocationObject;
    try {
        // Balanced accuracy is ±20-50m on Android (network + sensor fusion,
        // no full GPS chip activation) — well within the default 100m
        // radius. Trades ~3-5m worst-case fix for a 5-10x faster first
        // fix and a noticeable battery win across a roadshow shift.
        // If a future event uses a tight (<50m) radius, override here.
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        try {
            fix = (await Promise.race([
                Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
                new Promise<never>((_, reject) => {
                    timeoutId = setTimeout(() => reject(new Error('GPS timeout')), 8000);
                }),
            ])) as Location.LocationObject;
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
        }
    } catch {
        return {
            ok: false,
            reason: 'location_unavailable',
            message: 'Could not determine your location. Move outside or near a window and try again.',
            requiredMeters: radiusMetres,
        };
    }

    const { coords, timestamp: fixTimestamp } = fix;

    // Mock-location detection — Android only, production only.
    // `coords.mocked` flips true when a fake-GPS app feeds the OS a
    // synthetic position. iOS doesn't expose this and doesn't permit
    // mocking without jailbreak. The field is missing from
    // expo-location's cross-platform type, so we widen the cast to
    // read it. We skip the check in dev because Android emulators
    // report mocked=true unconditionally, which would break every
    // internal test build.
    const isMocked = (coords as { mocked?: boolean }).mocked === true;
    if (!__DEV__ && Platform.OS === 'android' && isMocked) {
        return {
            ok: false,
            reason: 'mocked_location',
            message: 'Mock location detected. Disable any fake-GPS apps and try again.',
            requiredMeters: radiusMetres,
        };
    }

    // Staleness — the OS can return a cached fix from earlier in the
    // session (e.g. when the app is brought back from background with
    // poor signal). A fix older than 60s isn't a useful signal of
    // "the user is at the venue right now".
    if (fixTimestamp && Date.now() - fixTimestamp > MAX_FIX_AGE_MS) {
        return {
            ok: false,
            reason: 'stale_fix',
            message: 'Your location reading is too old. Try again with GPS enabled.',
            requiredMeters: radiusMetres,
        };
    }

    // Accuracy probe — log-only. We're collecting telemetry on the
    // real-world distribution of fix accuracy at roadshow venues
    // (often indoor: malls, MRT). When `coords.accuracy` (the device's
    // own reported error radius) exceeds the venue radius, the
    // proximity verdict is effectively measuring noise. Once Sentry
    // shows the 95th percentile staying under the radius, flip this
    // branch to return `low_accuracy` instead.
    if (coords.accuracy != null && coords.accuracy > radiusMetres) {
        Sentry.captureMessage('gps.low_accuracy', {
            level: 'warning',
            tags: { feature: 'gpsVerification', platform: Platform.OS },
            extra: {
                accuracyMeters: Math.round(coords.accuracy),
                radiusMeters: radiusMetres,
            },
        });
    }

    const distance = haversineDistance(coords.latitude, coords.longitude, targetLat, targetLng);
    const distanceMeters = Math.round(distance);

    if (distance <= radiusMetres) {
        return { ok: true, distanceMeters, requiredMeters: radiusMetres };
    }

    return {
        ok: false,
        reason: 'out_of_range',
        message: `You are ${distanceMeters}m from the venue. Move within ${radiusMetres}m to check in.`,
        distanceMeters,
        requiredMeters: radiusMetres,
    };
}

// ── High-level helper used by the check-in flow ────────────

/**
 * Fetch an event's stored coordinates and verify the device is within range.
 * This is the function the check-in flow should call — it handles the "TBC
 * location" case and all the GPS error branches with structured reasons.
 */
export async function checkEventProximity(eventId: string): Promise<ProximityResult> {
    const { data, error } = await supabase
        .from('events')
        .select('latitude, longitude, location_radius_meters')
        .eq('id', eventId)
        .maybeSingle();

    if (error || !data) {
        return {
            ok: false,
            reason: 'event_not_found',
            message: 'Could not load event details. Please try again.',
        };
    }

    if (data.latitude === null || data.longitude === null) {
        return {
            ok: false,
            reason: 'no_location_set',
            message: 'This event has no pinned location yet. Ask your manager to set the venue.',
        };
    }

    return checkProximity(data.latitude, data.longitude, data.location_radius_meters);
}

// ── Math ───────────────────────────────────────────────────

/** Haversine great-circle distance between two WGS84 points, in metres. */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in metres
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}
