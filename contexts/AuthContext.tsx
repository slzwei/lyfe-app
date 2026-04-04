import {
    authenticate,
    clearBiometricRefreshToken,
    getBiometricRefreshToken,
    isBiometricsAvailable,
    isBiometricsEnabled,
    setBiometricsEnabled,
    storeBiometricRefreshToken,
} from '@/lib/biometrics';
import { clearSentryUser, setSentryUser } from '@/lib/sentry';
import { supabase } from '@/lib/supabase';
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

interface AuthContextType extends AuthState {
    signInWithOtp: (phone: string) => Promise<{ error: Error | null }>;
    verifyOtp: (phone: string, token: string) => Promise<{ error: Error | null }>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ── Profile context ───────────────────────────────────────────
interface ProfileContextType {
    user: User | null;
    updateProfile: (name: string, email: string | null) => Promise<{ error: string | null }>;
    updateAvatarUrl: (url: string | null) => void;
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
 * Fetch the user profile from public.users.
 * The handle_new_user DB trigger creates the row on auth signup,
 * so we retry briefly if the row hasn't appeared yet (race condition).
 */
async function fetchUserProfile(userId: string, _phone?: string | null): Promise<User | null> {
    for (let attempt = 0; attempt < 3; attempt++) {
        const { data, error } = await supabase.from('users').select('*').eq('id', userId).single();
        if (data) return data as User;
        if (error?.code !== 'PGRST116') {
            if (__DEV__) console.error('Error fetching user profile:', error?.message);
            return null;
        }
        // Row not yet created by trigger — wait briefly and retry
        if (attempt < 2) await new Promise((r) => setTimeout(r, 150));
    }
    if (__DEV__) console.error('User profile not found after retries');
    return null;
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

    // Check member_invitations (new system)
    const { data: memberInv } = await supabase
        .from('member_invitations')
        .select('id')
        .eq('accepted_by_id', userId)
        .eq('status', 'accepted')
        .limit(1)
        .maybeSingle();

    if (memberInv) return 'valid';

    // Check legacy invitations (lyfe-sg candidate flow)
    const { data: legacyInv } = await supabase
        .from('invitations')
        .select('id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

    if (legacyInv) return 'valid';

    return 'rejected';
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
        const { status } = await Notifications.getPermissionsAsync();
        const finalStatus = status === 'granted' ? status : (await Notifications.requestPermissionsAsync()).status;
        if (finalStatus !== 'granted') return;

        const tokenData = await Notifications.getExpoPushTokenAsync();
        if (!tokenData?.data) return;

        await supabase.from('users').update({ push_token: tokenData.data }).eq('id', userId);
    } catch {
        // Push token registration is non-critical — never throw
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
    onBiometricUnlock: (session: Session, profile: User | null) => void;
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

            // Try stored refresh token first (saved during sign-out with biometrics)
            const storedToken = await getBiometricRefreshToken();
            if (storedToken) {
                const { data, error } = await supabase.auth.refreshSession({
                    refresh_token: storedToken,
                });
                if (error || !data.session) {
                    await clearBiometricRefreshToken();
                    return { success: false, error: 'Session expired — please sign in with OTP.' };
                }
                session = data.session;
                await clearBiometricRefreshToken();
            } else {
                // Fallback: try existing session in storage (first launch after enabling biometrics)
                const {
                    data: { session: existingSession },
                } = await supabase.auth.getSession();
                session = existingSession;
            }

            if (!session) {
                return { success: false, error: 'Session expired — please sign in with OTP.' };
            }

            const profile = await fetchUserProfile(session.user.id, session.user.phone || null);
            if (profile) {
                await updateLastLogin(session.user.id);
                syncAuthMetadata().catch((e) => {
                    if (__DEV__) console.error('[BiometricsContext] syncAuthMetadata failed:', e);
                });
            }

            onBiometricUnlock(session, profile);
            return { success: true };
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

    const refreshUser = useCallback(async () => {
        if (sessionRef.current?.user) {
            const profile = await fetchUserProfile(sessionRef.current.user.id);
            setUser(profile);
        }
    }, [sessionRef, setUser]);

    const profileValue = useMemo(
        () => ({ user, updateProfile, updateAvatarUrl, refreshUser }),
        [user, updateProfile, updateAvatarUrl, refreshUser],
    );

    return <ProfileContext.Provider value={profileValue}>{children}</ProfileContext.Provider>;
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

    /** Called by BiometricsProvider after successful Face ID */
    const handleBiometricUnlock = useCallback(async (session: Session, profile: User | null) => {
        if (profile) {
            const invStatus = await checkInvitationStatus(profile.id, profile.created_at);
            setSentryUser({ id: session.user.id, phone: session.user.phone, role: profile.role });
            setUser(profile);
            setAuthState((prev) => ({
                ...prev,
                session,
                isAuthenticated: true,
                pendingBiometricSession: false,
                invitationStatus: invStatus,
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
    }, []);

    useEffect(() => {
        const initAuth = async () => {
            try {
                const {
                    data: { session },
                } = await supabase.auth.getSession();

                const bioEnabled = await isBiometricsEnabled();
                const bioAvailable = bioEnabled && (await isBiometricsAvailable());

                if (bioEnabled && bioAvailable) {
                    // Biometric gate: show prompt whether we have a session or a stored refresh token
                    const hasStoredToken = !!(await getBiometricRefreshToken());
                    if (session?.user || hasStoredToken) {
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
                    const profile = await fetchUserProfile(session.user.id, phone);
                    if (profile) {
                        const invStatus = await checkInvitationStatus(profile.id, profile.created_at);
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
                            invitationStatus: invStatus,
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
            if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;

            if (session?.user) {
                const profile = await fetchUserProfile(session.user.id, session.user.phone || null);
                if (profile) {
                    const invStatus = await checkInvitationStatus(profile.id, profile.created_at);
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
                        invitationStatus: invStatus,
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

    const signInWithOtp = useCallback(async (phone: string) => {
        const { error } = await supabase.auth.signInWithOtp({ phone });
        return { error: error ? new Error(error.message) : null };
    }, []);

    const verifyOtp = useCallback(async (phone: string, token: string) => {
        const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
        return { error: error ? new Error(error.message) : null };
    }, []);

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
            signInWithOtp,
            verifyOtp,
            signOut,
        }),
        [authState, signInWithOtp, verifyOtp, signOut],
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
            refreshUser: async () => {},
        }),
        ...(biometrics ?? {
            biometricsEnabled: false,
            authenticateWithBiometrics: async () => ({ success: false }),
            enableBiometrics: async () => false,
            disableBiometrics: async () => {},
        }),
    };
}
