import { letterSpacing } from '@/constants/platform';
import { toDateStr } from '@/lib/dateTime';
import type { ThemeColors } from '@/types/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Dimensions,
    FlatList,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
    PanResponder,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Reanimated, { interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

// ── Calendar layout constants ──────────────────────────────────
const SCREEN_W = Dimensions.get('window').width;
const CELL_W = Math.floor(SCREEN_W / 7);
const WEEKS_BUFFER = 53; // ~1 year each direction
const MONTHS_BUFFER = 24; // ~2 years each direction

const CAL_HEADER_H = 40;
const STRIP_H = 68; // week strip cell height
const GRID_LABELS_H = 24; // Mon–Sun initials
const GRID_ROW_H = 44; // each month-grid row
const CAL_HANDLE_H = 20;
const CAL_WEEK_H = CAL_HEADER_H + STRIP_H + CAL_HANDLE_H;
const CAL_MONTH_H = CAL_HEADER_H + GRID_LABELS_H + GRID_ROW_H * 6 + CAL_HANDLE_H;
const MONTH_GRID_H = GRID_LABELS_H + GRID_ROW_H * 6;

// Matches the previous RN Animated.spring(tension: 65, friction: 12) feel
// via the Origami conversion (stiffness = (t-30)*3.62+194, damping = (f-8)*3+25).
const EXPAND_SPRING = { stiffness: 320, damping: 37 };

const HIT = { top: 12, bottom: 12, left: 12, right: 12 };
const DOW_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

// Static names (en only — app is SG-locale throughout). Avoids ~1.5k Intl
// calls when pre-building strip/grid accessibility labels.
const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTH_NAMES = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];

function monthYearLabel(year: number, month: number): string {
    return `${MONTH_NAMES[month]} ${year}`;
}

// ── Pre-built cell data (computed once, never per render) ─────
export interface StripDay {
    dateStr: string;
    dayNum: number;
    dow: string;
    a11yLabel: string;
}

/** Build Mon-aligned day strip centered on today (exported for tests) */
export function buildStrip(todayStr: string): { days: StripDay[]; todayWeekIdx: number } {
    const d = new Date(todayStr + 'T00:00:00');
    const dow = (d.getDay() + 6) % 7; // Mon=0
    const start = new Date(d);
    start.setDate(d.getDate() - dow - WEEKS_BUFFER * 7);

    const totalDays = (WEEKS_BUFFER * 2 + 1) * 7;
    const days: StripDay[] = [];
    const cur = new Date(start);
    for (let i = 0; i < totalDays; i++) {
        const dowIdx = (cur.getDay() + 6) % 7;
        days.push({
            dateStr: toDateStr(cur),
            dayNum: cur.getDate(),
            dow: DOW_LABELS[dowIdx],
            a11yLabel: `${WEEKDAY_NAMES[dowIdx]} ${cur.getDate()} ${MONTH_NAMES[cur.getMonth()]}`,
        });
        cur.setDate(cur.getDate() + 1);
    }
    return { days, todayWeekIdx: WEEKS_BUFFER };
}

export interface GridCell {
    dateStr: string;
    dayNum: number;
    a11yLabel: string;
}

/** Build a 6-row (42 cell) Mon-first calendar grid for a given month (exported for tests) */
export function buildMonthGrid(year: number, month: number): (GridCell | null)[][] {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDow = (firstDay.getDay() + 6) % 7;

    const cells: (GridCell | null)[] = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let dayNum = 1; dayNum <= lastDay.getDate(); dayNum++) {
        const date = new Date(year, month, dayNum);
        const dowIdx = (date.getDay() + 6) % 7;
        cells.push({
            dateStr: toDateStr(date),
            dayNum,
            a11yLabel: `${WEEKDAY_NAMES[dowIdx]} ${dayNum} ${MONTH_NAMES[month]}`,
        });
    }
    while (cells.length < 42) cells.push(null);

    const weeks: (GridCell | null)[][] = [];
    for (let i = 0; i < 42; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
}

interface MonthPage {
    year: number;
    month: number;
    key: string;
    grid: (GridCell | null)[][];
}

/** Pre-generate month pages centered on today (exported for tests) */
export function buildMonthPages(todayStr: string): { pages: MonthPage[]; todayPageIdx: number } {
    const d = new Date(todayStr + 'T00:00:00');
    const centerYear = d.getFullYear();
    const centerMonth = d.getMonth();

    const pages: MonthPage[] = [];
    for (let i = -MONTHS_BUFFER; i <= MONTHS_BUFFER; i++) {
        const date = new Date(centerYear, centerMonth + i, 1);
        const y = date.getFullYear();
        const m = date.getMonth();
        pages.push({ year: y, month: m, key: `${y}-${m}`, grid: buildMonthGrid(y, m) });
    }
    return { pages, todayPageIdx: MONTHS_BUFFER };
}

// ── Memoized strip day cell ────────────────────────────────────
interface StripDayCellProps {
    day: StripDay;
    isSelected: boolean;
    isToday: boolean;
    hasEvent: boolean;
    colors: ThemeColors;
    onPress: (dateStr: string) => void;
}

const StripDayCell = React.memo(function StripDayCell({
    day,
    isSelected,
    isToday,
    hasEvent,
    colors,
    onPress,
}: StripDayCellProps) {
    return (
        <Pressable
            testID={`strip-day-${day.dateStr}`}
            style={[calStyles.stripCell, { width: CELL_W }]}
            onPress={() => onPress(day.dateStr)}
            accessibilityRole="button"
            accessibilityLabel={`${day.a11yLabel}${isToday ? ', today' : ''}${hasEvent ? ', has events' : ''}`}
            accessibilityState={{ selected: isSelected }}
        >
            <Text style={[calStyles.stripDow, { color: isToday && !isSelected ? colors.accent : colors.textTertiary }]}>
                {day.dow}
            </Text>
            <View
                style={[
                    calStyles.stripCircle,
                    isSelected && { backgroundColor: colors.accent },
                    isToday && !isSelected && { borderWidth: 1.5, borderColor: colors.accent },
                ]}
            >
                <Text
                    style={[
                        calStyles.stripDayText,
                        {
                            color: isSelected ? colors.textInverse : isToday ? colors.accent : colors.textPrimary,
                            fontWeight: isSelected || isToday ? '700' : '500',
                        },
                    ]}
                >
                    {day.dayNum}
                </Text>
            </View>
            <View
                testID={`strip-dot-${day.dateStr}`}
                style={[
                    calStyles.dot,
                    {
                        backgroundColor: hasEvent ? (isSelected ? colors.textInverse : colors.accent) : 'transparent',
                    },
                ]}
            />
        </Pressable>
    );
});

// ── Memoized grid day cell ─────────────────────────────────────
interface GridDayCellProps {
    cell: GridCell;
    isSelected: boolean;
    isToday: boolean;
    hasEvent: boolean;
    colors: ThemeColors;
    onPress: (dateStr: string) => void;
}

const GridDayCell = React.memo(function GridDayCell({
    cell,
    isSelected,
    isToday,
    hasEvent,
    colors,
    onPress,
}: GridDayCellProps) {
    return (
        <Pressable
            testID={`grid-day-${cell.dateStr}`}
            style={calStyles.gridCell}
            onPress={() => onPress(cell.dateStr)}
            accessibilityRole="button"
            accessibilityLabel={`${cell.a11yLabel}${isToday ? ', today' : ''}${hasEvent ? ', has events' : ''}`}
            accessibilityState={{ selected: isSelected }}
        >
            <View
                style={[
                    calStyles.gridCircle,
                    isSelected && { backgroundColor: colors.accent },
                    isToday && !isSelected && { borderWidth: 1.5, borderColor: colors.accent },
                ]}
            >
                <Text
                    style={[
                        calStyles.gridDayText,
                        {
                            color: isSelected ? colors.textInverse : isToday ? colors.accent : colors.textPrimary,
                            fontWeight: isSelected ? '700' : '500',
                        },
                    ]}
                >
                    {cell.dayNum}
                </Text>
            </View>
            {hasEvent && (
                <View
                    style={[
                        calStyles.dot,
                        {
                            backgroundColor: isSelected ? colors.textInverse : colors.accent,
                        },
                    ]}
                />
            )}
        </Pressable>
    );
});

// ── InlineCalendar ─────────────────────────────────────────────
export interface InlineCalendarProps {
    selectedDate: string;
    onSelectDate: (date: string) => void;
    eventDates: Set<string>;
    colors: ThemeColors;
    scrollToTodayRef?: React.MutableRefObject<(() => void) | null>;
}

export default function InlineCalendar({
    selectedDate,
    onSelectDate,
    eventDates,
    colors,
    scrollToTodayRef,
}: InlineCalendarProps) {
    const today = toDateStr(new Date());

    // ── Strip data (Mon-aligned, ~1 year each side) ──
    const { days: stripDays, todayWeekIdx } = useMemo(() => buildStrip(today), [today]);
    const stripIndex = useMemo(() => {
        const map = new Map<string, number>();
        stripDays.forEach((d, i) => map.set(d.dateStr, i));
        return map;
    }, [stripDays]);
    const stripRef = useRef<FlatList>(null);
    const todayStripIdx = useMemo(() => {
        const dow = (new Date(today + 'T00:00:00').getDay() + 6) % 7;
        return todayWeekIdx * 7 + dow;
    }, [todayWeekIdx, today]);
    const initialIdx = Math.max(0, todayStripIdx - 3);

    // ── Visible month label (derived from strip scroll) ──
    const [weekMonthLabel, setWeekMonthLabel] = useState(() => {
        const d = new Date(selectedDate + 'T00:00:00');
        return monthYearLabel(d.getFullYear(), d.getMonth());
    });
    const todayIdx = todayStripIdx;
    const [todayVisible, setTodayVisible] = useState(true);
    const [todayMonthVisible, setTodayMonthVisible] = useState(true);

    // ── Expand / collapse (week <-> month) ──
    // Reanimated drives height + cross-fades (spring settles on the UI
    // thread); PanResponder still feeds the value from JS during drags —
    // progressMirror keeps a synchronous copy for release thresholds.
    const expandProgress = useSharedValue(0);
    const progressMirror = useRef(0);
    const isExpandedRef = useRef(false);
    const [isExpanded, setIsExpanded] = useState(false);

    // ── Month pages (paging FlatList data) ──
    const { pages: monthPages, todayPageIdx } = useMemo(() => buildMonthPages(today), [today]);
    const monthGridRef = useRef<FlatList>(null);
    const visiblePageIdx = useRef(todayPageIdx);

    // Find the page index for a given year/month
    const findPageIdx = useCallback(
        (year: number, month: number) => {
            return monthPages.findIndex((p) => p.year === year && p.month === month);
        },
        [monthPages],
    );

    // ── Month label derived from visible page ──
    const [monthLabel, setMonthLabel] = useState(() => {
        const d = new Date(selectedDate + 'T00:00:00');
        return monthYearLabel(d.getFullYear(), d.getMonth());
    });

    // ── Animated styles ──
    const containerAnimStyle = useAnimatedStyle(() => ({
        height: interpolate(expandProgress.value, [0, 1], [CAL_WEEK_H, CAL_MONTH_H], 'clamp'),
    }));
    const contentAnimStyle = useAnimatedStyle(() => ({
        height: interpolate(expandProgress.value, [0, 1], [STRIP_H, MONTH_GRID_H], 'clamp'),
    }));
    const stripAnimStyle = useAnimatedStyle(() => ({
        opacity: interpolate(expandProgress.value, [0, 0.3], [1, 0], 'clamp'),
    }));
    const gridAnimStyle = useAnimatedStyle(() => ({
        opacity: interpolate(expandProgress.value, [0.7, 1], [0, 1], 'clamp'),
    }));

    // ── Scroll strip to place a date at position 3 (0-indexed) ──
    // Out-of-buffer dates clamp to the nearest edge (the viewport-derived
    // month label then reflects what's actually visible, and the Today
    // button appears as the way back).
    const scrollStripToDate = useCallback(
        (dateStr: string, animated = true) => {
            const idx = stripIndex.get(dateStr);
            if (idx !== undefined) {
                stripRef.current?.scrollToIndex({ index: Math.max(0, idx - 3), animated, viewPosition: 0 });
                return;
            }
            const clampIdx = dateStr < stripDays[0].dateStr ? 0 : Math.max(0, stripDays.length - 7);
            stripRef.current?.scrollToIndex({ index: clampIdx, animated, viewPosition: 0 });
        },
        [stripIndex, stripDays],
    );

    // Expose scroll-to-today for parent to call on tab re-press
    useEffect(() => {
        if (scrollToTodayRef) {
            scrollToTodayRef.current = () => {
                onSelectDate(today);
                scrollStripToDate(today);
            };
        }
    }, [scrollToTodayRef, today, onSelectDate, scrollStripToDate]);

    // ── Scroll month grid to a page (idx clamped to the buffer) ──
    const scrollMonthToPage = useCallback(
        (idx: number, animated = true) => {
            const clamped = Math.max(0, Math.min(idx, monthPages.length - 1));
            monthGridRef.current?.scrollToIndex({ index: clamped, animated });
            visiblePageIdx.current = clamped;
            const page = monthPages[clamped];
            setMonthLabel(monthYearLabel(page.year, page.month));
            setTodayMonthVisible(clamped === todayPageIdx);
        },
        [monthPages, todayPageIdx],
    );

    // When selectedDate changes from outside (parent syncs it to list scroll),
    // re-center the strip or page the month grid so the pill stays in view.
    const prevSelectedDateRef = useRef(selectedDate);
    useEffect(() => {
        if (prevSelectedDateRef.current === selectedDate) return;
        prevSelectedDateRef.current = selectedDate;

        if (isExpandedRef.current) {
            const d = new Date(selectedDate + 'T00:00:00');
            const idx = findPageIdx(d.getFullYear(), d.getMonth());
            const target =
                idx >= 0
                    ? idx
                    : d.getFullYear() * 12 + d.getMonth() < monthPages[0].year * 12 + monthPages[0].month
                      ? 0
                      : monthPages.length - 1;
            if (target !== visiblePageIdx.current) {
                scrollMonthToPage(target, true);
            }
        } else {
            scrollStripToDate(selectedDate, true);
        }
    }, [selectedDate, findPageIdx, scrollMonthToPage, scrollStripToDate, monthPages]);

    // ── animateTo (stable ref so PanResponder closure never goes stale) ──
    const animateToRef = useRef<(v: number) => void>(() => {});
    animateToRef.current = (toValue: number) => {
        const willExpand = toValue === 1;
        isExpandedRef.current = willExpand;
        setIsExpanded(willExpand);

        if (willExpand) {
            // Scroll month grid to the month of the selected date
            const d = new Date(selectedDate + 'T00:00:00');
            const idx = findPageIdx(d.getFullYear(), d.getMonth());
            if (idx >= 0) {
                scrollMonthToPage(idx, false);
            } else {
                scrollMonthToPage(
                    new Date(selectedDate + 'T00:00:00') < new Date(monthPages[0].year, monthPages[0].month, 1)
                        ? 0
                        : monthPages.length - 1,
                    false,
                );
            }
        } else {
            // Sync strip to selected date when collapsing
            setTimeout(() => {
                scrollStripToDate(selectedDate, false);
            }, 50);
        }

        progressMirror.current = toValue;
        expandProgress.value = withSpring(toValue, EXPAND_SPRING);
    };

    // ── PanResponder — vertical only (expand/collapse) ──
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 6 && Math.abs(gs.dy) > Math.abs(gs.dx) * 1.5,
            onPanResponderMove: (_, gs) => {
                const base = isExpandedRef.current ? 1 : 0;
                const range = CAL_MONTH_H - CAL_WEEK_H;
                const next = Math.max(0, Math.min(1, base + gs.dy / range));
                progressMirror.current = next;
                expandProgress.value = next;
            },
            onPanResponderRelease: (_, gs) => {
                const current = progressMirror.current;
                const shouldExpand = Math.abs(gs.vy) > 0.3 ? gs.vy > 0 : current > 0.5;
                animateToRef.current(shouldExpand ? 1 : 0);
            },
        }),
    ).current;

    // Tap alternative to the pan gesture (discoverability + VoiceOver)
    const toggleExpanded = useCallback(() => {
        animateToRef.current(isExpandedRef.current ? 0 : 1);
    }, []);

    // ── Month grid arrow navigation ──
    const navigateMonth = (delta: number) => {
        scrollMonthToPage(visiblePageIdx.current + delta);
    };

    // ── Month grid scroll → update label ──
    const onMonthGridScroll = useCallback(
        (e: NativeSyntheticEvent<NativeScrollEvent>) => {
            const offsetX = e.nativeEvent.contentOffset.x;
            const pageIdx = Math.round(offsetX / SCREEN_W);
            const clamped = Math.max(0, Math.min(pageIdx, monthPages.length - 1));
            if (clamped !== visiblePageIdx.current) {
                visiblePageIdx.current = clamped;
                const page = monthPages[clamped];
                setMonthLabel(monthYearLabel(page.year, page.month));
                setTodayMonthVisible(clamped === todayPageIdx);
            }
        },
        [monthPages, todayPageIdx],
    );

    // ── Strip scroll -> update month label + today visibility ──
    const onStripScroll = useCallback(
        (e: NativeSyntheticEvent<NativeScrollEvent>) => {
            const offsetX = e.nativeEvent.contentOffset.x;
            const firstVisibleIdx = Math.round(offsetX / CELL_W);
            const centerIdx = firstVisibleIdx + 3;
            const clamped = Math.max(0, Math.min(centerIdx, stripDays.length - 1));
            const day = stripDays[clamped];
            if (day) {
                const d = new Date(day.dateStr + 'T00:00:00');
                const label = monthYearLabel(d.getFullYear(), d.getMonth());
                setWeekMonthLabel((prev) => (prev === label ? prev : label));
            }
            const isVisible = todayIdx >= firstVisibleIdx && todayIdx < firstVisibleIdx + 7;
            setTodayVisible(isVisible);
        },
        [stripDays, todayIdx],
    );

    // ── Stable press handler for strip cells (no selectedDate dependency) ──
    const handleStripDayPress = useCallback(
        (dateStr: string) => {
            onSelectDate(dateStr);
            scrollStripToDate(dateStr);
        },
        [onSelectDate, scrollStripToDate],
    );

    // ── Render strip day cell (delegates to memoized component) ──
    const renderStripDay = useCallback(
        ({ item: day }: { item: StripDay }) => (
            <StripDayCell
                day={day}
                isSelected={day.dateStr === selectedDate}
                isToday={day.dateStr === today}
                hasEvent={eventDates.has(day.dateStr)}
                colors={colors}
                onPress={handleStripDayPress}
            />
        ),
        [selectedDate, today, eventDates, colors, handleStripDayPress],
    );

    // ── Stable press handler for grid cells ──
    const handleGridDayPress = useCallback(
        (dateStr: string) => {
            onSelectDate(dateStr);
        },
        [onSelectDate],
    );

    // ── Render month grid page ──
    const renderMonthPage = useCallback(
        ({ item: page }: { item: MonthPage }) => (
            <View style={{ width: SCREEN_W }}>
                {/* Day-of-week initials */}
                <View style={calStyles.dayLabels}>
                    {DOW_LABELS.map((lbl, i) => (
                        <View key={i} style={calStyles.dayLabelCell}>
                            <Text style={[calStyles.dayLabelText, { color: colors.textTertiary }]}>{lbl}</Text>
                        </View>
                    ))}
                </View>

                {page.grid.map((week, wi) => (
                    <View key={wi} style={calStyles.gridRow}>
                        {week.map((cell, di) => {
                            if (!cell) return <View key={di} style={calStyles.gridCell} />;

                            return (
                                <GridDayCell
                                    key={di}
                                    cell={cell}
                                    isSelected={cell.dateStr === selectedDate}
                                    isToday={cell.dateStr === today}
                                    hasEvent={eventDates.has(cell.dateStr)}
                                    colors={colors}
                                    onPress={handleGridDayPress}
                                />
                            );
                        })}
                    </View>
                ))}
            </View>
        ),
        [selectedDate, today, eventDates, colors, handleGridDayPress],
    );

    const getStripItemLayout = useCallback(
        (_: unknown, index: number) => ({
            length: CELL_W,
            offset: CELL_W * index,
            index,
        }),
        [],
    );

    const getMonthItemLayout = useCallback(
        (_: unknown, index: number) => ({
            length: SCREEN_W,
            offset: SCREEN_W * index,
            index,
        }),
        [],
    );

    // Find initial page for selectedDate
    const initialMonthPageIdx = useMemo(() => {
        const d = new Date(selectedDate + 'T00:00:00');
        const idx = monthPages.findIndex((p) => p.year === d.getFullYear() && p.month === d.getMonth());
        return idx >= 0 ? idx : todayPageIdx;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // only on mount

    return (
        <Reanimated.View
            style={[
                calStyles.container,
                { backgroundColor: colors.cardBackground, borderBottomColor: colors.border },
                containerAnimStyle,
            ]}
            {...panResponder.panHandlers}
        >
            {/* ── Header ── */}
            <View style={calStyles.header}>
                {/* Week mode — month label + Today button */}
                <Reanimated.View
                    style={[calStyles.headerRow, stripAnimStyle]}
                    pointerEvents={isExpanded ? 'none' : 'auto'}
                >
                    <Text style={[calStyles.monthText, { color: colors.textPrimary }]}>{weekMonthLabel}</Text>
                    {!todayVisible && (
                        <TouchableOpacity
                            onPress={() => {
                                onSelectDate(today);
                                scrollStripToDate(today);
                            }}
                            style={[calStyles.todayBtn, { borderColor: colors.accent }]}
                            hitSlop={HIT}
                            accessibilityRole="button"
                            accessibilityLabel="Jump to today"
                        >
                            <Text style={[calStyles.todayBtnText, { color: colors.accent }]}>Today</Text>
                        </TouchableOpacity>
                    )}
                </Reanimated.View>

                {/* Month mode — arrows + label + Today button */}
                <Reanimated.View
                    style={[calStyles.headerRow, calStyles.headerOverlay, gridAnimStyle]}
                    pointerEvents={isExpanded ? 'auto' : 'none'}
                >
                    <View style={calStyles.monthNavRow}>
                        <TouchableOpacity
                            onPress={() => navigateMonth(-1)}
                            hitSlop={HIT}
                            accessibilityRole="button"
                            accessibilityLabel="Previous month"
                        >
                            <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <Text style={[calStyles.monthText, { color: colors.textPrimary }]}>{monthLabel}</Text>
                        <TouchableOpacity
                            onPress={() => navigateMonth(1)}
                            hitSlop={HIT}
                            accessibilityRole="button"
                            accessibilityLabel="Next month"
                        >
                            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                    {!todayMonthVisible && (
                        <TouchableOpacity
                            onPress={() => {
                                onSelectDate(today);
                                scrollMonthToPage(todayPageIdx);
                            }}
                            style={[calStyles.todayBtn, { borderColor: colors.accent }]}
                            hitSlop={HIT}
                            accessibilityRole="button"
                            accessibilityLabel="Jump to today"
                        >
                            <Text style={[calStyles.todayBtnText, { color: colors.accent }]}>Today</Text>
                        </TouchableOpacity>
                    )}
                </Reanimated.View>
            </View>

            {/* ── Content area (cross-fades between strip and month grid) ── */}
            <Reanimated.View style={[calStyles.contentClip, contentAnimStyle]}>
                {/* Week strip — horizontal scroll */}
                <Reanimated.View
                    style={[{ height: STRIP_H }, stripAnimStyle]}
                    pointerEvents={isExpanded ? 'none' : 'auto'}
                >
                    <FlatList
                        ref={stripRef}
                        data={stripDays}
                        keyExtractor={(item) => item.dateStr}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        decelerationRate="fast"
                        snapToInterval={CELL_W}
                        snapToAlignment="start"
                        getItemLayout={getStripItemLayout}
                        initialScrollIndex={initialIdx}
                        onScrollToIndexFailed={() => {}}
                        onLayout={() => requestAnimationFrame(() => scrollStripToDate(today, false))}
                        renderItem={renderStripDay}
                        onScroll={onStripScroll}
                        scrollEventThrottle={32}
                        extraData={selectedDate}
                        windowSize={5}
                        maxToRenderPerBatch={14}
                    />
                </Reanimated.View>

                {/* Month grid — paging horizontal FlatList */}
                <Reanimated.View
                    style={[calStyles.gridOverlay, gridAnimStyle]}
                    pointerEvents={isExpanded ? 'auto' : 'none'}
                >
                    <FlatList
                        ref={monthGridRef}
                        data={monthPages}
                        keyExtractor={(item) => item.key}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        getItemLayout={getMonthItemLayout}
                        initialScrollIndex={initialMonthPageIdx}
                        onScrollToIndexFailed={() => {}}
                        renderItem={renderMonthPage}
                        onScroll={onMonthGridScroll}
                        scrollEventThrottle={16}
                        extraData={selectedDate}
                        windowSize={5}
                        initialNumToRender={2}
                        maxToRenderPerBatch={3}
                    />
                </Reanimated.View>
            </Reanimated.View>

            {/* ── Drag handle (also a tap target: gesture-free expand/collapse) ── */}
            <Pressable
                testID="calendar-expand-handle"
                style={calStyles.handleArea}
                onPress={toggleExpanded}
                hitSlop={{ top: 4, bottom: 8, left: 40, right: 40 }}
                accessibilityRole="button"
                accessibilityLabel={isExpanded ? 'Collapse calendar' : 'Expand calendar'}
                accessibilityHint={isExpanded ? 'Shows the week strip' : 'Shows the full month'}
            >
                <View style={[calStyles.handlePill, { backgroundColor: colors.divider }]} />
            </Pressable>
        </Reanimated.View>
    );
}

const calStyles = StyleSheet.create({
    container: {
        overflow: 'hidden',
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    header: {
        height: CAL_HEADER_H,
        justifyContent: 'center',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
    },
    headerOverlay: {
        position: 'absolute',
        left: 0,
        right: 0,
    },
    monthNavRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    monthText: {
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: letterSpacing(-0.2),
    },
    todayBtn: {
        borderWidth: 1.5,
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 4,
    },
    todayBtnText: {
        fontSize: 12,
        fontWeight: '700',
    },
    contentClip: {
        overflow: 'hidden',
    },
    // Week strip
    stripCell: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        height: STRIP_H,
    },
    stripDow: {
        fontSize: 11,
        fontWeight: '600',
    },
    stripCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stripDayText: {
        fontSize: 15,
    },
    // Month grid
    gridOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: MONTH_GRID_H,
    },
    dayLabels: {
        height: GRID_LABELS_H,
        flexDirection: 'row',
        paddingHorizontal: 4,
    },
    dayLabelCell: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dayLabelText: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    gridRow: {
        height: GRID_ROW_H,
        flexDirection: 'row',
        paddingHorizontal: 4,
    },
    gridCell: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
    },
    gridCircle: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
    },
    gridDayText: {
        fontSize: 14,
    },
    dot: {
        width: 4,
        height: 4,
        borderRadius: 2,
    },
    handleArea: {
        height: CAL_HANDLE_H,
        alignItems: 'center',
        justifyContent: 'center',
    },
    handlePill: {
        width: 36,
        height: 4,
        borderRadius: 2,
        opacity: 0.6,
    },
});
