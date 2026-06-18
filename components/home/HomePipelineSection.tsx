/**
 * HomePipelineSection — boxed 3-section pipeline card on the Home tab.
 *
 * Surfaces the "who needs you today" signal at the top of Home for
 * managers/directors/admins/ROs. Each urgency bucket renders as its own card
 * with up to MAX_ROWS_PER_SECTION candidates visible; a "See all →" link drops
 * into the Candidates tab (where the full list lives, with the Pipeline sort
 * toggle already documented).
 *
 * Presentational: the pipeline snapshot is fetched once by the Home screen
 * (via useCandidatePipeline) and passed in as props, so the greeting subline and
 * this section share a single fetch + realtime subscription.
 *
 * Tap targets:
 *   - Row → candidate detail
 *   - See all → Candidates tab (user taps Pipeline sort manually — no magic URL params for MVP)
 *
 * Empty / loading / error states: handled in-component. Section is self-contained.
 */
import { letterSpacing } from '@/constants/platform';
import { Fonts } from '@/constants/type';
import { useTheme } from '@/contexts/ThemeContext';
import { pipelineAnalytics } from '@/lib/analytics';
import type { PipelineSnapshot } from '@/lib/recruitment/pipelineFetch';
import type { NextStep, Urgency } from '@/lib/recruitment/pipeline';
import type { RecruitmentCandidate } from '@/types/recruitment';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const MAX_ROWS_PER_SECTION = 2;

interface HomePipelineSectionProps {
    rows: PipelineSnapshot['rows'];
    counts: PipelineSnapshot['counts'];
    isLoading: boolean;
    error: string | null;
    onCandidatePress: (candidateId: string) => void;
    onSeeAll: () => void;
}

type BucketKey = 'at-risk' | 'this-week' | 'ready';

interface Bucket {
    key: BucketKey;
    title: string;
    rows: { candidate: RecruitmentCandidate; nextStep: NextStep }[];
    total: number;
    tintVar: 'danger' | 'warning' | 'success';
}

function HomePipelineSectionImpl({
    rows,
    counts,
    isLoading,
    error,
    onCandidatePress,
    onSeeAll,
}: HomePipelineSectionProps) {
    const { colors } = useTheme();

    const buckets: Bucket[] = useMemo(() => {
        const byUrgency = (u: Urgency) => rows.filter((r) => r.nextStep.urgency === u);
        return [
            {
                key: 'at-risk',
                title: 'Needs you',
                rows: byUrgency('at-risk').slice(0, MAX_ROWS_PER_SECTION),
                total: counts['at-risk'],
                tintVar: 'danger',
            },
            {
                key: 'this-week',
                title: 'This week',
                rows: byUrgency('this-week').slice(0, MAX_ROWS_PER_SECTION),
                total: counts['this-week'],
                tintVar: 'warning',
            },
            {
                key: 'ready',
                title: 'Ready',
                rows: byUrgency('ready').slice(0, MAX_ROWS_PER_SECTION),
                total: counts.ready,
                tintVar: 'success',
            },
        ];
    }, [rows, counts]);

    if (isLoading) {
        return (
            <View style={[styles.loadingCard, { backgroundColor: colors.paperElevated, borderColor: colors.border }]}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={[styles.loadingText, { color: colors.textTertiary }]}>Loading your pipeline…</Text>
            </View>
        );
    }

    if (error) {
        // Silent fail — don't block Home over a pipeline glitch. Sentry will have captured it.
        return null;
    }

    const totalActionable = counts['at-risk'] + counts['this-week'] + counts.ready;
    if (totalActionable === 0) {
        return (
            <View style={[styles.emptyCard, { backgroundColor: colors.paperElevated, borderColor: colors.border }]}>
                <View style={[styles.emptyIcon, { backgroundColor: colors.successLight }]}>
                    <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Inbox zero on the pipeline.</Text>
                <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                    No one needs chasing today. Check back tomorrow or open Candidates to browse.
                </Text>
            </View>
        );
    }

    return (
        <View>
            <View style={styles.pipelineHeader}>
                <Text style={[styles.pipelineTitle, { color: colors.textPrimary }]}>Pipeline</Text>
                <Text style={[styles.pipelineMeta, { color: colors.textTertiary }]}>{totalActionable} need action</Text>
            </View>

            {buckets.map((b) => {
                if (b.total === 0) return null;
                const dotColor =
                    b.tintVar === 'danger' ? colors.danger : b.tintVar === 'warning' ? colors.warning : colors.success;
                const timeColor = b.tintVar === 'danger' ? colors.danger : colors.textTertiary;

                return (
                    <View
                        key={b.key}
                        style={[
                            styles.sectionCard,
                            { backgroundColor: colors.paperElevated, borderColor: colors.border },
                        ]}
                    >
                        <View style={[styles.sectionHead, { borderBottomColor: colors.borderLight }]}>
                            <View style={styles.sectionTitleRow}>
                                <View style={[styles.sectionDot, { backgroundColor: dotColor }]} />
                                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{b.title}</Text>
                                <Text style={[styles.sectionCount, { color: colors.textTertiary }]}>{b.total}</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => {
                                    pipelineAnalytics.homeSectionSeeAllTapped(b.key);
                                    onSeeAll();
                                }}
                                accessibilityRole="button"
                                accessibilityLabel={`See all ${b.title} candidates`}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <Text style={[styles.seeAll, { color: colors.accent }]}>See all →</Text>
                            </TouchableOpacity>
                        </View>

                        {b.rows.map((r, i) => {
                            const isFirst = i === 0;
                            return (
                                <TouchableOpacity
                                    key={r.candidate.id}
                                    style={[
                                        styles.row,
                                        !isFirst && {
                                            borderTopWidth: StyleSheet.hairlineWidth,
                                            borderTopColor: colors.borderLight,
                                        },
                                    ]}
                                    onPress={() => {
                                        pipelineAnalytics.homeRowTapped(r.candidate.id, r.nextStep.urgency);
                                        onCandidatePress(r.candidate.id);
                                    }}
                                    activeOpacity={0.7}
                                    accessibilityRole="button"
                                    accessibilityLabel={`${r.candidate.name}. ${r.nextStep.text}`}
                                >
                                    <View style={[styles.rowStripe, { backgroundColor: dotColor }]} />
                                    <View style={styles.rowBody}>
                                        <View style={styles.rowMetaLine}>
                                            <Text
                                                style={[styles.rowName, { color: colors.textTertiary }]}
                                                numberOfLines={1}
                                            >
                                                {r.candidate.name}
                                            </Text>
                                            {r.nextStep.signal && (
                                                <Text style={[styles.rowTime, { color: timeColor }]} numberOfLines={1}>
                                                    {r.nextStep.signal}
                                                </Text>
                                            )}
                                        </View>
                                        <Text style={[styles.rowNext, { color: colors.textPrimary }]} numberOfLines={2}>
                                            {r.nextStep.text}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                );
            })}
        </View>
    );
}

export default React.memo(HomePipelineSectionImpl);

const styles = StyleSheet.create({
    loadingCard: {
        marginHorizontal: 16,
        marginBottom: 12,
        padding: 18,
        borderRadius: 16,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    loadingText: {
        fontFamily: Fonts.sans,
        fontSize: 13,
        letterSpacing: letterSpacing(-0.1),
    },

    emptyCard: {
        marginHorizontal: 16,
        marginBottom: 12,
        padding: 18,
        borderRadius: 16,
        borderWidth: 1,
        alignItems: 'center',
    },
    emptyIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    emptyTitle: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 15,
        fontWeight: '600',
        letterSpacing: letterSpacing(-0.2),
        marginBottom: 4,
    },
    emptySub: {
        fontFamily: Fonts.sans,
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 18,
    },

    // Section header — "Pipeline" + "N need action" (sans per role rules).
    pipelineHeader: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    pipelineTitle: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: letterSpacing(-0.2),
    },
    pipelineMeta: {
        fontFamily: Fonts.sans,
        fontSize: 13,
        fontWeight: '500',
        letterSpacing: letterSpacing(-0.1),
    },

    sectionCard: {
        marginHorizontal: 16,
        marginBottom: 10,
        borderRadius: 16,
        borderWidth: 1,
        overflow: 'hidden',
    },
    sectionHead: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    sectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sectionDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
    },
    sectionTitle: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1.3,
        textTransform: 'uppercase',
    },
    sectionCount: {
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    seeAll: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: letterSpacing(-0.1),
    },

    row: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
    },
    rowStripe: {
        width: 2,
        borderRadius: 1,
        flexShrink: 0,
    },
    rowBody: {
        flex: 1,
        minWidth: 0,
    },
    rowMetaLine: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 10,
        marginBottom: 3,
    },
    rowName: {
        fontFamily: Fonts.sans,
        fontSize: 12.5,
        fontWeight: '500',
        letterSpacing: letterSpacing(-0.1),
        flex: 1,
    },
    rowTime: {
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: letterSpacing(-0.2),
        flexShrink: 0,
    },
    rowNext: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 15,
        fontWeight: '600',
        letterSpacing: letterSpacing(-0.2),
        lineHeight: 20,
    },
});
