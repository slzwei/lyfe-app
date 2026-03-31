/**
 * Tests for contexts/AuthContext.tsx — Auth, Profile, and Biometrics providers
 */
import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import * as biometrics from '@/lib/biometrics';
import { AuthProvider, useAuth, useProfile, useBiometrics } from '@/contexts/AuthContext';

jest.mock('@/lib/supabase');
jest.mock('@/lib/biometrics');

const mockSupa = supabase as any;
const mockBio = biometrics as jest.Mocked<typeof biometrics>;

function mockResolve(chain: any, value: any) {
    chain.__resolveWith(value);
}

const MOCK_SESSION = {
    user: { id: 'user-1', phone: '+6591234567' },
    access_token: 'tok',
    refresh_token: 'refresh-tok',
};

const MOCK_PROFILE = {
    id: 'user-1',
    full_name: 'Test User',
    phone: '+6591234567',
    email: 'test@test.com',
    role: 'agent',
    avatar_url: null,
    is_active: true,
};

const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>;

beforeEach(() => {
    jest.clearAllMocks();
    mockSupa.__resetChains();

    // Default: no session, no biometrics
    mockSupa.auth.getSession.mockResolvedValue({ data: { session: null } });
    mockSupa.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
    });

    mockBio.isBiometricsEnabled.mockResolvedValue(false);
    mockBio.isBiometricsAvailable.mockResolvedValue(false);
    mockBio.authenticate.mockResolvedValue(false);
    mockBio.setBiometricsEnabled.mockResolvedValue(undefined);

    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
});

// ── Auth basics ──

describe('AuthContext — init', () => {
    it('starts with loading true, then resolves to not authenticated when no session', async () => {
        const { result } = renderHook(() => useAuth(), { wrapper });

        // After init resolves
        await act(async () => {});

        expect(result.current.isLoading).toBe(false);
        expect(result.current.isAuthenticated).toBe(false);
        expect(result.current.session).toBeNull();
        expect(result.current.user).toBeNull();
    });

    it('loads existing session and fetches profile', async () => {
        mockSupa.auth.getSession.mockResolvedValue({ data: { session: MOCK_SESSION } });

        // Mock the fetchUserProfile call (from('users').select().eq().single())
        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, { data: MOCK_PROFILE, error: null });

        const { result } = renderHook(() => useAuth(), { wrapper });
        await act(async () => {});

        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.user?.full_name).toBe('Test User');
        expect(result.current.session).toBeTruthy();
    });

    it('sets pendingBiometricSession when biometrics enabled and available', async () => {
        mockSupa.auth.getSession.mockResolvedValue({ data: { session: MOCK_SESSION } });
        mockBio.isBiometricsEnabled.mockResolvedValue(true);
        mockBio.isBiometricsAvailable.mockResolvedValue(true);

        const { result } = renderHook(() => useAuth(), { wrapper });
        await act(async () => {});

        expect(result.current.isAuthenticated).toBe(false);
        expect(result.current.pendingBiometricSession).toBe(true);
        expect(result.current.isLoading).toBe(false);
    });

    it('handles init error gracefully', async () => {
        mockSupa.auth.getSession.mockRejectedValue(new Error('Network'));

        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        const { result } = renderHook(() => useAuth(), { wrapper });
        await act(async () => {});

        expect(result.current.isAuthenticated).toBe(false);
        expect(result.current.isLoading).toBe(false);
        consoleSpy.mockRestore();
    });
});

// ── OTP flow ──

describe('AuthContext — OTP', () => {
    it('signInWithOtp calls supabase auth', async () => {
        const { result } = renderHook(() => useAuth(), { wrapper });
        await act(async () => {});

        await act(async () => {
            const res = await result.current.signInWithOtp('+6591234567');
            expect(res.error).toBeNull();
        });

        expect(mockSupa.auth.signInWithOtp).toHaveBeenCalledWith({ phone: '+6591234567' });
    });

    it('signInWithOtp returns error on failure', async () => {
        mockSupa.auth.signInWithOtp.mockResolvedValue({ error: { message: 'Rate limited' } });

        const { result } = renderHook(() => useAuth(), { wrapper });
        await act(async () => {});

        await act(async () => {
            const res = await result.current.signInWithOtp('+6591234567');
            expect(res.error).toBeInstanceOf(Error);
            expect(res.error?.message).toBe('Rate limited');
        });
    });

    it('verifyOtp calls supabase auth with sms type', async () => {
        const { result } = renderHook(() => useAuth(), { wrapper });
        await act(async () => {});

        await act(async () => {
            const res = await result.current.verifyOtp('+6591234567', '123456');
            expect(res.error).toBeNull();
        });

        expect(mockSupa.auth.verifyOtp).toHaveBeenCalledWith({
            phone: '+6591234567',
            token: '123456',
            type: 'sms',
        });
    });

    it('verifyOtp returns error on failure', async () => {
        mockSupa.auth.verifyOtp.mockResolvedValue({ data: null, error: { message: 'Invalid OTP' } });

        const { result } = renderHook(() => useAuth(), { wrapper });
        await act(async () => {});

        await act(async () => {
            const res = await result.current.verifyOtp('+6591234567', '000000');
            expect(res.error?.message).toBe('Invalid OTP');
        });
    });
});

// ── Sign out ──

describe('AuthContext — signOut', () => {
    it('clears session and user on sign out (no biometrics)', async () => {
        // Start with an active session
        mockSupa.auth.getSession.mockResolvedValue({ data: { session: MOCK_SESSION } });
        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, { data: MOCK_PROFILE, error: null });

        const { result } = renderHook(() => useAuth(), { wrapper });
        await act(async () => {});

        expect(result.current.isAuthenticated).toBe(true);

        await act(async () => {
            await result.current.signOut();
        });

        expect(result.current.isAuthenticated).toBe(false);
        expect(result.current.session).toBeNull();
        expect(result.current.user).toBeNull();
        expect(AsyncStorage.removeItem).toHaveBeenCalledWith('lyfe_view_mode');
        expect(mockSupa.auth.signOut).toHaveBeenCalled();
    });

    it('signOut always revokes server session even with biometrics enabled', async () => {
        mockSupa.auth.getSession.mockResolvedValue({ data: { session: MOCK_SESSION } });
        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, { data: MOCK_PROFILE, error: null });

        const { result } = renderHook(() => useAuth(), { wrapper });
        await act(async () => {});

        mockBio.isBiometricsEnabled.mockResolvedValue(true);

        await act(async () => {
            await result.current.signOut();
        });

        // Server session is always revoked to prevent session leaks (Phase 1 security fix)
        expect(mockSupa.auth.signOut).toHaveBeenCalled();
        expect(result.current.isAuthenticated).toBe(false);
    });
});

// ── Profile ──

describe('ProfileContext — updateProfile', () => {
    it('updates profile in supabase and local state', async () => {
        mockSupa.auth.getSession.mockResolvedValue({ data: { session: MOCK_SESSION } });
        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, { data: MOCK_PROFILE, error: null });

        const { result } = renderHook(() => useAuth(), { wrapper });
        await act(async () => {});

        // Reset chain for the update call
        mockSupa.__resetChains();
        const updateChain = mockSupa.__getChain('users');
        mockResolve(updateChain, { error: null });

        await act(async () => {
            const res = await result.current.updateProfile('New Name', 'new@email.com');
            expect(res.error).toBeNull();
        });

        expect(result.current.user?.full_name).toBe('New Name');
        expect(result.current.user?.email).toBe('new@email.com');
    });

    it('trims name and email whitespace', async () => {
        mockSupa.auth.getSession.mockResolvedValue({ data: { session: MOCK_SESSION } });
        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, { data: MOCK_PROFILE, error: null });

        const { result } = renderHook(() => useAuth(), { wrapper });
        await act(async () => {});

        mockSupa.__resetChains();
        const updateChain = mockSupa.__getChain('users');
        mockResolve(updateChain, { error: null });

        await act(async () => {
            await result.current.updateProfile('  Padded Name  ', '  email@test.com  ');
        });

        expect(result.current.user?.full_name).toBe('Padded Name');
        expect(result.current.user?.email).toBe('email@test.com');
    });

    it('returns error when not authenticated', async () => {
        const { result } = renderHook(() => useAuth(), { wrapper });
        await act(async () => {});

        await act(async () => {
            const res = await result.current.updateProfile('Name', null);
            expect(res.error).toBe('Not authenticated');
        });
    });

    it('returns error when supabase update fails', async () => {
        mockSupa.auth.getSession.mockResolvedValue({ data: { session: MOCK_SESSION } });
        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, { data: MOCK_PROFILE, error: null });

        const { result } = renderHook(() => useAuth(), { wrapper });
        await act(async () => {});

        mockSupa.__resetChains();
        const updateChain = mockSupa.__getChain('users');
        mockResolve(updateChain, { error: { message: 'Update failed' } });

        await act(async () => {
            const res = await result.current.updateProfile('Name', null);
            expect(res.error).toBe('Update failed');
        });

        // User should not have changed
        expect(result.current.user?.full_name).toBe('Test User');
    });
});

describe('ProfileContext — updateAvatarUrl', () => {
    it('updates avatar in local state only', async () => {
        mockSupa.auth.getSession.mockResolvedValue({ data: { session: MOCK_SESSION } });
        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, { data: MOCK_PROFILE, error: null });

        const { result } = renderHook(() => useAuth(), { wrapper });
        await act(async () => {});

        await act(async () => {
            result.current.updateAvatarUrl('https://avatar.com/new.jpg');
        });

        expect(result.current.user?.avatar_url).toBe('https://avatar.com/new.jpg');
    });
});

// ── Biometrics ──

describe('BiometricsContext', () => {
    it('enableBiometrics succeeds when available and authenticated', async () => {
        mockBio.isBiometricsAvailable.mockResolvedValue(true);
        mockBio.authenticate.mockResolvedValue(true);

        const { result } = renderHook(() => useBiometrics(), { wrapper });
        await act(async () => {});

        let success: boolean = false;
        await act(async () => {
            success = await result.current.enableBiometrics();
        });

        expect(success).toBe(true);
        expect(result.current.biometricsEnabled).toBe(true);
        expect(mockBio.setBiometricsEnabled).toHaveBeenCalledWith(true);
    });

    it('enableBiometrics fails when not available', async () => {
        mockBio.isBiometricsAvailable.mockResolvedValue(false);

        const { result } = renderHook(() => useBiometrics(), { wrapper });
        await act(async () => {});

        let success: boolean = true;
        await act(async () => {
            success = await result.current.enableBiometrics();
        });

        expect(success).toBe(false);
        expect(result.current.biometricsEnabled).toBe(false);
    });

    it('enableBiometrics fails when user cancels auth', async () => {
        mockBio.isBiometricsAvailable.mockResolvedValue(true);
        mockBio.authenticate.mockResolvedValue(false);

        const { result } = renderHook(() => useBiometrics(), { wrapper });
        await act(async () => {});

        let success: boolean = true;
        await act(async () => {
            success = await result.current.enableBiometrics();
        });

        expect(success).toBe(false);
    });

    it('disableBiometrics clears state and storage', async () => {
        // First enable
        mockBio.isBiometricsAvailable.mockResolvedValue(true);
        mockBio.authenticate.mockResolvedValue(true);

        const { result } = renderHook(() => useBiometrics(), { wrapper });
        await act(async () => {});
        await act(async () => {
            await result.current.enableBiometrics();
        });

        expect(result.current.biometricsEnabled).toBe(true);

        await act(async () => {
            await result.current.disableBiometrics();
        });

        expect(result.current.biometricsEnabled).toBe(false);
        expect(mockBio.setBiometricsEnabled).toHaveBeenCalledWith(false);
    });

    it('authenticateWithBiometrics succeeds with valid session', async () => {
        mockBio.authenticate.mockResolvedValue(true);
        mockSupa.auth.getSession.mockResolvedValue({ data: { session: MOCK_SESSION } });

        // Profile fetch during biometric auth
        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, { data: MOCK_PROFILE, error: null });

        const { result } = renderHook(() => useAuth(), { wrapper });
        await act(async () => {});

        await act(async () => {
            const res = await result.current.authenticateWithBiometrics();
            expect(res.success).toBe(true);
        });

        expect(result.current.isAuthenticated).toBe(true);
    });

    it('authenticateWithBiometrics fails when biometric auth rejected', async () => {
        mockBio.authenticate.mockResolvedValue(false);

        const { result } = renderHook(() => useAuth(), { wrapper });
        await act(async () => {});

        await act(async () => {
            const res = await result.current.authenticateWithBiometrics();
            expect(res.success).toBe(false);
        });
    });

    it('authenticateWithBiometrics returns error when no session exists', async () => {
        mockBio.authenticate.mockResolvedValue(true);
        mockSupa.auth.getSession.mockResolvedValue({ data: { session: null } });

        const { result } = renderHook(() => useBiometrics(), { wrapper });
        await act(async () => {});

        await act(async () => {
            const res = await result.current.authenticateWithBiometrics();
            expect(res.success).toBe(false);
            expect(res.error).toMatch(/session expired/i);
        });
    });
});

// ── User creation (PGRST116) ──

describe('AuthContext — user auto-creation', () => {
    it('creates user profile when PGRST116 (not found)', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        mockSupa.auth.getSession.mockResolvedValue({ data: { session: MOCK_SESSION } });

        // First query: user not found
        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, { data: null, error: { code: 'PGRST116', message: 'No rows' } });

        const { result } = renderHook(() => useAuth(), { wrapper });
        await act(async () => {});

        // Verify that from('users') was called (for insert)
        expect(mockSupa.from).toHaveBeenCalledWith('users');
        consoleSpy.mockRestore();
    });
});

// ── Hook isolation ──

describe('Hook isolation', () => {
    it('useProfile throws outside AuthProvider', () => {
        expect(() => {
            renderHook(() => useProfile());
        }).toThrow('useProfile must be used within an AuthProvider');
    });

    it('useBiometrics throws outside AuthProvider', () => {
        expect(() => {
            renderHook(() => useBiometrics());
        }).toThrow('useBiometrics must be used within an AuthProvider');
    });
});
