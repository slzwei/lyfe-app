import { letterSpacing } from '@/constants/platform';
import Avatar from '@/components/Avatar';
import BiometricsPrompt from '@/components/home/BiometricsPrompt';
import ErrorBanner from '@/components/ErrorBanner';
import HeroStatsSection from '@/components/home/HeroStatsSection';
import HomePipelineSection from '@/components/home/HomePipelineSection';
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
import { useDashboard } from '@/hooks/useDashboard';
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
        displayActivities,
    } = useDashboard({ userId: user?.id, role, isManagerView, isAdminRole });

    const greeting = useMemo(() => getGreeting(), []);
    const firstName = user?.full_name?.split(' ')[0] || 'there';

    const pipeline = stats?.pipeline || [];
    const currentProgramme = candidateRoadmap.find((p) => !p.isLocked && p.percentage < 100) ?? candidateRoadmap[0];

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
                    paStats={{
                        candidateCount: paStats.candidateCount,
                        interviewCount: paStats.interviewCount,
                        eventCount: paStats.events.length,
                    }}
                    currentProgramme={currentProgramme}
                    candidateRoadmapCount={candidateRoadmap.length}
                />

                {/* Pipeline triage — for managers, directors, admins. Skips candidates + PAs + agents. */}
                {(isManagerView || isAdminRole) && !isCandidate && !isPa && (
                    <HomePipelineSection
                        isManagerView={isManagerView || isAdminRole}
                        onCandidatePress={(id) =>
                            router.push(`/(tabs)/home/candidate/${id}` as Parameters<typeof router.push>[0])
                        }
                        onSeeAll={() => router.push('/(tabs)/candidates')}
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

                {isPa && (
                    <UpcomingEventsCard
                        title="My Events"
                        events={paStats.events}
                        colors={colors}
                        isLoading={isLoading}
                        onSeeAll={() => router.push('/(tabs)/events')}
                        onEventPress={(id) => router.push(`/(tabs)/home/event/${id}`)}
                    />
                )}

                {!isCandidate && !isPa && !isAdminRole && !isManagerView && (
                    <UpcomingEventsCard
                        title="My Events"
                        events={agentEvents}
                        colors={colors}
                        isLoading={isLoading}
                        onSeeAll={() => router.push('/(tabs)/events')}
                        onEventPress={(id) => router.push(`/(tabs)/home/event/${id}`)}
                    />
                )}

                {!isCandidate && !isPa && <LeadPipelineCard pipeline={pipeline} colors={colors} />}

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
