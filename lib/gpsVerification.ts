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
import { supabase } from './supabase';

// ── Types ──────────────────────────────────────────────────

export type ProximityFailReason =
    | 'no_location_set' // event.latitude / longitude is null (TBC)
    | 'permission_denied' // user declined the location permission prompt
    | 'location_unavailable' // GPS hardware / network failed
    | 'out_of_range' // got a fix, but it's outside the radius
    | 'event_not_found'; // eventId doesn't resolve

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

    let coords: Location.LocationObjectCoords;
    try {
        // Balanced accuracy is ±20-50m on Android (network + sensor fusion,
        // no full GPS chip activation) — well within the default 100m
        // radius. Trades ~3-5m worst-case fix for a 5-10x faster first
        // fix and a noticeable battery win across a roadshow shift.
        // If a future event uses a tight (<50m) radius, override here.
        const fix = await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('GPS timeout')), 8000)),
        ]);
        coords = (fix as Location.LocationObject).coords;
    } catch {
        return {
            ok: false,
            reason: 'location_unavailable',
            message: 'Could not determine your location. Move outside or near a window and try again.',
            requiredMeters: radiusMetres,
        };
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
