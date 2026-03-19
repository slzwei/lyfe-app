import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import OnboardingCompleteScreen from '@/app/onboarding/OnboardingComplete';

jest.mock('@/contexts/ThemeContext');
jest.mock('@/contexts/AuthContext');
jest.mock('@/lib/supabase');

const mockReplace = jest.fn();
const mockRefreshUser = jest.fn().mockResolvedValue(undefined);

beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (useRouter as jest.Mock).mockReturnValue({
        push: jest.fn(),
        replace: mockReplace,
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
        user: {
            id: 'user-1',
            full_name: 'Test Agent',
            phone: '+6580000004',
            role: 'agent',
            onboarding_complete: true,
        },
        refreshUser: mockRefreshUser,
    });
    (supabase.from as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
        }),
    });
});

afterEach(() => {
    jest.useRealTimers();
});

describe('OnboardingCompleteScreen', () => {
    it('renders without crashing', () => {
        const { getByText } = render(<OnboardingCompleteScreen />);
        expect(getByText("You're all set!")).toBeTruthy();
    });

    it('shows celebration message', () => {
        const { getByText } = render(<OnboardingCompleteScreen />);
        expect(getByText(/Your onboarding is complete/)).toBeTruthy();
    });

    it('shows the Go to Dashboard button', () => {
        const { getByTestId } = render(<OnboardingCompleteScreen />);
        expect(getByTestId('go-to-dashboard-button')).toBeTruthy();
    });

    it('shows redirect text', () => {
        const { getByText } = render(<OnboardingCompleteScreen />);
        expect(getByText('Redirecting automatically...')).toBeTruthy();
    });

    it('navigates to dashboard on button press when onboarding complete', () => {
        const { getByTestId } = render(<OnboardingCompleteScreen />);
        fireEvent.press(getByTestId('go-to-dashboard-button'));
        expect(mockReplace).toHaveBeenCalledWith('/(tabs)/home');
    });

    it('auto-redirects after 2 seconds when onboarding complete', () => {
        render(<OnboardingCompleteScreen />);
        expect(mockReplace).not.toHaveBeenCalled();

        act(() => {
            jest.advanceTimersByTime(2000);
        });

        expect(mockReplace).toHaveBeenCalledWith('/(tabs)/home');
    });
});
