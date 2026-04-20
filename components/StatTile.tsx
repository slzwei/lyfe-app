import { Fonts } from '@/constants/type';
import { letterSpacing } from '@/constants/platform';
import { useTheme } from '@/contexts/ThemeContext';
import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

type Tint = 'sage' | 'terra' | 'pink' | 'butter' | 'neutral';

interface StatTileProps {
    value: number | string;
    label: string;
    tint?: Tint;
    style?: ViewStyle;
}

/**
 * Soft-tint stat tile. Three-up in a row is the canonical layout.
 *
 *   <View style={{ flexDirection: 'row', gap: 6 }}>
 *     <StatTile value={28}  label="Closes" tint="sage"    style={{ flex: 1 }} />
 *     <StatTile value={168} label="Open"   tint="terra"   style={{ flex: 1 }} />
 *     <StatTile value={3}   label="Nudge"  tint="pink"    style={{ flex: 1 }} />
 *   </View>
 */
export default function StatTile({ value, label, tint = 'neutral', style }: StatTileProps) {
    const { colors } = useTheme();
    const tintMap: Record<Tint, string> = {
        sage: (colors as any).tintSage ?? colors.successLight,
        terra: (colors as any).tintTerra ?? colors.accentLight,
        pink: (colors as any).tintPink ?? colors.accentLight,
        butter: (colors as any).tintButter ?? colors.warningLight,
        neutral: colors.cardBackground,
    };

    return (
        <View
            style={[
                styles.tile,
                {
                    backgroundColor: tintMap[tint],
                    borderColor: colors.border,
                },
                style,
            ]}
        >
            <Text style={[styles.value, { color: colors.textPrimary }]}>{value}</Text>
            <Text style={[styles.label, { color: colors.textTertiary }]}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    tile: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    value: {
        fontFamily: Fonts.serif,
        fontSize: 24,
        fontWeight: '500',
        letterSpacing: letterSpacing(-0.7),
        lineHeight: 26,
    },
    label: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 10.5,
        fontWeight: '600',
        marginTop: 4,
    },
});
