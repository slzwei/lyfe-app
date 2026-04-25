import { letterSpacing } from '@/constants/platform';
import { useTheme } from '@/contexts/ThemeContext';
import { formatSgPhone } from '@/lib/phone';
import type { NextStep, Urgency } from '@/lib/recruitment/pipeline';
import { CANDIDATE_STATUS_CONFIG, type RecruitmentCandidate } from '@/types/recruitment';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface CandidateCardProps {
    candidate: RecruitmentCandidate;
    onPress: () => void;
    /** Optional urgency hint from the pipeline engine. When present, the card
     * shows a small coloured dot + next-step text. Absent on legacy sort paths. */
    nextStep?: NextStep;
}

function urgencyColor(u: Urgency, colors: ReturnType<typeof useTheme>['colors']): string {
    switch (u) {
        case 'at-risk':
            return colors.danger;
        case 'this-week':
            return colors.warning;
        case 'ready':
            return colors.success;
        case 'on-track':
            return colors.textTertiary;
        case 'hidden':
            return colors.textTertiary;
    }
}

function daysInPipeline(createdAt: string): string {
    const days = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000));
    return days === 0 ? 'Today' : `${days}d ago`;
}

function relativeAgo(iso: string): string {
    const diff = Math.max(0, Date.now() - new Date(iso).getTime());
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

function CandidateCard({ candidate, onPress, nextStep }: CandidateCardProps) {
    const { colors } = useTheme();
    const statusConfig = CANDIDATE_STATUS_CONFIG[candidate.status];

    const createdStr = daysInPipeline(candidate.created_at);
    const lastChangeStr = relativeAgo(candidate.updated_at);
    const interviewCount = candidate.interviews.length;

    const showUrgency = nextStep && nextStep.urgency !== 'hidden';
    const urgencyTint = showUrgency ? urgencyColor(nextStep!.urgency, colors) : null;

    return (
        <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.cardBackground }]}
            onPress={onPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Candidate: ${candidate.name}, status: ${statusConfig.label}`}
        >
            <View style={styles.row}>
                <View style={[styles.avatar, { backgroundColor: colors.accentLight }]}>
                    <Text style={[styles.avatarText, { color: colors.accent }]}>
                        {(candidate.name || '?').charAt(0).toUpperCase()}
                    </Text>
                </View>

                <View style={styles.info}>
                    <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                        {candidate.name}
                    </Text>
                    <Text style={[styles.phone, { color: colors.textTertiary }]}>{formatSgPhone(candidate.phone)}</Text>
                </View>

                <View style={styles.statusCol}>
                    <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '14' }]}>
                        <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
                    </View>
                    <Text style={[styles.lastChange, { color: colors.textTertiary }]}>
                        Last change: {lastChangeStr}
                    </Text>
                </View>
            </View>

            {showUrgency && urgencyTint && (
                <View style={[styles.nextStepRow, { borderTopColor: colors.border }]}>
                    <View style={[styles.urgencyDot, { backgroundColor: urgencyTint }]} />
                    <Text style={[styles.nextStepText, { color: colors.textPrimary }]} numberOfLines={2}>
                        {nextStep!.text}
                    </Text>
                    {nextStep!.signal && (
                        <Text style={[styles.nextStepSignal, { color: urgencyTint }]}>{nextStep!.signal}</Text>
                    )}
                </View>
            )}

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
                <Text style={[styles.metaText, { color: colors.textTertiary }]}>Created: {createdStr}</Text>
            </View>
        </TouchableOpacity>
    );
}

export default React.memo(CandidateCard);

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
        letterSpacing: letterSpacing(-0.2),
    },
    phone: {
        fontSize: 13,
        marginTop: 1,
    },
    statusCol: {
        alignItems: 'flex-end',
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
    lastChange: {
        fontSize: 11,
        marginTop: 4,
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

    // ── Next-step row (pipeline sort only) ───────────────
    nextStepRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    urgencyDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        flexShrink: 0,
    },
    nextStepText: {
        flex: 1,
        fontSize: 13.5,
        fontWeight: '600',
        letterSpacing: letterSpacing(-0.1),
        lineHeight: 18,
    },
    nextStepSignal: {
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: letterSpacing(-0.2),
        flexShrink: 0,
    },
});
