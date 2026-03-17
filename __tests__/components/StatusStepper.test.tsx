import React from 'react';
import { render } from '@testing-library/react-native';
import StatusStepper from '@/components/StatusStepper';

const COLORS: any = { border: '#E0E0E0', textPrimary: '#000', textTertiary: '#999' };

describe('StatusStepper', () => {
    it('renders all status steps', () => {
        const { getByText } = render(<StatusStepper currentStatus="applied" colors={COLORS} />);
        expect(getByText('Applied')).toBeTruthy();
        expect(getByText('Interview')).toBeTruthy();
        expect(getByText('Interviewed')).toBeTruthy();
        expect(getByText('Approved')).toBeTruthy();
        expect(getByText('Exam Prep')).toBeTruthy();
        expect(getByText('Licensed')).toBeTruthy();
        expect(getByText('Active Agent')).toBeTruthy();
    });

    it('highlights current status', () => {
        const { getByText } = render(<StatusStepper currentStatus="interviewed" colors={COLORS} />);
        expect(getByText('Interviewed')).toBeTruthy();
    });
});
