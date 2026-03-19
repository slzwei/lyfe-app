import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import ProfileSetupScreen from '@/app/onboarding/ProfileSetup';

jest.mock('@/lib/supabase');
jest.mock('@/contexts/ThemeContext');
jest.mock('@/contexts/AuthContext');

const mockPush = jest.fn();
const mockRefreshUser = jest.fn().mockResolvedValue(undefined);

beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
        push: mockPush,
        replace: jest.fn(),
        back: jest.fn(),
    });
    (useTheme as jest.Mock).mockReturnValue({
        colors: Colors.light,
        isDark: false,
        mode: 'light',
        resolved: 'light',
        setMode: jest.fn(),
    });
    (useAuth as jest.Mock).mockReturnValue({
        user: { id: 'user-1', full_name: 'New User', phone: '+6580000004', role: 'agent' },
        refreshUser: mockRefreshUser,
    });
    (supabase.from as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
        }),
    });
});

describe('ProfileSetupScreen', () => {
    it('renders without crashing', () => {
        const { getByText } = render(<ProfileSetupScreen />);
        expect(getByText('Set Up Your Profile')).toBeTruthy();
    });

    it('shows the name input empty for New User', () => {
        const { getByTestId } = render(<ProfileSetupScreen />);
        expect(getByTestId('name-input').props.value).toBe('');
    });

    it('shows the phone input as read-only', () => {
        const { getByTestId } = render(<ProfileSetupScreen />);
        const phoneInput = getByTestId('phone-input');
        expect(phoneInput.props.editable).toBe(false);
    });

    it('shows the photo placeholder', () => {
        const { getByTestId } = render(<ProfileSetupScreen />);
        expect(getByTestId('photo-placeholder')).toBeTruthy();
    });

    it('shows validation error when name is empty', () => {
        const { getByTestId, getByText } = render(<ProfileSetupScreen />);
        fireEvent.press(getByTestId('continue-button'));
        expect(getByText('Name is required')).toBeTruthy();
    });

    it('saves name and navigates to AgencyInfo when valid', async () => {
        const { getByTestId } = render(<ProfileSetupScreen />);
        fireEvent.changeText(getByTestId('name-input'), 'John Doe');
        fireEvent.press(getByTestId('continue-button'));

        await waitFor(() => {
            expect(supabase.from).toHaveBeenCalledWith('users');
            expect(mockRefreshUser).toHaveBeenCalled();
            expect(mockPush).toHaveBeenCalledWith('/onboarding/AgencyInfo');
        });
    });
});
