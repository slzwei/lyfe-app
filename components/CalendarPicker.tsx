import { MODAL_STATUS_BAR_TRANSLUCENT } from '@/constants/platform';
import { useBottomSheetSafeBottom } from '@/hooks/useBottomSheetSafeBottom';
import { formatDateLabel, toDateStr } from '@/lib/dateTime';
import type { ThemeColors } from '@/types/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const SCREEN_W = Dimensions.get('window').width;
const DAY_SIZE = Math.floor((SCREEN_W - 64) / 7);
const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface SinglePickerProps {
    mode?: 'single';
    visible: boolean;
    selectedDate: string;
    onSelect: (date: string) => void;
    onClose: () => void;
    colors: ThemeColors;
    title?: string;
}

interface RangePickerProps {
    mode: 'range';
    visible: boolean;
    startDate: string;
    endDate: string;
    onConfirm: (start: string, end: string) => void;
    onClose: () => void;
    colors: ThemeColors;
    title?: string;
}

type CalendarPickerProps = SinglePickerProps | RangePickerProps;

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

export default function CalendarPicker(props: CalendarPickerProps) {
    const { visible, onClose, colors, title } = props;
    const isRange = props.mode === 'range';

    const slideAnim = useRef(new Animated.Value(0)).current;
    const [isRendered, setIsRendered] = useState(false);
    const sheetPaddingBottom = useBottomSheetSafeBottom(36);

    // Range mode local state — not committed until Done
    const [rangeStart, setRangeStart] = useState<string | null>(null);
    const [rangeEnd, setRangeEnd] = useState<string | null>(null);
    const [tapCount, setTapCount] = useState(0);

    // Figure out initial date for the month display
    const initDateStr = isRange ? (props as RangePickerProps).startDate : (props as SinglePickerProps).selectedDate;
    const [displayMonth, setDisplayMonth] = useState(() => {
        const d = new Date(initDateStr + 'T00:00:00');
        return { year: d.getFullYear(), month: d.getMonth() };
    });

    React.useEffect(() => {
        if (visible) {
            const dateStr = isRange ? (props as RangePickerProps).startDate : (props as SinglePickerProps).selectedDate;
            const d = new Date(dateStr + 'T00:00:00');
            setDisplayMonth({ year: d.getFullYear(), month: d.getMonth() });
            if (isRange) {
                const rp = props as RangePickerProps;
                setRangeStart(rp.startDate);
                setRangeEnd(rp.endDate);
                setTapCount(0);
            }
            setIsRendered(true);
            Animated.spring(slideAnim, {
                toValue: 1,
                useNativeDriver: true,
                damping: 20,
                stiffness: 200,
            }).start();
        } else {
            slideAnim.setValue(0);
        }
    }, [visible]);

    const animateOut = useCallback((cb: () => void) => {
        Animated.timing(slideAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
        }).start(() => {
            setIsRendered(false);
            cb();
        });
    }, []);

    const handleClose = useCallback(() => {
        if (isRange && rangeStart && rangeEnd) {
            // Confirm the range on close too
            const [s, e] = rangeStart <= rangeEnd ? [rangeStart, rangeEnd] : [rangeEnd, rangeStart];
            animateOut(() => (props as RangePickerProps).onConfirm(s, e));
        } else {
            animateOut(onClose);
        }
    }, [isRange, rangeStart, rangeEnd, onClose, animateOut]);

    const handleDone = useCallback(() => {
        if (isRange && rangeStart && rangeEnd) {
            const [s, e] = rangeStart <= rangeEnd ? [rangeStart, rangeEnd] : [rangeEnd, rangeStart];
            animateOut(() => (props as RangePickerProps).onConfirm(s, e));
        } else {
            animateOut(onClose);
        }
    }, [isRange, rangeStart, rangeEnd, onClose, animateOut]);

    const handleDayPress = useCallback(
        (date: Date) => {
            const ds = toDateStr(date);
            if (!isRange) {
                (props as SinglePickerProps).onSelect(ds);
                animateOut(onClose);
                return;
            }
            // Range mode: first tap = start, second tap = end
            if (tapCount === 0) {
                setRangeStart(ds);
                setRangeEnd(ds);
                setTapCount(1);
            } else {
                // Second tap — if before start, reset start and wait for new end
                if (rangeStart && ds < rangeStart) {
                    setRangeStart(ds);
                    setRangeEnd(ds);
                    // stay at tapCount 1 — user still needs to pick end
                } else if (ds === rangeStart) {
                    // Same date tapped — single-day range, done
                    setTapCount(0);
                } else {
                    setRangeEnd(ds);
                    setTapCount(0);
                }
            }
        },
        [isRange, tapCount, rangeStart, onClose, animateOut],
    );

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

    // Computed range boundaries (sorted)
    const rS = rangeStart && rangeEnd ? (rangeStart <= rangeEnd ? rangeStart : rangeEnd) : null;
    const rE = rangeStart && rangeEnd ? (rangeStart <= rangeEnd ? rangeEnd : rangeStart) : null;
    const selectedSingle = !isRange ? (props as SinglePickerProps).selectedDate : null;

    const translateY = slideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [500, 0],
    });
    const backdropOpacity = slideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0.4],
    });

    if (!visible && !isRendered) return null;

    // Range summary label
    const rangeSummary =
        isRange && rS && rE && rS !== rE
            ? `${formatDateLabel(rS)} – ${formatDateLabel(rE)}`
            : isRange && rS
              ? formatDateLabel(rS)
              : null;

    return (
        <Modal
            visible={visible || isRendered}
            transparent
            animationType="none"
            statusBarTranslucent={MODAL_STATUS_BAR_TRANSLUCENT}
            onRequestClose={handleClose}
        >
            <View style={s.overlay}>
                <Animated.View style={[s.backdrop, { opacity: backdropOpacity }]}>
                    <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={handleClose} />
                </Animated.View>

                <Animated.View
                    style={[
                        s.sheet,
                        {
                            backgroundColor: colors.cardBackground,
                            transform: [{ translateY }],
                            paddingBottom: sheetPaddingBottom,
                        },
                    ]}
                >
                    <View style={[s.handle, { backgroundColor: colors.border }]} />

                    {/* Header */}
                    <View style={s.header}>
                        <Text style={[s.title, { color: colors.textPrimary }]}>
                            {title ?? (isRange ? 'Select Dates' : 'Select Date')}
                        </Text>
                        <TouchableOpacity
                            onPress={handleDone}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            accessibilityRole="button"
                            accessibilityLabel="Done"
                        >
                            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.accent }}>Done</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Range hint */}
                    {isRange && (
                        <View style={s.rangeHintRow}>
                            {tapCount === 1 ? (
                                <Text style={[s.rangeHint, { color: colors.textTertiary }]}>Now tap the end date</Text>
                            ) : rangeSummary ? (
                                <Text style={[s.rangeHint, { color: colors.accent }]}>{rangeSummary}</Text>
                            ) : null}
                        </View>
                    )}

                    {/* Month navigation */}
                    <View style={s.monthNav}>
                        <TouchableOpacity
                            onPress={() => navigateMonth(-1)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            accessibilityRole="button"
                            accessibilityLabel="Previous month"
                        >
                            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
                        </TouchableOpacity>
                        <Text style={[s.monthLabel, { color: colors.textPrimary }]}>{monthLabel}</Text>
                        <TouchableOpacity
                            onPress={() => navigateMonth(1)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            accessibilityRole="button"
                            accessibilityLabel="Next month"
                        >
                            <Ionicons name="chevron-forward" size={22} color={colors.textPrimary} />
                        </TouchableOpacity>
                    </View>

                    {/* Day-of-week labels */}
                    <View style={s.dowRow}>
                        {DOW_LABELS.map((d) => (
                            <View key={d} style={[s.dowCell, { width: DAY_SIZE }]}>
                                <Text style={[s.dowText, { color: colors.textTertiary }]}>{d}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Grid */}
                    <View style={s.gridContainer}>
                        {grid.map((week, wi) => (
                            <View key={wi} style={s.weekRow}>
                                {week.map((date, di) => {
                                    const ds = toDateStr(date);
                                    const isCurrentMonth = date.getMonth() === displayMonth.month;
                                    const isToday = ds === todayStr;

                                    // Range highlighting
                                    const isStart = isRange && ds === rS;
                                    const isEnd = isRange && rS !== rE && ds === rE;
                                    const isInRange = isRange && rS && rE && rS !== rE && ds > rS && ds < rE;
                                    const isEndpoint = isStart || isEnd;

                                    // Single mode
                                    const isSingleSelected = !isRange && ds === selectedSingle;

                                    return (
                                        <TouchableOpacity
                                            key={di}
                                            style={[s.dayCell, { width: DAY_SIZE }]}
                                            onPress={() => handleDayPress(date)}
                                            activeOpacity={0.6}
                                            accessibilityRole="button"
                                            accessibilityLabel={`${date.getDate()} ${date.toLocaleDateString('en-SG', { month: 'long', year: 'numeric' })}`}
                                        >
                                            {/* Range band — full width for mid-range cells */}
                                            {isInRange && (
                                                <View style={[s.rangeBg, { backgroundColor: colors.accent + '30' }]} />
                                            )}
                                            {/* Half-band on start date (right half) */}
                                            {isStart && rS !== rE && (
                                                <View
                                                    style={[
                                                        s.rangeBg,
                                                        {
                                                            backgroundColor: colors.accent + '30',
                                                            left: '50%',
                                                            right: 0,
                                                        },
                                                    ]}
                                                />
                                            )}
                                            {/* Half-band on end date (left half) */}
                                            {isEnd && (
                                                <View
                                                    style={[
                                                        s.rangeBg,
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
                                                    s.dayCircle,
                                                    (isEndpoint || isSingleSelected) && {
                                                        backgroundColor: colors.accent,
                                                    },
                                                    isToday &&
                                                        !isEndpoint &&
                                                        !isSingleSelected && {
                                                            borderWidth: 1.5,
                                                            borderColor: colors.accent,
                                                        },
                                                ]}
                                            >
                                                <Text
                                                    style={[
                                                        s.dayText,
                                                        {
                                                            color:
                                                                isEndpoint || isSingleSelected
                                                                    ? '#FFFFFF'
                                                                    : isToday
                                                                      ? colors.accent
                                                                      : isCurrentMonth
                                                                        ? colors.textPrimary
                                                                        : colors.textTertiary + '60',
                                                            fontWeight:
                                                                isEndpoint || isSingleSelected || isToday
                                                                    ? '700'
                                                                    : '400',
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

                    {/* Today shortcut — single mode only */}
                    {!isRange && (
                        <TouchableOpacity
                            style={[s.todayBtn, { borderColor: colors.accent }]}
                            onPress={() => {
                                const now = new Date();
                                setDisplayMonth({ year: now.getFullYear(), month: now.getMonth() });
                                handleDayPress(now);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel="Select today"
                        >
                            <Text style={[s.todayBtnText, { color: colors.accent }]}>Today</Text>
                        </TouchableOpacity>
                    )}
                </Animated.View>
            </View>
        </Modal>
    );
}

const s = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
    sheet: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingTop: 12,
        paddingBottom: 36,
        paddingHorizontal: 16,
    },
    handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
        paddingHorizontal: 4,
    },
    title: { fontSize: 17, fontWeight: '600' },

    rangeHintRow: {
        minHeight: 22,
        marginBottom: 8,
        paddingHorizontal: 4,
    },
    rangeHint: { fontSize: 13, fontWeight: '500' },

    monthNav: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 4,
        marginBottom: 12,
    },
    monthLabel: { fontSize: 16, fontWeight: '700' },

    dowRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 4 },
    dowCell: { alignItems: 'center', paddingVertical: 4 },
    dowText: { fontSize: 12, fontWeight: '600' },

    gridContainer: { paddingHorizontal: 0 },
    weekRow: { flexDirection: 'row', justifyContent: 'space-around' },
    dayCell: {
        height: DAY_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
    },
    dayCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
    },
    dayText: { fontSize: 15 },
    rangeBg: {
        position: 'absolute',
        top: 4,
        bottom: 4,
        left: 0,
        right: 0,
    },

    todayBtn: {
        alignSelf: 'center',
        marginTop: 12,
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1.5,
    },
    todayBtnText: { fontSize: 14, fontWeight: '600' },
});
