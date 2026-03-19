import { letterSpacing } from '@/constants/platform';
import Avatar from '@/components/Avatar';
import ScreenHeader from '@/components/ScreenHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getTeamActivitySummaries } from '@/lib/activities';
import { getTeamPerformance, type TeamPerformanceResult } from '@/lib/team';
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

// ── Period helpers ───────────────────────────────────────────

type Period = 'week' | 'month' | 'quarter';

const PERIOD_LABELS: Record<Period, string> = {
    week: 'This Week',
    month: 'This Month',
    quarter: 'This Quarter',
};

function getDateRange(period: Period): { start: string; end: string } {
    const now = new Date();
    const end = now.toISOString();
    let start: Date;

    if (period === 'week') {
        start = new Date(now);
        const day = start.getDay();
        start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
    } else if (period === 'month') {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
        const q = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), q * 3, 1);
    }

    start.setHours(0, 0, 0, 0);
    return { start: start.toISOString(), end };
}

// ── Activity type config ─────────────────────────────────────

interface ActivityTypeConfig {
    label: string;
    icon: IconName;
}

const ACTIVITY_TYPES: Record<string, ActivityTypeConfig> = {
    call: { label: 'Calls', icon: 'call' },
    meeting: { label: 'Meetings', icon: 'calendar' },
    follow_up: { label: 'Follow-ups', icon: 'time' },
    note: { label: 'Notes', icon: 'create' },
    email: { label: 'Emails', icon: 'mail' },
    whatsapp: { label: 'WhatsApp', icon: 'logo-whatsapp' },
};

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
            {/* Period pills skeleton */}
            <View style={skeletonStyles.pillRow}>
                <SkeletonBlock width={80} height={36} />
                <SkeletonBlock width={80} height={36} />
                <SkeletonBlock width={80} height={36} />
            </View>
            {/* Hero stat cards skeleton */}
            <View style={skeletonStyles.heroRow}>
                <SkeletonBlock width="30%" height={100} style={{ borderRadius: 14 }} />
                <SkeletonBlock width="30%" height={100} style={{ borderRadius: 14 }} />
                <SkeletonBlock width="30%" height={100} style={{ borderRadius: 14 }} />
            </View>
            {/* Leaderboard skeleton */}
            <View style={[skeletonStyles.section, { backgroundColor: colors.cardBackground }]}>
                <SkeletonBlock width={160} height={22} style={{ marginBottom: 16 }} />
                <SkeletonBlock width="100%" height={56} style={{ marginBottom: 8 }} />
                <SkeletonBlock width="100%" height={56} style={{ marginBottom: 8 }} />
                <SkeletonBlock width="100%" height={56} />
            </View>
            {/* Activity breakdown skeleton */}
            <View style={[skeletonStyles.section, { backgroundColor: colors.cardBackground }]}>
                <SkeletonBlock width={180} height={22} style={{ marginBottom: 16 }} />
                <SkeletonBlock width="100%" height={32} style={{ marginBottom: 8 }} />
                <SkeletonBlock width="80%" height={32} style={{ marginBottom: 8 }} />
                <SkeletonBlock width="60%" height={32} style={{ marginBottom: 8 }} />
                <SkeletonBlock width="40%" height={32} />
            </View>
        </View>
    );
}

const skeletonStyles = StyleSheet.create({
    container: { paddingHorizontal: 16, paddingTop: 16 },
    pillRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
    heroRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
    section: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
});

// ── Animated Counter ─────────────────────────────────────────

function AnimatedCounter({ value, suffix = '', style }: { value: number; suffix?: string; style?: object }) {
    const animValue = useSharedValue(0);
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        animValue.value = 0;
        animValue.value = withTiming(value, { duration: 800 });
    }, [value, animValue]);

    // Poll the animated value to update display
    useEffect(() => {
        let frame: ReturnType<typeof requestAnimationFrame>;
        let startTime: number;
        const duration = 800;

        const animate = (ts: number) => {
            if (!startTime) startTime = ts;
            const progress = Math.min((ts - startTime) / duration, 1);
            setDisplayValue(Math.round(progress * value));
            if (progress < 1) {
                frame = requestAnimationFrame(animate);
            }
        };
        frame = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(frame);
    }, [value]);

    return (
        <Text style={style}>
            {displayValue}
            {suffix}
        </Text>
    );
}

// ── Empty State ──────────────────────────────────────────────

function EmptyState() {
    const { colors } = useTheme();
    return (
        <View style={emptyStyles.container}>
            <View style={[emptyStyles.iconContainer, { backgroundColor: colors.surfacePrimary }]}>
                <Ionicons name="analytics" size={48} color={colors.textTertiary} />
            </View>
            <Text style={[emptyStyles.title, { color: colors.textPrimary }]}>No analytics yet</Text>
            <Text style={[emptyStyles.subtitle, { color: colors.textSecondary }]}>
                Once your team starts logging activities and closing leads, analytics will appear here.
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

// ── Main Screen ──────────────────────────────────────────────

export default function AnalyticsScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();

    const [period, setPeriod] = useState<Period>('week');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [performance, setPerformance] = useState<TeamPerformanceResult | null>(null);
    const [teamActivities, setTeamActivities] = useState<{ type: string; count: number }[]>([]);

    const dateRange = useMemo(() => getDateRange(period), [period]);

    const loadData = useCallback(async () => {
        if (!user?.id) return;
        try {
            // Fetch team performance
            const perfResult = await getTeamPerformance(user.id, dateRange);

            if (perfResult.data) {
                setPerformance(perfResult.data);

                // Aggregate activities across all agents in a single query
                const agentIds = perfResult.data.agents.map((a) => a.agentId);
                const activitiesResult = await getTeamActivitySummaries(agentIds, dateRange);

                // Merge all byType arrays
                const typeCounts: Record<string, number> = {};
                (activitiesResult.data || []).forEach((summary) => {
                    summary.byType.forEach((bt) => {
                        typeCounts[bt.type] = (typeCounts[bt.type] || 0) + bt.count;
                    });
                });

                const aggregated = Object.entries(typeCounts)
                    .map(([type, count]) => ({ type, count }))
                    .sort((a, b) => b.count - a.count);

                setTeamActivities(aggregated);
            }
        } catch {
            // Error handled silently — empty state shown
        } finally {
            setLoading(false);
        }
    }, [user?.id, dateRange]);

    useEffect(() => {
        setLoading(true);
        loadData();
    }, [loadData]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    }, [loadData]);

    // Derived stats
    const totalLeads = useMemo(() => {
        if (!performance) return 0;
        return performance.agents.reduce((sum, a) => sum + a.leadsClosed, 0);
    }, [performance]);

    const conversionRate = useMemo(() => {
        if (!performance) return 0;
        const totalWon = performance.agents.reduce((sum, a) => sum + a.leadsWon, 0);
        const totalClosed = performance.agents.reduce((sum, a) => sum + a.leadsClosed, 0);
        return totalClosed > 0 ? Math.round((totalWon / totalClosed) * 100) : 0;
    }, [performance]);

    const totalActivitiesThisWeek = useMemo(() => {
        if (!performance) return 0;
        return performance.totalActivities;
    }, [performance]);

    const sortedAgents = useMemo(() => {
        if (!performance) return [];
        return [...performance.agents].sort((a, b) => {
            const aRate = a.leadsClosed > 0 ? (a.leadsWon / a.leadsClosed) * 100 : 0;
            const bRate = b.leadsClosed > 0 ? (b.leadsWon / b.leadsClosed) * 100 : 0;
            return bRate - aRate;
        });
    }, [performance]);

    const maxActivityCount = useMemo(() => {
        if (teamActivities.length === 0) return 1;
        return Math.max(...teamActivities.map((a) => a.count), 1);
    }, [teamActivities]);

    const isEmpty = !loading && (!performance || performance.agents.length === 0);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <ScreenHeader title="Analytics" showBack backLabel="Home" />

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
                    {/* Period Selector */}
                    <Animated.View entering={FadeInDown.delay(0).duration(400).springify()} style={styles.periodRow}>
                        {(['week', 'month', 'quarter'] as Period[]).map((p) => {
                            const isActive = period === p;
                            return (
                                <View
                                    key={p}
                                    style={[
                                        styles.periodPill,
                                        {
                                            backgroundColor: isActive ? colors.accent : colors.cardBackground,
                                        },
                                    ]}
                                    accessible
                                    accessibilityRole="button"
                                    accessibilityLabel={PERIOD_LABELS[p]}
                                >
                                    <Text
                                        style={[
                                            styles.periodPillText,
                                            { color: isActive ? colors.textInverse : colors.textSecondary },
                                        ]}
                                        onPress={() => setPeriod(p)}
                                    >
                                        {PERIOD_LABELS[p]}
                                    </Text>
                                </View>
                            );
                        })}
                    </Animated.View>

                    {/* Hero Stat Cards */}
                    <View style={styles.heroRow}>
                        {[
                            { label: 'Total Leads', value: totalLeads, icon: 'briefcase' as const },
                            { label: 'Conversion', value: conversionRate, icon: 'trending-up' as const, suffix: '%' },
                            {
                                label: 'Activities',
                                value: totalActivitiesThisWeek,
                                icon: 'pulse' as const,
                            },
                        ].map((stat, index) => (
                            <Animated.View
                                key={stat.label}
                                entering={FadeInDown.delay(index * 50 + 50)
                                    .duration(400)
                                    .springify()}
                                style={[
                                    styles.heroStatCard,
                                    {
                                        backgroundColor: colors.cardBackground,
                                        shadowColor: colors.textPrimary,
                                    },
                                ]}
                            >
                                <View style={[styles.heroStatIconWrap, { backgroundColor: colors.accentLight }]}>
                                    <Ionicons name={stat.icon} size={18} color={colors.accent} />
                                </View>
                                <AnimatedCounter
                                    value={stat.value}
                                    suffix={stat.suffix || ''}
                                    style={[styles.heroStatValue, { color: colors.textPrimary }]}
                                />
                                <Text style={[styles.heroStatLabel, { color: colors.textTertiary }]}>{stat.label}</Text>
                            </Animated.View>
                        ))}
                    </View>

                    {/* Agent Leaderboard */}
                    {sortedAgents.length > 0 && (
                        <Animated.View
                            entering={FadeInDown.delay(200).duration(400).springify()}
                            style={[
                                styles.card,
                                {
                                    backgroundColor: colors.cardBackground,
                                    shadowColor: colors.textPrimary,
                                },
                            ]}
                        >
                            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Agent Leaderboard</Text>
                            {sortedAgents.map((agent, index) => {
                                const rate =
                                    agent.leadsClosed > 0 ? Math.round((agent.leadsWon / agent.leadsClosed) * 100) : 0;
                                return (
                                    <Animated.View
                                        key={agent.agentId}
                                        entering={FadeInDown.delay(250 + index * 50)
                                            .duration(400)
                                            .springify()}
                                        style={styles.leaderRow}
                                    >
                                        <Text style={[styles.leaderRank, { color: colors.textTertiary }]}>
                                            {index + 1}
                                        </Text>
                                        <Avatar
                                            name={agent.agentName}
                                            size={36}
                                            backgroundColor={colors.accentLight}
                                            textColor={colors.accent}
                                        />
                                        <View style={styles.leaderInfo}>
                                            <Text
                                                style={[styles.leaderName, { color: colors.textPrimary }]}
                                                numberOfLines={1}
                                            >
                                                {agent.agentName}
                                            </Text>
                                            <View style={styles.leaderMeta}>
                                                <Text style={[styles.leaderMetaText, { color: colors.textTertiary }]}>
                                                    {agent.leadsClosed} leads
                                                </Text>
                                                <Text style={[styles.leaderMetaText, { color: colors.textTertiary }]}>
                                                    {agent.leadsWon} won
                                                </Text>
                                            </View>
                                            <View style={styles.leaderBarContainer}>
                                                <View
                                                    style={[
                                                        styles.leaderBarBg,
                                                        { backgroundColor: colors.borderLight },
                                                    ]}
                                                >
                                                    <View
                                                        style={[
                                                            styles.leaderBarFill,
                                                            {
                                                                width: `${rate}%`,
                                                                backgroundColor:
                                                                    rate >= 60
                                                                        ? colors.success
                                                                        : rate >= 30
                                                                          ? colors.warning
                                                                          : colors.danger,
                                                            },
                                                        ]}
                                                    />
                                                </View>
                                            </View>
                                        </View>
                                        <Text style={[styles.leaderRate, { color: colors.accent }]}>{rate}%</Text>
                                    </Animated.View>
                                );
                            })}
                        </Animated.View>
                    )}

                    {/* Activity Breakdown */}
                    {teamActivities.length > 0 && (
                        <Animated.View
                            entering={FadeInDown.delay(350).duration(400).springify()}
                            style={[
                                styles.card,
                                {
                                    backgroundColor: colors.cardBackground,
                                    shadowColor: colors.textPrimary,
                                },
                            ]}
                        >
                            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Activity Breakdown</Text>
                            {teamActivities.map((activity, index) => {
                                const config = ACTIVITY_TYPES[activity.type];
                                const barWidth = (activity.count / maxActivityCount) * 100;
                                const barColor =
                                    index === 0
                                        ? colors.accent
                                        : index === 1
                                          ? colors.info
                                          : index === 2
                                            ? colors.warning
                                            : colors.success;
                                return (
                                    <Animated.View
                                        key={activity.type}
                                        entering={FadeInDown.delay(400 + index * 50)
                                            .duration(400)
                                            .springify()}
                                        style={styles.activityBarRow}
                                    >
                                        <View style={styles.activityBarLabel}>
                                            <Ionicons name={config?.icon || 'ellipse'} size={16} color={barColor} />
                                            <Text
                                                style={[styles.activityBarLabelText, { color: colors.textSecondary }]}
                                            >
                                                {config?.label || activity.type}
                                            </Text>
                                        </View>
                                        <View style={styles.activityBarTrack}>
                                            <View
                                                style={[
                                                    styles.activityBarTrackBg,
                                                    { backgroundColor: colors.borderLight },
                                                ]}
                                            >
                                                <View
                                                    style={[
                                                        styles.activityBarFill,
                                                        {
                                                            width: `${barWidth}%`,
                                                            backgroundColor: barColor,
                                                        },
                                                    ]}
                                                />
                                            </View>
                                            <Text style={[styles.activityBarCount, { color: colors.textPrimary }]}>
                                                {activity.count}
                                            </Text>
                                        </View>
                                    </Animated.View>
                                );
                            })}
                        </Animated.View>
                    )}

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

    // Period Selector
    periodRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        gap: 8,
        marginBottom: 24,
    },
    periodPill: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        minWidth: 44,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    periodPillText: {
        fontSize: 13,
        fontWeight: '600',
    },

    // Hero Stat Cards
    heroRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        gap: 8,
        marginBottom: 24,
    },
    heroStatCard: {
        flex: 1,
        borderRadius: 14,
        padding: 16,
        alignItems: 'center',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    heroStatIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    heroStatValue: {
        fontSize: 28,
        fontWeight: '700',
        letterSpacing: letterSpacing(-1),
        marginBottom: 4,
    },
    heroStatLabel: {
        fontSize: 11,
        fontWeight: '500',
    },

    // Shared Card
    card: {
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 16,
        padding: 16,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 16,
        letterSpacing: letterSpacing(-0.3),
    },

    // Leaderboard
    leaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
    },
    leaderRank: {
        fontSize: 15,
        fontWeight: '600',
        width: 20,
        textAlign: 'center',
    },
    leaderInfo: {
        flex: 1,
    },
    leaderName: {
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 2,
        letterSpacing: letterSpacing(-0.3),
    },
    leaderMeta: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 4,
    },
    leaderMetaText: {
        fontSize: 11,
        fontWeight: '500',
    },
    leaderBarContainer: {
        marginTop: 4,
    },
    leaderBarBg: {
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
    },
    leaderBarFill: {
        height: 6,
        borderRadius: 3,
    },
    leaderRate: {
        fontSize: 15,
        fontWeight: '700',
        minWidth: 40,
        textAlign: 'right',
    },

    // Activity Breakdown
    activityBarRow: {
        marginBottom: 16,
    },
    activityBarLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    activityBarLabelText: {
        fontSize: 13,
        fontWeight: '500',
    },
    activityBarTrack: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    activityBarTrackBg: {
        flex: 1,
        height: 24,
        borderRadius: 12,
        overflow: 'hidden',
    },
    activityBarFill: {
        height: 24,
        borderRadius: 12,
    },
    activityBarCount: {
        fontSize: 13,
        fontWeight: '700',
        minWidth: 24,
        textAlign: 'right',
    },
});
