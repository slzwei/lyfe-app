import ActivityEntry from '@/components/candidates/ActivityEntry';
import type { CandidateActivity } from '@/types/recruitment';
import type { ThemeColors } from '@/types/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
    callLog: CandidateActivity[];
    colors: ThemeColors;
}

function ContactHistoryCard({ callLog, colors }: Props) {
    return (
        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
            <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Contact History</Text>
                {callLog.length > 0 && (
                    <Text style={[styles.countBadge, { color: colors.textTertiary }]}>{callLog.length}</Text>
                )}
            </View>
            {callLog.length === 0 ? (
                <View style={styles.emptyHistory}>
                    <Ionicons name="call-outline" size={28} color={colors.textTertiary} />
                    <Text style={[styles.emptyHistoryText, { color: colors.textTertiary }]}>
                        No calls or messages logged yet.{'\n'}Tap Call or WhatsApp above to start.
                    </Text>
                </View>
            ) : (
                callLog.map((entry, idx) => (
                    <ActivityEntry key={entry.id} entry={entry} isLast={idx === callLog.length - 1} colors={colors} />
                ))
            )}
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
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
    countBadge: { fontSize: 13, fontWeight: '600' },
    emptyHistory: {
        alignItems: 'center',
        paddingVertical: 20,
        gap: 8,
    },
    emptyHistoryText: {
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 18,
    },
});

export default React.memo(ContactHistoryCard);
