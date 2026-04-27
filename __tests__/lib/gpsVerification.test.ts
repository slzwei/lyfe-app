import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { Sentry } from '@/lib/sentry';
import { checkEventProximity, checkProximity } from '@/lib/gpsVerification';

jest.mock('@/lib/supabase');
const mockSupabase = require('@/lib/supabase').supabase;

const mockedRequestPerm = Location.requestForegroundPermissionsAsync as jest.Mock;
const mockedGetPosition = Location.getCurrentPositionAsync as jest.Mock;

// Marina Bay Sands ↔ Raffles Place — about 1.3km. Used to sanity-check
// the haversine math and as a "definitely out of range" pair.
const MBS = { lat: 1.2834, lng: 103.8607 };
const RAFFLES = { lat: 1.2843, lng: 103.8516 };

function mockFix(over: Partial<Location.LocationObjectCoords> & { timestamp?: number } = {}) {
    const { timestamp, ...coordsOver } = over;
    mockedGetPosition.mockResolvedValueOnce({
        coords: {
            latitude: MBS.lat,
            longitude: MBS.lng,
            accuracy: 10,
            mocked: false,
            altitude: 0,
            altitudeAccuracy: 0,
            heading: 0,
            speed: 0,
            ...coordsOver,
        },
        timestamp: timestamp ?? Date.now(),
    });
}

beforeEach(() => {
    jest.clearAllMocks();
    mockedRequestPerm.mockResolvedValue({ status: 'granted' });
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    (global as { __DEV__: boolean }).__DEV__ = true;
});

// ── checkProximity ─────────────────────────────────────────

describe('checkProximity — happy path', () => {
    it('returns ok=true when within radius and reports distance', async () => {
        mockFix({ latitude: MBS.lat, longitude: MBS.lng });

        const result = await checkProximity(MBS.lat, MBS.lng, 100);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.distanceMeters).toBe(0);
            expect(result.requiredMeters).toBe(100);
        }
    });

    it('returns out_of_range when distance exceeds radius', async () => {
        mockFix({ latitude: MBS.lat, longitude: MBS.lng });

        const result = await checkProximity(RAFFLES.lat, RAFFLES.lng, 100);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.reason).toBe('out_of_range');
            // Marina Bay ↔ Raffles is ~1km — sanity check the haversine output.
            expect(result.distanceMeters).toBeGreaterThan(900);
            expect(result.distanceMeters).toBeLessThan(1500);
            expect(result.message).toContain('from the venue');
        }
    });
});

describe('checkProximity — permission + GPS errors', () => {
    it('returns permission_denied when the permission prompt is rejected', async () => {
        mockedRequestPerm.mockResolvedValueOnce({ status: 'denied', canAskAgain: false });

        const result = await checkProximity(MBS.lat, MBS.lng, 100);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.reason).toBe('permission_denied');
            expect(result.canAskAgain).toBe(false);
            expect(result.message).toContain('Settings');
        }
        expect(mockedGetPosition).not.toHaveBeenCalled();
    });

    it('omits the Settings hint when the OS can re-prompt (Android first-deny)', async () => {
        mockedRequestPerm.mockResolvedValueOnce({ status: 'denied', canAskAgain: true });

        const result = await checkProximity(MBS.lat, MBS.lng, 100);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.reason).toBe('permission_denied');
            expect(result.canAskAgain).toBe(true);
            expect(result.message).not.toContain('Settings');
        }
    });

    it('returns location_unavailable when getCurrentPositionAsync rejects', async () => {
        mockedGetPosition.mockRejectedValueOnce(new Error('GPS hardware fault'));

        const result = await checkProximity(MBS.lat, MBS.lng, 100);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.reason).toBe('location_unavailable');
        }
    });
});

describe('checkProximity — mock-location detection', () => {
    it('rejects on Android in production when coords.mocked is true', async () => {
        Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
        (global as { __DEV__: boolean }).__DEV__ = false;
        mockFix({ mocked: true });

        const result = await checkProximity(MBS.lat, MBS.lng, 100);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.reason).toBe('mocked_location');
        }
    });

    it('does NOT reject on Android in dev (emulators always report mocked=true)', async () => {
        Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
        (global as { __DEV__: boolean }).__DEV__ = true;
        mockFix({ mocked: true });

        const result = await checkProximity(MBS.lat, MBS.lng, 100);

        expect(result.ok).toBe(true);
    });

    it('does NOT check coords.mocked on iOS', async () => {
        Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
        (global as { __DEV__: boolean }).__DEV__ = false;
        // Even if mocked were somehow true on iOS, we don't gate on it.
        mockFix({ mocked: true });

        const result = await checkProximity(MBS.lat, MBS.lng, 100);

        expect(result.ok).toBe(true);
    });
});

describe('checkProximity — staleness', () => {
    it('rejects when the fix timestamp is older than 60s', async () => {
        mockFix({ timestamp: Date.now() - 61_000 });

        const result = await checkProximity(MBS.lat, MBS.lng, 100);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.reason).toBe('stale_fix');
        }
    });

    it('accepts a fix that is just under the staleness threshold', async () => {
        mockFix({ timestamp: Date.now() - 30_000 });

        const result = await checkProximity(MBS.lat, MBS.lng, 100);

        expect(result.ok).toBe(true);
    });
});

describe('checkProximity — accuracy probe (log-only)', () => {
    it('captures a Sentry warning when accuracy exceeds the radius but still proceeds', async () => {
        mockFix({ accuracy: 250 });

        const result = await checkProximity(MBS.lat, MBS.lng, 100);

        expect(result.ok).toBe(true);
        expect(Sentry.captureMessage).toHaveBeenCalledWith(
            'gps.low_accuracy',
            expect.objectContaining({
                level: 'warning',
                extra: expect.objectContaining({ accuracyMeters: 250, radiusMeters: 100 }),
            }),
        );
    });

    it('does not capture when accuracy is within the radius', async () => {
        mockFix({ accuracy: 25 });

        await checkProximity(MBS.lat, MBS.lng, 100);

        expect(Sentry.captureMessage).not.toHaveBeenCalled();
    });

    it('does not capture when accuracy is null', async () => {
        mockFix({ accuracy: null as unknown as number });

        await checkProximity(MBS.lat, MBS.lng, 100);

        expect(Sentry.captureMessage).not.toHaveBeenCalled();
    });
});

// ── checkEventProximity ────────────────────────────────────

describe('checkEventProximity', () => {
    it('returns event_not_found when the row does not resolve', async () => {
        mockSupabase.from.mockReturnValue({
            select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                }),
            }),
        });

        const result = await checkEventProximity('event-123');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.reason).toBe('event_not_found');
        }
    });

    it('returns no_location_set when latitude/longitude are null (TBC venue)', async () => {
        mockSupabase.from.mockReturnValue({
            select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: { latitude: null, longitude: null, location_radius_meters: 100 },
                        error: null,
                    }),
                }),
            }),
        });

        const result = await checkEventProximity('event-123');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.reason).toBe('no_location_set');
        }
    });

    it('delegates to checkProximity with the stored coords + radius', async () => {
        mockSupabase.from.mockReturnValue({
            select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: {
                            latitude: MBS.lat,
                            longitude: MBS.lng,
                            location_radius_meters: 75,
                        },
                        error: null,
                    }),
                }),
            }),
        });
        mockFix({ latitude: MBS.lat, longitude: MBS.lng });

        const result = await checkEventProximity('event-123');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.requiredMeters).toBe(75);
        }
    });
});
