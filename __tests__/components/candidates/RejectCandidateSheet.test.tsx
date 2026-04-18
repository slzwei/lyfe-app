import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import RejectCandidateSheet from '@/components/candidates/RejectCandidateSheet';
import { Colors } from '@/constants/Colors';

const colors = Colors.light;
const noopAnimatedStyle = {} as any;

function makeProps(overrides: Partial<React.ComponentProps<typeof RejectCandidateSheet>> = {}) {
    return {
        visible: true,
        candidateName: 'Alice',
        reason: '',
        error: null,
        isSubmitting: false,
        colors,
        animatedStyle: noopAnimatedStyle,
        onReasonChange: jest.fn(),
        onSubmit: jest.fn(),
        onDismiss: jest.fn(),
        ...overrides,
    };
}

describe('RejectCandidateSheet', () => {
    it('renders candidate name + heading', () => {
        const props = makeProps();
        const { getByText } = render(<RejectCandidateSheet {...props} />);
        expect(getByText('Reject Candidate')).toBeTruthy();
        expect(getByText(/Alice/)).toBeTruthy();
    });

    it('disables submit when reason is empty', () => {
        const onSubmit = jest.fn();
        const { getByTestId } = render(<RejectCandidateSheet {...makeProps({ onSubmit, reason: '' })} />);
        fireEvent.press(getByTestId('reject-candidate-submit'));
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('disables submit when reason is only whitespace', () => {
        const onSubmit = jest.fn();
        const { getByTestId } = render(<RejectCandidateSheet {...makeProps({ onSubmit, reason: '   ' })} />);
        fireEvent.press(getByTestId('reject-candidate-submit'));
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('enables submit when reason is non-empty', () => {
        const onSubmit = jest.fn();
        const { getByTestId } = render(<RejectCandidateSheet {...makeProps({ onSubmit, reason: 'not a fit' })} />);
        fireEvent.press(getByTestId('reject-candidate-submit'));
        expect(onSubmit).toHaveBeenCalled();
    });

    it('calls onReasonChange when text is typed', () => {
        const onReasonChange = jest.fn();
        const { getByTestId } = render(<RejectCandidateSheet {...makeProps({ onReasonChange })} />);
        fireEvent.changeText(getByTestId('reject-candidate-reason-input'), 'moved overseas');
        expect(onReasonChange).toHaveBeenCalledWith('moved overseas');
    });

    it('shows Rejecting... label and disables when submitting', () => {
        const onSubmit = jest.fn();
        const { getByText, getByTestId } = render(
            <RejectCandidateSheet {...makeProps({ onSubmit, reason: 'done', isSubmitting: true })} />,
        );
        expect(getByText('Rejecting...')).toBeTruthy();
        fireEvent.press(getByTestId('reject-candidate-submit'));
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('surfaces error message when error prop is set', () => {
        const { getByText } = render(<RejectCandidateSheet {...makeProps({ error: 'RLS denied', reason: 'x' })} />);
        expect(getByText('RLS denied')).toBeTruthy();
    });
});
