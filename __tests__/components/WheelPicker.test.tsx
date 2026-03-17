/**
 * Tests for components/WheelPicker.tsx — iOS-style scroll wheel picker
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import WheelPicker, { WHEEL_ITEM_H } from '@/components/WheelPicker';

const MOCK_COLORS: any = {
    accent: '#FF7600',
    textPrimary: '#000000',
    border: '#E5E5EA',
};

const ITEMS = ['A', 'B', 'C', 'D', 'E'];

describe('WheelPicker', () => {
    it('renders all items', () => {
        const { getByText } = render(
            <WheelPicker items={ITEMS} selectedIndex={0} onChange={jest.fn()} colors={MOCK_COLORS} />,
        );
        ITEMS.forEach((item) => {
            expect(getByText(item)).toBeTruthy();
        });
    });

    it('exports WHEEL_ITEM_H constant', () => {
        expect(WHEEL_ITEM_H).toBe(44);
    });

    it('fires onChange on scroll end', () => {
        const onChange = jest.fn();
        const { getByTestId, UNSAFE_getAllByType } = render(
            <WheelPicker items={ITEMS} selectedIndex={0} onChange={onChange} colors={MOCK_COLORS} />,
        );

        // Find the ScrollView and simulate scroll end
        const scrollViews = UNSAFE_getAllByType(require('react-native').ScrollView);
        expect(scrollViews.length).toBeGreaterThan(0);

        const scrollView = scrollViews[0];
        fireEvent(scrollView, 'momentumScrollEnd', {
            nativeEvent: { contentOffset: { y: WHEEL_ITEM_H * 2 } },
        });

        expect(onChange).toHaveBeenCalledWith(2);
    });

    it('clamps index to valid range on scroll', () => {
        const onChange = jest.fn();
        const { UNSAFE_getAllByType } = render(
            <WheelPicker items={ITEMS} selectedIndex={0} onChange={onChange} colors={MOCK_COLORS} />,
        );

        const scrollViews = UNSAFE_getAllByType(require('react-native').ScrollView);
        const scrollView = scrollViews[0];

        // Scroll beyond max
        fireEvent(scrollView, 'momentumScrollEnd', {
            nativeEvent: { contentOffset: { y: WHEEL_ITEM_H * 100 } },
        });
        expect(onChange).toHaveBeenCalledWith(ITEMS.length - 1);

        // Scroll to negative
        fireEvent(scrollView, 'scrollEndDrag', {
            nativeEvent: { contentOffset: { y: -100 } },
        });
        expect(onChange).toHaveBeenCalledWith(0);
    });

    it('respects showIndicator={false}', () => {
        const { toJSON } = render(
            <WheelPicker
                items={ITEMS}
                selectedIndex={0}
                onChange={jest.fn()}
                colors={MOCK_COLORS}
                showIndicator={false}
            />,
        );
        const tree = JSON.stringify(toJSON());
        // When showIndicator is false, there should be no hairline border view
        // The indicator has pointerEvents="none" and borderTopWidth
        expect(tree).not.toContain('"pointerEvents":"none"');
    });

    it('respects custom width', () => {
        const { toJSON } = render(
            <WheelPicker items={ITEMS} selectedIndex={0} onChange={jest.fn()} colors={MOCK_COLORS} width={120} />,
        );
        const tree = toJSON() as any;
        const rootStyle = tree.props.style;
        expect(rootStyle.width).toBe(120);
    });

    it('respects custom visibleItems', () => {
        const { toJSON } = render(
            <WheelPicker items={ITEMS} selectedIndex={0} onChange={jest.fn()} colors={MOCK_COLORS} visibleItems={3} />,
        );
        const tree = toJSON() as any;
        const rootStyle = tree.props.style;
        expect(rootStyle.height).toBe(WHEEL_ITEM_H * 3);
    });

    it('uses default width=80 and visibleItems=5', () => {
        const { toJSON } = render(
            <WheelPicker items={ITEMS} selectedIndex={0} onChange={jest.fn()} colors={MOCK_COLORS} />,
        );
        const tree = toJSON() as any;
        const rootStyle = tree.props.style;
        expect(rootStyle.width).toBe(80);
        expect(rootStyle.height).toBe(WHEEL_ITEM_H * 5);
    });
});
