/**
 * Tests for components/leads/ScPrConfirmDialog.tsx — the SC/PR confirm gate.
 * Marking a lead "qualified" fires an irreversible Meta conversion, so the
 * transition is gated: "Yes" qualifies + reports, "No" logs a note. The dialog
 * must not fire either path while busy.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ScPrConfirmDialog } from '@/components/leads/ScPrConfirmDialog';

jest.mock('@/contexts/ThemeContext', () => ({
    useTheme: () => ({
        colors: jest.requireActual('@/constants/Colors').Colors.light,
        isDark: false,
        mode: 'light',
        resolved: 'light',
    }),
}));

const baseProps = {
    visible: true,
    onYes: jest.fn(),
    onNo: jest.fn(),
    onClose: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe('ScPrConfirmDialog', () => {
    it('renders the SC/PR prompt with Yes / No actions', () => {
        const { getByText, getByTestId } = render(<ScPrConfirmDialog {...baseProps} />);
        expect(getByText('Singapore Citizen / PR?')).toBeTruthy();
        expect(getByTestId('sc-pr-yes')).toBeTruthy();
        expect(getByTestId('sc-pr-no')).toBeTruthy();
    });

    it('fires onYes when "Yes — SC/PR" is pressed', () => {
        const onYes = jest.fn();
        const { getByTestId } = render(<ScPrConfirmDialog {...baseProps} onYes={onYes} />);
        fireEvent.press(getByTestId('sc-pr-yes'));
        expect(onYes).toHaveBeenCalledTimes(1);
    });

    it('fires onNo when "No" is pressed', () => {
        const onNo = jest.fn();
        const { getByTestId } = render(<ScPrConfirmDialog {...baseProps} onNo={onNo} />);
        fireEvent.press(getByTestId('sc-pr-no'));
        expect(onNo).toHaveBeenCalledTimes(1);
    });

    it('does not fire either action while busy (disabled)', () => {
        const onYes = jest.fn();
        const onNo = jest.fn();
        const { getByTestId } = render(<ScPrConfirmDialog {...baseProps} busy onYes={onYes} onNo={onNo} />);
        fireEvent.press(getByTestId('sc-pr-yes'));
        fireEvent.press(getByTestId('sc-pr-no'));
        expect(onYes).not.toHaveBeenCalled();
        expect(onNo).not.toHaveBeenCalled();
    });
});
