import { letterSpacing } from '@/constants/platform';
import { Fonts } from '@/constants/type';
import { useTheme } from '@/contexts/ThemeContext';
import { formatSgPhone } from '@/lib/phone';
import type { NextStep, Urgency } from '@/lib/recruitment/pipeline';
import { CANDIDATE_STATUS_CONFIG, type CandidateStatus, type RecruitmentCandidate } from '@/types/recruitment';
import type { ThemeColors } from '@/types/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface CandidateCardProps {
    candidate: RecruitmentCandidate;
    onPress: () => void;
    mode?: 'directory' | 'pipeline';
    /** Optional urgency hint from the pipeline engine. When present, the card
     * shows a small coloured dot + next-step text. Absent on legacy sort paths. */
    nextStep?: NextStep;
}

function urgencyColor(u: Urgency, colors: ThemeColors): string {
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

function statusColors(status: CandidateStatus, colors: ThemeColors): { fg: string; bg: string; border: string } {
    switch (status) {
        case 'applied':
            return { fg: colors.info, bg: colors.infoLight, border: colors.info + '33' };
        case 'interview_scheduled':
            return { fg: colors.warning, bg: colors.warningLight, border: colors.warning + '33' };
        case 'interviewed':
            return { fg: colors.statusProposed, bg: colors.tintPink, border: colors.statusProposed + '33' };
        case 'approved':
        case 'eapp_done':
        case 'licensed':
            return { fg: colors.success, bg: colors.successLight, border: colors.success + '33' };
        case 'exam_prep':
        case 'active_agent':
            return { fg: colors.accent, bg: colors.accentLight, border: colors.accent + '33' };
        case 'on_hold':
            return { fg: colors.textTertiary, bg: colors.surfaceSecondary, border: colors.border };
        case 'rejected':
            return { fg: colors.danger, bg: colors.dangerLight, border: colors.danger + '33' };
    }
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

function CandidateCard({ candidate, onPress, mode = 'directory', nextStep }: CandidateCardProps) {
    const { colors } = useTheme();
    const statusConfig = CANDIDATE_STATUS_CONFIG[candidate.status];

    const lastChangeStr = relativeAgo(candidate.updated_at);
    const interviewCount = candidate.interviews.length;

    const showUrgency = mode === 'pipeline' && nextStep && nextStep.urgency !== 'hidden';
    const urgencyTint = showUrgency ? urgencyColor(nextStep!.urgency, colors) : null;
    const status = statusColors(candidate.status, colors);
    const accessibilityLabel = showUrgency
        ? `Candidate: ${candidate.name}, status: ${statusConfig.label}, next step: ${nextStep!.text}`
        : `Candidate: ${candidate.name}, status: ${statusConfig.label}`;

    return (
        <TouchableOpacity
            testID={`candidate-card-${candidate.id}`}
            style={[
                styles.card,
                {
                    backgroundColor: colors.cardBackground,
                    borderColor: colors.cardBorder,
                },
            ]}
            onPress={onPress}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
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
                    {mode === 'directory' ? (
                        <Text style={[styles.phone, { color: colors.textTertiary }]} numberOfLines={1}>
                            {formatSgPhone(candidate.phone)}
                        </Text>
                    ) : (
                        <Text style={[styles.pipelineMeta, { color: colors.textTertiary }]} numberOfLines={1}>
                            Updated {lastChangeStr}
                        </Text>
                    )}
                </View>

                <View style={styles.statusCol}>
                    <View
                        style={[
                            styles.statusBadge,
                            {
                                backgroundColor: status.bg,
                                borderColor: status.border,
                            },
                        ]}
                    >
                        <Text style={[styles.statusText, { color: status.fg }]} numberOfLines={1}>
                            {statusConfig.label}
                        </Text>
                    </View>
                </View>
            </View>

            {showUrgency && urgencyTint && (
                <View
                    style={[
                        styles.nextStepRow,
                        {
                            backgroundColor: colors.surfaceSecondary,
                            borderColor: colors.borderLight,
                        },
                    ]}
                >
                    <View style={[styles.urgencyDot, { backgroundColor: urgencyTint }]} />
                    <Text style={[styles.nextStepText, { color: colors.textPrimary }]} numberOfLines={2}>
                        {nextStep!.text}
                    </Text>
                    {nextStep!.signal && (
                        <Text style={[styles.nextStepSignal, { color: urgencyTint }]} numberOfLines={1}>
                            {nextStep!.signal}
                        </Text>
                    )}
                </View>
            )}

            <View style={[styles.meta, { borderTopColor: colors.border }]}>
                {mode === 'directory' && candidate.assigned_manager_name && (
                    <View style={styles.metaItem}>
                        <Ionicons name="person-outline" size={12} color={colors.textTertiary} />
                        <Text style={[styles.metaText, { color: colors.textTertiary }]} numberOfLines={1}>
                            {candidate.assigned_manager_name}
                        </Text>
                    </View>
                )}
                {mode === 'directory' && interviewCount > 0 && (
                    <View style={styles.metaItem}>
                        <Ionicons name="videocam-outline" size={12} color={colors.textTertiary} />
                        <Text style={[styles.metaText, { color: colors.textTertiary }]}>
                            {interviewCount} interview{interviewCount !== 1 ? 's' : ''}
                        </Text>
                    </View>
                )}
                {mode === 'pipeline' && candidate.assigned_manager_name && (
                    <View style={styles.metaItem}>
                        <Ionicons name="person-outline" size={12} color={colors.textTertiary} />
                        <Text style={[styles.metaText, { color: colors.textTertiary }]} numberOfLines={1}>
                            {candidate.assigned_manager_name}
                        </Text>
                    </View>
                )}
                <Text style={[styles.metaText, styles.metaTime, { color: colors.textTertiary }]}>
                    Updated {lastChangeStr}
                </Text>
            </View>
        </TouchableOpacity>
    );
}

export default React.memo(CandidateCard);

const styles = StyleSheet.create({
    card: {
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
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
        fontFamily: Fonts.sansSemibold,
        fontSize: 16,
        fontWeight: '600',
    },
    info: {
        flex: 1,
    },
    name: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 16,
        fontWeight: '600',
        lineHeight: 22,
        letterSpacing: letterSpacing(-0.1),
    },
    phone: {
        fontFamily: Fonts.mono,
        fontSize: 12,
        lineHeight: 17,
        marginTop: 1,
    },
    pipelineMeta: {
        fontFamily: Fonts.mono,
        fontSize: 12,
        lineHeight: 17,
        marginTop: 1,
    },
    statusCol: {
        alignItems: 'flex-end',
        marginLeft: 8,
        maxWidth: 128,
    },
    statusBadge: {
        borderWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        maxWidth: 128,
    },
    statusText: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 12,
        fontWeight: '600',
        lineHeight: 16,
    },
    meta: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        flexShrink: 1,
    },
    metaText: {
        fontFamily: Fonts.sans,
        fontSize: 12,
        lineHeight: 16,
        flexShrink: 1,
    },
    metaTime: {
        fontFamily: Fonts.mono,
    },

    nextStepRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 10,
        paddingHorizontal: 10,
        paddingVertical: 9,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
    },
    urgencyDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        flexShrink: 0,
    },
    nextStepText: {
        flex: 1,
        fontFamily: Fonts.sansSemibold,
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: letterSpacing(-0.1),
        lineHeight: 19,
    },
    nextStepSignal: {
        fontFamily: Fonts.mono,
        fontSize: 11,
        fontWeight: '600',
        flexShrink: 0,
    },
});
