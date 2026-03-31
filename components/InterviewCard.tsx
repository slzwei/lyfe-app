import { INTERVIEW_STATUS_COLORS } from '@/constants/ui';
import { formatDateTime } from '@/lib/dateTime';
import type { Interview, InterviewRecommendation } from '@/types/recruitment';
import { RECOMMENDATION_CONFIG } from '@/types/recruitment';
import type { ThemeColors } from '@/types/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface InterviewCardProps {
    interview: Interview;
    colors: ThemeColors;
    onEdit: () => void;
    onDelete: () => void;
}

export default function InterviewCard({ interview, colors, onEdit, onDelete }: InterviewCardProps) {
    const isUpcoming = new Date(interview.datetime) > new Date();
    const statusColor = INTERVIEW_STATUS_COLORS[interview.status] ?? INTERVIEW_STATUS_COLORS.scheduled;

    return (
        <View
            style={[
                styles.card,
                { backgroundColor: colors.surfacePrimary || colors.background, borderColor: colors.border },
            ]}
        >
            <View style={styles.headerRow}>
                <View style={styles.roundBadge}>
                    <Text style={styles.roundText}>R{interview.round_number}</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.dateText, { color: colors.textPrimary }]}>
                        {formatDateTime(interview.datetime)}
                    </Text>
                    <Text style={[styles.typeText, { color: colors.textTertiary }]}>
                        {interview.type === 'zoom' ? 'Zoom' : 'In-Person'}
                    </Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: statusColor + '18' }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>
                        {interview.status.charAt(0).toUpperCase() + interview.status.slice(1)}
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={onEdit}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 8 }}
                    style={{ marginLeft: 8, padding: 4 }}
                    accessibilityRole="button"
                    accessibilityLabel="Edit interview"
                >
                    <Ionicons name="pencil-outline" size={16} color={colors.textTertiary} />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={onDelete}
                    hitSlop={{ top: 12, bottom: 12, left: 8, right: 12 }}
                    style={{ marginLeft: 4, padding: 4 }}
                    accessibilityRole="button"
                    accessibilityLabel="Delete interview"
                >
                    <Ionicons name="trash-outline" size={16} color={colors.textTertiary} />
                </TouchableOpacity>
            </View>

            {interview.recommendation && (
                <RecommendationBadge recommendation={interview.recommendation as InterviewRecommendation} />
            )}
            {interview.location && (
                <View style={styles.detailRow}>
                    <Ionicons name="location-outline" size={14} color={colors.textTertiary} />
                    <Text style={[styles.detailText, { color: colors.textSecondary }]}>{interview.location}</Text>
                </View>
            )}
            {interview.zoom_link && isUpcoming && (
                <TouchableOpacity
                    style={styles.detailRow}
                    onPress={() => Linking.openURL(interview.zoom_link!)}
                    accessibilityRole="button"
                    accessibilityLabel="Join Zoom meeting"
                >
                    <Ionicons name="videocam-outline" size={14} color={colors.accent} />
                    <Text style={[styles.detailText, { color: colors.accent }]}>Join Zoom Meeting</Text>
                </TouchableOpacity>
            )}
            {interview.notes && (
                <View style={styles.detailRow}>
                    <Ionicons name="chatbubble-outline" size={14} color={colors.textTertiary} />
                    <Text style={[styles.detailText, { color: colors.textSecondary }]}>{interview.notes}</Text>
                </View>
            )}
        </View>
    );
}

function RecommendationBadge({ recommendation }: { recommendation: InterviewRecommendation }) {
    const cfg = RECOMMENDATION_CONFIG[recommendation];
    if (!cfg) return null;
    return (
        <View style={[styles.recBadge, { backgroundColor: cfg.color + '14' }]}>
            <Ionicons name={cfg.icon as 'refresh-outline'} size={13} color={cfg.color} />
            <Text style={[styles.recBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 10,
        borderWidth: 0.5,
        padding: 12,
        marginBottom: 8,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    roundBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#007AFF18',
        alignItems: 'center',
        justifyContent: 'center',
    },
    roundText: { fontSize: 11, fontWeight: '700', color: '#007AFF' },
    dateText: { fontSize: 14, fontWeight: '600' },
    typeText: { fontSize: 12, marginTop: 1 },
    statusPill: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    statusText: { fontSize: 11, fontWeight: '600' },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
    },
    detailText: { fontSize: 13 },
    recBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 5,
        marginTop: 8,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
    },
    recBadgeText: { fontSize: 12, fontWeight: '700' },
});
