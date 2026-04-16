import { CANDIDATE_STATUS_CONFIG } from '@/types/recruitment';
import type { RecruitmentCandidate } from '@/types/recruitment';
import type { ThemeColors } from '@/types/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
    candidate: RecruitmentCandidate;
    colors: ThemeColors;
    onStatusPress: () => void;
}

export default function HeroSection({ candidate, colors, onStatusPress }: Props) {
    const daysSinceCreated = Math.floor((Date.now() - new Date(candidate.created_at).getTime()) / 86400000);
    const statusConfig = CANDIDATE_STATUS_CONFIG[candidate.status];
    const initials = candidate.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    return (
        <View style={[styles.container, { backgroundColor: colors.cardBackground }]}>
            <View style={[styles.avatar, { backgroundColor: colors.accentLight }]}>
                <Text style={[styles.avatarText, { color: colors.accent }]}>{initials}</Text>
            </View>

            <Text style={[styles.name, { color: colors.textPrimary }]}>{candidate.name}</Text>

            <View style={styles.contactRow}>
                <View style={styles.contactItem}>
                    <Ionicons name="call-outline" size={13} color={colors.textTertiary} />
                    <Text style={[styles.contactText, { color: colors.textSecondary }]}>{candidate.phone}</Text>
                </View>
                {candidate.email && (
                    <View style={styles.contactItem}>
                        <Ionicons name="mail-outline" size={13} color={colors.textTertiary} />
                        <Text style={[styles.contactText, { color: colors.textSecondary }]} numberOfLines={1}>
                            {candidate.email}
                        </Text>
                    </View>
                )}
            </View>

            <TouchableOpacity
                onPress={onStatusPress}
                style={[styles.statusPill, { backgroundColor: statusConfig.color + '1A' }]}
                activeOpacity={0.7}
            >
                <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
                <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
                <Ionicons name="chevron-down" size={14} color={statusConfig.color} />
            </TouchableOpacity>

            <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                    <Ionicons name="person-outline" size={13} color={colors.textTertiary} />
                    <Text style={[styles.metaText, { color: colors.textTertiary }]}>
                        {candidate.assigned_manager_name}
                    </Text>
                </View>
                <View style={styles.metaItem}>
                    <Ionicons name="time-outline" size={13} color={colors.textTertiary} />
                    <Text style={[styles.metaText, { color: colors.textTertiary }]}>
                        {daysSinceCreated}d in pipeline
                    </Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        paddingVertical: 24,
        paddingHorizontal: 16,
        marginHorizontal: 16,
        marginTop: 8,
        borderRadius: 16,
    },
    avatar: {
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    avatarText: {
        fontSize: 24,
        fontWeight: '800',
    },
    name: {
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 6,
    },
    contactRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 14,
    },
    contactItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    contactText: {
        fontSize: 13,
        fontWeight: '500',
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        marginBottom: 14,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statusText: {
        fontSize: 14,
        fontWeight: '700',
    },
    metaRow: {
        flexDirection: 'row',
        gap: 16,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaText: {
        fontSize: 12,
        fontWeight: '500',
    },
});
