import * as Sentry from '@sentry/react-native';
import { reactNavigationIntegration } from '@sentry/react-native';
import Constants from 'expo-constants';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || '';

const navigationIntegration = reactNavigationIntegration({
    enableTimeToInitialDisplay: true,
});

// PII fields we never want shipped to Sentry. The match is case-insensitive
// and substring-based so 'agentPhone', 'lead_email', 'staff_full_name', etc.
// all get redacted.
const PII_KEY_PATTERN = /phone|email|nric|name|token|jwt|address|otp|password/i;

function scrubObject(input: unknown): unknown {
    if (input == null || typeof input !== 'object') return input;
    if (Array.isArray(input)) return input.map(scrubObject);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
        if (PII_KEY_PATTERN.test(k)) {
            out[k] = '[redacted]';
        } else if (v && typeof v === 'object') {
            out[k] = scrubObject(v);
        } else {
            out[k] = v;
        }
    }
    return out;
}

export function initSentry() {
    // Always call Sentry.init, even without a DSN — Sentry.wrap() in the root
    // layout needs the SDK initialised to install its app-start span. With
    // enabled:false (dev or missing DSN) nothing is actually sent.
    Sentry.init({
        dsn: DSN,
        tracesSampleRate: __DEV__ ? 1.0 : 0.2,
        debug: false,
        enabled: !!DSN && !__DEV__,
        environment: __DEV__ ? 'development' : 'production',
        release: `com.shawnlee.lyfe@${Constants.expoConfig?.version ?? '0.0.0'}`,
        // dist must distinguish two builds of the same release (i.e., the
        // CFBundleVersion / versionCode that EAS auto-increments). The
        // previous use of projectId was static and made every build look
        // identical to Sentry, defeating release-comparison and source-map
        // upload (since Sentry keys source maps by release+dist).
        dist: Constants.nativeBuildVersion ?? undefined,
        integrations: [navigationIntegration],
        enableAutoSessionTracking: true,
        attachStacktrace: true,
        beforeSend(event) {
            if (event.extra) event.extra = scrubObject(event.extra) as Record<string, unknown>;
            if (event.tags) event.tags = scrubObject(event.tags) as typeof event.tags;
            if (event.contexts) event.contexts = scrubObject(event.contexts) as typeof event.contexts;
            if (event.request?.data) event.request.data = scrubObject(event.request.data);
            // Strip user PII — only id is allowed
            if (event.user) event.user = { id: event.user.id };
            return event;
        },
        beforeBreadcrumb(breadcrumb) {
            if (breadcrumb.data) breadcrumb.data = scrubObject(breadcrumb.data) as Record<string, unknown>;
            return breadcrumb;
        },
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
    Sentry.setTag('user.role', null);
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
