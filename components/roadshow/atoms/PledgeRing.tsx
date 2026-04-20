import { useTheme } from '@/contexts/ThemeContext';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';

export interface PledgeRingProps {
    value: number;
    pledge: number;
    size?: number;
    stroke?: number;
    color?: string;
    label?: string;
}

export function PledgeRing({ value, pledge, size = 68, stroke = 6, color, label }: PledgeRingProps) {
    const { colors } = useTheme();
    const c = color ?? colors.accent;
    const r = (size - stroke) / 2;
    const circ = 2 * Math.PI * r;
    const pct = pledge > 0 ? Math.min(1, value / pledge) : 0;
    const cx = size / 2;
    const cy = size / 2;

    return (
        <View
            style={styles.wrap}
            accessibilityLabel={label ? `${label}: ${value} of ${pledge}` : `${value} of ${pledge}`}
        >
            <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <Circle cx={cx} cy={cy} r={r} fill="none" stroke={colors.hairline} strokeWidth={stroke} />
                <Circle
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill="none"
                    stroke={c}
                    strokeWidth={stroke}
                    strokeDasharray={`${pct * circ} ${circ}`}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${cx} ${cy})`}
                />
                <SvgText
                    x={cx}
                    y={cy + size * 0.11}
                    textAnchor="middle"
                    fontSize={size * 0.34}
                    fontWeight="600"
                    fill={colors.textPrimary}
                >
                    {String(value)}
                </SvgText>
            </Svg>
            {label ? (
                <Text style={[styles.label, { color: colors.textTertiary }]}>
                    {label.toUpperCase()} · /{pledge}
                </Text>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { alignItems: 'center', gap: 6 },
    label: { fontSize: 10.5, fontWeight: '600', letterSpacing: 0.8 },
});
