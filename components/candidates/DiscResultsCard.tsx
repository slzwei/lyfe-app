import { DISC_TYPE_INFO } from '@/constants/disc';
import type { DiscResultType } from '@/constants/disc';
import { getDiscLabel } from '@/lib/disc';
import type { CandidateDiscResults } from '@/types/recruitment';
import type { ThemeColors } from '@/types/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

const DIMENSION_CONFIG = [
    { key: 'd_pct' as const, label: 'D', color: '#2B8C8C' },
    { key: 'i_pct' as const, label: 'I', color: '#7B5EA7' },
    { key: 's_pct' as const, label: 'S', color: '#D4876C' },
    { key: 'c_pct' as const, label: 'C', color: '#4A7FB5' },
];

interface Props {
    discResults: CandidateDiscResults;
    colors: ThemeColors;
}

function DiscResultsCard({ discResults, colors }: Props) {
    const typeInfo = DISC_TYPE_INFO[discResults.disc_type as DiscResultType];
    const typeLabel = getDiscLabel(discResults.disc_type as DiscResultType);

    return (
        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
            <View style={styles.headerRow}>
                <Ionicons
                    name={(typeInfo?.icon as any) || 'options-outline'}
                    size={18}
                    color={typeInfo?.color || colors.textTertiary}
                />
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>DISC Profile</Text>
            </View>

            <View style={[styles.typeBadge, { backgroundColor: (typeInfo?.color || '#78716c') + '14' }]}>
                <Text style={[styles.typeLabel, { color: typeInfo?.color || colors.textSecondary }]}>{typeLabel}</Text>
            </View>

            <View style={styles.barsContainer}>
                {DIMENSION_CONFIG.map(({ key, label, color }) => {
                    const pct = discResults[key];
                    return (
                        <View key={key} style={styles.barRow}>
                            <Text style={[styles.barLabel, { color }]}>{label}</Text>
                            <View
                                style={[
                                    styles.barTrack,
                                    { backgroundColor: colors.surfacePrimary || colors.background },
                                ]}
                            >
                                <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
                            </View>
                            <Text style={[styles.barValue, { color: colors.textSecondary }]}>{pct}%</Text>
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 14,
        borderWidth: 0.5,
        padding: 16,
        marginBottom: 12,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    sectionTitle: { fontSize: 15, fontWeight: '700' },
    typeBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        marginBottom: 14,
    },
    typeLabel: { fontSize: 14, fontWeight: '600' },
    barsContainer: { gap: 10 },
    barRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    barLabel: { fontSize: 14, fontWeight: '700', width: 16, textAlign: 'center' },
    barTrack: {
        flex: 1,
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
    },
    barFill: {
        height: '100%',
        borderRadius: 4,
    },
    barValue: { fontSize: 13, fontWeight: '500', width: 36, textAlign: 'right' },
});

export default React.memo(DiscResultsCard);
