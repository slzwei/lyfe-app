import * as Sentry from '@sentry/react-native';
import { reactNavigationIntegration } from '@sentry/react-native';
import Constants from 'expo-constants';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || '';

const navigationIntegration = reactNavigationIntegration({
    enableTimeToInitialDisplay: true,
});

export function initSentry() {
    if (!DSN) return;

    Sentry.init({
        dsn: DSN,
        tracesSampleRate: __DEV__ ? 1.0 : 0.2,
        debug: false,
        enabled: !__DEV__,
        environment: __DEV__ ? 'development' : 'production',
        release: `com.shawnlee.lyfe@${Constants.expoConfig?.version ?? '0.0.0'}`,
        dist: Constants.expoConfig?.extra?.eas?.projectId ?? undefined,
        integrations: [navigationIntegration],
        enableAutoSessionTracking: true,
        attachStacktrace: true,
    });
}

/** Call inside the root navigation container's onReady / ref callback */
export { navigationIntegration };

/** Set Sentry user context on login, clear on logout */
export function setSentryUser(user: { id: string; phone?: string | null; role?: string | null }) {
    Sentry.setUser({ id: user.id });
    if (user.role) {
        Sentry.setTag('user.role', user.role);
    }
}

export function clearSentryUser() {
    Sentry.setUser(null);
    Sentry.setTag('user.role', undefined as unknown as string);
}

/** Capture an exception with optional context */
export function captureError(error: unknown, context?: Record<string, unknown>) {
    if (error instanceof Error) {
        if (context) {
            Sentry.withScope((scope) => {
                scope.setExtras(context);
                Sentry.captureException(error);
            });
        } else {
            Sentry.captureException(error);
        }
    } else {
        Sentry.captureException(new Error(String(error)));
    }
}

export { Sentry };
