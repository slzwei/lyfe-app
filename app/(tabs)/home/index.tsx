import { letterSpacing } from '@/constants/platform';
import { Fonts } from '@/constants/type';
import Avatar from '@/components/Avatar';
import BiometricsPrompt from '@/components/home/BiometricsPrompt';
import ErrorBanner from '@/components/ErrorBanner';
import HeroStatsSection from '@/components/home/HeroStatsSection';
import HomePipelineSection from '@/components/home/HomePipelineSection';
import LiveApplicantsCard from '@/components/home/LiveApplicantsCard';
import LyfeLogo from '@/components/LyfeLogo';
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
import { useCandidatePipeline } from '@/hooks/useCandidatePipeline';
import { useDashboard } from '@/hooks/useDashboard';
import { useTypedRouter } from '@/hooks/useTypedRouter';
import { formatTodayEyebrow } from '@/lib/dateTime';
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

export default function HomeScreen() {
    const { colors } = useTheme();
    const { user, enableBiometrics } = useAuth();
    const { viewMode, canToggle } = useViewMode();
    const { unreadCount } = useNotifications();
    const router = useTypedRouter();
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

    const role = user?.role;
    const isCandidate = role === 'candidate';
    const isPa = role === 'pa';
    const isRo = role === 'ro';
    const isAdminRole = role === 'admin';

    const {
        stats,
        managerStats,
        paStats,
        agentEvents,
        candidateRoadmap,
        candidateEvents,
        error,
        setError,
        isLoading,
        refreshing,
        loadDashboardData,
        onRefresh,
    } = useDashboard({ userId: user?.id, role, isManagerView, isAdminRole });

    // Agent = the personal-leads view (incl. managers/directors toggled to agent view).
    const isAgent = !isCandidate && !isPa && !isRo && !isManagerView && !isAdminRole;
    // Privileged pipeline audience — managers, directors, admins, ROs (RO is global-scoped).
    const showPipeline = (isManagerView || isAdminRole || isRo) && !isCandidate && !isPa;

    // One pipeline fetch + realtime subscription, shared by the greeting subline and
    // the pipeline section. Inert (no fetch/channel) for non-privileged roles.
    const pipeline = useCandidatePipeline({
        isManagerView: isManagerView || isAdminRole || isRo,
        enabled: showPipeline,
    });

    const greeting = useMemo(() => getGreeting(), []);
    const dateLine = useMemo(() => formatTodayEyebrow(), []);
    const firstName = user?.full_name?.split(' ')[0] || 'there';

    const currentProgramme = candidateRoadmap.find((p) => !p.isLocked && p.percentage < 100) ?? candidateRoadmap[0];

    // Honest, role-aware greeting subline — only shown once its real data has loaded.
    let greetingSubline: string | null = null;
    if (showPipeline && !pipeline.isLoading && !isLoading) {
        const heroCandidates = isRo ? paStats.candidateCount : (managerStats?.activeCandidates ?? 0);
        const atRisk = pipeline.counts['at-risk'];
        const noun = heroCandidates === 1 ? 'candidate' : 'candidates';
        greetingSubline =
            atRisk > 0
                ? `${heroCandidates} ${noun} · ${atRisk} need you now`
                : `${heroCandidates} ${noun} in your pipeline`;
    } else if (isAgent && !isLoading && stats) {
        const noun = stats.totalLeads === 1 ? 'lead' : 'leads';
        greetingSubline =
            stats.newThisWeek > 0
                ? `${stats.totalLeads} ${noun} · ${stats.newThisWeek} new this week`
                : `${stats.totalLeads} ${noun}`;
    }

    const handleRefresh = useCallback(async () => {
        await Promise.all([onRefresh(), pipeline.refresh()]);
    }, [onRefresh, pipeline]);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <ScreenHeader
                title="Lyfe"
                titleElement={<LyfeLogo size="sm" />}
                rightAction={
                    <View style={styles.headerRight}>
                        <TouchableOpacity
                            testID="home-notifications-button"
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
                            testID="home-profile-button"
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
                testID="home-scroll-view"
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />
                }
            >
                <View style={styles.greetingBlock}>
                    <Text style={[styles.dateEyebrow, { color: colors.textTertiary }]} numberOfLines={1}>
                        {dateLine}
                    </Text>
                    <Text style={[styles.greetingHeadline, { color: colors.textPrimary }]} numberOfLines={2}>
                        <Text style={{ color: colors.textSecondary }}>{greeting}, </Text>
                        <Text style={{ fontFamily: Fonts.serifItalic, color: colors.accent }}>{firstName}.</Text>
                    </Text>
                    {greetingSubline && (
                        <Text style={[styles.greetingSubline, { color: colors.textSecondary }]} numberOfLines={1}>
                            {greetingSubline}
                        </Text>
                    )}
                </View>

                {error && <ErrorBanner message={error} onRetry={loadDashboardData} onDismiss={() => setError(null)} />}

                <HeroStatsSection
                    colors={colors}
                    isCandidate={isCandidate}
                    isPa={isPa || isRo}
                    isManagerView={isManagerView}
                    isAdminRole={isAdminRole}
                    stats={stats}
                    managerStats={managerStats}
                    paStats={{
                        candidateCount: paStats.candidateCount,
                        interviewCount: paStats.interviewCount,
                        eventCount: paStats.events.length,
                    }}
                    currentProgramme={currentProgramme}
                    candidateRoadmapCount={candidateRoadmap.length}
                    onTeamLeadsPress={isManagerView || isAdminRole ? () => router.push('/(tabs)/leads') : undefined}
                    onCandidatesPress={
                        isManagerView || isAdminRole ? () => router.push('/(tabs)/candidates') : undefined
                    }
                    onAgentsPress={isManagerView || isAdminRole ? () => router.push('/(tabs)/team') : undefined}
                    onRoadmapPress={isCandidate ? () => router.push('/(tabs)/roadmap') : undefined}
                    onPaCandidatesPress={isPa || isRo ? () => router.push('/(tabs)/pa') : undefined}
                    onPaEventsPress={isPa || isRo ? () => router.push('/(tabs)/events') : undefined}
                    onLeadsPress={
                        !isCandidate && !isPa && !isRo && !isManagerView && !isAdminRole
                            ? () => router.push('/(tabs)/leads')
                            : undefined
                    }
                />

                {/* Live applicants — same privileged audience as the pipeline. Ephemeral:
                    renders only when authorized applicants are filling their form/quiz right now. */}
                {showPipeline && (
                    <LiveApplicantsCard
                        colors={colors}
                        onPressApplicant={(id) =>
                            router.push(`/(tabs)/home/candidate/${id}` as Parameters<typeof router.push>[0])
                        }
                    />
                )}

                {/* Pipeline triage — for managers, directors, admins, ROs. Skips candidates + PAs + agents. */}
                {showPipeline && (
                    <HomePipelineSection
                        rows={pipeline.rows}
                        counts={pipeline.counts}
                        isLoading={pipeline.isLoading}
                        error={pipeline.error}
                        onCandidatePress={(id) =>
                            router.push(`/(tabs)/home/candidate/${id}` as Parameters<typeof router.push>[0])
                        }
                        onSeeAll={() => router.push(isRo ? '/(tabs)/pa' : '/(tabs)/candidates')}
                    />
                )}

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
                        isLoading={isLoading}
                        onSeeAll={() => router.push('/(tabs)/events')}
                        onEventPress={(id) => router.push(`/(tabs)/home/event/${id}`)}
                    />
                )}

                {(isPa || isRo) && (
                    <UpcomingEventsCard
                        title="My Events"
                        events={paStats.events}
                        colors={colors}
                        isLoading={isLoading}
                        onSeeAll={() => router.push('/(tabs)/events')}
                        onEventPress={(id) => router.push(`/(tabs)/home/event/${id}`)}
                    />
                )}

                {!isCandidate && !isPa && !isRo && (
                    <UpcomingEventsCard
                        title="My Events"
                        events={agentEvents}
                        colors={colors}
                        isLoading={isLoading}
                        onSeeAll={() => router.push('/(tabs)/events')}
                        onEventPress={(id) => router.push(`/(tabs)/home/event/${id}`)}
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
    greetingBlock: {
        paddingHorizontal: 20,
        marginTop: 12,
        marginBottom: 16,
    },
    dateEyebrow: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 1.4,
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    greetingHeadline: {
        fontFamily: Fonts.serif,
        fontSize: 32,
        fontWeight: '500',
        lineHeight: 36,
        letterSpacing: letterSpacing(-0.6),
    },
    greetingSubline: {
        fontFamily: Fonts.sans,
        fontSize: 15,
        lineHeight: 20,
        marginTop: 8,
    },
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
