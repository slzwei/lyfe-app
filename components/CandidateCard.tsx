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

    return (
        <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View style={styles.topRow}>
                <View style={styles.nameSection}>
                    <View style={[styles.avatar, { backgroundColor: statusConfig.color + '18' }]}>
                        <Text style={[styles.avatarText, { color: statusConfig.color }]}>
                            {candidate.name.charAt(0).toUpperCase()}
                        </Text>
                    </View>
                    <View style={styles.nameInfo}>
                        <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                            {candidate.name}
                        </Text>
                        <Text style={[styles.phone, { color: colors.textSecondary }]}>{candidate.phone}</Text>
                    </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '18' }]}>
                    <Ionicons name={statusConfig.icon as any} size={12} color={statusConfig.color} />
                    <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
                </View>
            </View>

            <View style={[styles.bottomRow, { borderTopColor: colors.borderLight }]}>
                <View style={styles.metaItem}>
                    <Ionicons name="person-outline" size={12} color={colors.textTertiary} />
                    <Text style={[styles.metaText, { color: colors.textTertiary }]}>{candidate.assigned_manager_name}</Text>
                </View>
                {candidate.interviews.length > 0 && (
                    <View style={styles.metaItem}>
                        <Ionicons name="videocam-outline" size={12} color={colors.textTertiary} />
                        <Text style={[styles.metaText, { color: colors.textTertiary }]}>
                            {candidate.interviews.length} interview{candidate.interviews.length > 1 ? 's' : ''}
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
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 14,
        borderWidth: 0.5,
        marginHorizontal: 12,
        marginBottom: 8,
        overflow: 'hidden',
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 14,
    },
    nameSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    avatar: {
        width: 38,
        height: 38,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: { fontSize: 16, fontWeight: '700' },
    nameInfo: { flex: 1 },
    name: { fontSize: 15, fontWeight: '600' },
    phone: { fontSize: 12, marginTop: 2 },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    statusText: { fontSize: 11, fontWeight: '600' },
    bottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderTopWidth: 0.5,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaText: { fontSize: 11 },
});
