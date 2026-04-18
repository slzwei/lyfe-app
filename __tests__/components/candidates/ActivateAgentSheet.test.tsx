import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import ActivateAgentSheet, { type ReadinessItem } from '@/components/candidates/ActivateAgentSheet';
import { Colors } from '@/constants/Colors';

const colors = Colors.light;
const noopAnimatedStyle = {} as any;

function satisfiedReadiness(): ReadinessItem[] {
    return [
        { label: 'Status is Licensed', satisfied: true },
        { label: 'BDM Interview completed', satisfied: true },
        { label: 'BES Induction completed', satisfied: true },
        { label: 'RNF issued', satisfied: true },
        { label: 'Sales Authority issued', satisfied: true },
    ];
}

function makeProps(overrides: Partial<React.ComponentProps<typeof ActivateAgentSheet>> = {}) {
    return {
        visible: true,
        candidateName: 'Alice',
        readiness: satisfiedReadiness(),
        error: null,
        isSubmitting: false,
        colors,
        animatedStyle: noopAnimatedStyle,
        onSubmit: jest.fn(),
        onDismiss: jest.fn(),
        ...overrides,
    };
}

describe('ActivateAgentSheet', () => {
    it('renders title + candidate name + readiness rows', () => {
        const { getByText } = render(<ActivateAgentSheet {...makeProps()} />);
        expect(getByText('Activate as Agent')).toBeTruthy();
        expect(getByText(/Alice/)).toBeTruthy();
        expect(getByText('BDM Interview completed')).toBeTruthy();
        expect(getByText('Sales Authority issued')).toBeTruthy();
    });

    it('enables submit when all checks satisfied', () => {
        const onSubmit = jest.fn();
        const { getByTestId } = render(<ActivateAgentSheet {...makeProps({ onSubmit })} />);
        fireEvent.press(getByTestId('activate-agent-submit'));
        expect(onSubmit).toHaveBeenCalled();
    });

    it('blocks submit when any check unsatisfied', () => {
        const onSubmit = jest.fn();
        const readiness = satisfiedReadiness();
        readiness[1].satisfied = false;
        const { getByTestId } = render(<ActivateAgentSheet {...makeProps({ onSubmit, readiness })} />);
        fireEvent.press(getByTestId('activate-agent-submit'));
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('shows helper text when any check is unsatisfied', () => {
        const readiness = satisfiedReadiness();
        readiness[0].satisfied = false;
        const { getByText } = render(<ActivateAgentSheet {...makeProps({ readiness })} />);
        expect(getByText('All readiness checks must be satisfied before activation.')).toBeTruthy();
    });

    it('disables submit while submitting', () => {
        const onSubmit = jest.fn();
        const { getByTestId, getByText } = render(
            <ActivateAgentSheet {...makeProps({ onSubmit, isSubmitting: true })} />,
        );
        expect(getByText('Activating...')).toBeTruthy();
        fireEvent.press(getByTestId('activate-agent-submit'));
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('surfaces error prop', () => {
        const { getByText } = render(<ActivateAgentSheet {...makeProps({ error: 'BDM not completed' })} />);
        expect(getByText('BDM not completed')).toBeTruthy();
    });

    it('renders optional detail on a check', () => {
        const readiness: ReadinessItem[] = [
            { label: 'Status is Licensed', satisfied: false, detail: 'Current status: Approved' },
            ...satisfiedReadiness().slice(1),
        ];
        const { getByText } = render(<ActivateAgentSheet {...makeProps({ readiness })} />);
        expect(getByText('Current status: Approved')).toBeTruthy();
    });
});
