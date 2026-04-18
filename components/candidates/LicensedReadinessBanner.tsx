import type { ThemeColors } from '@/types/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
    candidateName: string;
    rnfReferenceNumber: string | null;
    isConfirming: boolean;
    error: string | null;
    onConfirm: () => void;
    colors: ThemeColors;
}

/**
 * Banner rendered above the Papers section when a candidate has satisfied
 * every licensing prerequisite (fn_all_papers_passed + RNF issued) but hasn't
 * been flipped to `licensed` yet. Gated by the caller — this component does
 * not derive readiness; see [candidateId].tsx for visibility rules.
 *
 * The write itself never happens silently: tapping the CTA surfaces a
 * confirmation alert that re-states the RNF reference number so the caller
 * verifies the paperwork before the status flip.
 */
export default function LicensedReadinessBanner({
    candidateName,
    rnfReferenceNumber,
    isConfirming,
    error,
    onConfirm,
    colors,
}: Props) {
    const handlePress = () => {
        if (isConfirming) return;
        const refSuffix = rnfReferenceNumber ? ` (RNF ${rnfReferenceNumber})` : '';
        Alert.alert(
            'Mark as Licensed?',
            `${candidateName} has passed all 4 papers and their RNF has been issued${refSuffix}. This moves them into the Licensed stage.`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Mark Licensed', style: 'default', onPress: onConfirm },
            ],
        );
    };

    return (
        <View
            style={[styles.banner, { backgroundColor: colors.successLight, borderColor: colors.success }]}
            testID="licensed-readiness-banner"
        >
            <View style={styles.headerRow}>
                <Ionicons name="ribbon" size={22} color={colors.success} />
                <Text style={[styles.title, { color: colors.textPrimary }]}>Ready to License</Text>
            </View>
            <Text style={[styles.body, { color: colors.textSecondary }]}>
                All 4 papers passed · RNF issued{rnfReferenceNumber ? ` · Ref ${rnfReferenceNumber}` : ''}
            </Text>
            {error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}
            <TouchableOpacity
                style={[styles.cta, { backgroundColor: colors.success, opacity: isConfirming ? 0.6 : 1 }]}
                onPress={handlePress}
                disabled={isConfirming}
                activeOpacity={0.85}
                testID="licensed-readiness-banner-cta"
            >
                <Ionicons name="checkmark-circle" size={18} color={colors.textInverse} />
                <Text style={[styles.ctaText, { color: colors.textInverse }]}>
                    {isConfirming ? 'Updating…' : 'Mark as Licensed'}
                </Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    banner: {
        marginHorizontal: 16,
        marginBottom: 12,
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    title: { fontSize: 15, fontWeight: '700' },
    body: { fontSize: 13, fontWeight: '500', marginBottom: 12 },
    error: { fontSize: 13, fontWeight: '500', marginBottom: 8 },
    cta: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 10,
    },
    ctaText: { fontSize: 14, fontWeight: '700' },
});
