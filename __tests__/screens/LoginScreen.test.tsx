import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import LoginScreen from '@/app/(auth)/login';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/Colors';
import { getBiometryType, getBiometricRefreshToken, biometricMeta } from '@/lib/biometrics';

jest.mock('@/lib/supabase');
jest.mock('@/contexts/AuthContext');
jest.mock('@/contexts/ThemeContext');
jest.mock('@/lib/biometrics');
jest.mock('@/components/LyfeLogo', () => {
    const { View } = require('react-native');
    return () => <View testID="lyfe-logo" />;
});

const mockSignInWithOtp = jest.fn().mockResolvedValue({ error: null });
const mockVerifyOtp = jest.fn().mockResolvedValue({ error: null });
const mockAuthenticateWithBiometrics = jest.fn().mockResolvedValue(true);

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
        signInWithOtp: mockSignInWithOtp,
        verifyOtp: mockVerifyOtp,
        authenticateWithBiometrics: mockAuthenticateWithBiometrics,
        biometricsEnabled: false,
    });
    (getBiometryType as jest.Mock).mockResolvedValue('none');
    (getBiometricRefreshToken as jest.Mock).mockResolvedValue(null);
    (biometricMeta as jest.Mock).mockReturnValue({ label: 'Face ID', icon: 'scan-outline' });
});

describe('LoginScreen', () => {
    it('renders without crashing', () => {
        const tree = render(<LoginScreen />);
        expect(tree.toJSON()).toBeTruthy();
    });

    it('renders welcome text', () => {
        const { getByText } = render(<LoginScreen />);
        expect(getByText(/welcome back/i)).toBeTruthy();
    });

    it('renders Lyfe logo', () => {
        const { getByTestId } = render(<LoginScreen />);
        expect(getByTestId('lyfe-logo')).toBeTruthy();
    });

    it('renders phone input and country code', () => {
        const { getByTestId } = render(<LoginScreen />);
        expect(getByTestId('login-phone-input')).toBeTruthy();
        expect(getByTestId('login-country-code')).toBeTruthy();
    });

    it('renders send OTP button', () => {
        const { getByTestId } = render(<LoginScreen />);
        expect(getByTestId('login-send-otp-button')).toBeTruthy();
    });

    it('shows validation error for short phone', async () => {
        const { getByTestId } = render(<LoginScreen />);
        fireEvent.changeText(getByTestId('login-phone-input'), '123');
        fireEvent.press(getByTestId('login-send-otp-button'));

        await waitFor(() => {
            expect(getByTestId('login-error-text')).toBeTruthy();
        });
    });

    it('sends OTP on valid phone', async () => {
        const { getByTestId } = render(<LoginScreen />);
        fireEvent.changeText(getByTestId('login-phone-input'), '91234567');
        fireEvent.press(getByTestId('login-send-otp-button'));

        await waitFor(() => {
            expect(mockSignInWithOtp).toHaveBeenCalled();
        });
    });

    it('transitions to OTP step after send', async () => {
        const { getByTestId } = render(<LoginScreen />);
        fireEvent.changeText(getByTestId('login-phone-input'), '91234567');
        fireEvent.press(getByTestId('login-send-otp-button'));

        await waitFor(() => {
            expect(getByTestId('login-otp-input')).toBeTruthy();
            expect(getByTestId('login-verify-button')).toBeTruthy();
        });
    });

    it('renders biometric button when enabled with face type', async () => {
        (useAuth as jest.Mock).mockReturnValue({
            signInWithOtp: mockSignInWithOtp,
            verifyOtp: mockVerifyOtp,
            authenticateWithBiometrics: mockAuthenticateWithBiometrics,
            biometricsEnabled: true,
        });
        (getBiometryType as jest.Mock).mockResolvedValue('face');
        (getBiometricRefreshToken as jest.Mock).mockResolvedValue('mock-token');

        const { getByTestId } = render(<LoginScreen />);

        await waitFor(() => {
            expect(getByTestId('login-biometric-button')).toBeTruthy();
        });
    });

    it('verifies OTP and calls verifyOtp', async () => {
        const { getByTestId } = render(<LoginScreen />);

        // Step 1: send OTP
        fireEvent.changeText(getByTestId('login-phone-input'), '91234567');
        await act(async () => {
            fireEvent.press(getByTestId('login-send-otp-button'));
        });

        await waitFor(() => {
            expect(getByTestId('login-otp-input')).toBeTruthy();
        });

        // Step 2: enter OTP and verify
        fireEvent.changeText(getByTestId('login-otp-input'), '123456');
        await act(async () => {
            fireEvent.press(getByTestId('login-verify-button'));
        });

        expect(mockVerifyOtp).toHaveBeenCalledWith('+6591234567', '123456');
    });

    it('shows use different number link in OTP step', async () => {
        const { getByTestId, getByLabelText } = render(<LoginScreen />);

        fireEvent.changeText(getByTestId('login-phone-input'), '91234567');
        await act(async () => {
            fireEvent.press(getByTestId('login-send-otp-button'));
        });

        await waitFor(() => {
            expect(getByLabelText('Use a different phone number')).toBeTruthy();
        });

        // Press it to go back to phone step
        fireEvent.press(getByLabelText('Use a different phone number'));

        await waitFor(() => {
            expect(getByTestId('login-phone-input')).toBeTruthy();
        });
    });

    it('calls authenticateWithBiometrics on biometric press', async () => {
        (useAuth as jest.Mock).mockReturnValue({
            signInWithOtp: mockSignInWithOtp,
            verifyOtp: mockVerifyOtp,
            authenticateWithBiometrics: mockAuthenticateWithBiometrics,
            biometricsEnabled: true,
        });
        (getBiometryType as jest.Mock).mockResolvedValue('face');
        (getBiometricRefreshToken as jest.Mock).mockResolvedValue('mock-token');

        const { getByTestId } = render(<LoginScreen />);

        await waitFor(() => {
            expect(getByTestId('login-biometric-button')).toBeTruthy();
        });

        fireEvent.press(getByTestId('login-biometric-button'));

        await waitFor(() => {
            expect(mockAuthenticateWithBiometrics).toHaveBeenCalled();
        });
    });
});
