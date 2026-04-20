import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RoadshowBounds } from '@/constants/roadshow/tokens';

export interface NumberStepperProps {
    value: number;
    onChange: (next: number) => void;
    label?: string;
    /** Overrides a11y label suffix — e.g. "agents per slot" → "Increase agents per slot". Falls back to `label`. */
    accessibilityLabel?: string;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
    testID?: string;
}

export function NumberStepper({
    value,
    onChange,
    label,
    accessibilityLabel,
    min = RoadshowBounds.minPledge,
    max = RoadshowBounds.maxPledge,
    step = 1,
    disabled = false,
    testID,
}: NumberStepperProps) {
    const a11y = accessibilityLabel ?? label ?? 'value';
    const { colors } = useTheme();

    const clamp = (n: number) => Math.max(min, Math.min(max, n));
    const dec = () => !disabled && onChange(clamp(value - step));
    const inc = () => !disabled && onChange(clamp(value + step));

    const atMin = value <= min;
    const atMax = value >= max;
    const btnBg = colors.surfacePrimary;
    const btnBorder = colors.border;

    return (
        <View style={styles.wrap} testID={testID}>
            {label ? <Text style={[styles.label, { color: colors.textTertiary }]}>{label.toUpperCase()}</Text> : null}
            <View style={styles.row}>
                <Pressable
                    onPress={dec}
                    disabled={disabled}
                    style={({ pressed }) => [
                        styles.btn,
                        {
                            backgroundColor: btnBg,
                            borderColor: btnBorder,
                            opacity: disabled || atMin ? 0.4 : pressed ? 0.7 : 1,
                        },
                    ]}
                    accessibilityLabel={`Decrease ${a11y}`}
                    hitSlop={8}
                >
                    <Ionicons name="remove" size={14} color={colors.textPrimary} />
                </Pressable>
                <Text style={[styles.value, { color: colors.textPrimary }]}>{value}</Text>
                <Pressable
                    onPress={inc}
                    disabled={disabled}
                    style={({ pressed }) => [
                        styles.btn,
                        {
                            backgroundColor: btnBg,
                            borderColor: btnBorder,
                            opacity: disabled || atMax ? 0.4 : pressed ? 0.7 : 1,
                        },
                    ]}
                    accessibilityLabel={`Increase ${a11y}`}
                    hitSlop={8}
                >
                    <Ionicons name="add" size={14} color={colors.textPrimary} />
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { alignItems: 'center', gap: 6 },
    label: { fontSize: 10.5, fontWeight: '600', letterSpacing: 0.8 },
    // Tight row sizing: 28px buttons + 6px gap + 30px value + 6px gap + 28px
    // = 98px per stepper — three fit comfortably in a 330px container
    // (vs the previous 138px × 3 = 414px which overflowed on iPhone 12 Pro).
    row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    btn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    value: {
        fontSize: 22,
        fontWeight: '600',
        minWidth: 30,
        textAlign: 'center',
        fontVariant: ['tabular-nums'],
    },
});
