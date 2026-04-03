/**
 * Tests for app/(tabs)/leads/add.tsx — Add Lead screen
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AddLeadScreen from '@/app/(tabs)/leads/add';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/Colors';
import { createLead } from '@/lib/leads';

jest.mock('@/lib/supabase');
jest.mock('@/contexts/AuthContext');
jest.mock('@/contexts/ThemeContext');
jest.mock('@/lib/leads');
jest.mock('@/hooks/useSubmitGuard', () => ({
    useSubmitGuard: () => ({
        isSubmitting: false,
        guard: (fn: () => Promise<void>) => fn(),
    }),
}));

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
    ...jest.requireActual('expo-router'),
    useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn() }),
}));

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
        user: { id: 'user-1', role: 'agent', full_name: 'Test Agent' },
    });
});

describe('AddLeadScreen', () => {
    it('renders form fields', () => {
        const { getByText, getByPlaceholderText } = render(<AddLeadScreen />);
        expect(getByText('Contact Information')).toBeTruthy();
        expect(getByPlaceholderText('e.g. Sarah Tan')).toBeTruthy();
        expect(getByPlaceholderText('+65 9123 4567')).toBeTruthy();
        expect(getByPlaceholderText('sarah@email.com')).toBeTruthy();
        expect(getByText('Source')).toBeTruthy();
        expect(getByText('Product Interest')).toBeTruthy();
    });

    it('shows validation errors for empty name and phone', async () => {
        const { getByTestId, getByText } = render(<AddLeadScreen />);
        fireEvent.press(getByTestId('add-lead-save'));

        await waitFor(() => {
            expect(getByText('Name is required')).toBeTruthy();
            expect(getByText('Phone is required')).toBeTruthy();
        });
    });

    it('shows invalid phone error', async () => {
        const { getByTestId, getByPlaceholderText, getByText } = render(<AddLeadScreen />);
        fireEvent.changeText(getByPlaceholderText('e.g. Sarah Tan'), 'Jane');
        fireEvent.changeText(getByPlaceholderText('+65 9123 4567'), '12');
        fireEvent.press(getByTestId('add-lead-save'));

        await waitFor(() => {
            expect(getByText('Invalid phone number')).toBeTruthy();
        });
    });

    it('shows invalid email error', async () => {
        const { getByTestId, getByPlaceholderText, getByText } = render(<AddLeadScreen />);
        fireEvent.changeText(getByPlaceholderText('e.g. Sarah Tan'), 'Jane');
        fireEvent.changeText(getByPlaceholderText('+65 9123 4567'), '+6591234567');
        fireEvent.changeText(getByPlaceholderText('sarah@email.com'), 'bad-email');
        fireEvent.press(getByTestId('add-lead-save'));

        await waitFor(() => {
            expect(getByText('Invalid email address')).toBeTruthy();
        });
    });

    it('shows success modal on successful save', async () => {
        (createLead as jest.Mock).mockResolvedValue({ error: null });

        const { getByTestId, getByPlaceholderText, getByText } = render(<AddLeadScreen />);
        fireEvent.changeText(getByPlaceholderText('e.g. Sarah Tan'), 'Sarah Tan');
        fireEvent.changeText(getByPlaceholderText('+65 9123 4567'), '+6591234567');
        fireEvent.press(getByTestId('add-lead-save'));

        await waitFor(() => {
            expect(getByText('Lead Created')).toBeTruthy();
            expect(getByText('Sarah Tan has been added to your leads.')).toBeTruthy();
        });
    });

    it('shows error banner on save failure', async () => {
        (createLead as jest.Mock).mockResolvedValue({ error: 'Duplicate phone number' });

        const { getByTestId, getByPlaceholderText, getByText } = render(<AddLeadScreen />);
        fireEvent.changeText(getByPlaceholderText('e.g. Sarah Tan'), 'Jane');
        fireEvent.changeText(getByPlaceholderText('+65 9123 4567'), '+6591234567');
        fireEvent.press(getByTestId('add-lead-save'));

        await waitFor(() => {
            expect(getByText('Duplicate phone number')).toBeTruthy();
        });
    });

    it('navigates back on success modal dismiss', async () => {
        (createLead as jest.Mock).mockResolvedValue({ error: null });

        const { getByTestId, getByPlaceholderText } = render(<AddLeadScreen />);
        fireEvent.changeText(getByPlaceholderText('e.g. Sarah Tan'), 'Jane');
        fireEvent.changeText(getByPlaceholderText('+65 9123 4567'), '+6591234567');
        fireEvent.press(getByTestId('add-lead-save'));

        await waitFor(() => {
            fireEvent.press(getByTestId('add-lead-success-ok'));
        });

        expect(mockBack).toHaveBeenCalled();
    });

    it('shows lock screen for unauthorized roles', () => {
        (useAuth as jest.Mock).mockReturnValue({
            user: { id: 'user-1', role: 'candidate', full_name: 'Candidate' },
        });

        const { getByText } = render(<AddLeadScreen />);
        expect(getByText('Not Authorized')).toBeTruthy();
    });

    it('allows source chip selection', () => {
        const { getByLabelText } = render(<AddLeadScreen />);
        fireEvent.press(getByLabelText('Source: Walk-in'));
        // Verify it doesn't crash — state change is internal
    });

    it('allows product chip selection', () => {
        const { getByLabelText } = render(<AddLeadScreen />);
        fireEvent.press(getByLabelText('Product: Life Insurance'));
        // Verify it doesn't crash
    });
});
