import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import DeleteCandidateSheet from '@/components/candidates/DeleteCandidateSheet';
import { Colors } from '@/constants/Colors';

const colors = Colors.light;
const noopAnimatedStyle = {} as any;

function makeProps(overrides: Partial<React.ComponentProps<typeof DeleteCandidateSheet>> = {}) {
    return {
        visible: true,
        candidateName: 'Alice Tan',
        confirmText: '',
        error: null,
        isSubmitting: false,
        colors,
        animatedStyle: noopAnimatedStyle,
        onConfirmTextChange: jest.fn(),
        onSubmit: jest.fn(),
        onDismiss: jest.fn(),
        ...overrides,
    };
}

describe('DeleteCandidateSheet', () => {
    it('renders the heading and candidate name', () => {
        const { getAllByText, getByText } = render(<DeleteCandidateSheet {...makeProps()} />);
        // 'Delete Candidate' is both the title and the button label.
        expect(getAllByText('Delete Candidate').length).toBeGreaterThan(0);
        expect(getByText(/Alice Tan/)).toBeTruthy();
    });

    it('disables submit until a name is typed', () => {
        const onSubmit = jest.fn();
        const { getByTestId } = render(<DeleteCandidateSheet {...makeProps({ onSubmit, confirmText: '' })} />);
        fireEvent.press(getByTestId('delete-candidate-submit'));
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('keeps submit disabled when the typed name is wrong', () => {
        const onSubmit = jest.fn();
        const { getByTestId } = render(<DeleteCandidateSheet {...makeProps({ onSubmit, confirmText: 'Bob' })} />);
        fireEvent.press(getByTestId('delete-candidate-submit'));
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('enables submit when the typed name matches (case-insensitive)', () => {
        const onSubmit = jest.fn();
        const { getByTestId } = render(<DeleteCandidateSheet {...makeProps({ onSubmit, confirmText: 'alice tan' })} />);
        fireEvent.press(getByTestId('delete-candidate-submit'));
        expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it('calls onConfirmTextChange when text is typed', () => {
        const onConfirmTextChange = jest.fn();
        const { getByTestId } = render(<DeleteCandidateSheet {...makeProps({ onConfirmTextChange })} />);
        fireEvent.changeText(getByTestId('delete-candidate-confirm-input'), 'Alice');
        expect(onConfirmTextChange).toHaveBeenCalledWith('Alice');
    });

    it('shows the Deleting... label and blocks submit while submitting', () => {
        const onSubmit = jest.fn();
        const { getByText, getByTestId } = render(
            <DeleteCandidateSheet {...makeProps({ onSubmit, confirmText: 'Alice Tan', isSubmitting: true })} />,
        );
        expect(getByText('Deleting...')).toBeTruthy();
        fireEvent.press(getByTestId('delete-candidate-submit'));
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('surfaces the error message when error is set', () => {
        const { getByText } = render(
            <DeleteCandidateSheet {...makeProps({ error: 'Network error', confirmText: 'Alice Tan' })} />,
        );
        expect(getByText('Network error')).toBeTruthy();
    });
});
