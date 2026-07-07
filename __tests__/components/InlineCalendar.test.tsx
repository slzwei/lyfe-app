/**
 * Tests for components/InlineCalendar.tsx — the inline (no-Modal) calendar
 * used inside bottom sheets (MilestoneMarkSheet, PrepCourseMarkSheet,
 * PaperAttemptEditSheet). Range semantics intentionally match
 * CalendarPicker: a second tap earlier than the start RESTARTS the range
 * and keeps waiting for an end date (no accidental instant-commit).
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import InlineCalendar from '@/components/InlineCalendar';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

const colors = {
    textPrimary: '#000',
    textTertiary: '#999',
    textInverse: '#FBF7EE',
    accent: '#FF7600',
} as never;

describe('InlineCalendar (root) — single mode', () => {
    it('calls onSelect with the tapped date', () => {
        const onSelect = jest.fn();
        const { getByTestId } = render(
            <InlineCalendar selectedDate="2026-03-10" onSelect={onSelect} colors={colors} />,
        );

        fireEvent.press(getByTestId('inline-calendar-day-2026-03-18'));
        expect(onSelect).toHaveBeenCalledWith('2026-03-18');
    });

    it('ignores taps on days before minDate', () => {
        const onSelect = jest.fn();
        const { getByTestId } = render(
            <InlineCalendar selectedDate="2026-03-10" onSelect={onSelect} colors={colors} minDate="2026-03-10" />,
        );

        fireEvent.press(getByTestId('inline-calendar-day-2026-03-05'));
        expect(onSelect).not.toHaveBeenCalled();

        fireEvent.press(getByTestId('inline-calendar-day-2026-03-15'));
        expect(onSelect).toHaveBeenCalledWith('2026-03-15');
    });
});

describe('InlineCalendar (root) — range mode', () => {
    function renderRange(start: string | null = null, end: string | null = null) {
        const onRangeChange = jest.fn();
        const utils = render(
            <InlineCalendar
                mode="range"
                startDate={start ?? '2026-03-10'}
                endDate={end ?? '2026-03-10'}
                onRangeChange={onRangeChange}
                colors={colors}
            />,
        );
        return { ...utils, onRangeChange };
    }

    it('first tap starts a tentative same-day range', () => {
        const { getByTestId, onRangeChange } = renderRange();
        fireEvent.press(getByTestId('inline-calendar-day-2026-03-12'));
        expect(onRangeChange).toHaveBeenLastCalledWith('2026-03-12', '2026-03-12');
    });

    it('second tap after the start completes the range', () => {
        const { getByTestId, rerender, onRangeChange } = renderRange();

        fireEvent.press(getByTestId('inline-calendar-day-2026-03-12'));
        rerender(
            <InlineCalendar
                mode="range"
                startDate="2026-03-12"
                endDate="2026-03-12"
                onRangeChange={onRangeChange}
                colors={colors}
            />,
        );
        fireEvent.press(getByTestId('inline-calendar-day-2026-03-20'));

        expect(onRangeChange).toHaveBeenLastCalledWith('2026-03-12', '2026-03-20');
    });

    it('a second tap EARLIER than the start restarts the range there and keeps waiting', () => {
        const { getByTestId, rerender, onRangeChange } = renderRange();

        fireEvent.press(getByTestId('inline-calendar-day-2026-03-20'));
        rerender(
            <InlineCalendar
                mode="range"
                startDate="2026-03-20"
                endDate="2026-03-20"
                onRangeChange={onRangeChange}
                colors={colors}
            />,
        );

        // Earlier tap → restart, NOT an instant (5th → 20th) commit
        fireEvent.press(getByTestId('inline-calendar-day-2026-03-05'));
        expect(onRangeChange).toHaveBeenLastCalledWith('2026-03-05', '2026-03-05');
        expect(getByTestId('inline-calendar-day-2026-03-05')).toBeTruthy();

        // Still waiting: the next tap completes from the restarted start
        rerender(
            <InlineCalendar
                mode="range"
                startDate="2026-03-05"
                endDate="2026-03-05"
                onRangeChange={onRangeChange}
                colors={colors}
            />,
        );
        fireEvent.press(getByTestId('inline-calendar-day-2026-03-12'));
        expect(onRangeChange).toHaveBeenLastCalledWith('2026-03-05', '2026-03-12');
    });

    it('an explicit second tap on the start date makes a same-day range', () => {
        const { getByTestId, rerender, onRangeChange } = renderRange();

        fireEvent.press(getByTestId('inline-calendar-day-2026-03-12'));
        rerender(
            <InlineCalendar
                mode="range"
                startDate="2026-03-12"
                endDate="2026-03-12"
                onRangeChange={onRangeChange}
                colors={colors}
            />,
        );
        fireEvent.press(getByTestId('inline-calendar-day-2026-03-12'));

        expect(onRangeChange).toHaveBeenLastCalledWith('2026-03-12', '2026-03-12');
    });
});
