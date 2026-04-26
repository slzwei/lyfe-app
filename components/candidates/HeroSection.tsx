import { Fonts } from '@/constants/type';
import { letterSpacing } from '@/constants/platform';
import { formatSgPhone } from '@/lib/phone';
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
    canReassign?: boolean;
    onReassignPress?: () => void;
}

// 6-char hex color + 40% alpha suffix.
function alphaBorder(hex: string): string {
    return hex.length === 7 ? `${hex}66` : hex;
}

export default function HeroSection({ candidate, colors, onStatusPress, canReassign, onReassignPress }: Props) {
    const daysSinceCreated = Math.floor((Date.now() - new Date(candidate.created_at).getTime()) / 86400000);
    const statusConfig = CANDIDATE_STATUS_CONFIG[candidate.status];
    const initials = candidate.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    return (
        <View style={styles.container}>
            <View style={styles.topRow}>
                <View style={[styles.initials, { backgroundColor: colors.accentLight }]}>
                    <Text style={[styles.initialsText, { color: colors.accent }]}>{initials}</Text>
                </View>
                <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={2}>
                    {candidate.name}
                </Text>
            </View>

            <TouchableOpacity
                onPress={onStatusPress}
                activeOpacity={0.7}
                style={[styles.statusTag, { borderColor: alphaBorder(statusConfig.color) }]}
            >
                <Text style={[styles.statusLabel, { color: statusConfig.color }]}>{statusConfig.label}</Text>
                <Text style={[styles.statusCaret, { color: statusConfig.color }]}>{'›'}</Text>
            </TouchableOpacity>

            <View style={styles.metaGrid}>
                <View style={styles.metaItem}>
                    <Text style={[styles.metaLabel, { color: colors.textTertiary }]}>PHONE</Text>
                    <Text style={[styles.metaValue, { color: colors.textPrimary }]} numberOfLines={1}>
                        {formatSgPhone(candidate.phone)}
                    </Text>
                </View>
                <View style={styles.metaItem}>
                    <Text style={[styles.metaLabel, { color: colors.textTertiary }]}>EMAIL</Text>
                    <Text style={[styles.metaValue, { color: colors.textPrimary }]}>{candidate.email || '—'}</Text>
                </View>
                <View style={styles.metaItem}>
                    <Text style={[styles.metaLabel, { color: colors.textTertiary }]}>MANAGER</Text>
                    {canReassign && onReassignPress ? (
                        <TouchableOpacity
                            onPress={onReassignPress}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            accessibilityLabel="Reassign manager"
                            style={styles.managerRow}
                        >
                            <Text
                                style={[styles.metaValue, { color: colors.textPrimary, flexShrink: 1 }]}
                                numberOfLines={1}
                            >
                                {candidate.assigned_manager_name || '—'}
                            </Text>
                            <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
                        </TouchableOpacity>
                    ) : (
                        <Text style={[styles.metaValue, { color: colors.textPrimary }]} numberOfLines={1}>
                            {candidate.assigned_manager_name || '—'}
                        </Text>
                    )}
                </View>
                <View style={styles.metaItem}>
                    <Text style={[styles.metaLabel, { color: colors.textTertiary }]}>IN PIPELINE</Text>
                    <Text style={[styles.metaValue, { color: colors.textPrimary }]} numberOfLines={1}>
                        {daysSinceCreated}d
                    </Text>
                </View>
            </View>

            <View style={[styles.rule, { backgroundColor: colors.cardBorder }]} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 20,
        paddingTop: 12,
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 14,
        marginBottom: 16,
    },
    initials: {
        width: 48,
        height: 48,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    initialsText: {
        fontFamily: Fonts.serifItalic,
        fontSize: 22,
        lineHeight: 26,
    },
    name: {
        flex: 1,
        fontFamily: Fonts.serif,
        fontSize: 34,
        fontWeight: '500',
        lineHeight: 38,
        letterSpacing: letterSpacing(-0.8),
    },
    statusTag: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        paddingHorizontal: 10,
        paddingVertical: 4,
        marginBottom: 24,
    },
    statusLabel: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: letterSpacing(1),
        textTransform: 'uppercase',
    },
    statusCaret: {
        fontFamily: Fonts.serif,
        fontSize: 14,
        lineHeight: 14,
    },
    metaGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 20,
    },
    metaItem: {
        width: '50%',
        paddingRight: 8,
        marginBottom: 14,
    },
    metaLabel: {
        fontFamily: Fonts.mono,
        fontSize: 10,
        letterSpacing: letterSpacing(1),
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    metaValue: {
        fontFamily: Fonts.sans,
        fontSize: 14,
        fontWeight: '500',
        lineHeight: 18,
    },
    managerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    rule: {
        height: 1,
    },
});
