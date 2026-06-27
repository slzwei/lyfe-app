/**
 * Status-tinted initial avatar (ported from mktr-leads `Monogram`, re-skinned).
 * The initial is SANS (Albert Sans) — never serif/Fraunces (brand rule).
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Txt } from './Txt';
import { useLeadsTheme, alpha, statusColors, type LeadStatusKey } from '@/lib/leads/theme';

export function Monogram({ name, status, size = 42 }: { name?: string | null; status?: LeadStatusKey; size?: number }) {
    const { colors } = useLeadsTheme();
    const tint = status ? statusColors[status] : colors.accent;
    const initial = (name?.trim()?.[0] ?? '?').toUpperCase();
    return (
        <View
            style={[
                styles.wrap,
                { width: size, height: size, borderRadius: size / 2, backgroundColor: alpha(tint, 0.16) },
            ]}
        >
            <Txt role="body" weight="bold" size={Math.round(size * 0.42)} color={tint}>
                {initial}
            </Txt>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
