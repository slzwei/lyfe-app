import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import QuickAction from '@/components/leads/QuickAction';

describe('QuickAction', () => {
    const baseProps = {
        icon: 'call',
        label: 'Call',
        color: '#34C759',
        bgColor: '#E8F9ED',
        onPress: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders the label text', () => {
        const { getByText } = render(<QuickAction {...baseProps} />);
        expect(getByText('Call')).toBeTruthy();
    });

    it('calls onPress when tapped', () => {
        const onPress = jest.fn();
        const { getByText } = render(<QuickAction {...baseProps} onPress={onPress} />);
        fireEvent.press(getByText('Call'));
        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('does not call onPress when disabled', () => {
        const onPress = jest.fn();
        const { getByText } = render(<QuickAction {...baseProps} onPress={onPress} disabled />);
        fireEvent.press(getByText('Call'));
        expect(onPress).not.toHaveBeenCalled();
    });

    it('renders with reduced opacity when disabled', () => {
        const { toJSON } = render(<QuickAction {...baseProps} disabled />);
        const tree = toJSON();
        expect(tree).toBeTruthy();
        expect(tree?.props?.style).toEqual(expect.objectContaining({ opacity: 0.35 }));
    });

    it('renders with full opacity when enabled', () => {
        const { toJSON } = render(<QuickAction {...baseProps} />);
        const tree = toJSON();
        expect(tree?.props?.style).not.toEqual(expect.objectContaining({ opacity: 0.35 }));
    });
});
