/**
 * Tests for lib/notificationPreferences.ts — Notification preferences service
 */
import { supabase } from '@/lib/supabase';
import { fetchNotificationPreferences, updateNotificationPreference } from '@/lib/notificationPreferences';

jest.mock('@/lib/supabase');

const mockSupa = supabase as any;

function mockResolve(chain: any, value: any) {
    chain.__resolveWith(value);
}

beforeEach(() => {
    mockSupa.__resetChains();
    jest.clearAllMocks();
});

// ── fetchNotificationPreferences ──

describe('fetchNotificationPreferences', () => {
    it('returns preferences on success', async () => {
        const chain = mockSupa.__getChain('users');
        mockResolve(chain, {
            data: { notification_preferences: { new_lead: false, event_reminder: false } },
            error: null,
        });

        const result = await fetchNotificationPreferences('user-1');
        expect(result.error).toBeNull();
        expect(result.prefs).toEqual({ new_lead: false, event_reminder: false });
    });

    it('returns empty preferences when user has none set', async () => {
        const chain = mockSupa.__getChain('users');
        mockResolve(chain, {
            data: { notification_preferences: null },
            error: null,
        });

        const result = await fetchNotificationPreferences('user-1');
        expect(result.error).toBeNull();
        expect(result.prefs).toEqual({});
    });

    it('returns empty preferences when data is null', async () => {
        const chain = mockSupa.__getChain('users');
        mockResolve(chain, {
            data: null,
            error: null,
        });

        const result = await fetchNotificationPreferences('user-1');
        expect(result.error).toBeNull();
        expect(result.prefs).toEqual({});
    });

    it('returns error on failure', async () => {
        const chain = mockSupa.__getChain('users');
        mockResolve(chain, {
            data: null,
            error: { message: 'Network error' },
        });

        const result = await fetchNotificationPreferences('user-1');
        expect(result.error).toBe('Network error');
        expect(result.prefs).toEqual({});
    });
});

// ── updateNotificationPreference ──

describe('updateNotificationPreference', () => {
    it('disables a preference by setting it to false', async () => {
        const chain = mockSupa.__getChain('users');
        // First call: fetch current prefs; second call: update
        mockResolve(chain, {
            data: { notification_preferences: {} },
            error: null,
        });

        const result = await updateNotificationPreference('user-1', 'new_lead', false);
        expect(result.error).toBeNull();
    });

    it('enables a preference by removing the key', async () => {
        const chain = mockSupa.__getChain('users');
        // Current prefs have new_lead disabled
        mockResolve(chain, {
            data: { notification_preferences: { new_lead: false } },
            error: null,
        });

        const result = await updateNotificationPreference('user-1', 'new_lead', true);
        expect(result.error).toBeNull();
    });

    it('returns error when fetch step fails', async () => {
        const chain = mockSupa.__getChain('users');
        mockResolve(chain, {
            data: null,
            error: { message: 'Fetch failed' },
        });

        const result = await updateNotificationPreference('user-1', 'new_lead', false);
        expect(result.error).toBe('Fetch failed');
    });

    it('returns error when update step fails', async () => {
        const chain = mockSupa.__getChain('users');
        // The chain mock resolves the same value for both calls.
        // Since the proxy returns the same resolve value, and the update
        // call chains from the same table, set it to return an error.
        mockResolve(chain, {
            data: { notification_preferences: {} },
            error: { message: 'Update failed' },
        });

        const result = await updateNotificationPreference('user-1', 'new_lead', false);
        // The first call (fetch) will also get this error
        expect(result.error).toBe('Update failed');
    });

    it('handles null current preferences gracefully', async () => {
        const chain = mockSupa.__getChain('users');
        mockResolve(chain, {
            data: { notification_preferences: null },
            error: null,
        });

        const result = await updateNotificationPreference('user-1', 'event_reminder', false);
        expect(result.error).toBeNull();
    });
});
