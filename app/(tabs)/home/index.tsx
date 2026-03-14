import { letterSpacing } from '@/constants/platform';
import Avatar from '@/components/Avatar';
import BiometricsPrompt from '@/components/home/BiometricsPrompt';
import ErrorBanner from '@/components/ErrorBanner';
import HeroStatsSection from '@/components/home/HeroStatsSection';
import LeadPipelineCard from '@/components/home/LeadPipelineCard';
import LyfeLogo from '@/components/LyfeLogo';
import RecentActivityCard from '@/components/home/RecentActivityCard';
import RoadmapProgressCard from '@/components/home/RoadmapProgressCard';
import ScreenHeader from '@/components/ScreenHeader';
import UpcomingEventsCard from '@/components/home/UpcomingEventsCard';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { useViewMode } from '@/contexts/ViewModeContext';
import {
    getBiometryType,
    hasShownBiometricsPrompt,
    isBiometricsAvailable,
    isBiometricsEnabled,
    markBiometricsPromptShown,
    type BiometryType,
} from '@/lib/biometrics';
import {
    fetchLeadStats,
    fetchManagerDashboardStats,
    fetchRecentActivities,
    type LeadPipelineStats,
    type ManagerDashboardStats,
} from '@/lib/leads';
import { timeAgo } from '@/lib/dateTime';
import { fetchUpcomingEvents } from '@/lib/events';
import { fetchCandidateRoadmap } from '@/lib/roadmap';
import { fetchPAManagerIds, fetchPACandidateCount, fetchPAInterviewCount } from '@/lib/recruitment';
import type { AgencyEvent } from '@/types/event';
import type { ProgrammeWithModules } from '@/types/roadmap';
import { type LeadActivity, type LeadActivityType } from '@/types/lead';
import { useTypedRouter } from '@/hooks/useTypedRouter';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
}

// Map LeadActivity type → icon name
const ACTIVITY_ICONS: Record<LeadActivityType, string> = {
    created: 'person-add',
    note: 'create',
    call: 'call',
    whatsapp: 'logo-whatsapp',
    status_change: 'swap-horizontal',
    reassignment: 'swap-horizontal',
    email: 'mail',
    meeting: 'calendar',
    follow_up: 'time',
};

/** Convert Supabase LeadActivity (+ lead_name) → render shape */
function formatActivities(
    activities: (LeadActivity & { lead_name?: string })[],
): { id: string; type: string; leadName: string; detail: string; time: string; icon: string }[] {
    return activities.map((a) => {
        let detail = a.description || '';
        if (a.type === 'status_change' && a.metadata) {
            const from = a.metadata.from_status || '?';
            const to = a.metadata.to_status || '?';
            detail = `${from.charAt(0).toUpperCase() + from.slice(1)} \u2192 ${to.charAt(0).toUpperCase() + to.slice(1)}`;
        } else if (a.type === 'created') {
            detail = detail || 'Lead created';
        } else if (a.type === 'note') {
            detail = a.description
                ? `Note: ${a.description.substring(0, 40)}${a.description.length > 40 ? '...' : ''}`
                : 'Added a note';
        }
        return { id: a.id, type: a.type, leadName: a.lead_name || 'Unknown', detail, time: timeAgo(a.created_at), icon: ACTIVITY_ICONS[a.type] || 'ellipse' };
    });
}

export default function HomeScreen() {
    const { colors } = useTheme();
    const { user, enableBiometrics } = useAuth();
    const { viewMode, canToggle } = useViewMode();
    const { unreadCount } = useNotifications();
    const router = useTypedRouter();
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const isManagerView = canToggle && viewMode === 'manager';

    // Biometrics setup prompt
    const [showBiometricsPrompt, setShowBiometricsPrompt] = useState(false);
    const [biometryType, setBiometryType] = useState<BiometryType>('none');
    const [isEnablingBiometrics, setIsEnablingBiometrics] = useState(false);

    useEffect(() => {
        const checkBiometricsPrompt = async () => {
            const available = await isBiometricsAvailable();
            if (!available) return;
            const enabled = await isBiometricsEnabled();
            if (enabled) return;
            const shown = await hasShownBiometricsPrompt();
            if (shown) return;
            const type = await getBiometryType();
            setBiometryType(type);
            setShowBiometricsPrompt(true);
        };
        checkBiometricsPrompt();
    }, []);

    const handleEnableBiometrics = useCallback(async () => {
        setIsEnablingBiometrics(true);
        const success = await enableBiometrics();
        setIsEnablingBiometrics(false);
        if (success) setShowBiometricsPrompt(false);
    }, [enableBiometrics]);

    const handleDismissBiometricsPrompt = useCallback(async () => {
        await markBiometricsPromptShown();
        setShowBiometricsPrompt(false);
    }, []);

    // Data state
    const [stats, setStats] = useState<LeadPipelineStats | null>(null);
    const [recentActivities, setRecentActivities] = useState<(LeadActivity & { lead_name?: string })[]>([]);
    const [managerStats, setManagerStats] = useState<ManagerDashboardStats | null>(null);
    const [paStats, setPaStats] = useState<{ candidateCount: number; interviewCount: number; events: AgencyEvent[] }>({
        candidateCount: 0, interviewCount: 0, events: [],
    });
    const [agentEvents, setAgentEvents] = useState<AgencyEvent[]>([]);
    const [candidateRoadmap, setCandidateRoadmap] = useState<ProgrammeWithModules[]>([]);
    const [candidateEvents, setCandidateEvents] = useState<AgencyEvent[]>([]);

    const greeting = useMemo(() => getGreeting(), []);
    const firstName = user?.full_name?.split(' ')[0] || 'there';
    const role = user?.role;
    const isCandidate = role === 'candidate';
    const isPa = role === 'pa';
    const isAdminRole = role === 'admin';

    const loadDashboardData = useCallback(async () => {
        if (!user?.id) return;
        try {
            setError(null);
            if (isCandidate) {
                const [roadmapResult, eventsResult] = await Promise.all([
                    fetchCandidateRoadmap(user.id), fetchUpcomingEvents(user.id, 3),
                ]);
                if (roadmapResult.data) setCandidateRoadmap(roadmapResult.data);
                setCandidateEvents(eventsResult.data);
                return;
            }
            if (isPa) {
                const managerIds = await fetchPAManagerIds(user.id);
                const [total, interviews, eventsResult] = await Promise.all([
                    fetchPACandidateCount(managerIds), fetchPAInterviewCount(managerIds), fetchUpcomingEvents(user.id, 5),
                ]);
                setPaStats({ candidateCount: total ?? 0, interviewCount: interviews ?? 0, events: eventsResult.data });
                return;
            }
            const isManagerLike = isManagerView || isAdminRole;
            const promises: Promise<any>[] = [
                fetchLeadStats(user.id, isManagerLike), fetchRecentActivities(user.id, isManagerLike, 5),
            ];
            if (isManagerLike && user.role) promises.push(fetchManagerDashboardStats(user.id, user.role));
            const results = await Promise.all(promises);
            if (results[0].data) setStats(results[0].data);
            if (results[1].data) setRecentActivities(results[1].data);
            if (results[2]?.data) setManagerStats(results[2].data);
            if (results[0].error) setError('Failed to load dashboard data');
            if (!isManagerLike) {
                const eventsResult = await fetchUpcomingEvents(user.id, 5);
                setAgentEvents(eventsResult.data);
            }
        } catch {
            setError('Failed to load dashboard data');
        }
    }, [user?.id, isCandidate, isPa, isManagerView, isAdminRole, user?.role]);

    useEffect(() => { loadDashboardData(); }, [loadDashboardData]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadDashboardData();
        setRefreshing(false);
    }, [loadDashboardData]);

    const pipeline = stats?.pipeline || [];
    const displayActivities = useMemo(
        () => (recentActivities.length > 0 ? formatActivities(recentActivities) : []),
        [recentActivities, isManagerView],
    );
    const currentProgramme = candidateRoadmap.find((p) => !p.isLocked && p.percentage < 100) ?? candidateRoadmap[0];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <ScreenHeader
                title="Lyfe"
                titleElement={<LyfeLogo size="sm" />}
                rightAction={
                    <View style={styles.headerRight}>
                        <TouchableOpacity
                            style={styles.bellBtn}
                            onPress={() => router.push('/(tabs)/home/notifications')}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            accessibilityLabel={
                                unreadCount > 0
                                    ? `Notifications, ${unreadCount > 99 ? '99 plus' : unreadCount} unread`
                                    : 'Notifications'
                            }
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Ionicons name="notifications-outline" size={24} color={colors.textPrimary} />
                            {unreadCount > 0 && (
                                <View style={[styles.badge, { backgroundColor: colors.danger }]}>
                                    <Text style={[styles.badgeText, { color: colors.textInverse }]}>
                                        {unreadCount > 99 ? '99+' : unreadCount}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.avatarBtn}
                            onPress={() => router.push('/(tabs)/profile')}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            accessibilityLabel="Go to profile"
                        >
                            <Avatar
                                name={user?.full_name || '?'}
                                avatarUrl={user?.avatar_url}
                                size={44}
                                backgroundColor={colors.accentLight}
                                textColor={colors.accent}
                            />
                        </TouchableOpacity>
                    </View>
                }
            />
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
                }
            >
                <View style={styles.greetingRow}>
                    <Text style={[styles.greetingText, { letterSpacing: letterSpacing(-0.3) }]} numberOfLines={1}>
                        <Text style={{ color: colors.textSecondary }}>{greeting}, </Text>
                        <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{firstName}</Text>
                    </Text>
                </View>

                {error && <ErrorBanner message={error} onRetry={loadDashboardData} onDismiss={() => setError(null)} />}

                <HeroStatsSection
                    colors={colors}
                    isCandidate={isCandidate}
                    isPa={isPa}
                    isManagerView={isManagerView}
                    isAdminRole={isAdminRole}
                    stats={stats}
                    managerStats={managerStats}
                    paStats={{ candidateCount: paStats.candidateCount, interviewCount: paStats.interviewCount, eventCount: paStats.events.length }}
                    currentProgramme={currentProgramme}
                    candidateRoadmapCount={candidateRoadmap.length}
                />

                {isCandidate && currentProgramme && (
                    <RoadmapProgressCard
                        programme={currentProgramme}
                        colors={colors}
                        onPress={() => router.push('/(tabs)/roadmap')}
                    />
                )}

                {isCandidate && (
                    <UpcomingEventsCard
                        title="Upcoming Events"
                        events={candidateEvents}
                        colors={colors}
                        onSeeAll={() => router.push('/(tabs)/events')}
                        onEventPress={(id) => router.push(`/(tabs)/home/event/${id}` as any)}
                    />
                )}

                {isPa && (
                    <UpcomingEventsCard
                        title="My Events"
                        events={paStats.events}
                        colors={colors}
                        onSeeAll={() => router.push('/(tabs)/events')}
                        onEventPress={(id) => router.push(`/(tabs)/home/event/${id}` as any)}
                    />
                )}

                {!isCandidate && !isPa && !isAdminRole && !isManagerView && (
                    <UpcomingEventsCard
                        title="My Events"
                        events={agentEvents}
                        colors={colors}
                        onSeeAll={() => router.push('/(tabs)/events')}
                        onEventPress={(id) => router.push(`/(tabs)/home/event/${id}` as any)}
                    />
                )}

                {!isCandidate && !isPa && (
                    <LeadPipelineCard pipeline={pipeline} colors={colors} />
                )}

                {!isCandidate && !isPa && (
                    <RecentActivityCard
                        activities={displayActivities}
                        colors={colors}
                        onSeeAll={() => router.push('/(tabs)/leads')}
                    />
                )}
            </ScrollView>

            <BiometricsPrompt
                visible={showBiometricsPrompt}
                biometryType={biometryType}
                isEnabling={isEnablingBiometrics}
                colors={colors}
                onEnable={handleEnableBiometrics}
                onDismiss={handleDismissBiometricsPrompt}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { paddingBottom: 40, paddingTop: 4 },
    greetingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        marginTop: 12,
        marginBottom: 16,
    },
    greetingText: { fontSize: 22 },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    bellBtn: {
        minWidth: 44,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarBtn: {
        borderRadius: 22,
        overflow: 'hidden',
    },
    badge: {
        position: 'absolute',
        top: 2,
        right: 0,
        minWidth: 16,
        height: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '700',
        lineHeight: 12,
    },
});
