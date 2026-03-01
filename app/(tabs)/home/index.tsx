import ScreenHeader from '@/components/ScreenHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useViewMode } from '@/contexts/ViewModeContext';
import { fetchLeadStats, fetchRecentActivities, type LeadPipelineStats } from '@/lib/leads';
import { STATUS_CONFIG, type LeadStatus } from '@/types/lead';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const MOCK_OTP = process.env.EXPO_PUBLIC_MOCK_OTP === 'true';

// ── Mock Data — Agent View ──
const AGENT_STATS = {
    totalLeads: 8,
    newThisWeek: 3,
    conversionRate: 25,
    activeFollowUps: 4,
};

// ── Mock Data — Manager View ──
const MANAGER_STATS = {
    teamLeads: 24,
    activeCandidates: 6,
    agentsManaged: 4,
    pendingInterviews: 3,
};

const MOCK_ACTIVITIES = [
    { id: '1', type: 'status_change' as const, leadName: 'Sarah Tan', detail: 'New \u2192 Contacted', time: '2h ago', icon: 'swap-horizontal' as const },
    { id: '2', type: 'note' as const, leadName: 'David Lim', detail: 'Added follow-up note', time: '3h ago', icon: 'create' as const },
    { id: '3', type: 'call' as const, leadName: 'Amanda Lee', detail: 'Outbound call (5 min)', time: '5h ago', icon: 'call' as const },
    { id: '4', type: 'new_lead' as const, leadName: 'Michael Wong', detail: 'New lead from referral', time: '1d ago', icon: 'person-add' as const },
    { id: '5', type: 'status_change' as const, leadName: 'Jessica Ng', detail: 'Proposed \u2192 Won', time: '2d ago', icon: 'trophy' as const },
];

const MANAGER_ACTIVITIES = [
    { id: '1', type: 'candidate' as const, leadName: 'Jason Teo', detail: 'Applied to join team', time: '1h ago', icon: 'person-add' as const },
    { id: '2', type: 'reassign' as const, leadName: 'Sarah Tan', detail: 'Lead reassigned to Alice', time: '3h ago', icon: 'swap-horizontal' as const },
    { id: '3', type: 'interview' as const, leadName: 'Priya Sharma', detail: 'Interview completed', time: '5h ago', icon: 'checkmark-circle' as const },
    { id: '4', type: 'exam' as const, leadName: 'Wei Ming Chen', detail: 'Exam Prep started', time: '1d ago', icon: 'school' as const },
];

const LEAD_PIPELINE: { status: LeadStatus; count: number }[] = [
    { status: 'new', count: 2 },
    { status: 'contacted', count: 2 },
    { status: 'qualified', count: 1 },
    { status: 'proposed', count: 2 },
    { status: 'won', count: 1 },
    { status: 'lost', count: 0 },
];

function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
}

export default function HomeScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const { viewMode, canToggle } = useViewMode();
    const router = useRouter();
    const [refreshing, setRefreshing] = useState(false);
    const isManagerView = canToggle && viewMode === 'manager';

    // Real data state
    const [stats, setStats] = useState<LeadPipelineStats | null>(null);
    const [recentActivities, setRecentActivities] = useState<any[]>([]);

    const greeting = useMemo(() => getGreeting(), []);
    const firstName = user?.full_name?.split(' ')[0] || 'there';

    const loadDashboardData = useCallback(async () => {
        if (MOCK_OTP || !user?.id) return;
        const [statsResult, activitiesResult] = await Promise.all([
            fetchLeadStats(user.id, isManagerView),
            fetchRecentActivities(user.id, isManagerView, 5),
        ]);
        if (statsResult.data) setStats(statsResult.data);
        if (activitiesResult.data) setRecentActivities(activitiesResult.data);
    }, [user?.id, isManagerView]);

    useEffect(() => {
        loadDashboardData();
    }, [loadDashboardData]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadDashboardData();
        setRefreshing(false);
    }, [loadDashboardData]);

    // Use real stats or mock fallback
    const agentStats = stats || AGENT_STATS;
    const pipeline = stats?.pipeline || LEAD_PIPELINE;

    const totalPipeline = pipeline.reduce((n, s) => n + s.count, 0);

    const role = user?.role;
    const isCandidate = role === 'candidate';

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
                }
            >
                {/* Header */}
                <ScreenHeader
                    greeting={greeting}
                    title={firstName}
                    rightAction={
                        <TouchableOpacity
                            style={[styles.avatarCircle, { backgroundColor: colors.accentLight }]}
                            onPress={() => router.push('/(tabs)/profile' as any)}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.avatarText, { color: colors.accent }]}>
                                {user?.full_name?.charAt(0)?.toUpperCase() || '?'}
                            </Text>
                        </TouchableOpacity>
                    }
                />

                {/* Hero Stats */}
                <View style={styles.heroStatsContainer}>
                    {isCandidate ? (
                        <>
                            <View style={styles.statsRow}>
                                <View style={[styles.heroCardPrimary, { backgroundColor: '#FF9500' }]}>
                                    <Ionicons name="school" size={80} color="rgba(255,255,255,0.15)" style={styles.heroIconBg} />
                                    <Text style={[styles.heroStatValue, { color: '#FFFFFF' }]}>2</Text>
                                    <Text style={[styles.heroStatLabel, { color: 'rgba(255,255,255,0.9)' }]}>Exams to Pass</Text>
                                </View>
                                <View style={styles.statsColumn}>
                                    <StatCardSmall label="Stage" value="Exam Prep" colors={colors} />
                                    <StatCardSmall label="Days Left" value="45" colors={colors} />
                                </View>
                            </View>
                        </>
                    ) : isManagerView ? (
                        <>
                            <View style={styles.statsRow}>
                                <View style={[styles.heroCardPrimary, { backgroundColor: colors.accent }]}>
                                    <Ionicons name="people" size={80} color="rgba(255,255,255,0.15)" style={styles.heroIconBg} />
                                    <Text style={[styles.heroStatValue, { color: '#FFFFFF' }]}>{isManagerView ? (stats?.totalLeads || MANAGER_STATS.teamLeads) : 0}</Text>
                                    <Text style={[styles.heroStatLabel, { color: 'rgba(255,255,255,0.9)' }]}>Team Leads</Text>
                                </View>
                                <View style={styles.statsColumn}>
                                    <StatCardSmall label="Candidates" value={(MANAGER_STATS.activeCandidates).toString()} colors={colors} />
                                    <StatCardSmall label="Agents" value={(MANAGER_STATS.agentsManaged).toString()} colors={colors} />
                                </View>
                            </View>
                        </>
                    ) : (
                        <>
                            <View style={styles.statsRow}>
                                <View style={[styles.heroCardPrimary, { backgroundColor: colors.accent }]}>
                                    <Ionicons name="briefcase" size={80} color="rgba(255,255,255,0.15)" style={styles.heroIconBg} />
                                    <Text style={[styles.heroStatValue, { color: '#FFFFFF' }]}>{agentStats.totalLeads}</Text>
                                    <Text style={[styles.heroStatLabel, { color: 'rgba(255,255,255,0.9)' }]}>Total Leads</Text>
                                </View>
                                <View style={styles.statsColumn}>
                                    <StatCardSmall label="New Leads" value={agentStats.newThisWeek.toString()} colors={colors} />
                                    <StatCardSmall label="Conversion" value={`${agentStats.conversionRate}%`} colors={colors} />
                                </View>
                            </View>
                        </>
                    )}
                </View>

                {/* Quick Actions */}
                <View style={[styles.section, styles.quickActionsSection]}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Quick Actions</Text>
                    <View style={styles.quickActionsGrid}>
                        {isCandidate ? (
                            <>
                                <QuickActionBtn icon="school" label="Exams" colors={colors} onPress={() => router.push('/(tabs)/exams' as any)} />
                                <QuickActionBtn icon="book" label="Study" colors={colors} onPress={() => router.push('/(tabs)/exams/study' as any)} />
                                <QuickActionBtn icon="help-circle" label="Support" colors={colors} onPress={() => { }} />
                                <QuickActionBtn icon="person" label="Profile" colors={colors} onPress={() => router.push('/(tabs)/profile' as any)} />
                            </>
                        ) : isManagerView ? (
                            <>
                                <QuickActionBtn icon="briefcase" label="Team" colors={colors} onPress={() => router.push('/(tabs)/team' as any)} />
                                <QuickActionBtn icon="people" label="Leads" colors={colors} onPress={() => router.push('/(tabs)/leads' as any)} />
                                <QuickActionBtn icon="document-text" label="Candidates" colors={colors} onPress={() => router.push('/(tabs)/candidates' as any)} />
                                <QuickActionBtn icon="person" label="Profile" colors={colors} onPress={() => router.push('/(tabs)/profile' as any)} />
                            </>
                        ) : (
                            <>
                                <QuickActionBtn icon="person-add" label="Add Lead" colors={colors} onPress={() => router.push('/(tabs)/leads/add' as any)} />
                                <QuickActionBtn icon="list" label="All Leads" colors={colors} onPress={() => router.push('/(tabs)/leads' as any)} />
                                <QuickActionBtn icon="calendar" label="Follow-ups" colors={colors} onPress={() => { }} />
                                <QuickActionBtn icon="person" label="Profile" colors={colors} onPress={() => router.push('/(tabs)/profile' as any)} />
                            </>
                        )}
                    </View>
                </View>

                {/* Lead Pipeline — hidden for candidates */}
                {!isCandidate && (
                    <View style={[styles.card, { backgroundColor: colors.cardBackground, shadowColor: colors.textPrimary }]}>
                        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Lead Pipeline</Text>
                        <View style={styles.pipelineWrapper}>
                            <View style={styles.pipelineBar}>
                                {pipeline.filter(s => s.count > 0).map((seg) => (
                                    <View
                                        key={seg.status}
                                        style={[
                                            styles.pipelineSegment,
                                            {
                                                flex: seg.count / totalPipeline,
                                                backgroundColor: STATUS_CONFIG[seg.status].color,
                                            },
                                        ]}
                                    />
                                ))}
                            </View>
                        </View>
                        <View style={styles.pipelineLegend}>
                            {pipeline.map((seg) => {
                                if (seg.count === 0) return null;
                                return (
                                    <View key={seg.status} style={[styles.legendChip, { backgroundColor: colors.background }]}>
                                        <View style={[styles.legendDot, { backgroundColor: STATUS_CONFIG[seg.status].color }]} />
                                        <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>
                                            {STATUS_CONFIG[seg.status].label}
                                        </Text>
                                        <Text style={[styles.legendCount, { color: colors.textPrimary }]}>{seg.count}</Text>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                )}

                {/* Recent Activity — hidden for candidates */}
                {!isCandidate && (
                    <View style={[styles.card, { backgroundColor: colors.cardBackground, shadowColor: colors.textPrimary }]}>
                        <View style={styles.sectionHeaderRow}>
                            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Recent Activity</Text>
                            <TouchableOpacity>
                                <Text style={[styles.seeAllText, { color: colors.accent }]}>See All</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.activityFeed}>
                            {(isManagerView ? MANAGER_ACTIVITIES : MOCK_ACTIVITIES).map((activity, index) => (
                                <View key={activity.id} style={styles.activityRow}>
                                    <View style={[styles.activityIconCircle, { backgroundColor: colors.accent + '15' }]}>
                                        <Ionicons name={activity.icon as any} size={18} color={colors.accent} />
                                    </View>
                                    <View style={styles.activityContent}>
                                        <Text style={[styles.activityLeadName, { color: colors.textPrimary }]}>{activity.leadName}</Text>
                                        <Text style={[styles.activityDetail, { color: colors.textSecondary }]}>{activity.detail}</Text>
                                    </View>
                                    <Text style={[styles.activityTime, { color: colors.textTertiary }]}>{activity.time}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

// ── Sub-Components ──

function StatCardSmall({ label, value, colors }: { label: string; value: string; colors: any }) {
    return (
        <View style={[styles.statCardSmall, { backgroundColor: colors.cardBackground, shadowColor: colors.textPrimary }]}>
            <Text style={[styles.statValueSmall, { color: colors.textPrimary }]}>{value}</Text>
            <Text style={[styles.statLabelSmall, { color: colors.textTertiary }]}>{label}</Text>
        </View>
    );
}

function QuickActionBtn({ icon, label, colors, onPress }: { icon: string; label: string; colors: any; onPress: () => void }) {
    return (
        <TouchableOpacity style={[styles.quickActionSurface, { backgroundColor: colors.cardBackground, shadowColor: colors.textPrimary }]} onPress={onPress} activeOpacity={0.7}>
            <View style={[styles.quickActionIconWrapper, { backgroundColor: colors.accent + '12' }]}>
                <Ionicons name={icon as any} size={22} color={colors.accent} />
            </View>
            <Text style={[styles.quickActionLabel, { color: colors.textPrimary }]}>{label}</Text>
        </TouchableOpacity>
    );
}

// ── Styles ──
const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { paddingBottom: 40 },

    // Header
    avatarCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: { fontSize: 18, fontWeight: '700' },

    // Shared Section Styles
    section: {
        marginHorizontal: 16,
        marginBottom: 20,
    },
    sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    seeAllText: { fontSize: 14, fontWeight: '600' },

    // Card Standard
    card: {
        marginHorizontal: 16,
        marginBottom: 20,
        borderRadius: 20,
        padding: 20,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 2,
    },

    // Hero Stats (Staggered Layout)
    heroStatsContainer: {
        paddingHorizontal: 16,
        marginBottom: 20,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    heroCardPrimary: {
        flex: 1.2,
        borderRadius: 24,
        padding: 20,
        justifyContent: 'flex-end',
        position: 'relative',
        overflow: 'hidden',
        minHeight: 160,
    },
    heroIconBg: {
        position: 'absolute',
        top: -10,
        right: -10,
        transform: [{ rotate: '15deg' }],
    },
    heroStatValue: { fontSize: 40, fontWeight: '800', marginBottom: 4, letterSpacing: -1 },
    heroStatLabel: { fontSize: 15, fontWeight: '500' },

    statsColumn: {
        flex: 1,
        gap: 12,
    },
    statCardSmall: {
        flex: 1,
        borderRadius: 16,
        padding: 16,
        justifyContent: 'center',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
        elevation: 1,
    },
    statValueSmall: { fontSize: 22, fontWeight: '700', marginBottom: 2 },
    statLabelSmall: { fontSize: 13, fontWeight: '500' },

    // Quick Actions
    quickActionsSection: {
        marginTop: 4,
    },
    quickActionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    quickActionSurface: {
        flex: 1,
        minWidth: '45%',
        borderRadius: 16,
        alignItems: 'center',
        paddingVertical: 14,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 6,
        elevation: 1,
    },
    quickActionIconWrapper: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    quickActionLabel: {
        fontSize: 12,
        fontWeight: '600'
    },

    // Pipeline
    pipelineWrapper: {
        backgroundColor: 'rgba(0,0,0,0.02)',
        borderRadius: 10,
        padding: 4,
        marginBottom: 16,
    },
    pipelineBar: {
        flexDirection: 'row',
        height: 12,
        borderRadius: 8,
        overflow: 'hidden',
        gap: 2,
    },
    pipelineSegment: { borderRadius: 8 },
    pipelineLegend: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    legendChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        gap: 6,
    },
    legendDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    legendLabel: { fontSize: 12, fontWeight: '500' },
    legendCount: { fontSize: 13, fontWeight: '700' },

    // Activity Feed
    activityFeed: {
        gap: 16,
    },
    activityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    activityIconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    activityContent: { flex: 1 },
    activityLeadName: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
    activityDetail: { fontSize: 13, fontWeight: '400' },
    activityTime: { fontSize: 12, alignSelf: 'flex-start', marginTop: 2 },
});
