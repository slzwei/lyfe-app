import { supabase } from '@/lib/supabase';
import type { User } from '@/types/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

    /** Fetch the user profile from public.users, creating it if needed */
    const fetchUserProfile = useCallback(async (userId: string, phone?: string | null): Promise<User | null> => {
        // Try to fetch existing profile
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (data) return data as User;

        // Profile doesn't exist — create it (backup for cases where trigger didn't fire)
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
                if (MOCK_OTP) {
                    // In mock mode, check for a mock session in state
                    setState(prev => ({ ...prev, isLoading: false }));
                    return;
                }

                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                    const phone = session.user.phone || null;
                    const profile = await fetchUserProfile(session.user.id, phone);
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
                const profile = await fetchUserProfile(session.user.id, session.user.phone || null);
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
    /** Mock phone → role mapping for development testing */
    const MOCK_ROLES: Record<string, { role: User['role']; name: string; stage?: string }> = {
        '+6580000001': { role: 'admin', name: 'Admin User' },
        '+6580000002': { role: 'director', name: 'Dir. Rachel Tan' },
        '+6580000003': { role: 'manager', name: 'Mgr. David Lim' },
        '+6580000004': { role: 'agent', name: 'Agent Sarah Lee' },
        '+6580000005': { role: 'pa', name: 'PA Jessica Ng' },
        '+6580000006': { role: 'candidate', name: 'Candidate Jason', stage: 'exam_prep' },
    };

    const verifyOtp = useCallback(async (phone: string, token: string) => {
        if (MOCK_OTP) {
            if (token === MOCK_OTP_CODE) {
                // Resolve role from phone number, default to manager
                const match = MOCK_ROLES[phone];
                const mockRole = match?.role || 'manager';
                const mockName = match?.name || 'Test User';
                const mockStage = match?.stage || null;

                const mockUser: User = {
                    id: 'mock-user-id',
                    email: null,
                    phone,
                    full_name: mockName,
                    avatar_url: null,
                    role: mockRole,
                    reports_to: null,
                    lifecycle_stage: mockStage as User['lifecycle_stage'],
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
        await AsyncStorage.removeItem('lyfe_view_mode');
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
