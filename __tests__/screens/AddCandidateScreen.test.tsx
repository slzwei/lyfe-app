/**
 * Tests for app/(tabs)/team/add-candidate.tsx
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AddCandidateScreen from '@/app/(tabs)/team/add-candidate';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/Colors';
import { createCandidate, fetchAssignableManagers } from '@/lib/recruitment';

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
    (createCandidate as jest.Mock).mockResolvedValue({
        data: { id: 'cand-1', name: 'Jane' },
        inviteToken: 'token-123',
        error: null,
    });
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
