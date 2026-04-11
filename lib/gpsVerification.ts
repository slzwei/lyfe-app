/**
 * GPS proximity verification for roadshow check-in.
 */
import * as Location from 'expo-location';

export interface GPSCheckResult {
    passed: boolean;
    /** Distance in metres from target, or -1 if unavailable. */
    distance: number;
    error?: string;
}

/** Default radius in metres for proximity check. */
const DEFAULT_RADIUS_M = 200;

/**
 * Check if the device is within `radiusMetres` of (targetLat, targetLng).
 *
 * Requests foreground location permission if not already granted.
 * Returns { passed: true } if within radius, or an error if location is unavailable.
 */
export async function checkProximity(
    targetLat: number,
    targetLng: number,
    radiusMetres: number = DEFAULT_RADIUS_M,
): Promise<GPSCheckResult> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
        return { passed: false, distance: -1, error: 'Location permission denied' };
    }

    let location: Location.LocationObject;
    try {
        location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
        });
    } catch {
        return { passed: false, distance: -1, error: 'Could not determine your location' };
    }

    const distance = haversineDistance(location.coords.latitude, location.coords.longitude, targetLat, targetLng);

    return {
        passed: distance <= radiusMetres,
        distance: Math.round(distance),
    };
}

/** Haversine distance between two points in metres. */
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
