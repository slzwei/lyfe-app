import { Fonts } from '@/constants/type';
import { useTheme } from '@/contexts/ThemeContext';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface RingStatProps {
    /** 0..1 — fraction complete */
    progress: number;
    /** Number to display inside the ring (no units) */
    value: number | string;
    /** Ring diameter in px */
    size?: number;
    /** Stroke width */
    strokeWidth?: number;
    /** Override ring colour (defaults to accent) */
    color?: string;
}

/**
 * Circular progress ring — the Tropic Office KPI atom.
 *
 * Requires react-native-svg (already a dependency in lyfe-app for the pixel art).
 *
 * Usage:
 *   <RingStat progress={0.79} value={79} />
 *   <View style={{ flexDirection: 'row', gap: 14 }}>
 *     <RingStat progress={0.79} value={79} />
 *     <View>
 *       <Text>Team Alpha</Text>
 *       <Text>$142,000 of $180k</Text>
 *     </View>
 *   </View>
 */
export default function RingStat({ progress, value, size = 70, strokeWidth = 5, color }: RingStatProps) {
    const { colors } = useTheme();
    const ringColor = color ?? colors.accent;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const clamped = Math.max(0, Math.min(1, progress));
    const dash = circumference * clamped;

    return (
        <View style={[styles.wrap, { width: size, height: size }]}>
            <Svg width={size} height={size}>
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={colors.borderLight}
                    strokeWidth={strokeWidth}
                />
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={ringColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${dash} ${circumference}`}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
            </Svg>
            <View style={styles.labelContainer} pointerEvents="none">
                <Text style={[styles.label, { color: colors.textPrimary, fontSize: size * 0.26 }]}>{value}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    labelContainer: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
    label: {
        fontFamily: Fonts.serif,
        fontWeight: '500',
    },
});
