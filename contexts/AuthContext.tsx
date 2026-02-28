import { supabase } from '@/lib/supabase';
import type { User } from '@/types/database';
import type { Session } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

interface AuthState {
    session: Session | null;
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
    signInWithOtp: (phone: string) => Promise<{ error: Error | null }>;
    verifyOtp: (phone: string, token: string) => Promise<{ error: Error | null }>;
    signOut: () => Promise<void>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Mock OTP mode: When EXPO_PUBLIC_MOCK_OTP is 'true', skip real Supabase OTP
 * and use a hardcoded OTP code for development.
 */
const MOCK_OTP = process.env.EXPO_PUBLIC_MOCK_OTP === 'true';
const MOCK_OTP_CODE = '123456';

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<AuthState>({
        session: null,
        user: null,
        isLoading: true,
        isAuthenticated: false,
    });

    /** Fetch the user profile from public.users */
    const fetchUserProfile = useCallback(async (userId: string): Promise<User | null> => {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) {
            console.error('Error fetching user profile:', error.message);
            return null;
        }
        return data as User;
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
                if (MOCK_OTP) {
                    // In mock mode, check for a mock session in state
                    setState(prev => ({ ...prev, isLoading: false }));
                    return;
                }

                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                    const profile = await fetchUserProfile(session.user.id);
                    if (profile) {
                        await updateLastLogin(session.user.id);
                    }
                    setState({
                        session,
                        user: profile,
                        isLoading: false,
                        isAuthenticated: !!profile,
                    });
                } else {
                    setState({ session: null, user: null, isLoading: false, isAuthenticated: false });
                }
            } catch {
                setState({ session: null, user: null, isLoading: false, isAuthenticated: false });
            }
        };

        initAuth();

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (session?.user) {
                const profile = await fetchUserProfile(session.user.id);
                setState({
                    session,
                    user: profile,
                    isLoading: false,
                    isAuthenticated: !!profile,
                });
            } else {
                setState({ session: null, user: null, isLoading: false, isAuthenticated: false });
            }
        });

        return () => subscription.unsubscribe();
    }, [fetchUserProfile, updateLastLogin]);

    /** Send OTP to phone number */
    const signInWithOtp = useCallback(async (phone: string) => {
        if (MOCK_OTP) {
            // In mock mode, just pretend we sent the OTP
            console.log(`[MOCK OTP] Would send OTP to ${phone}. Use code: ${MOCK_OTP_CODE}`);
            return { error: null };
        }

        const { error } = await supabase.auth.signInWithOtp({ phone });
        return { error: error ? new Error(error.message) : null };
    }, []);

    /** Verify OTP code */
    const verifyOtp = useCallback(async (phone: string, token: string) => {
        if (MOCK_OTP) {
            if (token === MOCK_OTP_CODE) {
                // Create a mock session for development
                // In real mode, Supabase would handle this
                const mockUser: User = {
                    id: 'mock-user-id',
                    email: null,
                    phone,
                    full_name: 'Test User',
                    avatar_url: null,
                    role: 'agent', // Default mock role — change for testing different roles
                    reports_to: null,
                    lifecycle_stage: null,
                    date_of_birth: null,
                    last_login_at: new Date().toISOString(),
                    is_active: true,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                };
                setState({
                    session: null,
                    user: mockUser,
                    isLoading: false,
                    isAuthenticated: true,
                });
                return { error: null };
            }
            return { error: new Error('Invalid OTP code') };
        }

        const { error } = await supabase.auth.verifyOtp({
            phone,
            token,
            type: 'sms',
        });
        return { error: error ? new Error(error.message) : null };
    }, []);

    /** Sign out */
    const signOut = useCallback(async () => {
        if (MOCK_OTP) {
            setState({ session: null, user: null, isLoading: false, isAuthenticated: false });
            return;
        }
        await supabase.auth.signOut();
        setState({ session: null, user: null, isLoading: false, isAuthenticated: false });
    }, []);

    /** Refresh user profile */
    const refreshUser = useCallback(async () => {
        if (MOCK_OTP && state.user) {
            return; // No refresh needed in mock mode
        }
        if (state.session?.user) {
            const profile = await fetchUserProfile(state.session.user.id);
            setState(prev => ({ ...prev, user: profile }));
        }
    }, [state.session, state.user, fetchUserProfile]);

    return (
        <AuthContext.Provider
            value={{
                ...state,
                signInWithOtp,
                verifyOtp,
                signOut,
                refreshUser,
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
