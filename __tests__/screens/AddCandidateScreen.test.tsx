/**
 * Tests for app/(tabs)/candidates/add-candidate.tsx
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AddCandidateScreen from '@/app/(tabs)/candidates/add-candidate';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/Colors';
import { createCandidate, fetchAssignableManagers, getInviteUrl } from '@/lib/recruitment';

jest.mock('@/lib/supabase');
jest.mock('@/contexts/AuthContext');
jest.mock('@/contexts/ThemeContext');
jest.mock('@/lib/recruitment');
jest.mock('@/hooks/useSubmitGuard', () => ({
    useSubmitGuard: () => ({
        isSubmitting: false,
        guard: (fn: () => Promise<void>) => fn(),
    }),
}));

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
    ...jest.requireActual('expo-router'),
    useRouter: () => ({ push: jest.fn(), back: mockBack, replace: jest.fn() }),
}));

/** Default successful createCandidate response — no email provided. */
function mockCreateSuccess(overrides: Record<string, unknown> = {}) {
    (createCandidate as jest.Mock).mockResolvedValue({
        data: { id: 'cand-1', name: 'Jane' },
        inviteToken: 'token-123',
        inviteUrl: 'https://lyfe.sg/candidate/login?token=token-123',
        emailSent: false,
        emailError: null,
        error: null,
        ...overrides,
    });
}

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
        user: { id: 'mgr-1', role: 'manager', app_metadata: { role: 'manager' } },
    });
    (fetchAssignableManagers as jest.Mock).mockResolvedValue({ data: [], error: null });
    (getInviteUrl as jest.Mock).mockImplementation((token: string) => `https://lyfe.sg/candidate/login?token=${token}`);
    mockCreateSuccess();
});

describe('AddCandidateScreen', () => {
    it('renders form fields', () => {
        const { getByText, getByPlaceholderText } = render(<AddCandidateScreen />);
        expect(getByText('Add Candidate')).toBeTruthy();
        expect(getByPlaceholderText('Enter full name')).toBeTruthy();
        expect(getByPlaceholderText('+65 9XXX XXXX')).toBeTruthy();
        expect(getByPlaceholderText('email@example.com')).toBeTruthy();
        expect(getByText('Create Candidate')).toBeTruthy();
    });

    it('shows validation errors for empty name and phone', async () => {
        const { getByText } = render(<AddCandidateScreen />);
        fireEvent.press(getByText('Create Candidate'));

        await waitFor(() => {
            expect(getByText('Name is required')).toBeTruthy();
            expect(getByText('Phone number is required')).toBeTruthy();
        });
    });

    it.each(['1234', '61234567', '+90000000'])('rejects invalid SG phone %s', async (badPhone) => {
        const { getByText, getByPlaceholderText } = render(<AddCandidateScreen />);
        fireEvent.changeText(getByPlaceholderText('Enter full name'), 'Jane Smith');
        fireEvent.changeText(getByPlaceholderText('+65 9XXX XXXX'), badPhone);
        fireEvent.press(getByText('Create Candidate'));

        await waitFor(() => {
            expect(getByText('Enter a valid Singapore mobile number')).toBeTruthy();
        });
        expect(createCandidate).not.toHaveBeenCalled();
    });

    it.each([
        ['90000000', '6590000000'],
        ['+65 9000 0000', '6590000000'],
        ['6590000000', '6590000000'],
    ])('accepts %s and submits normalized phone %s', async (input, normalized) => {
        const { getByText, getByPlaceholderText } = render(<AddCandidateScreen />);
        fireEvent.changeText(getByPlaceholderText('Enter full name'), 'Jane Smith');
        fireEvent.changeText(getByPlaceholderText('+65 9XXX XXXX'), input);
        fireEvent.press(getByText('Create Candidate'));

        await waitFor(() => {
            expect(createCandidate).toHaveBeenCalled();
        });
        expect((createCandidate as jest.Mock).mock.calls[0][0].phone).toBe(normalized);
    });

    it('rejects an invalid optional email', async () => {
        const { getByText, getByPlaceholderText } = render(<AddCandidateScreen />);
        fireEvent.changeText(getByPlaceholderText('Enter full name'), 'Jane Smith');
        fireEvent.changeText(getByPlaceholderText('+65 9XXX XXXX'), '90000000');
        fireEvent.changeText(getByPlaceholderText('email@example.com'), 'not-an-email');
        fireEvent.press(getByText('Create Candidate'));

        await waitFor(() => {
            expect(getByText('Enter a valid email address')).toBeTruthy();
        });
        expect(createCandidate).not.toHaveBeenCalled();
    });

    it('uses the invite_url returned by the edge function', async () => {
        mockCreateSuccess({ inviteUrl: 'https://lyfe.sg/candidate/login?token=edge-url-token' });
        const { getByText, getByPlaceholderText, getByTestId } = render(<AddCandidateScreen />);
        fireEvent.changeText(getByPlaceholderText('Enter full name'), 'Jane Smith');
        fireEvent.changeText(getByPlaceholderText('+65 9XXX XXXX'), '90000000');
        fireEvent.press(getByText('Create Candidate'));

        await waitFor(() => {
            expect(getByTestId('add-candidate-success-link')).toHaveTextContent(/edge-url-token/);
        });
    });

    it('shows email-sent copy when email_sent is true', async () => {
        mockCreateSuccess({ emailSent: true });
        const { getByText, getByPlaceholderText, getByTestId } = render(<AddCandidateScreen />);
        fireEvent.changeText(getByPlaceholderText('Enter full name'), 'Jane Smith');
        fireEvent.changeText(getByPlaceholderText('+65 9XXX XXXX'), '90000000');
        fireEvent.changeText(getByPlaceholderText('email@example.com'), 'jane@example.com');
        fireEvent.press(getByText('Create Candidate'));

        await waitFor(() => {
            expect(getByTestId('add-candidate-success-message')).toHaveTextContent(
                /Invitation email sent to jane@example\.com/,
            );
        });
    });

    it('shows manual-link copy when no email is provided', async () => {
        const { getByText, getByPlaceholderText, getByTestId } = render(<AddCandidateScreen />);
        fireEvent.changeText(getByPlaceholderText('Enter full name'), 'Jane Smith');
        fireEvent.changeText(getByPlaceholderText('+65 9XXX XXXX'), '90000000');
        fireEvent.press(getByText('Create Candidate'));

        await waitFor(() => {
            expect(getByTestId('add-candidate-success-message')).toHaveTextContent(
                'No email was sent. Copy and send this invite link manually.',
            );
        });
    });

    it('shows email-failed copy when email was provided but not sent', async () => {
        mockCreateSuccess({ emailSent: false, emailError: 'SES rejected the message' });
        const { getByText, getByPlaceholderText, getByTestId } = render(<AddCandidateScreen />);
        fireEvent.changeText(getByPlaceholderText('Enter full name'), 'Jane Smith');
        fireEvent.changeText(getByPlaceholderText('+65 9XXX XXXX'), '90000000');
        fireEvent.changeText(getByPlaceholderText('email@example.com'), 'jane@example.com');
        fireEvent.press(getByText('Create Candidate'));

        await waitFor(() => {
            expect(getByTestId('add-candidate-success-message')).toHaveTextContent(/the email was not sent/);
        });
    });

    it('shows success modal with invite link', async () => {
        const { getByText, getByPlaceholderText } = render(<AddCandidateScreen />);
        fireEvent.changeText(getByPlaceholderText('Enter full name'), 'Jane Smith');
        fireEvent.changeText(getByPlaceholderText('+65 9XXX XXXX'), '+6591234567');
        fireEvent.press(getByText('Create Candidate'));

        await waitFor(() => {
            expect(getByText('Candidate Created')).toBeTruthy();
        });
    });

    it('shows error on creation failure', async () => {
        (createCandidate as jest.Mock).mockResolvedValue({
            data: null,
            inviteToken: null,
            inviteUrl: null,
            emailSent: false,
            emailError: null,
            error: 'Duplicate phone',
        });

        const { getByText, getByPlaceholderText } = render(<AddCandidateScreen />);
        fireEvent.changeText(getByPlaceholderText('Enter full name'), 'Jane');
        fireEvent.changeText(getByPlaceholderText('+65 9XXX XXXX'), '+6591234567');
        fireEvent.press(getByText('Create Candidate'));

        await waitFor(() => {
            expect(getByText('Duplicate phone')).toBeTruthy();
        });
    });

    it('navigates back on Done', async () => {
        const { getByText, getByPlaceholderText } = render(<AddCandidateScreen />);
        fireEvent.changeText(getByPlaceholderText('Enter full name'), 'Jane');
        fireEvent.changeText(getByPlaceholderText('+65 9XXX XXXX'), '+6591234567');
        fireEvent.press(getByText('Create Candidate'));

        await waitFor(() => {
            fireEvent.press(getByText('Done'));
        });
        expect(mockBack).toHaveBeenCalled();
    });

    it('renders resume upload area', () => {
        const { getByText } = render(<AddCandidateScreen />);
        expect(getByText('Attach PDF')).toBeTruthy();
        expect(getByText('Up to 10 MB')).toBeTruthy();
    });

    it('renders info text about invite link', () => {
        const { getByText } = render(<AddCandidateScreen />);
        expect(getByText(/invite link will be generated/)).toBeTruthy();
    });
});
