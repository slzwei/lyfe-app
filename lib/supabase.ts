import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';
import type { Database } from '@/types/shared/database.types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        'Missing required Supabase environment variables. ' +
            'Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env',
    );
}

// SecureStore has a 2048-byte limit per item. Large values (e.g. Supabase
// session JWTs) are split into 2000-byte chunks stored in SecureStore.
const CHUNK_SIZE = 2000;

// Use AFTER_FIRST_UNLOCK so Supabase's autoRefreshToken timer can read the
// session from the keychain even when the device is locked. The default
// (WHEN_UNLOCKED) causes "User interaction is not allowed" errors on
// background refresh ticks.
const STORE_OPTS: SecureStore.SecureStoreOptions = {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

/** Clean up legacy AsyncStorage fallback keys from the old implementation. */
async function cleanupLegacyKeys(key: string): Promise<void> {
    await AsyncStorage.removeItem(`supabase_as_${key}`).catch(() => {});
}

const secureStoreAdapter = {
    getItem: async (key: string): Promise<string | null> => {
        if (Platform.OS === 'web') {
            if (typeof window === 'undefined') return null;
            return localStorage.getItem(key);
        }

        // Migrate: check old AsyncStorage fallback and move to chunks
        const legacy = await AsyncStorage.getItem(`supabase_as_${key}`).catch(() => null);
        if (legacy !== null) {
            // Migrate to chunked SecureStore and remove legacy key
            await secureStoreAdapter.setItem(key, legacy);
            await AsyncStorage.removeItem(`supabase_as_${key}`).catch(() => {});
            return legacy;
        }

        // Check for chunked storage
        const countStr = await SecureStore.getItemAsync(`${key}_chunks`, STORE_OPTS).catch(() => null);
        if (countStr !== null) {
            const count = parseInt(countStr, 10);
            const parts: string[] = [];
            for (let i = 0; i < count; i++) {
                const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`, STORE_OPTS).catch(() => null);
                if (chunk === null) return null; // corrupted — treat as missing
                parts.push(chunk);
            }
            return parts.join('');
        }

        // Single value
        return SecureStore.getItemAsync(key, STORE_OPTS).catch(() => null);
    },

    setItem: async (key: string, value: string): Promise<void> => {
        if (Platform.OS === 'web') {
            if (typeof window === 'undefined') return;
            localStorage.setItem(key, value);
            return;
        }

        // Clean up legacy AsyncStorage keys
        cleanupLegacyKeys(key);

        if (value.length > CHUNK_SIZE) {
            // Remove any existing single value
            await SecureStore.deleteItemAsync(key, STORE_OPTS).catch(() => {});

            // Remove old chunks if they exist
            const oldCountStr = await SecureStore.getItemAsync(`${key}_chunks`, STORE_OPTS).catch(() => null);
            if (oldCountStr !== null) {
                const oldCount = parseInt(oldCountStr, 10);
                for (let i = 0; i < oldCount; i++) {
                    await SecureStore.deleteItemAsync(`${key}_chunk_${i}`, STORE_OPTS).catch(() => {});
                }
            }

            // Write new chunks
            const chunkCount = Math.ceil(value.length / CHUNK_SIZE);
            for (let i = 0; i < chunkCount; i++) {
                const chunk = value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
                await SecureStore.setItemAsync(`${key}_chunk_${i}`, chunk, STORE_OPTS).catch(() => {});
            }
            await SecureStore.setItemAsync(`${key}_chunks`, String(chunkCount), STORE_OPTS).catch(() => {});
        } else {
            // Remove any existing chunks
            const oldCountStr = await SecureStore.getItemAsync(`${key}_chunks`, STORE_OPTS).catch(() => null);
            if (oldCountStr !== null) {
                const oldCount = parseInt(oldCountStr, 10);
                for (let i = 0; i < oldCount; i++) {
                    await SecureStore.deleteItemAsync(`${key}_chunk_${i}`, STORE_OPTS).catch(() => {});
                }
                await SecureStore.deleteItemAsync(`${key}_chunks`, STORE_OPTS).catch(() => {});
            }

            await SecureStore.setItemAsync(key, value, STORE_OPTS).catch(() => {});
        }
    },

    removeItem: async (key: string): Promise<void> => {
        if (Platform.OS === 'web') {
            if (typeof window === 'undefined') return;
            localStorage.removeItem(key);
            return;
        }

        // Remove single value
        await SecureStore.deleteItemAsync(key, STORE_OPTS).catch(() => {});

        // Remove chunks if they exist
        const countStr = await SecureStore.getItemAsync(`${key}_chunks`, STORE_OPTS).catch(() => null);
        if (countStr !== null) {
            const count = parseInt(countStr, 10);
            for (let i = 0; i < count; i++) {
                await SecureStore.deleteItemAsync(`${key}_chunk_${i}`, STORE_OPTS).catch(() => {});
            }
            await SecureStore.deleteItemAsync(`${key}_chunks`, STORE_OPTS).catch(() => {});
        }

        // Clean up legacy keys
        await cleanupLegacyKeys(key);
    },
};

/**
 * Custom fetch with two responsibilities:
 *
 * 1) Inject the cached access_token onto outgoing PostgREST/edge-function
 *    requests. `supabase.auth.getSession()` in RN with the chunked
 *    SecureStore adapter occasionally returns null mid-session; this shim
 *    keeps requests authenticated using `sessionCache` (which AuthContext
 *    mirrors from authState on every state change, including TOKEN_REFRESHED).
 *
 * 2) Recover from expired JWTs without showing a technical error. When a
 *    request returns 401 on a non-auth path, refresh the session once
 *    (deduped across concurrent failures) and retry the original request
 *    with the new token. If the refresh fails permanently (refresh token
 *    revoked/invalid), sign the user out so the auth gate routes to login.
 *    Transient failures (network) propagate the 401 untouched — the
 *    NetworkContext reconnect listener handles those.
 *
 * /auth/v1/* requests are carved out of both behaviours: those manage the
 * session itself and must not be retried or have a cached token injected.
 */
function resolveUrl(input: RequestInfo | URL): string | undefined {
    if (typeof input === 'string') return input;
    if (typeof URL !== 'undefined' && input instanceof URL) return input.href;
    if (input && typeof (input as Request).url === 'string') return (input as Request).url;
    return undefined;
}

interface RefreshResult {
    ok: boolean;
    permanent: boolean;
    accessToken: string | null;
}

// Module-level mutex so a single screen mount that fires N parallel queries
// can't trigger N refreshSession() calls — that races with refresh-token
// rotation and produces false `refresh_token_already_used` sign-outs.
let refreshPromise: Promise<RefreshResult> | null = null;

const customFetch: typeof fetch = async (input, init) => {
    const url = resolveUrl(input);
    const isAuthPath = url ? url.includes('/auth/v1/') : false;

    let nextInit = init;
    if (!isAuthPath && url) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { getCachedAccessToken } = require('./sessionCache') as {
                getCachedAccessToken: () => string | null;
            };
            const token = getCachedAccessToken();
            if (token) {
                const headers = new Headers(init?.headers as HeadersInit | undefined);
                headers.set('Authorization', `Bearer ${token}`);
                nextInit = { ...(init || {}), headers };
            }
        } catch {
            nextInit = init;
        }
    }

    const response = await fetch(input, nextInit);

    if (response.status !== 401 || isAuthPath) return response;

    // No cached session → nothing to refresh. Don't trigger sign-out either,
    // since the user may already be in the process of signing out.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCachedAccessToken, setCachedSession } = require('./sessionCache') as {
        getCachedAccessToken: () => string | null;
        setCachedSession: (input: { access_token: string | null; user_id: string | null }) => void;
    };
    if (!getCachedAccessToken()) return response;

    let pending = refreshPromise;
    if (!pending) {
        pending = (async (): Promise<RefreshResult> => {
            try {
                const { error, data } = await supabase.auth.refreshSession();
                if (!error && data.session) {
                    // Update sessionCache directly: TOKEN_REFRESHED also fires
                    // a setState in AuthContext, but React render hasn't run
                    // by the time this promise resolves. Belt + suspenders so
                    // the retry below picks up the fresh token immediately.
                    setCachedSession({
                        access_token: data.session.access_token,
                        user_id: data.session.user?.id ?? null,
                    });
                    return { ok: true, permanent: false, accessToken: data.session.access_token };
                }
                const errAny = error as { status?: number; code?: string } | null;
                const status = errAny?.status ?? 0;
                const code = errAny?.code ?? '';
                // Conservative classification: only treat goTrue's explicit
                // "refresh token is dead" signals as permanent. Network
                // errors and 5xx are transient.
                const permanent =
                    status === 400 &&
                    (code === 'refresh_token_not_found' ||
                        code === 'invalid_grant' ||
                        code === 'refresh_token_already_used');
                return { ok: false, permanent, accessToken: null };
            } catch {
                return { ok: false, permanent: false, accessToken: null };
            } finally {
                refreshPromise = null;
            }
        })();
        refreshPromise = pending;
    }

    const result = await pending;

    if (result.ok && result.accessToken) {
        // Retry once via platform fetch (not customFetch) — no recursion.
        const headers = new Headers(init?.headers as HeadersInit | undefined);
        headers.set('Authorization', `Bearer ${result.accessToken}`);
        return fetch(input, { ...(init || {}), headers });
    }

    if (result.permanent) {
        // Auth gate in app/_layout.tsx redirects to login on SIGNED_OUT.
        supabase.auth.signOut().catch(() => {});
    }

    return response;
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: secureStoreAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
    global: {
        fetch: customFetch,
    },
});

// JS timers throttle/stop when the app is backgrounded, so supabase-js's
// autoRefreshToken loop drifts off-schedule and silently fails to refresh.
// Pair foreground/background transitions with start/stopAutoRefresh per
// Supabase's RN guidance: https://supabase.com/docs/reference/javascript/initializing
if (Platform.OS !== 'web') {
    AppState.addEventListener('change', (state) => {
        if (state === 'active') {
            supabase.auth.startAutoRefresh();
        } else {
            supabase.auth.stopAutoRefresh();
        }
    });
}
