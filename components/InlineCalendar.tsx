/**
 * Inline calendar grid — a drop-in child component, no Modal.
 *
 * Used inside bottom sheets that already own a Modal (the Modal-based
 * CalendarPicker can't present over another Modal on iOS). Supports both
 * single-date and range-date selection, matching the semantics of the
 * standalone CalendarPicker used by the events screen.
 *
 *   mode="single": one tap = done.
 *   mode="range": first tap = start, second tap = end. If the second tap is
 *                 before the current start, the earlier date becomes the new
 *                 start (like the events picker). Same-day range is allowed.
 */
import { toDateStr } from '@/lib/dateTime';
import type { ThemeColors } from '@/types/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const SCREEN_W = Dimensions.get('window').width;
const DAY_SIZE = Math.floor((SCREEN_W - 80) / 7);
const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface SingleProps {
    mode?: 'single';
    selectedDate: string | null;
    onSelect: (date: string) => void;
    colors: ThemeColors;
    /** Days before this YYYY-MM-DD render disabled and ignore taps */
    minDate?: string;
}

interface RangeProps {
    mode: 'range';
    startDate: string | null;
    endDate: string | null;
    onRangeChange: (start: string, end: string) => void;
    colors: ThemeColors;
    /** Days before this YYYY-MM-DD render disabled and ignore taps */
    minDate?: string;
}

type Props = SingleProps | RangeProps;

function buildGrid(year: number, month: number): Date[][] {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startDow = (first.getDay() + 6) % 7;

    const cells: Date[] = [];
    for (let i = startDow - 1; i >= 0; i--) cells.push(new Date(year, month, -i));
    for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(year, month, d));
    while (cells.length < 42) {
        const nextDay = cells.length - startDow - last.getDate() + 1;
        cells.push(new Date(year, month + 1, nextDay));
    }

    const weeks: Date[][] = [];
    for (let i = 0; i < 42; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
}

export default function InlineCalendar(props: Props) {
    const isRange = props.mode === 'range';
    const { colors } = props;
    const anchorDate = isRange ? props.startDate : props.selectedDate;
    const initial = anchorDate ? new Date(anchorDate + 'T00:00:00') : new Date();
    const [displayMonth, setDisplayMonth] = useState(() => ({
        year: initial.getFullYear(),
        month: initial.getMonth(),
    }));
    // Range mode: 0 = waiting for first tap, 1 = waiting for second (end) tap.
    const [tapCount, setTapCount] = useState(0);

    const grid = useMemo(
        () => buildGrid(displayMonth.year, displayMonth.month),
        [displayMonth.year, displayMonth.month],
    );

    const todayStr = toDateStr(new Date());
    const monthLabel = new Date(displayMonth.year, displayMonth.month, 1).toLocaleDateString('en-SG', {
        month: 'long',
        year: 'numeric',
    });

    const navigateMonth = (delta: number) => {
        setDisplayMonth((prev) => {
            const d = new Date(prev.year, prev.month + delta, 1);
            return { year: d.getFullYear(), month: d.getMonth() };
        });
    };

    const handlePress = (ds: string) => {
        if (props.minDate && ds < props.minDate) return;
        if (!isRange) {
            (props as SingleProps).onSelect(ds);
            return;
        }
        const rp = props as RangeProps;
        if (tapCount === 0) {
            // First tap starts (and temporarily ends) a range; also fires so parent
            // sees a same-day range while the user decides on the end.
            rp.onRangeChange(ds, ds);
            setTapCount(1);
            return;
        }
        // Second tap. Earlier than the current start → restart the range there
        // and keep waiting for an end date (matches CalendarPicker — no
        // accidental instant-commit). Otherwise lock in the range; a same-day
        // range comes from an explicit second tap on the start date.
        const start = rp.startDate ?? ds;
        if (ds < start) {
            rp.onRangeChange(ds, ds);
            return; // stay at tapCount 1 — user still needs to pick end
        }
        rp.onRangeChange(start, ds);
        setTapCount(0);
    };

    // Compute sorted range boundaries once for cell rendering.
    const rS = isRange ? props.startDate : null;
    const rE = isRange ? props.endDate : null;
    const sortedStart = rS && rE && rS <= rE ? rS : rE;
    const sortedEnd = rS && rE && rS <= rE ? rE : rS;

    return (
        <View style={styles.container} pointerEvents="box-none">
            <View style={styles.monthNav} pointerEvents="box-none">
                <TouchableOpacity
                    onPress={() => navigateMonth(-1)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityLabel="Previous month"
                    testID="inline-calendar-prev-month"
                >
                    <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.monthLabel, { color: colors.textPrimary }]}>{monthLabel}</Text>
                <TouchableOpacity
                    onPress={() => navigateMonth(1)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityLabel="Next month"
                    testID="inline-calendar-next-month"
                >
                    <Ionicons name="chevron-forward" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
            </View>

            {isRange && (
                <Text style={[styles.rangeHint, { color: colors.textTertiary }]}>
                    {tapCount === 1 ? 'Now tap the end date' : 'Tap a start date'}
                </Text>
            )}

            <View style={styles.dowRow} pointerEvents="box-none">
                {DOW_LABELS.map((d) => (
                    <View key={d} style={[styles.dowCell, { width: DAY_SIZE }]} pointerEvents="box-none">
                        <Text style={[styles.dowText, { color: colors.textTertiary }]}>{d}</Text>
                    </View>
                ))}
            </View>

            <View pointerEvents="box-none">
                {grid.map((week, wi) => (
                    <View key={wi} style={styles.weekRow} pointerEvents="box-none">
                        {week.map((date, di) => {
                            const ds = toDateStr(date);
                            const isCurrentMonth = date.getMonth() === displayMonth.month;
                            const isToday = ds === todayStr;
                            const isDisabled = !!props.minDate && ds < props.minDate;

                            const isStart = isRange && ds === sortedStart;
                            const isEnd = isRange && ds === sortedEnd && sortedStart !== sortedEnd;
                            const isEndpoint = isStart || isEnd;
                            const isInRange =
                                isRange &&
                                sortedStart &&
                                sortedEnd &&
                                sortedStart !== sortedEnd &&
                                ds > sortedStart &&
                                ds < sortedEnd;

                            const isSingleSelected = !isRange && ds === (props as SingleProps).selectedDate;

                            const filled = isEndpoint || isSingleSelected;

                            return (
                                <TouchableOpacity
                                    key={di}
                                    style={[styles.dayCell, { width: DAY_SIZE }]}
                                    onPress={() => handlePress(ds)}
                                    activeOpacity={isDisabled ? 1 : 0.6}
                                    disabled={isDisabled}
                                    accessibilityRole="button"
                                    accessibilityState={{ disabled: isDisabled }}
                                    accessibilityLabel={`${date.getDate()} ${monthLabel}`}
                                    testID={`inline-calendar-day-${ds}`}
                                >
                                    {isInRange && (
                                        <View style={[styles.rangeBand, { backgroundColor: colors.accent + '30' }]} />
                                    )}
                                    {isStart && sortedStart !== sortedEnd && (
                                        <View
                                            style={[
                                                styles.rangeBand,
                                                {
                                                    backgroundColor: colors.accent + '30',
                                                    left: '50%',
                                                    right: 0,
                                                },
                                            ]}
                                        />
                                    )}
                                    {isEnd && (
                                        <View
                                            style={[
                                                styles.rangeBand,
                                                {
                                                    backgroundColor: colors.accent + '30',
                                                    left: 0,
                                                    right: '50%',
                                                },
                                            ]}
                                        />
                                    )}
                                    <View
                                        style={[
                                            styles.dayCircle,
                                            filled && { backgroundColor: colors.accent },
                                            isToday &&
                                                !filled && {
                                                    borderWidth: 1.5,
                                                    borderColor: colors.accent,
                                                },
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.dayText,
                                                {
                                                    color: filled
                                                        ? colors.textInverse
                                                        : isDisabled
                                                          ? colors.textTertiary + '40'
                                                          : isToday
                                                            ? colors.accent
                                                            : isCurrentMonth
                                                              ? colors.textPrimary
                                                              : colors.textTertiary + '60',
                                                    fontWeight: filled || isToday ? '700' : '400',
                                                },
                                            ]}
                                        >
                                            {date.getDate()}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { paddingVertical: 4 },
    monthNav: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 4,
        marginBottom: 6,
    },
    monthLabel: { fontSize: 16, fontWeight: '700' },
    rangeHint: {
        fontSize: 12,
        fontWeight: '500',
        textAlign: 'center',
        marginBottom: 6,
    },
    dowRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 4 },
    dowCell: { alignItems: 'center', paddingVertical: 4 },
    dowText: { fontSize: 12, fontWeight: '600' },
    weekRow: { flexDirection: 'row', justifyContent: 'space-around' },
    dayCell: {
        height: DAY_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
    },
    rangeBand: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: '50%',
        marginTop: -18,
        height: 36,
    },
    dayCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dayText: { fontSize: 15 },
});
