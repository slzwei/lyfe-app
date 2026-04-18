import { Fonts } from '@/constants/type';
import { letterSpacing } from '@/constants/platform';
import type { ThemeColors } from '@/types/theme';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
    title: string;
    // TODO: Tropic SectionCard no longer renders an icon. Prop preserved so
    // existing callers compile; safe to remove once all callsites drop it.
    icon?: string;
    badge?: string;
    colors: ThemeColors;
    children: React.ReactNode;
}

// Two-word titles split into roman + italic (the brand gesture at heading
// level). Single-word titles stay roman.
function splitTitle(title: string): { roman: string; italic?: string } {
    const words = title.trim().split(/\s+/);
    if (words.length < 2) return { roman: title.trim() };
    return {
        roman: words.slice(0, -1).join(' '),
        italic: words[words.length - 1],
    };
}

export default function SectionCard({ title, badge, colors, children }: Props) {
    const { roman, italic } = splitTitle(title);
    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <Text style={[styles.heading, { color: colors.textPrimary }]}>
                    {italic ? `${roman} ` : roman}
                    {italic && <Text style={[styles.headingItalic, { color: colors.accent }]}>{italic}</Text>}
                </Text>
                {badge && <Text style={[styles.badge, { color: colors.textTertiary }]}>{badge}</Text>}
            </View>
            <View style={[styles.body, { borderTopColor: colors.cardBorder, borderBottomColor: colors.cardBorder }]}>
                {children}
            </View>
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
        <View style={[styles.detailRow, { borderBottomColor: colors.cardBorder }]}>
            <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>{label}</Text>
            <Text style={[styles.detailValue, { color: colors.textPrimary }]} selectable>
                {value}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 20,
        marginTop: 28,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
        gap: 12,
    },
    heading: {
        flex: 1,
        fontFamily: Fonts.serif,
        fontSize: 20,
        fontWeight: '500',
        lineHeight: 24,
        letterSpacing: letterSpacing(-0.3),
    },
    headingItalic: {
        fontFamily: Fonts.serifItalic,
    },
    badge: {
        fontFamily: Fonts.mono,
        fontSize: 11,
        lineHeight: 14,
    },
    body: {
        borderTopWidth: 1,
        borderBottomWidth: 1,
        paddingVertical: 20,
    },
    detailRow: {
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    detailLabel: {
        fontFamily: Fonts.mono,
        fontSize: 10,
        lineHeight: 12,
        letterSpacing: letterSpacing(1),
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    detailValue: {
        fontFamily: Fonts.serif,
        fontSize: 16,
        lineHeight: 22,
    },
});
