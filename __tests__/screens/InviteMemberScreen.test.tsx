/**
 * Tests for app/(tabs)/team/invite-member.tsx
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import InviteMemberScreen from '@/app/(tabs)/team/invite-member';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/Colors';
import { createMemberInvitation } from '@/lib/invitations';
import { fetchAssignableManagers } from '@/lib/recruitment';

jest.mock('@/lib/supabase');
jest.mock('@/contexts/AuthContext');
jest.mock('@/contexts/ThemeContext');
jest.mock('@/lib/invitations', () => ({
    createMemberInvitation: jest.fn(),
    getInvitableRoles: jest.fn().mockReturnValue(['agent', 'pa', 'candidate']),
}));
jest.mock('@/lib/recruitment');
jest.mock('@/components/FormField', () => {
    const { View, Text, TextInput } = require('react-native');
    return function MockFormField(props: any) {
        return (
            <View>
                <Text>{props.label}</Text>
                {props.error ? <Text>{props.error}</Text> : null}
                {props.children}
            </View>
        );
    };
});
jest.mock('@/components/ErrorBanner', () => {
    const { Text } = require('react-native');
    return function MockErrorBanner({ message }: { message: string }) {
        return <Text>{message}</Text>;
    };
});
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
        user: { id: 'mgr-1', role: 'manager' },
    });
    (fetchAssignableManagers as jest.Mock).mockResolvedValue({ data: [], error: null });
    (createMemberInvitation as jest.Mock).mockResolvedValue({ error: null });
});

describe('InviteMemberScreen', () => {
    it('renders form fields', () => {
        const { getByText, getByPlaceholderText } = render(<InviteMemberScreen />);
        expect(getByText('Invite Member')).toBeTruthy();
        expect(getByPlaceholderText('e.g. John Tan')).toBeTruthy();
        expect(getByPlaceholderText('9123 4567')).toBeTruthy();
        expect(getByText('Send Invitation')).toBeTruthy();
    });

    it('shows validation errors for empty fields', async () => {
        const { getByTestId, getByText } = render(<InviteMemberScreen />);
        fireEvent.press(getByTestId('invite-submit-button'));

        await waitFor(() => {
            expect(getByText('Name is required')).toBeTruthy();
            expect(getByText('Phone number is required')).toBeTruthy();
        });
    });

    it('validates SG phone number format', async () => {
        const { getByTestId, getByText } = render(<InviteMemberScreen />);
        fireEvent.changeText(getByTestId('invite-name-input'), 'John');
        fireEvent.changeText(getByTestId('invite-phone-input'), '1234');
        // Select a role first
        fireEvent.press(getByTestId('invite-role-picker'));
        await waitFor(() => {
            fireEvent.press(getByText('Agent'));
        });
        fireEvent.press(getByTestId('invite-submit-button'));

        await waitFor(() => {
            expect(getByText(/valid 8-digit SG number/)).toBeTruthy();
        });
    });

    it('shows role picker with invitable roles', () => {
        const { getByTestId, getByText } = render(<InviteMemberScreen />);
        fireEvent.press(getByTestId('invite-role-picker'));

        // Manager can invite these roles
        expect(getByText('Select Role')).toBeTruthy();
    });

    it('shows success modal on successful invite', async () => {
        const { getByTestId, getByText } = render(<InviteMemberScreen />);
        fireEvent.changeText(getByTestId('invite-name-input'), 'Jane Doe');
        fireEvent.changeText(getByTestId('invite-phone-input'), '91234567');

        // Select Agent role
        fireEvent.press(getByTestId('invite-role-picker'));
        await waitFor(() => {
            fireEvent.press(getByText('Agent'));
        });

        fireEvent.press(getByTestId('invite-submit-button'));

        await waitFor(() => {
            expect(getByText('Invitation Sent')).toBeTruthy();
        });
    });

    it('shows error on failed invite', async () => {
        (createMemberInvitation as jest.Mock).mockResolvedValue({ error: 'Phone already registered' });

        const { getByTestId, getByText } = render(<InviteMemberScreen />);
        fireEvent.changeText(getByTestId('invite-name-input'), 'Jane');
        fireEvent.changeText(getByTestId('invite-phone-input'), '91234567');
        fireEvent.press(getByTestId('invite-role-picker'));
        await waitFor(() => {
            fireEvent.press(getByText('Agent'));
        });
        fireEvent.press(getByTestId('invite-submit-button'));

        await waitFor(() => {
            expect(getByText('Phone already registered')).toBeTruthy();
        });
    });

    it('navigates back on Done in success modal', async () => {
        const { getByTestId, getByText } = render(<InviteMemberScreen />);
        fireEvent.changeText(getByTestId('invite-name-input'), 'Jane');
        fireEvent.changeText(getByTestId('invite-phone-input'), '91234567');
        fireEvent.press(getByTestId('invite-role-picker'));
        await waitFor(() => {
            fireEvent.press(getByText('Agent'));
        });
        fireEvent.press(getByTestId('invite-submit-button'));

        await waitFor(() => {
            fireEvent.press(getByText('Done'));
        });
        expect(mockBack).toHaveBeenCalled();
    });
});
