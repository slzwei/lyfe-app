/**
 * Tests for components/CalendarPicker.tsx — modal calendar picker (single + range modes)
 *
 * Animation notes:
 *   animateOut() uses Animated.timing(...).start(cb) which fires the callback via a
 *   Timeout in React Native's Jest mock (not synchronously). Tests that assert on
 *   callbacks fired after animation (onClose, onConfirm) must flush timers with
 *   jest.useFakeTimers() + act(() => jest.runAllTimers()).
 *
 * TouchableOpacity ordering in the rendered tree (single mode):
 *   [0]  backdrop (inside Animated.View)
 *   [1]  Done button (header)
 *   [2]  back chevron (month nav)
 *   [3]  forward chevron (month nav)
 *   [4..45] day cells (42 total, 6 weeks × 7 days)
 *   [46] Today button
 */
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { TouchableOpacity } from 'react-native';

import CalendarPicker from '@/components/CalendarPicker';

// ── Module mocks ─────────────────────────────────────────────────────────────

jest.mock('@/constants/platform', () => ({
    MODAL_STATUS_BAR_TRANSLUCENT: false,
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

jest.mock('@/lib/dateTime', () => ({
    formatDateLabel: jest.fn((d: string) => d),
    toDateStr: jest.fn((date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }),
}));

// ── Shared fixtures ───────────────────────────────────────────────────────────

const mockColors = {
    cardBackground: '#FFF',
    border: '#EEE',
    textPrimary: '#000',
    textSecondary: '#666',
    textTertiary: '#999',
    textInverse: '#FBF7EE',
    accent: '#FF7600',
    inputBackground: '#F5F5F5',
    inputBorder: '#DDD',
    danger: '#EF4444',
    accentLight: '#FFF3E6',
    surfaceSecondary: '#F0F0F0',
};

// Today in the test environment (CLAUDE.md: 2026-03-10)
const TODAY = '2026-03-10';

// Indices within UNSAFE_getAllByType(TouchableOpacity) for a single-mode calendar
// rendered with visible={true}. Range mode has the same header layout but no Today button.
const IDX_BACKDROP = 0;
const IDX_DONE = 1;
const IDX_BACK_CHEVRON = 2;
const IDX_FWD_CHEVRON = 3;

// Default props for single mode
const defaultSingleProps = {
    visible: true,
    selectedDate: TODAY,
    onSelect: jest.fn(),
    onClose: jest.fn(),
    colors: mockColors as any,
};

// Default props for range mode
const defaultRangeProps = {
    mode: 'range' as const,
    visible: true,
    startDate: TODAY,
    endDate: TODAY,
    onConfirm: jest.fn(),
    onClose: jest.fn(),
    colors: mockColors as any,
};

beforeEach(() => {
    jest.clearAllMocks();
    // Restore real timers between tests (some tests use fake timers)
    jest.useRealTimers();
});

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('CalendarPicker', () => {
    // ── Visibility ────────────────────────────────────────────────────────────

    it('returns null when not visible', () => {
        const { toJSON } = render(<CalendarPicker {...defaultSingleProps} visible={false} />);
        expect(toJSON()).toBeNull();
    });

    // ── Title rendering ───────────────────────────────────────────────────────

    it('renders default title "Select Date" in single mode', () => {
        const { getByText } = render(<CalendarPicker {...defaultSingleProps} />);
        expect(getByText('Select Date')).toBeTruthy();
    });

    it('renders custom title when provided', () => {
        const { getByText } = render(<CalendarPicker {...defaultSingleProps} title="Pick a Day" />);
        expect(getByText('Pick a Day')).toBeTruthy();
    });

    // ── Day-of-week labels ────────────────────────────────────────────────────

    it('shows all day-of-week labels Mon through Sun', () => {
        const { getByText } = render(<CalendarPicker {...defaultSingleProps} />);
        ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach((label) => {
            expect(getByText(label)).toBeTruthy();
        });
    });

    // ── Month/year navigation label ───────────────────────────────────────────

    it('shows the month/year label for the displayed month', () => {
        const { getByText } = render(<CalendarPicker {...defaultSingleProps} selectedDate="2026-03-10" />);
        // Component uses en-SG locale: long month + year
        expect(getByText('March 2026')).toBeTruthy();
    });

    // ── Month navigation ──────────────────────────────────────────────────────

    it('navigates to the next month when the forward chevron is pressed', () => {
        const { getByText, UNSAFE_getAllByType } = render(
            <CalendarPicker {...defaultSingleProps} selectedDate="2026-03-10" />,
        );

        expect(getByText('March 2026')).toBeTruthy();

        const allTouchables = UNSAFE_getAllByType(TouchableOpacity);
        fireEvent.press(allTouchables[IDX_FWD_CHEVRON]);

        expect(getByText('April 2026')).toBeTruthy();
    });

    it('navigates to the previous month when the back chevron is pressed', () => {
        const { getByText, UNSAFE_getAllByType } = render(
            <CalendarPicker {...defaultSingleProps} selectedDate="2026-03-10" />,
        );

        expect(getByText('March 2026')).toBeTruthy();

        const allTouchables = UNSAFE_getAllByType(TouchableOpacity);
        fireEvent.press(allTouchables[IDX_BACK_CHEVRON]);

        expect(getByText('February 2026')).toBeTruthy();
    });

    // ── Single mode — day selection ───────────────────────────────────────────

    it('calls onSelect with the selected date string when a day is pressed', () => {
        jest.useFakeTimers();
        const onSelect = jest.fn();
        const onClose = jest.fn();

        const { getAllByText } = render(
            <CalendarPicker {...defaultSingleProps} selectedDate="2026-03-10" onSelect={onSelect} onClose={onClose} />,
        );

        // Day 15 is always present in March 2026
        fireEvent.press(getAllByText('15')[0]);

        // onSelect fires before animateOut starts
        expect(onSelect).toHaveBeenCalledWith('2026-03-15');

        // Flush the 200 ms animateOut timer so the onClose callback runs
        act(() => {
            jest.runAllTimers();
        });

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('renders a Today button in single mode', () => {
        const { getByText } = render(<CalendarPicker {...defaultSingleProps} />);
        expect(getByText('Today')).toBeTruthy();
    });

    // ── Range mode ────────────────────────────────────────────────────────────

    it('renders default title "Select Dates" in range mode', () => {
        const { getByText } = render(<CalendarPicker {...defaultRangeProps} />);
        expect(getByText('Select Dates')).toBeTruthy();
    });

    it('does not render a Today button in range mode', () => {
        const { queryByText } = render(<CalendarPicker {...defaultRangeProps} />);
        expect(queryByText('Today')).toBeNull();
    });

    it('shows "Now tap the end date" hint after the first tap in range mode', () => {
        const { getAllByText, getByText, queryByText } = render(
            <CalendarPicker {...defaultRangeProps} startDate="2026-03-01" endDate="2026-03-01" />,
        );

        // Hint is absent before any interaction
        expect(queryByText('Now tap the end date')).toBeNull();

        // First tap sets the start date (tapCount goes 0 → 1)
        fireEvent.press(getAllByText('5')[0]);

        expect(getByText('Now tap the end date')).toBeTruthy();
    });

    it('Done button calls onConfirm with sorted start and end dates', () => {
        jest.useFakeTimers();
        const onConfirm = jest.fn();

        const { getAllByText, getByText } = render(
            <CalendarPicker {...defaultRangeProps} startDate="2026-03-01" endDate="2026-03-01" onConfirm={onConfirm} />,
        );

        // First tap — set start date to the 5th
        fireEvent.press(getAllByText('5')[0]);

        // Second tap — set end date to the 20th
        fireEvent.press(getAllByText('20')[0]);

        // Press Done
        fireEvent.press(getByText('Done'));

        // Flush animateOut timer
        act(() => {
            jest.runAllTimers();
        });

        expect(onConfirm).toHaveBeenCalledWith('2026-03-05', '2026-03-20');
    });

    it('sorts the range so onConfirm always receives (earlier, later)', () => {
        jest.useFakeTimers();
        const onConfirm = jest.fn();

        const { getAllByText, getByText } = render(
            <CalendarPicker {...defaultRangeProps} startDate="2026-03-01" endDate="2026-03-01" onConfirm={onConfirm} />,
        );

        // Tap 20th as start, then March 25th as end.
        // (March 2026 starts on a Sunday, so the grid's leading cells are
        // Feb 23–28 — getAllByText('25')[0] is FEBRUARY 25; [1] is March.)
        fireEvent.press(getAllByText('20')[0]);
        fireEvent.press(getAllByText('25')[1]);

        fireEvent.press(getByText('Done'));

        act(() => {
            jest.runAllTimers();
        });

        // Regardless of tap order, result must be (start <= end)
        expect(onConfirm).toHaveBeenCalledTimes(1);
        const [start, end]: [string, string] = onConfirm.mock.calls[0];
        expect(start <= end).toBe(true);
        expect(onConfirm).toHaveBeenCalledWith('2026-03-20', '2026-03-25');
    });

    // ── Grid completeness ─────────────────────────────────────────────────────

    it('renders exactly 42 day cells (6 weeks × 7 days)', () => {
        const { UNSAFE_getAllByType } = render(<CalendarPicker {...defaultSingleProps} selectedDate="2026-03-10" />);

        const allTouchables = UNSAFE_getAllByType(TouchableOpacity);

        // Non-day TouchableOpacities: backdrop(1) + Done(1) + back-chevron(1) + fwd-chevron(1) + Today(1) = 5
        const NON_DAY_TOUCHABLES = 5;
        const dayCells = allTouchables.length - NON_DAY_TOUCHABLES;
        expect(dayCells).toBe(42);
    });

    // ── Today special styling ─────────────────────────────────────────────────

    it("renders today's date cell with a border matching the accent color", () => {
        const { toJSON } = render(
            // selectedDate is a past date so today's cell is not the selected endpoint
            <CalendarPicker {...defaultSingleProps} selectedDate="2026-03-01" />,
        );

        const tree = JSON.stringify(toJSON());
        // Today's dayCircle View gets { borderWidth: 1.5, borderColor: accent }
        expect(tree).toContain('"borderColor":"#FF7600"');
        expect(tree).toContain('"borderWidth":1.5');
    });

    // ── Close / Done parity ───────────────────────────────────────────────────

    it('calls onClose when Done is pressed in single mode with no range state', () => {
        jest.useFakeTimers();
        const onClose = jest.fn();

        const { getByText } = render(<CalendarPicker {...defaultSingleProps} onClose={onClose} />);

        fireEvent.press(getByText('Done'));

        act(() => {
            jest.runAllTimers();
        });

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('confirms range on Done when both start and end are set', () => {
        jest.useFakeTimers();
        const onConfirm = jest.fn();

        const { getAllByText, getByText } = render(
            <CalendarPicker {...defaultRangeProps} startDate="2026-03-01" endDate="2026-03-01" onConfirm={onConfirm} />,
        );

        fireEvent.press(getAllByText('3')[0]);
        fireEvent.press(getAllByText('18')[0]);

        fireEvent.press(getByText('Done'));

        act(() => {
            jest.runAllTimers();
        });

        expect(onConfirm).toHaveBeenCalledWith('2026-03-03', '2026-03-18');
    });

    // ── Range mode: same date tapped twice → single-day range ────────────────

    it('accepts a single-day range when the same date is tapped twice', () => {
        jest.useFakeTimers();
        const onConfirm = jest.fn();

        const { getAllByText, getByText } = render(
            <CalendarPicker {...defaultRangeProps} startDate="2026-03-01" endDate="2026-03-01" onConfirm={onConfirm} />,
        );

        // Tap 10 twice — second tap on same date resets tapCount to 0 (single-day range)
        fireEvent.press(getAllByText('10')[0]);
        fireEvent.press(getAllByText('10')[0]);

        fireEvent.press(getByText('Done'));

        act(() => {
            jest.runAllTimers();
        });

        expect(onConfirm).toHaveBeenCalledWith('2026-03-10', '2026-03-10');
    });

    // ── Month navigation preserves selection ──────────────────────────────────

    it('pressing a day after navigating months calls onSelect with the correct date', () => {
        jest.useFakeTimers();
        const onSelect = jest.fn();

        const { UNSAFE_getAllByType, getAllByText } = render(
            <CalendarPicker {...defaultSingleProps} selectedDate="2026-03-10" onSelect={onSelect} />,
        );

        // Navigate forward to April
        const allTouchables = UNSAFE_getAllByType(TouchableOpacity);
        fireEvent.press(allTouchables[IDX_FWD_CHEVRON]);

        // Press "15" — now in April 2026
        fireEvent.press(getAllByText('15')[0]);

        expect(onSelect).toHaveBeenCalledWith('2026-04-15');
    });

    // ── Today button shortcut (single mode) ──────────────────────────────────

    it('Today button calls onSelect and onClose', () => {
        jest.useFakeTimers();
        const onSelect = jest.fn();
        const onClose = jest.fn();

        const { getByText } = render(
            <CalendarPicker {...defaultSingleProps} selectedDate="2026-01-01" onSelect={onSelect} onClose={onClose} />,
        );

        fireEvent.press(getByText('Today'));

        // onSelect should be called with a valid YYYY-MM-DD string
        expect(onSelect).toHaveBeenCalledTimes(1);
        const selected: string = onSelect.mock.calls[0][0];
        expect(/^\d{4}-\d{2}-\d{2}$/.test(selected)).toBe(true);

        // Flush animateOut so onClose fires
        act(() => {
            jest.runAllTimers();
        });

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    // ── Range mode: custom title ──────────────────────────────────────────────

    it('renders a custom title in range mode when provided', () => {
        const { getByText } = render(<CalendarPicker {...defaultRangeProps} title="Choose Range" />);
        expect(getByText('Choose Range')).toBeTruthy();
    });

    // ── Visible state transitions ─────────────────────────────────────────────

    it('renders sheet content when visible changes from false to true', () => {
        const { rerender, getByText } = render(<CalendarPicker {...defaultSingleProps} visible={false} />);

        rerender(<CalendarPicker {...defaultSingleProps} visible={true} />);

        expect(getByText('Select Date')).toBeTruthy();
    });

    // ── Cancellable range editing (backdrop = discard, Done = commit) ─────────

    it('backdrop tap discards range edits instead of committing them', () => {
        jest.useFakeTimers();
        const onConfirm = jest.fn();
        const onClose = jest.fn();

        const { getAllByText, UNSAFE_getAllByType } = render(
            <CalendarPicker
                {...defaultRangeProps}
                startDate="2026-03-01"
                endDate="2026-03-04"
                onConfirm={onConfirm}
                onClose={onClose}
            />,
        );

        // One stray tap starts a new range…
        fireEvent.press(getAllByText('5')[0]);
        // …but tapping the backdrop cancels the edit entirely
        fireEvent.press(UNSAFE_getAllByType(TouchableOpacity)[IDX_BACKDROP]);

        act(() => {
            jest.runAllTimers();
        });

        expect(onConfirm).not.toHaveBeenCalled();
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('Done mid-selection (no end date yet) closes without committing', () => {
        jest.useFakeTimers();
        const onConfirm = jest.fn();
        const onClose = jest.fn();

        const { getAllByText, getByText } = render(
            <CalendarPicker
                {...defaultRangeProps}
                startDate="2026-03-01"
                endDate="2026-03-04"
                onConfirm={onConfirm}
                onClose={onClose}
            />,
        );

        fireEvent.press(getAllByText('5')[0]);
        fireEvent.press(getByText('Done'));

        act(() => {
            jest.runAllTimers();
        });

        expect(onConfirm).not.toHaveBeenCalled();
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('a tap earlier than the start restarts the range and keeps waiting for an end', () => {
        jest.useFakeTimers();
        const onConfirm = jest.fn();

        const { getAllByText, getByText } = render(
            <CalendarPicker {...defaultRangeProps} startDate="2026-03-01" endDate="2026-03-01" onConfirm={onConfirm} />,
        );

        fireEvent.press(getAllByText('20')[0]);
        // Earlier tap → restart at the 5th, still waiting for the end date
        fireEvent.press(getAllByText('5')[0]);
        expect(getByText('Now tap the end date')).toBeTruthy();

        fireEvent.press(getAllByText('12')[0]);
        fireEvent.press(getByText('Done'));

        act(() => {
            jest.runAllTimers();
        });

        expect(onConfirm).toHaveBeenCalledWith('2026-03-05', '2026-03-12');
    });

    // ── minDate guard ─────────────────────────────────────────────────────────

    it('ignores taps on days before minDate in single mode', () => {
        const onSelect = jest.fn();

        const { getAllByText } = render(
            <CalendarPicker
                {...defaultSingleProps}
                selectedDate="2026-03-10"
                onSelect={onSelect}
                minDate="2026-03-10"
            />,
        );

        // The 5th is before minDate — tap must be a no-op
        fireEvent.press(getAllByText('5')[0]);
        expect(onSelect).not.toHaveBeenCalled();

        // The 15th is allowed
        fireEvent.press(getAllByText('15')[0]);
        expect(onSelect).toHaveBeenCalledWith('2026-03-15');
    });
});
