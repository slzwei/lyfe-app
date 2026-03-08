import {
    authenticate,
    isBiometricsAvailable,
    isBiometricsEnabled,
    setBiometricsEnabled,
} from '@/lib/biometrics';
import { supabase } from '@/lib/supabase';
import type { User } from '@/types/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

// ── Auth-only context ─────────────────────────────────────────
interface AuthState {
    session: Session | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    pendingBiometricSession: boolean;
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
    authenticateWithBiometrics: () => Promise<{ success: boolean }>;
    enableBiometrics: () => Promise<boolean>;
    disableBiometrics: () => Promise<void>;
}

const BiometricsContext = createContext<BiometricsContextType | undefined>(undefined);

// ── Helpers ───────────────────────────────────────────────────

/** Fetch the user profile from public.users, creating it if needed */
async function fetchUserProfile(userId: string, phone?: string | null): Promise<User | null> {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

    if (data) return data as User;

    if (error?.code === 'PGRST116') {
        const { data: newUser, error: insertError } = await supabase
            .from('users')
            .insert({
                id: userId,
                phone: phone || null,
                full_name: 'New User',
                role: 'candidate',
            })
            .select()
            .single();

        if (insertError) {
            if (__DEV__) console.error('Error creating user profile:', insertError.message);
            return null;
        }
        return newUser as User;
    }

    if (error) {
        if (__DEV__) console.error('Error fetching user profile:', error.message);
        return null;
    }
    return null;
}

async function updateLastLogin(userId: string) {
    await supabase
        .from('users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', userId);
}

async function registerPushToken(userId: string) {
    try {
        const Notifications = await import('expo-notifications');
        const { status } = await Notifications.getPermissionsAsync();
        const finalStatus = status === 'granted'
            ? status
            : (await Notifications.requestPermissionsAsync()).status;
        if (finalStatus !== 'granted') return;

        const tokenData = await Notifications.getExpoPushTokenAsync();
        if (!tokenData?.data) return;

        await supabase
            .from('users')
            .update({ push_token: tokenData.data })
            .eq('id', userId);
    } catch {
        // Push token registration is non-critical — never throw
    }
}

// ── Providers ─────────────────────────────────────────────────

function BiometricsProvider({
    children,
    sessionRef,
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

    const authenticateWithBiometrics = useCallback(async (): Promise<{ success: boolean }> => {
        try {
            const success = await authenticate('Sign in to Lyfe');
            if (!success) return { success: false };

            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setBiometricsEnabledState(false);
                await setBiometricsEnabled(false);
                return { success: false };
            }

            const profile = await fetchUserProfile(session.user.id, session.user.phone || null);
            if (profile) await updateLastLogin(session.user.id);

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

    return (
        <BiometricsContext.Provider
            value={{
                biometricsEnabled,
                authenticateWithBiometrics,
                enableBiometrics,
                disableBiometrics,
            }}
        >
            {children}
        </BiometricsContext.Provider>
    );
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
    const updateProfile = useCallback(async (name: string, email: string | null): Promise<{ error: string | null }> => {
        const trimmedName = name.trim();
        const trimmedEmail = email?.trim() || null;
        if (!sessionRef.current?.user?.id) return { error: 'Not authenticated' };
        const { error } = await supabase
            .from('users')
            .update({ full_name: trimmedName, email: trimmedEmail })
            .eq('id', sessionRef.current.user.id);
        if (error) return { error: error.message };
        setUser(prev => prev ? { ...prev, full_name: trimmedName, email: trimmedEmail } : prev);
        return { error: null };
    }, [sessionRef, setUser]);

    const updateAvatarUrl = useCallback((url: string | null) => {
        setUser(prev => prev ? { ...prev, avatar_url: url } : prev);
    }, [setUser]);

    const refreshUser = useCallback(async () => {
        if (sessionRef.current?.user) {
            const profile = await fetchUserProfile(sessionRef.current.user.id);
            setUser(profile);
        }
    }, [sessionRef, setUser]);

    return (
        <ProfileContext.Provider value={{ user, updateProfile, updateAvatarUrl, refreshUser }}>
            {children}
        </ProfileContext.Provider>
    );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [authState, setAuthState] = useState<AuthState>({
        session: null,
        isLoading: true,
        isAuthenticated: false,
        pendingBiometricSession: false,
    });
    const [user, setUser] = useState<User | null>(null);

    const sessionRef = useRef<Session | null>(null);
    sessionRef.current = authState.session;

    /** Called by BiometricsProvider after successful Face ID */
    const handleBiometricUnlock = useCallback((session: Session, profile: User | null) => {
        setUser(profile);
        setAuthState(prev => ({
            ...prev,
            session,
            isAuthenticated: !!profile,
            pendingBiometricSession: false,
        }));
    }, []);

    useEffect(() => {
        const initAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();

                if (session?.user) {
                    const bioEnabled = await isBiometricsEnabled();
                    const bioAvailable = await isBiometricsAvailable();

                    if (bioEnabled && bioAvailable) {
                        setAuthState({
                            session: null,
                            isLoading: false,
                            isAuthenticated: false,
                            pendingBiometricSession: true,
                        });
                        return;
                    }

                    const phone = session.user.phone || null;
                    const profile = await fetchUserProfile(session.user.id, phone);
                    if (profile) {
                        await updateLastLogin(session.user.id);
                        registerPushToken(session.user.id);
                    }
                    setUser(profile);
                    setAuthState({
                        session,
                        isLoading: false,
                        isAuthenticated: !!profile,
                        pendingBiometricSession: false,
                    });
                } else {
                    setAuthState({
                        session: null,
                        isLoading: false,
                        isAuthenticated: false,
                        pendingBiometricSession: false,
                    });
                }
            } catch (e) {
                if (__DEV__) console.error('[AuthContext] initAuth failed:', e);
                setAuthState({
                    session: null,
                    isLoading: false,
                    isAuthenticated: false,
                    pendingBiometricSession: false,
                });
            }
        };

        initAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;

            if (session?.user) {
                const profile = await fetchUserProfile(session.user.id, session.user.phone || null);
                if (profile) registerPushToken(session.user.id);
                setUser(profile);
                setAuthState(prev => ({
                    ...prev,
                    session,
                    isLoading: false,
                    isAuthenticated: !!profile,
                    pendingBiometricSession: false,
                }));
            } else {
                setUser(null);
                setAuthState(prev => ({
                    ...prev,
                    session: null,
                    isLoading: false,
                    isAuthenticated: false,
                    pendingBiometricSession: false,
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
        const hasLiveSession = !!sessionRef.current;

        if (bioEnabled && hasLiveSession) {
            setUser(null);
            setAuthState(prev => ({
                ...prev,
                session: null,
                isAuthenticated: false,
                pendingBiometricSession: true,
            }));
            return;
        }

        await supabase.auth.signOut();
        setUser(null);
        setAuthState(prev => ({
            ...prev,
            session: null,
            isLoading: false,
            isAuthenticated: false,
            pendingBiometricSession: false,
        }));
    }, []);

    return (
        <AuthContext.Provider
            value={{
                ...authState,
                signInWithOtp,
                verifyOtp,
                signOut,
            }}
        >
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
        ...(profile ?? { user: null, updateProfile: async () => ({ error: 'Not ready' }), updateAvatarUrl: () => {}, refreshUser: async () => {} }),
        ...(biometrics ?? { biometricsEnabled: false, authenticateWithBiometrics: async () => ({ success: false }), enableBiometrics: async () => false, disableBiometrics: async () => {} }),
    };
}
