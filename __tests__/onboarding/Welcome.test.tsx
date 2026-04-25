import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/Colors';
import WelcomeScreen from '@/app/onboarding/Welcome';

jest.mock('@/contexts/ThemeContext');

const mockPush = jest.fn();

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
});

describe('WelcomeScreen', () => {
    it('renders without crashing', () => {
        const { getByText } = render(<WelcomeScreen />);
        expect(getByText('Lyfe.')).toBeTruthy();
    });

    it('shows the tagline', () => {
        const { getByText } = render(<WelcomeScreen />);
        expect(getByText(/Your insurance career starts here/)).toBeTruthy();
    });

    it('shows the Get Started button', () => {
        const { getByTestId } = render(<WelcomeScreen />);
        expect(getByTestId('get-started-button')).toBeTruthy();
    });

    it('navigates to ProfileSetup on button press', () => {
        const { getByTestId } = render(<WelcomeScreen />);
        fireEvent.press(getByTestId('get-started-button'));
        expect(mockPush).toHaveBeenCalledWith('/onboarding/ProfileSetup');
    });
});
