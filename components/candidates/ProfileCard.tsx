import { letterSpacing } from '@/constants/platform';
import { CANDIDATE_STATUS_CONFIG, type CandidateStatusConfig } from '@/types/recruitment';
import type { RecruitmentCandidate } from '@/types/recruitment';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface ProfileCardColors {
    cardBackground: string;
    cardBorder: string;
    textPrimary: string;
    textSecondary: string;
    textTertiary: string;
    borderLight?: string;
    border: string;
}

interface ProfileCardProps {
    candidate: RecruitmentCandidate;
    colors: ProfileCardColors;
}

function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getTimeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
}

export default function ProfileCard({ candidate, colors }: ProfileCardProps) {
    const statusConfig: CandidateStatusConfig = CANDIDATE_STATUS_CONFIG[candidate.status];

    return (
        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
            <View style={styles.profileRow}>
                <View style={[styles.avatar, { backgroundColor: statusConfig.color + '18' }]}>
                    <Text style={[styles.avatarText, { color: statusConfig.color }]}>
                        {candidate.name.charAt(0).toUpperCase()}
                    </Text>
                </View>
                <View style={styles.profileInfo}>
                    <Text style={[styles.profileName, { color: colors.textPrimary }]}>{candidate.name}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '14' }]}>
                        <Ionicons name={statusConfig.icon} size={12} color={statusConfig.color} />
                        <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>
                            {statusConfig.label}
                        </Text>
                    </View>
                </View>
            </View>

            <View style={[styles.contactSection, { borderTopColor: colors.borderLight || colors.border }]}>
                <View style={styles.contactRow}>
                    <Ionicons name="call-outline" size={16} color={colors.textTertiary} />
                    <Text style={[styles.contactText, { color: colors.textSecondary }]}>{candidate.phone}</Text>
                </View>
                {candidate.email && (
                    <View style={styles.contactRow}>
                        <Ionicons name="mail-outline" size={16} color={colors.textTertiary} />
                        <Text style={[styles.contactText, { color: colors.textSecondary }]}>{candidate.email}</Text>
                    </View>
                )}
                <View style={styles.contactRow}>
                    <Ionicons name="person-outline" size={16} color={colors.textTertiary} />
                    <Text style={[styles.contactText, { color: colors.textSecondary }]}>
                        Recruiter: {candidate.assigned_manager_name}
                    </Text>
                </View>
                <View style={styles.contactRow}>
                    <Ionicons name="calendar-outline" size={16} color={colors.textTertiary} />
                    <Text style={[styles.contactText, { color: colors.textSecondary }]}>
                        Applied {formatDate(candidate.created_at)} · Updated {getTimeAgo(candidate.updated_at)}
                    </Text>
                </View>
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
    profileRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    avatar: {
        width: 52,
        height: 52,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: { fontSize: 22, fontWeight: '800' },
    profileInfo: { flex: 1 },
    profileName: { fontSize: 20, fontWeight: '800', letterSpacing: letterSpacing(-0.3) },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        marginTop: 6,
    },
    statusBadgeText: { fontSize: 12, fontWeight: '600' },
    contactSection: {
        marginTop: 14,
        paddingTop: 14,
        borderTopWidth: 0.5,
        gap: 8,
    },
    contactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    contactText: { fontSize: 14 },
});
