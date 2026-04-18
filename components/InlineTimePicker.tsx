/**
 * Inline time picker — stepper buttons for hour / minute + AM-PM toggle.
 *
 * Rewritten from a WheelPicker-based design because vertical wheels nested
 * inside a vertical ScrollView created an unresolvable gesture conflict on
 * iOS — drags on or near the wheels couldn't scroll the parent sheet. This
 * variant uses stepper buttons only (no internal scroll), so every pixel of
 * the sheet is drag-to-scroll.
 *
 * Hour wraps 1↔12. Minute wraps in 5-minute increments 0↔55. AM/PM is a
 * simple two-way toggle.
 */
import type { ThemeColors } from '@/types/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const MINUTE_STEP = 5;

interface Props {
    /** 1..12 */
    hour: number;
    /** 0..55, multiple of MINUTE_STEP */
    minute: number;
    amPm: 'AM' | 'PM';
    onHourChange: (h: number) => void;
    onMinuteChange: (m: number) => void;
    onAmPmChange: (v: 'AM' | 'PM') => void;
    colors: ThemeColors;
}

function wrapHour(delta: number, current: number): number {
    const next = current + delta;
    if (next > 12) return 1;
    if (next < 1) return 12;
    return next;
}

function wrapMinute(delta: number, current: number): number {
    const next = current + delta * MINUTE_STEP;
    if (next >= 60) return 0;
    if (next < 0) return 60 - MINUTE_STEP;
    return next;
}

interface StepperColumnProps {
    label: string;
    value: string;
    onDec: () => void;
    onInc: () => void;
    colors: ThemeColors;
    testIDBase: string;
}

function StepperColumn({ label, value, onDec, onInc, colors, testIDBase }: StepperColumnProps) {
    return (
        <View style={styles.column}>
            <Text style={[styles.columnLabel, { color: colors.textTertiary }]}>{label}</Text>
            <View style={[styles.stepperBox, { borderColor: colors.border, backgroundColor: colors.surfacePrimary }]}>
                <TouchableOpacity
                    onPress={onDec}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 4 }}
                    style={styles.stepperBtn}
                    testID={`${testIDBase}-dec`}
                >
                    <Ionicons name="chevron-down" size={20} color={colors.accent} />
                </TouchableOpacity>
                <Text style={[styles.stepperValue, { color: colors.textPrimary }]}>{value}</Text>
                <TouchableOpacity
                    onPress={onInc}
                    hitSlop={{ top: 12, bottom: 12, left: 4, right: 12 }}
                    style={styles.stepperBtn}
                    testID={`${testIDBase}-inc`}
                >
                    <Ionicons name="chevron-up" size={20} color={colors.accent} />
                </TouchableOpacity>
            </View>
        </View>
    );
}

export default function InlineTimePicker({
    hour,
    minute,
    amPm,
    onHourChange,
    onMinuteChange,
    onAmPmChange,
    colors,
}: Props) {
    return (
        <View style={styles.container} pointerEvents="box-none">
            <View style={styles.row} pointerEvents="box-none">
                <StepperColumn
                    label="Hour"
                    value={String(hour)}
                    onDec={() => onHourChange(wrapHour(-1, hour))}
                    onInc={() => onHourChange(wrapHour(1, hour))}
                    colors={colors}
                    testIDBase="time-picker-hour"
                />
                <StepperColumn
                    label="Minute"
                    value={String(minute).padStart(2, '0')}
                    onDec={() => onMinuteChange(wrapMinute(-1, minute))}
                    onInc={() => onMinuteChange(wrapMinute(1, minute))}
                    colors={colors}
                    testIDBase="time-picker-minute"
                />

                <View style={styles.column}>
                    <Text style={[styles.columnLabel, { color: colors.textTertiary }]}>Period</Text>
                    <View style={[styles.toggleBox, { borderColor: colors.border }]}>
                        <TouchableOpacity
                            onPress={() => onAmPmChange('AM')}
                            style={[styles.toggleHalf, amPm === 'AM' && { backgroundColor: colors.accent }]}
                            activeOpacity={0.7}
                            testID="time-picker-am"
                        >
                            <Text
                                style={[
                                    styles.toggleText,
                                    {
                                        color: amPm === 'AM' ? colors.textInverse : colors.textPrimary,
                                    },
                                ]}
                            >
                                AM
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => onAmPmChange('PM')}
                            style={[styles.toggleHalf, amPm === 'PM' && { backgroundColor: colors.accent }]}
                            activeOpacity={0.7}
                            testID="time-picker-pm"
                        >
                            <Text
                                style={[
                                    styles.toggleText,
                                    {
                                        color: amPm === 'PM' ? colors.textInverse : colors.textPrimary,
                                    },
                                ]}
                            >
                                PM
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        paddingTop: 6,
        paddingBottom: 2,
    },
    row: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },
    column: {
        flex: 1,
        alignItems: 'center',
    },
    columnLabel: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    stepperBox: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 12,
        paddingVertical: 6,
        paddingHorizontal: 8,
        justifyContent: 'space-between',
        alignSelf: 'stretch',
    },
    stepperBtn: {
        padding: 4,
    },
    stepperValue: {
        fontSize: 20,
        fontWeight: '700',
        textAlign: 'center',
    },
    toggleBox: {
        flexDirection: 'row',
        borderWidth: 1,
        borderRadius: 12,
        overflow: 'hidden',
        alignSelf: 'stretch',
    },
    toggleHalf: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    toggleText: {
        fontSize: 14,
        fontWeight: '700',
    },
});
