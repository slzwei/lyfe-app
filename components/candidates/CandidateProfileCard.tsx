import { letterSpacing } from '@/constants/platform';
import { formatCreatedAt, timeAgo } from '@/lib/dateTime';
import { CANDIDATE_STATUS_CONFIG, type RecruitmentCandidate } from '@/types/recruitment';
import type { ThemeColors } from '@/types/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Alert, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

let Clipboard: typeof import('expo-clipboard') | null = null;
try {
    Clipboard = require('expo-clipboard');
} catch (e) {
    if (__DEV__) console.warn('expo-clipboard not available:', e);
}

interface Props {
    candidate: RecruitmentCandidate;
    colors: ThemeColors;
}

function CandidateProfileCard({ candidate, colors }: Props) {
    const statusConfig = CANDIDATE_STATUS_CONFIG[candidate.status];

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
                        Applied {formatCreatedAt(candidate.created_at)} · Updated {timeAgo(candidate.updated_at)}
                    </Text>
                </View>
            </View>

            {candidate.status === 'applied' && candidate.invite_token && (
                <TouchableOpacity
                    style={[styles.inviteBanner, { backgroundColor: colors.accentLight }]}
                    activeOpacity={0.7}
                    onPress={async () => {
                        const link = `https://lyfe-admin.vercel.app/invite/${candidate.invite_token}`;
                        if (Clipboard) {
                            await Clipboard.setStringAsync(link);
                            Alert.alert('Copied', 'Invite link copied to clipboard');
                        } else {
                            Share.share({ message: link });
                        }
                    }}
                >
                    <Ionicons name="link-outline" size={16} color={colors.accent} />
                    <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
                        Copy Invite Link
                    </Text>
                    <Ionicons name="copy-outline" size={14} color={colors.accent} />
                </TouchableOpacity>
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
    inviteBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 14,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 10,
    },
});

export default React.memo(CandidateProfileCard);
