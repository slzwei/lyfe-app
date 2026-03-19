import { letterSpacing } from '@/constants/platform';
import ScreenHeader from '@/components/ScreenHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { CANDIDATE_STATUS_CONFIG, type CandidateStatus } from '@/types/recruitment';
import type { IconName } from '@/types/ui';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { type DimensionValue, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
    FadeInDown,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';
import { fetchCandidateStatusCounts } from '@/lib/recruitment/candidates';

// ── Pipeline stages (subset for funnel) ──────────────────────

interface FunnelStage {
    key: CandidateStatus;
    label: string;
    icon: IconName;
    count: number;
}

const FUNNEL_STAGES: { key: CandidateStatus; label: string; icon: IconName }[] = [
    { key: 'applied', label: 'Applied', icon: 'person-add' },
    { key: 'interview_scheduled', label: 'Interview', icon: 'calendar' },
    { key: 'approved', label: 'Approved', icon: 'shield-checkmark' },
    { key: 'exam_prep', label: 'Exam Prep', icon: 'school' },
    { key: 'active_agent', label: 'Onboarded', icon: 'star' },
];

// ── Skeleton Loader ──────────────────────────────────────────

function SkeletonBlock({ width, height, style }: { width: number | string; height: number; style?: object }) {
    const { colors } = useTheme();
    const opacity = useSharedValue(0.3);

    useEffect(() => {
        opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
    }, [opacity]);

    const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

    return (
        <Animated.View
            style={[
                {
                    width: width as DimensionValue,
                    height,
                    borderRadius: 12,
                    backgroundColor: colors.borderLight,
                },
                animStyle,
                style,
            ]}
        />
    );
}

function SkeletonLoader() {
    const { colors } = useTheme();
    return (
        <View style={skeletonStyles.container}>
            {[0, 1, 2, 3, 4].map((i) => (
                <View key={i} style={[skeletonStyles.stageCard, { backgroundColor: colors.cardBackground }]}>
                    <SkeletonBlock width={40} height={40} style={{ borderRadius: 20 }} />
                    <View style={skeletonStyles.stageInfo}>
                        <SkeletonBlock width={100} height={18} style={{ marginBottom: 8 }} />
                        <SkeletonBlock width="100%" height={24} />
                    </View>
                </View>
            ))}
        </View>
    );
}

const skeletonStyles = StyleSheet.create({
    container: { paddingHorizontal: 16, paddingTop: 16 },
    stageCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        padding: 16,
        borderRadius: 16,
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    stageInfo: { flex: 1 },
});

// ── Empty State ──────────────────────────────────────────────

function EmptyState() {
    const { colors } = useTheme();
    return (
        <View style={emptyStyles.container}>
            <View style={[emptyStyles.iconContainer, { backgroundColor: colors.surfacePrimary }]}>
                <Ionicons name="funnel" size={48} color={colors.textTertiary} />
            </View>
            <Text style={[emptyStyles.title, { color: colors.textPrimary }]}>No candidates yet</Text>
            <Text style={[emptyStyles.subtitle, { color: colors.textSecondary }]}>
                Start recruiting candidates to see your pipeline funnel here.
            </Text>
        </View>
    );
}

const emptyStyles = StyleSheet.create({
    container: { alignItems: 'center', paddingHorizontal: 32, paddingVertical: 48 },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    title: { fontSize: 18, fontWeight: '700', marginBottom: 8, letterSpacing: letterSpacing(-0.3) },
    subtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
});

// ── Animated Bar ─────────────────────────────────────────────

function AnimatedBar({ widthPercent, color }: { widthPercent: number; color: string }) {
    const barWidth = useSharedValue(0);

    useEffect(() => {
        barWidth.value = withTiming(widthPercent, { duration: 800 });
    }, [widthPercent, barWidth]);

    const animStyle = useAnimatedStyle(() => ({
        width: `${barWidth.value}%` as DimensionValue,
    }));

    return <Animated.View style={[barStyles.fill, { backgroundColor: color }, animStyle]} />;
}

const barStyles = StyleSheet.create({
    fill: {
        height: 24,
        borderRadius: 12,
        minWidth: 8,
    },
});

// ── Funnel Stage Card ────────────────────────────────────────

function FunnelStageCard({
    stage,
    index,
    conversionToNext,
    maxCount,
}: {
    stage: FunnelStage;
    index: number;
    conversionToNext: number | null;
    maxCount: number;
}) {
    const { colors } = useTheme();

    const statusConfig = CANDIDATE_STATUS_CONFIG[stage.key];
    const barPercent = maxCount > 0 ? (stage.count / maxCount) * 100 : 0;

    return (
        <>
            <Animated.View
                entering={FadeInDown.delay(index * 50)
                    .duration(400)
                    .springify()}
            >
                <View
                    style={[
                        cardStyles.container,
                        {
                            backgroundColor: colors.cardBackground,
                            shadowColor: colors.textPrimary,
                        },
                    ]}
                    accessibilityLabel={`${stage.label}: ${stage.count} candidates`}
                >
                    <View style={cardStyles.topRow}>
                        <View style={[cardStyles.iconCircle, { backgroundColor: colors.accentLight }]}>
                            <Ionicons name={stage.icon} size={20} color={colors.accent} />
                        </View>
                        <View style={cardStyles.labelWrap}>
                            <Text style={[cardStyles.label, { color: colors.textPrimary }]}>{stage.label}</Text>
                            <Text style={[cardStyles.count, { color: colors.textTertiary }]}>
                                {stage.count} candidate{stage.count !== 1 ? 's' : ''}
                            </Text>
                        </View>
                        <Text style={[cardStyles.bigCount, { color: colors.accent }]}>{stage.count}</Text>
                    </View>
                    <View style={[cardStyles.barTrack, { backgroundColor: colors.borderLight }]}>
                        <AnimatedBar
                            widthPercent={Math.max(barPercent, stage.count > 0 ? 5 : 0)}
                            color={statusConfig.color}
                        />
                    </View>
                </View>
            </Animated.View>
            {conversionToNext !== null && (
                <Animated.View
                    entering={FadeInDown.delay(index * 50 + 25)
                        .duration(400)
                        .springify()}
                    style={cardStyles.conversionRow}
                >
                    <Ionicons name="arrow-down" size={16} color={colors.textTertiary} />
                    <Text style={[cardStyles.conversionText, { color: colors.textTertiary }]}>
                        {conversionToNext}% conversion
                    </Text>
                </Animated.View>
            )}
        </>
    );
}

const cardStyles = StyleSheet.create({
    container: {
        borderRadius: 16,
        padding: 16,
        marginHorizontal: 16,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    labelWrap: { flex: 1 },
    label: { fontSize: 15, fontWeight: '600', letterSpacing: letterSpacing(-0.3) },
    count: { fontSize: 11, fontWeight: '500', marginTop: 2 },
    bigCount: { fontSize: 28, fontWeight: '700', letterSpacing: letterSpacing(-1) },
    barTrack: {
        height: 24,
        borderRadius: 12,
        overflow: 'hidden',
    },
    conversionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingVertical: 4,
    },
    conversionText: {
        fontSize: 11,
        fontWeight: '500',
    },
});

// ── Main Screen ──────────────────────────────────────────────

export default function PipelineScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stageCounts, setStageCounts] = useState<Record<string, number>>({});

    const loadData = useCallback(async () => {
        if (!user?.id) return;
        try {
            const { data, error } = await fetchCandidateStatusCounts(user.id);

            if (!error && data) {
                const counts: Record<string, number> = {};
                data.forEach((c) => {
                    counts[c.status] = (counts[c.status] || 0) + 1;
                });
                setStageCounts(counts);
            }
        } catch {
            // handled silently
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    }, [loadData]);

    const funnelData: FunnelStage[] = useMemo(() => {
        return FUNNEL_STAGES.map((s) => ({
            ...s,
            count: stageCounts[s.key] || 0,
        }));
    }, [stageCounts]);

    const maxCount = useMemo(() => Math.max(...funnelData.map((s) => s.count), 1), [funnelData]);
    const totalCandidates = useMemo(() => funnelData.reduce((sum, s) => sum + s.count, 0), [funnelData]);

    const isEmpty = !loading && totalCandidates === 0;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <ScreenHeader title="Candidate Pipeline" showBack backLabel="Home" />

            {loading && !refreshing ? (
                <SkeletonLoader />
            ) : isEmpty ? (
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
                    }
                >
                    <EmptyState />
                </ScrollView>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
                    }
                >
                    {/* Summary */}
                    <Animated.View entering={FadeInDown.delay(0).duration(400).springify()} style={styles.summaryRow}>
                        <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
                            {totalCandidates} total candidate{totalCandidates !== 1 ? 's' : ''} in pipeline
                        </Text>
                    </Animated.View>

                    {/* Funnel Stages */}
                    {funnelData.map((stage, index) => {
                        const nextStage = funnelData[index + 1];
                        const conversionToNext =
                            nextStage && stage.count > 0 ? Math.round((nextStage.count / stage.count) * 100) : null;

                        return (
                            <FunnelStageCard
                                key={stage.key}
                                stage={stage}
                                index={index}
                                conversionToNext={conversionToNext}
                                maxCount={maxCount}
                            />
                        );
                    })}

                    {/* Bottom Padding */}
                    <View style={styles.bottomPadding} />
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

// ── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { paddingTop: 8 },
    bottomPadding: { height: 48 },
    summaryRow: {
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    summaryText: {
        fontSize: 15,
        fontWeight: '400',
    },
});
