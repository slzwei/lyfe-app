/**
 * Tests for components/roadmap/UnlockConfirmSheet
 */
import React from 'react';
import { fireEvent, render, act } from '@testing-library/react-native';

import UnlockConfirmSheet from '@/components/roadmap/UnlockConfirmSheet';

const COLORS: any = {
    textPrimary: '#111',
    textSecondary: '#555',
    textTertiary: '#999',
    textInverse: '#FFFFFF',
    background: '#FFF',
    border: '#E5E5E5',
    accent: '#FF7600',
    accentLight: '#FFF0E6',
    cardBackground: '#FFF',
    surfacePrimary: '#F9F9F9',
};

const defaultProps = {
    visible: true,
    candidateName: 'Alice Tan',
    programmeName: 'SproutLYFE',
    isUnlocking: false,
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
    colors: COLORS,
};

beforeEach(() => jest.clearAllMocks());

describe('UnlockConfirmSheet', () => {
    it('renders nothing (modal hidden) when visible=false', () => {
        const { queryByText } = render(<UnlockConfirmSheet {...defaultProps} visible={false} />);
        // Modal with visible=false — the title text is not in the rendered tree
        expect(queryByText('Unlock SproutLYFE?')).toBeNull();
    });

    it('shows programme name in title', () => {
        const { getByText } = render(<UnlockConfirmSheet {...defaultProps} />);
        expect(getByText('Unlock SproutLYFE?')).toBeTruthy();
    });

    it('shows candidate name in body text', () => {
        const { getByText } = render(<UnlockConfirmSheet {...defaultProps} />);
        expect(getByText(/Alice Tan/)).toBeTruthy();
    });

    it('calls onConfirm when Confirm Unlock is pressed', () => {
        const onConfirm = jest.fn();
        const { getByText } = render(<UnlockConfirmSheet {...defaultProps} onConfirm={onConfirm} />);
        fireEvent.press(getByText('Confirm Unlock'));
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel when Cancel is pressed', () => {
        const onCancel = jest.fn();
        const { getByText } = render(<UnlockConfirmSheet {...defaultProps} onCancel={onCancel} />);
        fireEvent.press(getByText('Cancel'));
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('shows loading indicator while unlocking and hides confirm text', () => {
        const { queryByText } = render(<UnlockConfirmSheet {...defaultProps} isUnlocking />);
        // When isUnlocking, ActivityIndicator replaces the button text
        expect(queryByText('Confirm Unlock')).toBeNull();
    });

    it('confirm button is disabled while unlocking', () => {
        const onConfirm = jest.fn();
        const { UNSAFE_getAllByType } = render(
            <UnlockConfirmSheet {...defaultProps} isUnlocking onConfirm={onConfirm} />,
        );
        // The confirm Touchable has disabled=true when isUnlocking
        const touchables = UNSAFE_getAllByType(require('@/components/Touchable').default);
        // First Touchable = overlay, second = confirm button, third = cancel
        // Find the confirm button by its disabled prop
        const disabledBtn = touchables.find((t: any) => t.props.disabled === true);
        expect(disabledBtn).toBeTruthy();
    });
});
