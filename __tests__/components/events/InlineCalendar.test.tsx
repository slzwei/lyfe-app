import React from 'react';
import { FlatList } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import InlineCalendar, { buildStrip, buildMonthGrid, buildMonthPages } from '@/components/events/InlineCalendar';
import { toDateStr } from '@/lib/dateTime';
import { Colors } from '@/constants/Colors';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

const colors = Colors.light as never;

function addDays(base: Date, n: number): Date {
    const d = new Date(base);
    d.setDate(d.getDate() + n);
    return d;
}

// ── Pure helpers ───────────────────────────────────────────────

describe('buildStrip', () => {
    it('builds a Mon-aligned strip of full weeks centered on today', () => {
        const { days, todayWeekIdx } = buildStrip('2026-07-08'); // a Wednesday
        expect(days.length % 7).toBe(0);
        // First date is a Monday: (getDay()+6)%7 === 0
        const first = new Date(days[0].dateStr + 'T00:00:00');
        expect((first.getDay() + 6) % 7).toBe(0);
        // Today sits inside the week at todayWeekIdx, at its weekday offset
        const dow = (new Date('2026-07-08T00:00:00').getDay() + 6) % 7;
        expect(days[todayWeekIdx * 7 + dow].dateStr).toBe('2026-07-08');
    });

    it('produces consecutive unique dates', () => {
        const { days } = buildStrip('2026-02-27');
        expect(new Set(days.map((d) => d.dateStr)).size).toBe(days.length);
        for (let i = 1; i < days.length; i++) {
            const prev = new Date(days[i - 1].dateStr + 'T00:00:00');
            const cur = new Date(days[i].dateStr + 'T00:00:00');
            expect(cur.getTime() - prev.getTime()).toBe(86_400_000);
        }
    });

    it('precomputes display + accessibility strings per day', () => {
        const { days, todayWeekIdx } = buildStrip('2026-07-08');
        const dow = (new Date('2026-07-08T00:00:00').getDay() + 6) % 7;
        const today = days[todayWeekIdx * 7 + dow];
        expect(today.dayNum).toBe(8);
        expect(today.dow).toBe('We');
        expect(today.a11yLabel).toBe('Wednesday 8 July');
    });
});

describe('buildMonthGrid', () => {
    it('always yields 6 weeks of 7 cells', () => {
        for (const [y, m] of [
            [2026, 0],
            [2026, 1],
            [2026, 6],
            [2024, 1], // leap Feb
        ]) {
            const grid = buildMonthGrid(y, m);
            expect(grid).toHaveLength(6);
            grid.forEach((week) => expect(week).toHaveLength(7));
        }
    });

    it('pads adjacent-month cells with null and aligns day 1 to its weekday', () => {
        // July 2026 starts on a Wednesday
        const grid = buildMonthGrid(2026, 6);
        const flat = grid.flat();
        expect(flat[0]).toBeNull();
        expect(flat[1]).toBeNull();
        expect(flat[2]?.dayNum).toBe(1);
        expect(flat[2]?.a11yLabel).toBe('Wednesday 1 July');
        // All non-null cells belong to July
        const filled = flat.filter((c): c is NonNullable<typeof c> => c !== null);
        filled.forEach((c) => expect(c.dateStr.startsWith('2026-07')).toBe(true));
        expect(filled).toHaveLength(31);
    });
});

describe('buildMonthPages', () => {
    it('centers today and spans the buffer both ways', () => {
        const { pages, todayPageIdx } = buildMonthPages('2026-07-08');
        expect(pages[todayPageIdx].year).toBe(2026);
        expect(pages[todayPageIdx].month).toBe(6);
        expect(todayPageIdx).toBe((pages.length - 1) / 2);
        // Pages are consecutive months with unique keys
        expect(new Set(pages.map((p) => p.key)).size).toBe(pages.length);
        for (let i = 1; i < pages.length; i++) {
            const prev = pages[i - 1];
            const cur = pages[i];
            expect(prev.year * 12 + prev.month + 1).toBe(cur.year * 12 + cur.month);
        }
    });
});

// ── Component behavior ─────────────────────────────────────────

describe('InlineCalendar (events)', () => {
    const today = new Date();
    const todayStr = toDateStr(today);
    const tomorrowStr = toDateStr(addDays(today, 1));

    let scrollToIndexSpy: jest.SpyInstance;

    beforeEach(() => {
        scrollToIndexSpy = jest.spyOn(FlatList.prototype, 'scrollToIndex').mockImplementation(() => {});
    });

    afterEach(() => {
        scrollToIndexSpy.mockRestore();
    });

    function renderCalendar(overrides: Partial<React.ComponentProps<typeof InlineCalendar>> = {}) {
        const onSelectDate = jest.fn();
        const scrollToTodayRef = React.createRef<(() => void) | null>() as React.MutableRefObject<(() => void) | null>;
        const utils = render(
            <InlineCalendar
                selectedDate={todayStr}
                onSelectDate={onSelectDate}
                eventDates={new Set([tomorrowStr])}
                colors={colors}
                scrollToTodayRef={scrollToTodayRef}
                {...overrides}
            />,
        );
        return { ...utils, onSelectDate, scrollToTodayRef };
    }

    it('renders a strip cell for today', () => {
        const { getByTestId } = renderCalendar();
        expect(getByTestId(`strip-day-${todayStr}`)).toBeTruthy();
    });

    it('tapping a strip day selects it and re-centers the strip', () => {
        const { getByTestId, onSelectDate } = renderCalendar();
        scrollToIndexSpy.mockClear();

        fireEvent.press(getByTestId(`strip-day-${tomorrowStr}`));

        expect(onSelectDate).toHaveBeenCalledWith(tomorrowStr);
        expect(scrollToIndexSpy).toHaveBeenCalled();
    });

    it('marks event dates with an accent dot and leaves others transparent', () => {
        const { getByTestId } = renderCalendar();

        const flatten = (style: unknown) =>
            Object.assign({}, ...(Array.isArray(style) ? style : [style]).flat().filter(Boolean));

        const withEvent = flatten(getByTestId(`strip-dot-${tomorrowStr}`).props.style);
        const withoutEvent = flatten(getByTestId(`strip-dot-${todayStr}`).props.style);
        expect(withEvent.backgroundColor).toBe(colors.accent);
        expect(withoutEvent.backgroundColor).toBe('transparent');
    });

    it('installs scrollToTodayRef; invoking it selects today and scrolls', () => {
        const { scrollToTodayRef, onSelectDate } = renderCalendar({ selectedDate: tomorrowStr });
        expect(typeof scrollToTodayRef.current).toBe('function');

        scrollToIndexSpy.mockClear();
        act(() => {
            scrollToTodayRef.current?.();
        });

        expect(onSelectDate).toHaveBeenCalledWith(todayStr);
        expect(scrollToIndexSpy).toHaveBeenCalled();
    });

    it('re-centers the strip when selectedDate changes from outside', () => {
        const { rerender, onSelectDate, scrollToTodayRef } = renderCalendar();
        scrollToIndexSpy.mockClear();

        rerender(
            <InlineCalendar
                selectedDate={tomorrowStr}
                onSelectDate={onSelectDate}
                eventDates={new Set([tomorrowStr])}
                colors={colors}
                scrollToTodayRef={scrollToTodayRef}
            />,
        );

        expect(scrollToIndexSpy).toHaveBeenCalled();
    });

    it('clamps to the strip edge instead of desyncing when selectedDate is out of buffer', () => {
        const { rerender, onSelectDate, scrollToTodayRef } = renderCalendar();
        scrollToIndexSpy.mockClear();

        rerender(
            <InlineCalendar
                selectedDate="2099-01-01"
                onSelectDate={onSelectDate}
                eventDates={new Set()}
                colors={colors}
                scrollToTodayRef={scrollToTodayRef}
            />,
        );

        const stripLen = buildStrip(todayStr).days.length;
        expect(scrollToIndexSpy).toHaveBeenCalledWith(expect.objectContaining({ index: stripLen - 7 }));
    });

    it('exposes day cells to assistive tech with state and context', () => {
        const { getByTestId } = renderCalendar();

        const todayCell = getByTestId(`strip-day-${todayStr}`);
        expect(todayCell.props.accessibilityRole).toBe('button');
        expect(todayCell.props.accessibilityLabel).toMatch(/, today$/);
        expect(todayCell.props.accessibilityState).toEqual({ selected: true });

        const eventCell = getByTestId(`strip-day-${tomorrowStr}`);
        expect(eventCell.props.accessibilityLabel).toMatch(/, has events$/);
        expect(eventCell.props.accessibilityState).toEqual({ selected: false });
    });

    it('handle tap toggles between expand and collapse', () => {
        const { getByTestId } = renderCalendar();

        const handle = getByTestId('calendar-expand-handle');
        expect(handle.props.accessibilityLabel).toBe('Expand calendar');

        fireEvent.press(handle);
        expect(getByTestId('calendar-expand-handle').props.accessibilityLabel).toBe('Collapse calendar');

        fireEvent.press(handle);
        expect(getByTestId('calendar-expand-handle').props.accessibilityLabel).toBe('Expand calendar');
    });

    it('grid day tap selects the date once expanded', () => {
        const { getByTestId, onSelectDate } = renderCalendar();

        fireEvent.press(getByTestId('calendar-expand-handle'));
        fireEvent.press(getByTestId(`grid-day-${tomorrowStr}`));

        expect(onSelectDate).toHaveBeenCalledWith(tomorrowStr);
    });
});
