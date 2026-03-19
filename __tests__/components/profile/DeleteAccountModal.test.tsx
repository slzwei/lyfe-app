import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import DeleteAccountModal from '@/components/profile/DeleteAccountModal';
import { Colors } from '@/constants/Colors';

const colors = Colors.light;

const baseProps = {
    visible: true,
    colors,
    deleting: false,
    error: null as string | null,
    onCancel: jest.fn(),
    onConfirm: jest.fn(),
};

describe('DeleteAccountModal', () => {
    beforeEach(() => jest.clearAllMocks());

    it('renders title and warning text', () => {
        const { getByText } = render(<DeleteAccountModal {...baseProps} />);
        expect(getByText('Delete Account')).toBeTruthy();
        expect(getByText(/permanently delete/i)).toBeTruthy();
    });

    it('delete button is disabled until user types "delete"', () => {
        const { getByLabelText } = render(<DeleteAccountModal {...baseProps} />);
        const confirmBtn = getByLabelText('Confirm account deletion');
        expect(confirmBtn.props.accessibilityState?.disabled).toBe(true);
    });

    it('enables delete button after typing "delete"', () => {
        const { getByLabelText } = render(<DeleteAccountModal {...baseProps} />);
        const input = getByLabelText('Type delete to confirm account deletion');
        fireEvent.changeText(input, 'delete');
        const confirmBtn = getByLabelText('Confirm account deletion');
        expect(confirmBtn.props.accessibilityState?.disabled).toBe(false);
    });

    it('calls onConfirm when delete button is pressed after confirmation', () => {
        const { getByLabelText } = render(<DeleteAccountModal {...baseProps} />);
        const input = getByLabelText('Type delete to confirm account deletion');
        fireEvent.changeText(input, 'delete');
        fireEvent.press(getByLabelText('Confirm account deletion'));
        expect(baseProps.onConfirm).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel when cancel button is pressed', () => {
        const { getByLabelText } = render(<DeleteAccountModal {...baseProps} />);
        fireEvent.press(getByLabelText('Cancel account deletion'));
        expect(baseProps.onCancel).toHaveBeenCalledTimes(1);
    });

    it('shows spinner and disables input when deleting', () => {
        const { getByLabelText } = render(<DeleteAccountModal {...baseProps} deleting />);
        const input = getByLabelText('Type delete to confirm account deletion');
        expect(input.props.editable).toBe(false);
    });

    it('is case-insensitive for confirmation', () => {
        const { getByLabelText } = render(<DeleteAccountModal {...baseProps} />);
        const input = getByLabelText('Type delete to confirm account deletion');
        fireEvent.changeText(input, 'DELETE');
        const confirmBtn = getByLabelText('Confirm account deletion');
        expect(confirmBtn.props.accessibilityState?.disabled).toBe(false);
    });

    it('displays error message when error prop is set', () => {
        const { getByText } = render(
            <DeleteAccountModal {...baseProps} error="Failed to delete account. Please try again." />,
        );
        expect(getByText('Failed to delete account. Please try again.')).toBeTruthy();
    });

    it('does not display error text when error is null', () => {
        const { queryByText } = render(<DeleteAccountModal {...baseProps} error={null} />);
        expect(queryByText(/failed/i)).toBeNull();
    });
});
