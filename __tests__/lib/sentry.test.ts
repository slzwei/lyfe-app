/**
 * Tests for lib/sentry.ts — Sentry initialization and re-export
 */
import * as Sentry from '@sentry/react-native';

// jest.setup.js already mocks @sentry/react-native

const mockSentryModule = {
    init: jest.fn(),
    wrap: jest.fn((c: any) => c),
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    setUser: jest.fn(),
    setTag: jest.fn(),
    addBreadcrumb: jest.fn(),
    withScope: jest.fn((cb: any) => cb({ setExtra: jest.fn(), setExtras: jest.fn() })),
    reactNavigationIntegration: jest.fn(() => ({
        name: 'ReactNavigation',
        registerNavigationContainer: jest.fn(),
    })),
};

describe('sentry', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('does not call Sentry.init when DSN is empty', () => {
        process.env.EXPO_PUBLIC_SENTRY_DSN = '';
        jest.resetModules();
        const { initSentry } = require('@/lib/sentry');

        initSentry();

        expect(Sentry.init).not.toHaveBeenCalled();
    });

    it('calls Sentry.init when DSN is set', () => {
        process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://abc@sentry.io/123';
        jest.resetModules();

        jest.mock('@sentry/react-native', () => mockSentryModule);

        const sentryMod = require('@/lib/sentry');
        const SentryFresh = require('@sentry/react-native');

        sentryMod.initSentry();

        expect(SentryFresh.init).toHaveBeenCalledWith(
            expect.objectContaining({
                dsn: 'https://abc@sentry.io/123',
                environment: expect.any(String),
                enableAutoSessionTracking: true,
            }),
        );

        // mobileReplayIntegration must NOT be in integrations (causes iOS 26 crash)
        const initCall = SentryFresh.init.mock.calls[0][0];
        const integrationNames = initCall.integrations.map((i: any) => i.name);
        expect(integrationNames).not.toContain('MobileReplay');
    });

    it('redacts PII from events and breadcrumbs before sending', () => {
        process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://abc@sentry.io/123';
        jest.resetModules();
        jest.mock('@sentry/react-native', () => mockSentryModule);

        const { initSentry } = require('@/lib/sentry');
        const SentryFresh = require('@sentry/react-native');

        initSentry();
        const initOptions = SentryFresh.init.mock.calls[0][0];
        const event = initOptions.beforeSend({
            extra: {
                lead_email: 'lead@example.com',
                nested: { agentPhone: '+6599999999', safe: 'kept' },
                rows: [{ token: 'secret', status: 'new' }],
            },
            tags: { staff_full_name: 'Alice Agent', role: 'agent' },
            contexts: { device: { address: '123 Street', model: 'iPhone' } },
            request: { data: { otp: '555555', status: 'new' } },
            user: { id: 'user-1', email: 'agent@example.com' },
        });

        expect(event.extra.lead_email).toBe('[redacted]');
        expect(event.extra.nested).toEqual({ agentPhone: '[redacted]', safe: 'kept' });
        expect(event.extra.rows).toEqual([{ token: '[redacted]', status: 'new' }]);
        expect(event.tags.staff_full_name).toBe('[redacted]');
        expect(event.contexts.device).toEqual({ address: '[redacted]', model: 'iPhone' });
        expect(event.request.data).toEqual({ otp: '[redacted]', status: 'new' });
        expect(event.user).toEqual({ id: 'user-1' });

        const breadcrumb = initOptions.beforeBreadcrumb({
            data: { password: 'secret', label: 'tap lead' },
        });
        expect(breadcrumb.data).toEqual({ password: '[redacted]', label: 'tap lead' });
    });

    it('re-exports Sentry module', () => {
        const { Sentry: SentryExport } = require('@/lib/sentry');
        expect(SentryExport).toBeDefined();
        expect(SentryExport.init).toBeDefined();
        expect(SentryExport.captureException).toBeDefined();
    });

    it('exports captureError helper', () => {
        const { captureError } = require('@/lib/sentry');
        expect(typeof captureError).toBe('function');
    });

    it('exports setSentryUser and clearSentryUser', () => {
        const { setSentryUser, clearSentryUser } = require('@/lib/sentry');
        expect(typeof setSentryUser).toBe('function');
        expect(typeof clearSentryUser).toBe('function');
    });

    it('captureError sends exception to Sentry', () => {
        jest.resetModules();
        jest.mock('@sentry/react-native', () => mockSentryModule);
        const { captureError } = require('@/lib/sentry');
        const SentryFresh = require('@sentry/react-native');

        const testError = new Error('test error');
        captureError(testError);

        expect(SentryFresh.captureException).toHaveBeenCalledWith(testError);
    });

    it('captureError attaches context in a scoped report', () => {
        jest.resetModules();
        const setExtras = jest.fn();
        mockSentryModule.withScope.mockImplementationOnce((cb: any) => cb({ setExtras }));
        jest.mock('@sentry/react-native', () => mockSentryModule);
        const { captureError } = require('@/lib/sentry');
        const SentryFresh = require('@sentry/react-native');

        const testError = new Error('test error');
        captureError(testError, { leadId: 'lead-1', stage: 'assignment' });

        expect(setExtras).toHaveBeenCalledWith({ leadId: 'lead-1', stage: 'assignment' });
        expect(SentryFresh.captureException).toHaveBeenCalledWith(testError);
    });

    it('captureError wraps non-Error values', () => {
        jest.resetModules();
        jest.mock('@sentry/react-native', () => mockSentryModule);
        const { captureError } = require('@/lib/sentry');
        const SentryFresh = require('@sentry/react-native');

        captureError('string error');

        expect(SentryFresh.captureException).toHaveBeenCalledWith(expect.any(Error));
    });

    it('setSentryUser sets user and role tag', () => {
        jest.resetModules();
        jest.mock('@sentry/react-native', () => mockSentryModule);
        const { setSentryUser } = require('@/lib/sentry');
        const SentryFresh = require('@sentry/react-native');

        setSentryUser({ id: 'user-1', phone: '+65123', role: 'agent' });

        expect(SentryFresh.setUser).toHaveBeenCalledWith({ id: 'user-1' });
        expect(SentryFresh.setTag).toHaveBeenCalledWith('user.role', 'agent');
    });

    it('clearSentryUser clears user context', () => {
        jest.resetModules();
        jest.mock('@sentry/react-native', () => mockSentryModule);
        const { clearSentryUser } = require('@/lib/sentry');
        const SentryFresh = require('@sentry/react-native');

        clearSentryUser();

        expect(SentryFresh.setUser).toHaveBeenCalledWith(null);
        expect(SentryFresh.setTag).toHaveBeenCalledWith('user.role', null);
    });
});
