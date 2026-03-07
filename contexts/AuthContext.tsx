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

interface AuthState {
    session: Session | null;
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    // true when a session exists in storage but is gated behind biometrics
    pendingBiometricSession: boolean;
    biometricsEnabled: boolean;
}

interface AuthContextType extends AuthState {
    signInWithOtp: (phone: string) => Promise<{ error: Error | null }>;
    verifyOtp: (phone: string, token: string) => Promise<{ error: Error | null }>;
    signOut: () => Promise<void>;
    refreshUser: () => Promise<void>;
    updateAvatarUrl: (url: string | null) => void;
    updateProfile: (name: string, email: string | null) => Promise<{ error: string | null }>;
    authenticateWithBiometrics: () => Promise<{ success: boolean }>;
    enableBiometrics: () => Promise<boolean>;
    disableBiometrics: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<AuthState>({
        session: null,
        user: null,
        isLoading: true,
        isAuthenticated: false,
        pendingBiometricSession: false,
        biometricsEnabled: false,
    });

    // Track the live session so signOut can soft-lock without calling getSession()
    const sessionRef = useRef<Session | null>(null);
    sessionRef.current = state.session;

    /** Fetch the user profile from public.users, creating it if needed */
    const fetchUserProfile = useCallback(async (userId: string, phone?: string | null): Promise<User | null> => {
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
                console.error('Error creating user profile:', insertError.message);
                return null;
            }
            return newUser as User;
        }

        if (error) {
            console.error('Error fetching user profile:', error.message);
            return null;
        }
        return null;
    }, []);

    /** Update last_login_at timestamp */
    const updateLastLogin = useCallback(async (userId: string) => {
        await supabase
            .from('users')
            .update({ last_login_at: new Date().toISOString() })
            .eq('id', userId);
    }, []);

    /** Initialize auth state on mount */
    useEffect(() => {
        const initAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();

                if (session?.user) {
                    const bioEnabled = await isBiometricsEnabled();
                    const bioAvailable = await isBiometricsAvailable();

                    if (bioEnabled && bioAvailable) {
                        // Session exists but is gated — show the Face ID screen
                        setState({
                            session: null,
                            user: null,
                            isLoading: false,
                            isAuthenticated: false,
                            pendingBiometricSession: true,
                            biometricsEnabled: true,
                        });
                        return;
                    }

                    const phone = session.user.phone || null;
                    const profile = await fetchUserProfile(session.user.id, phone);
                    if (profile) {
                        await updateLastLogin(session.user.id);
                        registerPushToken(session.user.id);
                    }
                    setState({
                        session,
                        user: profile,
                        isLoading: false,
                        isAuthenticated: !!profile,
                        pendingBiometricSession: false,
                        biometricsEnabled: bioEnabled,
                    });
                } else {
                    const bioEnabled = await isBiometricsEnabled();
                    setState({
                        session: null,
                        user: null,
                        isLoading: false,
                        isAuthenticated: false,
                        pendingBiometricSession: false,
                        biometricsEnabled: bioEnabled,
                    });
                }
            } catch (e) {
                console.error('[AuthContext] initAuth failed:', e);
                setState({
                    session: null,
                    user: null,
                    isLoading: false,
                    isAuthenticated: false,
                    pendingBiometricSession: false,
                    biometricsEnabled: false,
                });
            }
        };

        initAuth();

        // onAuthStateChange handles live OTP logins — never gates behind biometrics
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            // INITIAL_SESSION is handled by initAuth() above (with biometric gating).
            // TOKEN_REFRESHED must be ignored when the biometric gate is active.
            if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;

            if (session?.user) {
                const profile = await fetchUserProfile(session.user.id, session.user.phone || null);
                if (profile) registerPushToken(session.user.id);
                const bioEnabled = await isBiometricsEnabled();
                setState(prev => ({
                    ...prev,
                    session,
                    user: profile,
                    isLoading: false,
                    isAuthenticated: !!profile,
                    pendingBiometricSession: false,
                    biometricsEnabled: bioEnabled,
                }));
            } else {
                setState(prev => ({
                    ...prev,
                    session: null,
                    user: null,
                    isLoading: false,
                    isAuthenticated: false,
                    pendingBiometricSession: false,
                }));
            }
        });

        return () => subscription.unsubscribe();
    }, [fetchUserProfile, updateLastLogin]);

    /** Send OTP to phone number */
    const signInWithOtp = useCallback(async (phone: string) => {
        const { error } = await supabase.auth.signInWithOtp({ phone });
        return { error: error ? new Error(error.message) : null };
    }, []);

    /** Verify OTP code */
    const verifyOtp = useCallback(async (phone: string, token: string) => {
        const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
        return { error: error ? new Error(error.message) : null };
    }, []);

    /**
     * Authenticate with Face ID / Touch ID.
     * Face ID is verified FIRST, then the session is read from SecureStore.
     * This avoids any race condition with the pending session ref.
     */
    const authenticateWithBiometrics = useCallback(async (): Promise<{ success: boolean }> => {
        try {
            // Verify identity first
            const success = await authenticate('Sign in to Lyfe');
            if (!success) return { success: false };

            // Read session from SecureStore after successful Face ID
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                // Session has genuinely expired — user must log in with OTP
                setState(prev => ({ ...prev, pendingBiometricSession: false, biometricsEnabled: false }));
                await setBiometricsEnabled(false);
                return { success: false };
            }

            const profile = await fetchUserProfile(session.user.id, session.user.phone || null);
            if (profile) await updateLastLogin(session.user.id);

            setState(prev => ({
                ...prev,
                session,
                user: profile,
                isAuthenticated: !!profile,
                pendingBiometricSession: false,
            }));

            return { success: true };
        } catch (e) {
            console.error('[AuthContext] authenticateWithBiometrics error:', e);
            return { success: false };
        }
    }, [fetchUserProfile, updateLastLogin]);

    /**
     * Enable biometrics after a successful OTP login.
     */
    const enableBiometrics = useCallback(async (): Promise<boolean> => {
        const available = await isBiometricsAvailable();
        if (!available) return false;

        const success = await authenticate('Enable biometric sign-in for Lyfe');
        if (!success) return false;

        await setBiometricsEnabled(true);
        setState(prev => ({ ...prev, biometricsEnabled: true }));
        return true;
    }, []);

    /** Disable biometrics */
    const disableBiometrics = useCallback(async (): Promise<void> => {
        await setBiometricsEnabled(false);
        setState(prev => ({ ...prev, biometricsEnabled: false }));
    }, []);

    /**
     * Sign out — soft-locks when biometrics are enabled so Face ID can re-enter.
     * Uses sessionRef to avoid calling getSession() which can trigger auth state changes.
     */
    const signOut = useCallback(async () => {
        await AsyncStorage.removeItem('lyfe_view_mode');

        const bioEnabled = await isBiometricsEnabled();
        const hasLiveSession = !!sessionRef.current;

        if (bioEnabled && hasLiveSession) {
            // Soft lock: keep session in SecureStore, show Face ID gate
            setState(prev => ({
                ...prev,
                session: null,
                user: null,
                isAuthenticated: false,
                pendingBiometricSession: true,
            }));
            return;
        }

        // Full sign out
        await supabase.auth.signOut();
        setState(prev => ({
            ...prev,
            session: null,
            user: null,
            isLoading: false,
            isAuthenticated: false,
            pendingBiometricSession: false,
        }));
    }, []);

    /** Directly update the avatar URL in local state (after upload/remove) */
    const updateAvatarUrl = useCallback((url: string | null) => {
        setState(prev => prev.user ? { ...prev, user: { ...prev.user, avatar_url: url } } : prev);
    }, []);

    /** Update full_name and email in Supabase and local state */
    const updateProfile = useCallback(async (name: string, email: string | null): Promise<{ error: string | null }> => {
        const trimmedName = name.trim();
        const trimmedEmail = email?.trim() || null;
        if (!sessionRef.current?.user?.id) return { error: 'Not authenticated' };
        const { error } = await supabase
            .from('users')
            .update({ full_name: trimmedName, email: trimmedEmail })
            .eq('id', sessionRef.current.user.id);
        if (error) return { error: error.message };
        setState(prev => prev.user ? { ...prev, user: { ...prev.user, full_name: trimmedName, email: trimmedEmail } } : prev);
        return { error: null };
    }, []);

    /** Register Expo push token and store to users table */
    const registerPushToken = useCallback(async (userId: string) => {
        try {
            // Dynamic import so missing native module never crashes the app
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
    }, []);

    /** Refresh user profile */
    const refreshUser = useCallback(async () => {
        if (sessionRef.current?.user) {
            const profile = await fetchUserProfile(sessionRef.current.user.id);
            setState(prev => ({ ...prev, user: profile }));
        }
    }, [fetchUserProfile]);

    return (
        <AuthContext.Provider
            value={{
                ...state,
                signInWithOtp,
                verifyOtp,
                signOut,
                refreshUser,
                updateAvatarUrl,
                updateProfile,
                authenticateWithBiometrics,
                enableBiometrics,
                disableBiometrics,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
