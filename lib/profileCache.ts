/**
 * Last-known-good profile cache — the offline cold-start lifeline (audit C2).
 *
 * When the app starts with no connectivity, the profile fetch and invitation
 * check cannot run; without a cached copy the auth gate bounces a validly
 * signed-in user to the OTP login screen — which itself needs network — a
 * hard lockout. The cache is written on every successful profile resolution
 * and read ONLY when the network is what failed, never when the server
 * authoritatively said the profile doesn't exist.
 *
 * AsyncStorage, not SecureStore: this is the user's own public.users row
 * (name/phone/role/onboarding flags) — far below session-token sensitivity,
 * and SecureStore's chunked adapter is reserved for the session itself.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '@/types/database';

const STORAGE_KEY = 'lyfe_profile_cache_v1';

/** Only gate-passing statuses are ever cached — 'rejected' must re-prove itself online. */
export type CachedInvitationStatus = 'valid' | 'skipped';

export interface CachedProfile {
    userId: string;
    profile: User;
    invitationStatus: CachedInvitationStatus;
    cachedAt: string;
}

export async function saveCachedProfile(profile: User, invitationStatus: CachedInvitationStatus): Promise<void> {
    try {
        const entry: CachedProfile = {
            userId: profile.id,
            profile,
            invitationStatus,
            cachedAt: new Date().toISOString(),
        };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
    } catch {
        // Cache is best-effort — never let it break an online auth flow
    }
}

/**
 * Load the cached profile. When `expectedUserId` is given, a cache written by
 * a different account returns null — one device user must never inherit
 * another's profile. Without it (offline cold start where the session itself
 * couldn't be restored), the cache identifies the device's last signed-in,
 * never-signed-out user.
 */
export async function loadCachedProfile(expectedUserId?: string): Promise<CachedProfile | null> {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const entry = JSON.parse(raw) as CachedProfile;
        if (!entry?.userId || !entry.profile) return null;
        if (entry.invitationStatus !== 'valid' && entry.invitationStatus !== 'skipped') return null;
        if (expectedUserId && entry.userId !== expectedUserId) return null;
        return entry;
    } catch {
        return null;
    }
}

export async function clearCachedProfile(): Promise<void> {
    try {
        await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {
        // best-effort
    }
}
