import type { ThemeColors } from '@/types/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
    title: string;
    icon?: keyof typeof Ionicons.glyphMap;
    badge?: string;
    colors: ThemeColors;
    children: React.ReactNode;
}

export default function SectionCard({ title, icon, badge, colors, children }: Props) {
    return (
        <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    {icon && <Ionicons name={icon} size={16} color={colors.accent} />}
                    <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
                </View>
                {badge && <Text style={[styles.badge, { color: colors.textTertiary }]}>{badge}</Text>}
            </View>
            {children}
        </View>
    );
}

export function DetailRow({
    label,
    value,
    colors,
}: {
    label: string;
    value: string | number | null | undefined;
    colors: ThemeColors;
}) {
    if (value == null || value === '') return null;
    return (
        <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>{label}</Text>
            <Text style={[styles.detailValue, { color: colors.textPrimary }]} selectable>
                {value}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 16,
        padding: 16,
        marginHorizontal: 16,
        marginBottom: 12,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        fontSize: 15,
        fontWeight: '700',
    },
    badge: {
        fontSize: 13,
        fontWeight: '500',
    },
    detailRow: {
        flexDirection: 'row',
        paddingVertical: 8,
    },
    detailLabel: {
        width: 110,
        fontSize: 13,
        fontWeight: '500',
    },
    detailValue: {
        flex: 1,
        fontSize: 13,
        fontWeight: '500',
    },
});
