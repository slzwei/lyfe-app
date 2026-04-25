/**
 * Tests for app/onboarding/EmailVerification.tsx
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import EmailVerificationScreen from '@/app/onboarding/EmailVerification';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/Colors';
import { sendEmailOtp, verifyEmailOtp } from '@/lib/email-verification';

jest.mock('@/lib/supabase');
jest.mock('@/contexts/AuthContext');
jest.mock('@/contexts/ThemeContext');
jest.mock('@/lib/email-verification');

const mockRefreshUser = jest.fn().mockResolvedValue(undefined);

beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (useTheme as jest.Mock).mockReturnValue({
        colors: Colors.light,
        isDark: false,
        mode: 'light',
        resolved: 'light',
        setMode: jest.fn(),
    });
    (useAuth as jest.Mock).mockReturnValue({
        refreshUser: mockRefreshUser,
    });
    (sendEmailOtp as jest.Mock).mockResolvedValue({ error: null });
    (verifyEmailOtp as jest.Mock).mockResolvedValue({ error: null });
});

afterEach(() => {
    jest.useRealTimers();
});

describe('EmailVerificationScreen', () => {
    it('renders email step initially', () => {
        const { getByText, getByPlaceholderText } = render(<EmailVerificationScreen />);
        expect(getByText('VERIFY EMAIL')).toBeTruthy();
        expect(getByPlaceholderText('you@example.com')).toBeTruthy();
        expect(getByText('Send verification code')).toBeTruthy();
    });

    it('transitions to OTP step on successful send', async () => {
        const { getByTestId, getByText } = render(<EmailVerificationScreen />);
        fireEvent.changeText(getByTestId('email-verification-input'), 'test@example.com');
        fireEvent.press(getByTestId('email-send-code-button'));

        await waitFor(() => {
            expect(getByText('inbox.')).toBeTruthy();
            expect(getByText('test@example.com')).toBeTruthy();
        });
    });

    it('shows error on send failure', async () => {
        (sendEmailOtp as jest.Mock).mockResolvedValue({ error: 'Rate limited' });

        const { getByTestId, getByText } = render(<EmailVerificationScreen />);
        fireEvent.changeText(getByTestId('email-verification-input'), 'test@example.com');
        fireEvent.press(getByTestId('email-send-code-button'));

        await waitFor(() => {
            expect(getByText('Rate limited')).toBeTruthy();
        });
    });

    it('verifies OTP and calls refreshUser', async () => {
        const { getByTestId, getByText } = render(<EmailVerificationScreen />);

        // Step 1: Enter email
        fireEvent.changeText(getByTestId('email-verification-input'), 'test@example.com');
        fireEvent.press(getByTestId('email-send-code-button'));

        await waitFor(() => {
            expect(getByText('inbox.')).toBeTruthy();
        });

        // Step 2: Enter OTP
        fireEvent.changeText(getByTestId('email-otp-input'), '123456');
        fireEvent.press(getByTestId('email-verify-button'));

        await waitFor(() => {
            expect(verifyEmailOtp).toHaveBeenCalledWith('test@example.com', '123456');
            expect(mockRefreshUser).toHaveBeenCalled();
        });
    });

    it('shows verify error', async () => {
        (verifyEmailOtp as jest.Mock).mockResolvedValue({ error: 'Invalid code' });

        const { getByTestId, getByText } = render(<EmailVerificationScreen />);

        fireEvent.changeText(getByTestId('email-verification-input'), 'test@example.com');
        fireEvent.press(getByTestId('email-send-code-button'));

        await waitFor(() => {
            expect(getByText('inbox.')).toBeTruthy();
        });

        fireEvent.changeText(getByTestId('email-otp-input'), '999999');
        fireEvent.press(getByTestId('email-verify-button'));

        await waitFor(() => {
            expect(getByText('Invalid code')).toBeTruthy();
        });
    });

    it('shows change email link in OTP step', async () => {
        const { getByTestId, getByText } = render(<EmailVerificationScreen />);

        fireEvent.changeText(getByTestId('email-verification-input'), 'test@example.com');
        fireEvent.press(getByTestId('email-send-code-button'));

        await waitFor(() => {
            expect(getByText('Change email')).toBeTruthy();
            expect(getByText(/Resend/)).toBeTruthy();
        });

        fireEvent.press(getByText('Change email'));

        await waitFor(() => {
            expect(getByText('VERIFY EMAIL')).toBeTruthy();
        });
    });
});
