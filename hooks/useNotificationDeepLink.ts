/**
 * Routes notification taps to the right screen.
 *
 * Two paths:
 *   1. Cold start: app launches because the user tapped a notification.
 *      `getLastNotificationResponseAsync()` returns the response that
 *      caused launch; we route once at mount.
 *   2. Warm tap: app was already running. `addNotificationResponseReceivedListener`
 *      fires every tap thereafter.
 *
 * Payload contract: edge functions that emit notifications include
 * `data.route` as a pre-built expo-router path (e.g. `/(tabs)/leads/{id}`).
 * Receivers may also inspect `data.leadId` / `data.eventId` / etc. for
 * future fine-grained handling. We trust the path because our edge functions
 * are the only emitters, and they construct paths from validated UUIDs.
 *
 * Auth gate timing: we don't navigate while the auth gate is still loading.
 * If a notification tap arrives during that window the handler defers to
 * the auth gate's own redirect logic; we replay the route once auth is
 * settled. This avoids navigating to a protected screen before the session
 * is restored from SecureStore.
 */
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

interface NotificationData {
    route?: string;
    [key: string]: unknown;
}

/** Validate the route looks like an expo-router path we own. Defence-in-depth
 *  against a payload that somehow carries an arbitrary URL. */
function isSafeRoute(route: unknown): route is string {
    if (typeof route !== 'string') return false;
    if (route.length === 0 || route.length > 200) return false;
    // Only allow our own internal paths. Reject http:, javascript:, data:, etc.
    return route.startsWith('/');
}

export function useNotificationDeepLink(opts: { ready: boolean }) {
    const router = useRouter();
    const pendingRouteRef = useRef<string | null>(null);
    const handledColdStartRef = useRef(false);

    // Cold-start handler: runs once. Stores the route in pendingRouteRef
    // until the auth gate is ready, then navigates.
    useEffect(() => {
        if (handledColdStartRef.current) return;
        handledColdStartRef.current = true;

        Notifications.getLastNotificationResponseAsync()
            .then((response) => {
                if (!response) return;
                const data = response.notification.request.content.data as NotificationData;
                if (data?.route && isSafeRoute(data.route)) {
                    pendingRouteRef.current = data.route;
                }
            })
            .catch((err) => {
                if (__DEV__) console.error('[useNotificationDeepLink] cold-start lookup failed:', err);
            });
    }, []);

    // Drain the pending cold-start route once auth is ready.
    useEffect(() => {
        if (!opts.ready) return;
        const route = pendingRouteRef.current;
        if (route) {
            pendingRouteRef.current = null;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            router.push(route as any);
        }
    }, [opts.ready, router]);

    // Warm-tap handler: every notification tap while the app is running.
    useEffect(() => {
        const sub = Notifications.addNotificationResponseReceivedListener((response) => {
            const data = response.notification.request.content.data as NotificationData;
            if (data?.route && isSafeRoute(data.route)) {
                if (opts.ready) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    router.push(data.route as any);
                } else {
                    // Auth gate is still loading — stash for the drain effect.
                    pendingRouteRef.current = data.route;
                }
            }
        });
        return () => sub.remove();
    }, [opts.ready, router]);
}
