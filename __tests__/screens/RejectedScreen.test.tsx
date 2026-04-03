/**
 * Tests for app/(auth)/rejected.tsx — Access Denied screen
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import RejectedScreen from '@/app/(auth)/rejected';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/Colors';

jest.mock('@/lib/supabase');
jest.mock('@/contexts/AuthContext');
jest.mock('@/contexts/ThemeContext');

const mockSignOut = jest.fn().mockResolvedValue(undefined);
const mockRefreshUser = jest.fn().mockResolvedValue(undefined);

beforeEach(() => {
    jest.clearAllMocks();
    (useTheme as jest.Mock).mockReturnValue({
        colors: Colors.light,
        isDark: false,
        mode: 'light',
        resolved: 'light',
        setMode: jest.fn(),
    });
    (useAuth as jest.Mock).mockReturnValue({
        signOut: mockSignOut,
        refreshUser: mockRefreshUser,
    });
});

describe('RejectedScreen', () => {
    it('renders access denied message', () => {
        const { getByText } = render(<RejectedScreen />);
        expect(getByText('Access Denied')).toBeTruthy();
        expect(getByText(/does not have an active invitation/)).toBeTruthy();
    });

    it('renders sign out and try again buttons', () => {
        const { getByText } = render(<RejectedScreen />);
        expect(getByText('Sign Out')).toBeTruthy();
        expect(getByText('Try Again')).toBeTruthy();
    });

    it('calls signOut on sign out press', async () => {
        const { getByText } = render(<RejectedScreen />);
        fireEvent.press(getByText('Sign Out'));
        await waitFor(() => {
            expect(mockSignOut).toHaveBeenCalled();
        });
    });

    it('calls refreshUser on try again press', async () => {
        const { getByText } = render(<RejectedScreen />);
        fireEvent.press(getByText('Try Again'));
        await waitFor(() => {
            expect(mockRefreshUser).toHaveBeenCalled();
        });
    });
});
