import type { ThemeColors } from '@/types/theme';
import type { IconName } from '@/types/ui';
import type { CandidateActivity } from '@/types/recruitment';
import { timeAgo } from '@/lib/dateTime';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface ActivityEntryProps {
    entry: CandidateActivity;
    isLast: boolean;
    colors: ThemeColors;
}

export default function ActivityEntry({ entry, isLast, colors }: ActivityEntryProps) {
    const isNote = entry.type === 'note';
    const isPositive = entry.outcome === 'reached' || entry.outcome === 'sent';
    const dotColor = isNote ? colors.textTertiary : isPositive ? colors.success : colors.textTertiary;
    const iconName: IconName = isNote ? 'create-outline' : entry.type === 'whatsapp' ? 'logo-whatsapp' : 'call';
    const iconColor = isNote ? colors.textTertiary : entry.type === 'whatsapp' ? '#25D366' : dotColor;
    const outcomeLabel =
        entry.outcome === 'reached'
            ? 'Connected'
            : entry.outcome === 'no_answer'
              ? 'No answer'
              : entry.outcome === 'sent'
                ? 'Sent'
                : '';
    const typeLabel = isNote ? 'Note' : entry.type === 'whatsapp' ? 'WhatsApp' : 'Call';

    return (
        <View style={entryStyles.row}>
            <View style={entryStyles.timelineCol}>
                <View style={[entryStyles.dot, { backgroundColor: iconColor + '20' }]}>
                    <Ionicons name={iconName} size={13} color={iconColor} />
                </View>
                {!isLast && <View style={[entryStyles.line, { backgroundColor: colors.border }]} />}
            </View>
            <View style={[entryStyles.content, { paddingBottom: isLast ? 0 : 16 }]}>
                <Text style={[entryStyles.title, { color: colors.textPrimary }]}>
                    {typeLabel}
                    {outcomeLabel ? (
                        <>
                            {'  '}
                            <Text style={[entryStyles.outcome, { color: dotColor }]}>{outcomeLabel}</Text>
                        </>
                    ) : null}
                </Text>
                {entry.note ? (
                    <View style={[entryStyles.noteBox, { backgroundColor: colors.surfacePrimary }]}>
                        <Text style={[entryStyles.noteText, { color: colors.textSecondary }]}>{entry.note}</Text>
                    </View>
                ) : null}
                <Text style={[entryStyles.meta, { color: colors.textTertiary }]}>
                    {entry.actor_name ? `${entry.actor_name} · ` : ''}
                    {timeAgo(entry.created_at)}
                </Text>
            </View>
        </View>
    );
}

const entryStyles = StyleSheet.create({
    row: { flexDirection: 'row' },
    timelineCol: { width: 32, alignItems: 'center' },
    dot: {
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
    },
    line: { width: 2, flex: 1, marginTop: 4 },
    content: { flex: 1, marginLeft: 8, paddingTop: 3 },
    title: { fontSize: 14, fontWeight: '600' },
    outcome: { fontSize: 14, fontWeight: '600' },
    noteBox: {
        marginTop: 6,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 7,
    },
    noteText: { fontSize: 13, lineHeight: 18 },
    meta: { fontSize: 11, marginTop: 5 },
});
