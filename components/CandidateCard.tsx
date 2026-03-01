import { useTheme } from '@/contexts/ThemeContext';
import { CANDIDATE_STATUS_CONFIG, type RecruitmentCandidate } from '@/types/recruitment';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface CandidateCardProps {
    candidate: RecruitmentCandidate;
    onPress: () => void;
}

export default function CandidateCard({ candidate, onPress }: CandidateCardProps) {
    const { colors } = useTheme();
    const statusConfig = CANDIDATE_STATUS_CONFIG[candidate.status];

    const timeAgo = getTimeAgo(candidate.updated_at);
    const interviewCount = candidate.interviews.length;

    return (
        <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.cardBackground }]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View style={styles.row}>
                <View style={[styles.avatar, { backgroundColor: colors.accentLight }]}>
                    <Text style={[styles.avatarText, { color: colors.accent }]}>
                        {candidate.name.charAt(0).toUpperCase()}
                    </Text>
                </View>

                <View style={styles.info}>
                    <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                        {candidate.name}
                    </Text>
                    <Text style={[styles.phone, { color: colors.textTertiary }]}>
                        {candidate.phone}
                    </Text>
                </View>

                <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '14' }]}>
                    <Text style={[styles.statusText, { color: statusConfig.color }]}>
                        {statusConfig.label}
                    </Text>
                </View>
            </View>

            <View style={[styles.meta, { borderTopColor: colors.border }]}>
                {candidate.assigned_manager_name && (
                    <View style={styles.metaItem}>
                        <Ionicons name="person-outline" size={12} color={colors.textTertiary} />
                        <Text style={[styles.metaText, { color: colors.textTertiary }]}>
                            {candidate.assigned_manager_name}
                        </Text>
                    </View>
                )}
                {interviewCount > 0 && (
                    <View style={styles.metaItem}>
                        <Ionicons name="videocam-outline" size={12} color={colors.textTertiary} />
                        <Text style={[styles.metaText, { color: colors.textTertiary }]}>
                            {interviewCount} interview{interviewCount !== 1 ? 's' : ''}
                        </Text>
                    </View>
                )}
                <Text style={[styles.metaText, { color: colors.textTertiary }]}>{timeAgo}</Text>
            </View>
        </TouchableOpacity>
    );
}

function getTimeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return '1d ago';
    return `${days}d ago`;
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 12,
        padding: 14,
        marginBottom: 6,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    avatarText: {
        fontSize: 16,
        fontWeight: '600',
    },
    info: {
        flex: 1,
    },
    name: {
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    phone: {
        fontSize: 13,
        marginTop: 1,
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    meta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaText: {
        fontSize: 12,
    },
});
