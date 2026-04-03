/**
 * Tests for app/_layout.tsx — RootLayout and AuthGate redirect logic
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

// Need to require after all mocks are set up
import RootLayout from '@/app/_layout';
import { useRouter, useSegments } from 'expo-router';

jest.mock('@/lib/supabase');
jest.mock('@/lib/sentry', () => ({
    initSentry: jest.fn(),
    navigationIntegration: { registerNavigationContainer: jest.fn() },
    Sentry: { wrap: (c: any) => c },
}));

// Mock all providers as pass-through
jest.mock('@/contexts/ThemeContext', () => ({
    ThemeProvider: ({ children }: any) => children,
    useTheme: () => ({
        colors: require('@/constants/Colors').Colors.light,
        isDark: false,
        mode: 'light',
        resolved: 'light',
        setMode: jest.fn(),
    }),
}));
jest.mock('@/contexts/NetworkContext', () => ({
    NetworkProvider: ({ children }: any) => children,
}));
jest.mock('@/contexts/ViewModeContext', () => ({
    ViewModeProvider: ({ children }: any) => children,
}));
jest.mock('@/contexts/NotificationContext', () => ({
    NotificationProvider: ({ children }: any) => children,
}));
jest.mock('@/components/AppErrorBoundary', () => {
    return ({ children }: any) => children;
});

// Mock fonts as loaded
jest.mock('expo-font', () => ({
    useFonts: jest.fn(() => [true, null]),
}));

// We need to control useAuth per test
const mockUseAuth = jest.fn();
jest.mock('@/contexts/AuthContext', () => ({
    AuthProvider: ({ children }: any) => children,
    useAuth: () => mockUseAuth(),
}));

// Use the global expo-router mock from jest.setup.js but override useSegments and useRouter
const mockReplace = jest.fn();
const mockSegments = jest.fn<string[], []>(() => ['(tabs)']);

// Access the global mock's functions to override them per-test
const expoRouter = jest.requireMock('expo-router');
// Export ErrorBoundary expected by _layout.tsx
expoRouter.ErrorBoundary = ({ children }: any) => children;

beforeEach(() => {
    jest.clearAllMocks();
    (useSegments as jest.Mock).mockReturnValue(['(tabs)']);
    (useRouter as jest.Mock).mockReturnValue({ push: jest.fn(), replace: mockReplace, back: jest.fn() });
});

describe('RootLayout', () => {
    it('renders provider stack and Stack navigator', () => {
        mockUseAuth.mockReturnValue({
            isAuthenticated: true,
            isLoading: false,
            invitationStatus: 'valid',
            user: { id: 'u1', role: 'agent', email_verified: true, onboarding_complete: true },
        });

        const { getByTestId } = render(<RootLayout />);
        expect(getByTestId('mock-stack')).toBeTruthy();
    });

    it('renders null during loading (splash stays visible)', () => {
        mockUseAuth.mockReturnValue({
            isAuthenticated: false,
            isLoading: true,
            invitationStatus: null,
            user: null,
        });

        const { toJSON } = render(<RootLayout />);
        // AuthGate returns null during loading — Stack is not rendered
        // The RootLayout still renders providers but AuthGate blocks content
    });

    it('redirects to login when not authenticated', async () => {
        (useSegments as jest.Mock).mockReturnValue(['(tabs)']);
        mockUseAuth.mockReturnValue({
            isAuthenticated: false,
            isLoading: false,
            invitationStatus: null,
            user: null,
        });

        render(<RootLayout />);

        await waitFor(() => {
            expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
        });
    });

    it('redirects to rejected when invitation rejected', async () => {
        (useSegments as jest.Mock).mockReturnValue(['(tabs)']);
        mockUseAuth.mockReturnValue({
            isAuthenticated: true,
            isLoading: false,
            invitationStatus: 'rejected',
            user: { id: 'u1', role: 'agent' },
        });

        render(<RootLayout />);

        await waitFor(() => {
            expect(mockReplace).toHaveBeenCalledWith('/(auth)/rejected');
        });
    });

    it('redirects to EmailVerification for unverified candidate', async () => {
        (useSegments as jest.Mock).mockReturnValue(['(auth)']);
        mockUseAuth.mockReturnValue({
            isAuthenticated: true,
            isLoading: false,
            invitationStatus: 'valid',
            user: { id: 'u1', role: 'candidate', email_verified: false, onboarding_complete: true },
        });

        render(<RootLayout />);

        await waitFor(() => {
            expect(mockReplace).toHaveBeenCalledWith('/onboarding/EmailVerification');
        });
    });

    it('redirects to onboarding for incomplete onboarding', async () => {
        (useSegments as jest.Mock).mockReturnValue(['(auth)']);
        mockUseAuth.mockReturnValue({
            isAuthenticated: true,
            isLoading: false,
            invitationStatus: 'valid',
            user: { id: 'u1', role: 'agent', email_verified: true, onboarding_complete: false },
        });

        render(<RootLayout />);

        await waitFor(() => {
            expect(mockReplace).toHaveBeenCalledWith('/onboarding/Welcome');
        });
    });

    it('redirects to home for fully authenticated user in auth group', async () => {
        (useSegments as jest.Mock).mockReturnValue(['(auth)']);
        mockUseAuth.mockReturnValue({
            isAuthenticated: true,
            isLoading: false,
            invitationStatus: 'valid',
            user: { id: 'u1', role: 'agent', email_verified: true, onboarding_complete: true },
        });

        render(<RootLayout />);

        await waitFor(() => {
            expect(mockReplace).toHaveBeenCalledWith('/(tabs)/home');
        });
    });

    it('redirects candidate to email verification from non-onboarding route', async () => {
        (useSegments as jest.Mock).mockReturnValue(['(tabs)']);
        mockUseAuth.mockReturnValue({
            isAuthenticated: true,
            isLoading: false,
            invitationStatus: 'valid',
            user: { id: 'u1', role: 'candidate', email_verified: false, onboarding_complete: true },
        });

        render(<RootLayout />);

        await waitFor(() => {
            expect(mockReplace).toHaveBeenCalledWith('/onboarding/EmailVerification');
        });
    });

    it('redirects to onboarding from non-onboarding route', async () => {
        (useSegments as jest.Mock).mockReturnValue(['(tabs)']);
        mockUseAuth.mockReturnValue({
            isAuthenticated: true,
            isLoading: false,
            invitationStatus: 'valid',
            user: { id: 'u1', role: 'agent', email_verified: true, onboarding_complete: false },
        });

        render(<RootLayout />);

        await waitFor(() => {
            expect(mockReplace).toHaveBeenCalledWith('/onboarding/Welcome');
        });
    });
});
