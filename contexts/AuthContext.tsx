import {
    authenticate,
    clearBiometricRefreshToken,
    getBiometricRefreshToken,
    isBiometricsAvailable,
    isBiometricsEnabled,
    setBiometricsEnabled,
    storeBiometricRefreshToken,
} from '@/lib/biometrics';
import { isNetworkError, isNetworkErrorResult } from '@/lib/offline';
import { clearCachedProfile, loadCachedProfile, saveCachedProfile } from '@/lib/profileCache';
import { clearSentryUser, setSentryUser } from '@/lib/sentry';
import { clearCachedSession, setCachedSession } from '@/lib/sessionCache';
import { supabase } from '@/lib/supabase';
import { OTA_RELOAD_FLAG_KEY } from '@/hooks/useOtaUpdates';
import type { User } from '@/types/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

// ── Auth-only context ─────────────────────────────────────────
type InvitationStatus = 'checking' | 'valid' | 'rejected' | 'skipped';

interface AuthState {
    session: Session | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    pendingBiometricSession: boolean;
    invitationStatus: InvitationStatus;
}

type PhoneEligibility = {
    eligible: boolean;
    reason: 'existing_user' | 'pending_invitation' | 'invitation_expired' | 'not_found' | 'invalid_phone';
};

interface AuthContextType extends AuthState {
    checkPhoneEligible: (phone: string) => Promise<PhoneEligibility>;
    signInWithOtp: (phone: string) => Promise<{ error: Error | null }>;
    verifyOtp: (phone: string, token: string) => Promise<{ error: Error | null }>;
    recheckInvitation: () => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Explicit column list for the self-profile fetch. Mirrors every public.users
// column EXCEPT push_token, which migration 20260613010000 locks to
// service_role only (audit H3) — a `select=*` now 403s against the
// column-level grant. push_token is intentionally omitted: it is never read
// client-side (only written by registerForPushNotifications, and read by the
// send-push-notification edge function via the service role). If a new users
// column is added, append it here so it surfaces on the profile.
export const USER_PROFILE_COLUMNS = [
    'id',
    'email',
    'phone',
    'full_name',
    'avatar_url',
    'role',
    'reports_to',
    'lifecycle_stage',
    'date_of_birth',
    'last_login_at',
    'is_active',
    'created_at',
    'updated_at',
    'external_id',
    'notification_preferences',
    'onboarding_complete',
    'email_verified',
    'last_seen_at',
    'face_registered_at',
    'consent_tos_at',
    'consent_privacy_at',
    'consent_operational_push_at',
    'consent_marketing_at',
    'is_test_data',
].join(',');

// ── Profile context ───────────────────────────────────────────
interface ProfileContextType {
    user: User | null;
    updateProfile: (name: string, email: string | null) => Promise<{ error: string | null }>;
    updateAvatarUrl: (url: string | null) => void;
    updateFaceRegisteredAt: (iso: string | null) => void;
    refreshUser: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

// ── Biometrics context ────────────────────────────────────────
interface BiometricsContextType {
    biometricsEnabled: boolean;
    authenticateWithBiometrics: () => Promise<{ success: boolean; error?: string }>;
    enableBiometrics: () => Promise<boolean>;
    disableBiometrics: () => Promise<void>;
}

const BiometricsContext = createContext<BiometricsContextType | undefined>(undefined);

// ── Helpers ───────────────────────────────────────────────────

// Cutoff: users created before this date are grandfathered in (skip invitation check)
const INVITATION_SYSTEM_CUTOFF = '2026-03-29T00:00:00Z';

/**
 * auth-js never surfaces raw fetch failures — they arrive as
 * AuthRetryableFetchError (status 0), sometimes resolved on the error field,
 * sometimes thrown. Either way the refresh token is still safe in storage
 * (auth-js only removes the session on auth-level failures), so the failure
 * is connectivity, not a revoked session.
 */
function isAuthNetworkFailure(e: unknown): boolean {
    if (!e || typeof e !== 'object') return false;
    const err = e as { name?: string; status?: number; message?: string };
    if (err.name === 'AuthRetryableFetchError') return true;
    return typeof err.message === 'string' && isNetworkErrorResult({ message: err.message }, err.status);
}

/**
 * Fetch the user profile from public.users.
 * The handle_new_user DB trigger creates the row on auth signup,
 * so we retry briefly if the row hasn't appeared yet (race condition).
 *
 * `networkFailed` is true only when every attempt died at the transport layer
 * (no HTTP response at all) — the caller may then fall back to the cached
 * profile. A served response (even 4xx or zero rows) is authoritative.
 */
async function fetchUserProfile(
    userId: string,
    accessToken: string | null,
    _phone?: string | null,
): Promise<{ profile: User | null; networkFailed: boolean }> {
    // The previous iteration showed `onAuthStateChange` firing SIGNED_IN with a
    // valid session.user, but `supabase.auth.getSession()` returning no
    // access_token in the same JS tick — supabase-js hadn't yet committed the
    // session internally. So we now require callers to pass the access_token
    // they already have in hand (from the onAuthStateChange `session` arg, or
    // from getSession() for the initAuth path). If the caller doesn't have a
    // token, we fall back to getSession() but that race is the failure mode.
    // Prefer the explicit accessToken from the caller. Otherwise consult
    // the module-level session cache (set by AuthContext on every auth
    // state change). Fall back to supabase.auth.getSession() only as a
    // last resort — that path can return null mid-session in RN.
    let token = accessToken;
    if (!token) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        token = require('@/lib/sessionCache').getCachedAccessToken();
    }
    if (!token) {
        const {
            data: { session },
        } = await supabase.auth.getSession();
        token = session?.access_token ?? null;
    }
    if (!token) {
        return { profile: null, networkFailed: false };
    }

    const supaUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const apikey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!supaUrl || !apikey) {
        return { profile: null, networkFailed: false };
    }
    const url = `${supaUrl}/rest/v1/users?id=eq.${encodeURIComponent(userId)}&select=${USER_PROFILE_COLUMNS}`;

    let sawHttpResponse = false;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const resp = await fetch(url, {
                headers: {
                    apikey,
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/json',
                    'Accept-Profile': 'public',
                },
            });
            sawHttpResponse = true;
            const bodyText = await resp.text();
            if (resp.ok) {
                const rows = JSON.parse(bodyText) as User[];
                if (Array.isArray(rows) && rows.length === 1) {
                    return { profile: rows[0], networkFailed: false };
                }
            }
        } catch (err) {
            if (__DEV__) console.error('fetchUserProfile attempt', attempt, 'failed:', err);
        }

        if (attempt < 2) await new Promise((r) => setTimeout(r, 150));
    }
    if (__DEV__) console.error('User profile not found after retries');
    return { profile: null, networkFailed: !sawHttpResponse };
}

/**
 * Check whether the user has a valid invitation.
 * - Users created before the invitation system cutoff are auto-skipped.
 * - Otherwise, check member_invitations or legacy invitations table.
 */
async function checkInvitationStatus(userId: string, createdAt: string | null): Promise<InvitationStatus> {
    // Existing users before the system went live are grandfathered
    if (createdAt && new Date(createdAt) < new Date(INVITATION_SYSTEM_CUTOFF)) {
        return 'skipped';
    }

    // postgrest resolves network failures as { error, status: 0 } instead of
    // throwing — offline must not read as "no invitation row" and bounce a
    // previously admitted user to the rejection screen. Fall back to the last
    // status they passed the gate with; only authoritative empty results
    // reject. (The cache only ever holds 'valid' / 'skipped'.)
    const offlineFallback = async (): Promise<InvitationStatus> => {
        const cached = await loadCachedProfile(userId);
        return cached ? cached.invitationStatus : 'rejected';
    };

    // Check member_invitations (new system)
    const {
        data: memberInv,
        error: memberErr,
        status: memberStatus,
    } = await supabase
        .from('member_invitations')
        .select('id')
        .eq('accepted_by_id', userId)
        .eq('status', 'accepted')
        .limit(1)
        .maybeSingle();

    if (isNetworkErrorResult(memberErr, memberStatus)) return offlineFallback();
    if (memberInv) return 'valid';

    // Check legacy invitations (lyfe-sg candidate flow)
    const {
        data: legacyInv,
        error: legacyErr,
        status: legacyStatus,
    } = await supabase.from('invitations').select('id').eq('user_id', userId).limit(1).maybeSingle();

    if (isNetworkErrorResult(legacyErr, legacyStatus)) return offlineFallback();
    if (legacyInv) return 'valid';

    return 'rejected';
}

/**
 * Resolve the profile + invitation status for an authenticated session,
 * falling back to the last-known-good cache when the NETWORK — not the
 * server — is what failed. An offline cold start must not bounce a validly
 * signed-in user to a login screen that itself needs connectivity (audit C2).
 * A served "no such profile" stays authoritative: it rejects and clears the
 * cache so a deleted account can't live on offline.
 */
async function resolveProfileAndInvitation(
    session: Session,
): Promise<{ profile: User | null; invitationStatus: InvitationStatus }> {
    const { profile, networkFailed } = await fetchUserProfile(
        session.user.id,
        session.access_token,
        session.user.phone || null,
    );
    if (profile) {
        const invitationStatus = await checkInvitationStatus(profile.id, profile.created_at);
        if (invitationStatus === 'valid' || invitationStatus === 'skipped') {
            saveCachedProfile(profile, invitationStatus).catch(() => {});
        }
        return { profile, invitationStatus };
    }
    if (networkFailed) {
        const cached = await loadCachedProfile(session.user.id);
        if (cached) {
            return { profile: cached.profile, invitationStatus: cached.invitationStatus };
        }
    } else {
        await clearCachedProfile();
    }
    return { profile: null, invitationStatus: 'rejected' };
}

async function updateLastLogin(userId: string) {
    await supabase.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', userId);
}

/** Sync public.users name + role into auth JWT metadata */
async function syncAuthMetadata() {
    await supabase.rpc('sync_auth_metadata');
}

async function registerPushToken(userId: string) {
    try {
        const Notifications = await import('expo-notifications');
        const Constants = (await import('expo-constants')).default;

        // Expo SDK 52+ requires projectId for production / standalone builds.
        // Without it, getExpoPushTokenAsync returns null on App Store / TestFlight
        // builds, silently breaking push notifications. Constants.expoConfig.extra
        // is populated from app.config.js extra block.
        const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
        if (!projectId) {
            console.warn('[push] EAS projectId missing — push tokens will not register on production builds');
            return;
        }

        const { status } = await Notifications.getPermissionsAsync();
        const finalStatus = status === 'granted' ? status : (await Notifications.requestPermissionsAsync()).status;
        if (finalStatus !== 'granted') return;

        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        if (!tokenData?.data) {
            console.warn('[push] getExpoPushTokenAsync returned no token');
            return;
        }

        await supabase.from('users').update({ push_token: tokenData.data }).eq('id', userId);
    } catch (err) {
        // Push token registration is non-critical — never throw
        console.warn('[push] registerPushToken failed:', err);
    }
}

// ── Providers ─────────────────────────────────────────────────

function BiometricsProvider({
    children,
    sessionRef: _sessionRef,
    onBiometricUnlock,
}: {
    children: React.ReactNode;
    sessionRef: React.MutableRefObject<Session | null>;
    onBiometricUnlock: (
        session: Session | null,
        resolved: { profile: User | null; invitationStatus: InvitationStatus },
    ) => void;
}) {
    const [biometricsEnabled, setBiometricsEnabledState] = useState(false);

    // Sync biometricsEnabled when auth finishes init
    useEffect(() => {
        isBiometricsEnabled().then(setBiometricsEnabledState);
    }, []);

    const authenticateWithBiometrics = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
        try {
            const success = await authenticate('Sign in to Lyfe');
            if (!success) return { success: false };

            let session: Session | null = null;
            let networkFailed = false;

            // Try stored refresh token first (saved during sign-out with biometrics)
            const storedToken = await getBiometricRefreshToken();
            if (storedToken) {
                try {
                    const { data, error } = await supabase.auth.refreshSession({
                        refresh_token: storedToken,
                    });
                    if (data?.session) {
                        session = data.session;
                        await clearBiometricRefreshToken();
                    } else if (isAuthNetworkFailure(error)) {
                        // Offline — keep the stored token for the next online
                        // unlock and fall through to the local-session fallback.
                        networkFailed = true;
                    } else {
                        await clearBiometricRefreshToken();
                        return { success: false, error: 'Session expired — please sign in with OTP.' };
                    }
                } catch (e) {
                    if (!isNetworkError(e) && !isAuthNetworkFailure(e)) throw e;
                    networkFailed = true;
                }
            }

            if (!session) {
                // No stored token (first launch after enabling biometrics) or
                // the refresh couldn't reach the server. The biometric sign-out
                // flow never revokes the local session, so fall back to it.
                const {
                    data: { session: existingSession },
                    error,
                } = await supabase.auth.getSession();
                session = existingSession;
                if (!session && isAuthNetworkFailure(error)) networkFailed = true;
            }

            if (session) {
                const resolved = await resolveProfileAndInvitation(session);
                if (resolved.profile) {
                    await updateLastLogin(session.user.id);
                    syncAuthMetadata().catch((e) => {
                        if (__DEV__) console.error('[BiometricsContext] syncAuthMetadata failed:', e);
                    });
                }
                onBiometricUnlock(session, resolved);
                return { success: true };
            }

            if (networkFailed) {
                // Offline cold start with an expired session (audit C2): the
                // refresh token survives in storage — auth-js keeps it on
                // retryable failures — so land on the last-known-good profile.
                // NetworkContext refreshes the session on reconnect and the
                // TOKEN_REFRESHED handler merges it back into auth state.
                const cached = await loadCachedProfile();
                if (cached) {
                    onBiometricUnlock(null, { profile: cached.profile, invitationStatus: cached.invitationStatus });
                    return { success: true };
                }
                return { success: false, error: 'You appear to be offline — reconnect and try again.' };
            }

            return { success: false, error: 'Session expired — please sign in with OTP.' };
        } catch (e) {
            if (__DEV__) console.error('[BiometricsContext] authenticateWithBiometrics error:', e);
            return { success: false };
        }
    }, [onBiometricUnlock]);

    const enableBiometrics = useCallback(async (): Promise<boolean> => {
        const available = await isBiometricsAvailable();
        if (!available) return false;

        const success = await authenticate('Enable biometric sign-in for Lyfe');
        if (!success) return false;

        await setBiometricsEnabled(true);
        setBiometricsEnabledState(true);
        return true;
    }, []);

    const disableBiometrics = useCallback(async (): Promise<void> => {
        await setBiometricsEnabled(false);
        setBiometricsEnabledState(false);
    }, []);

    const biometricsValue = useMemo(
        () => ({
            biometricsEnabled,
            authenticateWithBiometrics,
            enableBiometrics,
            disableBiometrics,
        }),
        [biometricsEnabled, authenticateWithBiometrics, enableBiometrics, disableBiometrics],
    );

    return <BiometricsContext.Provider value={biometricsValue}>{children}</BiometricsContext.Provider>;
}

function ProfileProvider({
    children,
    sessionRef,
    user,
    setUser,
}: {
    children: React.ReactNode;
    sessionRef: React.MutableRefObject<Session | null>;
    user: User | null;
    setUser: React.Dispatch<React.SetStateAction<User | null>>;
}) {
    const updateProfile = useCallback(
        async (name: string, email: string | null): Promise<{ error: string | null }> => {
            const trimmedName = name.trim();
            const trimmedEmail = email?.trim() || null;
            if (!sessionRef.current?.user?.id) return { error: 'Not authenticated' };
            const { error } = await supabase
                .from('users')
                .update({ full_name: trimmedName, email: trimmedEmail })
                .eq('id', sessionRef.current.user.id);
            if (error) return { error: error.message };
            setUser((prev) => (prev ? { ...prev, full_name: trimmedName, email: trimmedEmail } : prev));
            return { error: null };
        },
        [sessionRef, setUser],
    );

    const updateAvatarUrl = useCallback(
        (url: string | null) => {
            setUser((prev) => (prev ? { ...prev, avatar_url: url } : prev));
        },
        [setUser],
    );

    // Optimistic updater used by the Lyfe ID registration screen after a
    // successful registerFace() call. Pass `null` to clear (future "Remove
    // Lyfe ID" flow). Keeps the Profile card reactive without a round-trip.
    const updateFaceRegisteredAt = useCallback(
        (iso: string | null) => {
            setUser((prev) => (prev ? { ...prev, face_registered_at: iso } : prev));
        },
        [setUser],
    );

    const refreshUser = useCallback(async () => {
        if (sessionRef.current?.user) {
            const { profile, networkFailed } = await fetchUserProfile(
                sessionRef.current.user.id,
                sessionRef.current.access_token,
            );
            // Don't wipe a perfectly good in-memory profile because the
            // refresh ran offline — only authoritative answers update state.
            if (!networkFailed) setUser(profile);
        }
    }, [sessionRef, setUser]);

    const profileValue = useMemo(
        () => ({ user, updateProfile, updateAvatarUrl, updateFaceRegisteredAt, refreshUser }),
        [user, updateProfile, updateAvatarUrl, updateFaceRegisteredAt, refreshUser],
    );

    return <ProfileContext.Provider value={profileValue}>{children}</ProfileContext.Provider>;
}

// Supabase's auto-refresh can fail silently when the network is mid-reconnect
// (e.g., right after backgrounding→foregrounding or an OTA reload), leaving
// in-memory session null even though the refresh token in storage is valid.
// Retry an explicit refresh with backoff before declaring the user logged out.
// Bail early on auth errors — refresh token genuinely invalid means really
// signed out (revoked elsewhere, expired) and no amount of retrying will help.
async function restoreSessionWithRetry(): Promise<{ session: Session | null; networkFailed: boolean }> {
    const initial = await supabase.auth.getSession();
    if (initial.data.session) return { session: initial.data.session, networkFailed: false };
    // getSession refreshes expired sessions internally; offline that surfaces
    // as a retryable fetch error with the refresh token still safe in storage.
    let networkFailed = isAuthNetworkFailure(initial.error);

    const delays = [0, 1000, 2500];
    for (const delay of delays) {
        if (delay > 0) await new Promise((r) => setTimeout(r, delay));
        try {
            const { data, error } = await supabase.auth.refreshSession();
            if (data?.session) return { session: data.session, networkFailed: false };
            if (isAuthNetworkFailure(error)) {
                networkFailed = true;
                continue;
            }
            // Auth-level outcome (invalid / absent token): genuinely signed out.
            return { session: null, networkFailed: false };
        } catch (e) {
            // Transport-level throw — keep retrying
            if (isNetworkError(e) || isAuthNetworkFailure(e)) networkFailed = true;
        }
    }
    return { session: null, networkFailed };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [authState, setAuthState] = useState<AuthState>({
        session: null,
        isLoading: true,
        isAuthenticated: false,
        pendingBiometricSession: false,
        invitationStatus: 'checking',
    });
    const [user, setUser] = useState<User | null>(null);

    const sessionRef = useRef<Session | null>(null);
    sessionRef.current = authState.session;

    // Mirror the active session into a module-level cache so hot-path lib
    // functions (fetchLeads, etc.) can read the access_token directly,
    // bypassing supabase.auth.getSession() which can return null mid-
    // session in RN with the chunked SecureStore adapter (see lib/sessionCache).
    if (authState.session) {
        setCachedSession({
            access_token: authState.session.access_token,
            user_id: authState.session.user?.id ?? null,
        });
    } else if (authState.isAuthenticated && user) {
        // Offline grace (expired session, network-only failure): no token to
        // mirror, but stamp the user id so offline-queued writes still carry
        // ownership for the SyncManager's per-user replay check.
        setCachedSession({ access_token: null, user_id: user.id });
    } else {
        clearCachedSession();
    }

    /** Called by BiometricsProvider after successful Face ID. `session` is
     *  null in the offline-grace path (expired session, cached profile). */
    const handleBiometricUnlock = useCallback(
        (session: Session | null, resolved: { profile: User | null; invitationStatus: InvitationStatus }) => {
            const { profile, invitationStatus } = resolved;
            if (profile) {
                setSentryUser({ id: profile.id, phone: profile.phone, role: profile.role });
                setUser(profile);
                // Re-register push token on biometric unlock too — covers the
                // reinstall + biometric-only flow where the OTP path never runs.
                registerPushToken(profile.id).catch((e) => {
                    if (__DEV__) console.error('[AuthContext] registerPushToken (biometric) failed:', e);
                });
                setAuthState((prev) => ({
                    ...prev,
                    session,
                    isAuthenticated: true,
                    pendingBiometricSession: false,
                    invitationStatus,
                }));
            } else {
                setUser(null);
                setAuthState((prev) => ({
                    ...prev,
                    session,
                    isAuthenticated: false,
                    pendingBiometricSession: false,
                    invitationStatus: 'rejected',
                }));
            }
        },
        [],
    );

    useEffect(() => {
        const initAuth = async () => {
            try {
                // If this init follows an OTA-triggered reload, the user already
                // passed any auth gate in the prior session — skip the biometric
                // gate so the reload is transparent. Flag is one-shot.
                const otaReloadFlag = await AsyncStorage.getItem(OTA_RELOAD_FLAG_KEY);
                const skipBioGate = !!otaReloadFlag;
                if (skipBioGate) {
                    await AsyncStorage.removeItem(OTA_RELOAD_FLAG_KEY);
                }

                const { session, networkFailed: restoreNetworkFailed } = await restoreSessionWithRetry();

                const bioEnabled = await isBiometricsEnabled();
                const bioAvailable = bioEnabled && (await isBiometricsAvailable());

                if (bioEnabled && bioAvailable && !skipBioGate) {
                    // Biometric gate: show prompt whether we have a session, a
                    // stored refresh token, or an offline-grace cached profile
                    // (expired session that only failed to refresh because the
                    // device is offline — the unlock path serves the cache).
                    const hasStoredToken = !!(await getBiometricRefreshToken());
                    const hasOfflineGrace = restoreNetworkFailed && !!(await loadCachedProfile());
                    if (session?.user || hasStoredToken || hasOfflineGrace) {
                        setAuthState({
                            session: null,
                            isLoading: false,
                            isAuthenticated: false,
                            pendingBiometricSession: true,
                            invitationStatus: 'checking',
                        });
                        return;
                    }
                }

                if (session?.user) {
                    const phone = session.user.phone || null;
                    const { profile, invitationStatus } = await resolveProfileAndInvitation(session);
                    if (profile) {
                        await updateLastLogin(session.user.id);
                        syncAuthMetadata().catch((e) => {
                            if (__DEV__) console.error('[AuthContext] syncAuthMetadata failed:', e);
                        });
                        registerPushToken(session.user.id).catch((e) => {
                            if (__DEV__) console.error('[AuthContext] registerPushToken failed:', e);
                        });
                        setSentryUser({ id: session.user.id, phone, role: profile.role });
                        setUser(profile);
                        setAuthState({
                            session,
                            isLoading: false,
                            isAuthenticated: true,
                            pendingBiometricSession: false,
                            invitationStatus,
                        });
                    } else {
                        setUser(null);
                        setAuthState({
                            session,
                            isLoading: false,
                            isAuthenticated: false,
                            pendingBiometricSession: false,
                            invitationStatus: 'rejected',
                        });
                    }
                } else if (restoreNetworkFailed) {
                    // Offline grace (audit C2): the session couldn't be restored
                    // ONLY because the network is down — auth-js keeps the
                    // refresh token in storage on retryable failures. Land the
                    // device's last signed-in (never signed-out) user on their
                    // cached profile instead of bouncing them to an OTP login
                    // screen that itself needs connectivity. On reconnect,
                    // NetworkContext refreshes the session and the
                    // TOKEN_REFRESHED handler merges it into this state.
                    const cached = await loadCachedProfile();
                    if (cached) {
                        setSentryUser({
                            id: cached.profile.id,
                            phone: cached.profile.phone,
                            role: cached.profile.role,
                        });
                        setUser(cached.profile);
                        setAuthState({
                            session: null,
                            isLoading: false,
                            isAuthenticated: true,
                            pendingBiometricSession: false,
                            invitationStatus: cached.invitationStatus,
                        });
                    } else {
                        setAuthState({
                            session: null,
                            isLoading: false,
                            isAuthenticated: false,
                            pendingBiometricSession: false,
                            invitationStatus: 'checking',
                        });
                    }
                } else {
                    setAuthState({
                        session: null,
                        isLoading: false,
                        isAuthenticated: false,
                        pendingBiometricSession: false,
                        invitationStatus: 'checking',
                    });
                }
            } catch (e) {
                if (__DEV__) console.error('[AuthContext] initAuth failed:', e);
                setAuthState({
                    session: null,
                    isLoading: false,
                    isAuthenticated: false,
                    pendingBiometricSession: false,
                    invitationStatus: 'checking',
                });
            }
        };

        initAuth();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'INITIAL_SESSION') return;

            // Silent token refreshes only update the session; skip the user
            // profile re-fetch and downstream work. The render-time mirror at
            // the top of this provider then propagates the new access_token
            // into sessionCache so customFetch retries pick up the fresh JWT.
            if (event === 'TOKEN_REFRESHED') {
                setAuthState((prev) => ({ ...prev, session }));
                return;
            }

            if (session?.user) {
                const { profile, invitationStatus } = await resolveProfileAndInvitation(session);
                if (profile) {
                    registerPushToken(session.user.id).catch((e) => {
                        if (__DEV__) console.error('[AuthContext] registerPushToken failed:', e);
                    });
                    setSentryUser({
                        id: session.user.id,
                        phone: session.user.phone,
                        role: profile.role,
                    });
                    setUser(profile);
                    setAuthState((prev) => ({
                        ...prev,
                        session,
                        isLoading: false,
                        isAuthenticated: true,
                        pendingBiometricSession: false,
                        invitationStatus,
                    }));
                } else {
                    setUser(null);
                    setAuthState((prev) => ({
                        ...prev,
                        session,
                        isLoading: false,
                        isAuthenticated: false,
                        pendingBiometricSession: false,
                        invitationStatus: 'rejected',
                    }));
                }
            } else {
                // SIGNED_OUT / revoked: the last-known-good cache must not
                // outlive the account's access.
                clearCachedProfile().catch(() => {});
                clearSentryUser();
                setUser(null);
                setAuthState((prev) => ({
                    ...prev,
                    session: null,
                    isLoading: false,
                    isAuthenticated: false,
                    pendingBiometricSession: false,
                    invitationStatus: 'checking',
                }));
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const checkPhoneEligible = useCallback(async (phone: string): Promise<PhoneEligibility> => {
        try {
            const { data, error } = await supabase.rpc('check_phone_eligible', {
                phone_input: phone,
            });
            if (error) {
                if (__DEV__) console.error('[AuthContext] checkPhoneEligible RPC error:', error.message);
                // Fail open — if RPC fails, allow OTP to proceed (don't block login)
                return { eligible: true, reason: 'existing_user' };
            }
            return data as PhoneEligibility;
        } catch {
            // Network error or unexpected failure — fail open
            return { eligible: true, reason: 'existing_user' };
        }
    }, []);

    const signInWithOtp = useCallback(async (phone: string) => {
        const { error } = await supabase.auth.signInWithOtp({ phone });
        return { error: error ? new Error(error.message) : null };
    }, []);

    const verifyOtp = useCallback(async (phone: string, token: string) => {
        const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
        return { error: error ? new Error(error.message) : null };
    }, []);

    const recheckInvitation = useCallback(async () => {
        const profile = user;
        if (!profile) return;
        const invStatus = await checkInvitationStatus(profile.id, profile.created_at);
        setAuthState((prev) => ({ ...prev, invitationStatus: invStatus }));
    }, [user]);

    const signOut = useCallback(async () => {
        await AsyncStorage.removeItem('lyfe_view_mode');

        const bioEnabled = await isBiometricsEnabled();
        if (bioEnabled) {
            // When biometrics are enabled, we keep the server session alive so the
            // refresh token remains valid for Face ID re-auth. The biometric gate
            // on the login screen protects device-level access. We just save the
            // token and update app state — no signOut call at all.
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (session?.refresh_token) {
                await storeBiometricRefreshToken(session.refresh_token);
            }
        } else {
            await supabase.auth.signOut();
            // Real sign-out: drop the last-known-good profile so the offline
            // grace path can't resurrect a signed-out account. (Biometric
            // "sign-out" keeps it — Face ID unlock may need it offline.)
            await clearCachedProfile();
        }

        clearSentryUser();
        setUser(null);
        setAuthState((prev) => ({
            ...prev,
            session: null,
            isLoading: false,
            isAuthenticated: false,
            pendingBiometricSession: bioEnabled,
            invitationStatus: 'checking',
        }));
    }, []);

    // Note: authState includes pendingBiometricSession which triggers re-renders
    // on every auth state change. It could be moved to a useRef since no consumer
    // uses it for rendering, but it's part of the public API (AuthContextType) and
    // tested directly, so the trade-off favors keeping it as state for now.
    const authValue = useMemo(
        () => ({
            ...authState,
            checkPhoneEligible,
            signInWithOtp,
            verifyOtp,
            recheckInvitation,
            signOut,
        }),
        [authState, checkPhoneEligible, signInWithOtp, verifyOtp, recheckInvitation, signOut],
    );

    return (
        <AuthContext.Provider value={authValue}>
            <ProfileProvider sessionRef={sessionRef} user={user} setUser={setUser}>
                <BiometricsProvider sessionRef={sessionRef} onBiometricUnlock={handleBiometricUnlock}>
                    {children}
                </BiometricsProvider>
            </ProfileProvider>
        </AuthContext.Provider>
    );
}

// ── Hooks ─────────────────────────────────────────────────────

/** Auth-only hook — session, loading, signIn/signOut */
function useAuthContext() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuthContext must be used within an AuthProvider');
    return context;
}

/** Profile hook — user, updateProfile, updateAvatarUrl, refreshUser */
export function useProfile() {
    const context = useContext(ProfileContext);
    if (!context) throw new Error('useProfile must be used within an AuthProvider');
    return context;
}

/** Biometrics hook */
export function useBiometrics() {
    const context = useContext(BiometricsContext);
    if (!context) throw new Error('useBiometrics must be used within an AuthProvider');
    return context;
}

/** Combined hook — backward compatible, merges all three contexts */
export function useAuth() {
    const auth = useAuthContext();
    const profile = useContext(ProfileContext);
    const biometrics = useContext(BiometricsContext);
    return {
        ...auth,
        ...(profile ?? {
            user: null,
            updateProfile: async () => ({ error: 'Not ready' }),
            updateAvatarUrl: () => {},
            updateFaceRegisteredAt: () => {},
            refreshUser: async () => {},
        }),
        ...(biometrics ?? {
            biometricsEnabled: false,
            authenticateWithBiometrics: async (): Promise<{ success: boolean; error?: string }> => ({ success: false }),
            enableBiometrics: async () => false,
            disableBiometrics: async () => {},
        }),
    };
}
