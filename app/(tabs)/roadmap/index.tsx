import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useReducedMotion } from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRoadmap } from '@/hooks/useRoadmap';
import { getCandidateIdForUser } from '@/lib/roadmap';
import ScreenHeader from '@/components/ScreenHeader';
import ProgrammeHero from '@/components/roadmap/ProgrammeHero';
import ProgrammeTabs from '@/components/roadmap/ProgrammeTabs';
import RoadmapGrid from '@/components/roadmap/RoadmapGrid';
import ProgrammeLockedOverlay from '@/components/roadmap/ProgrammeLockedOverlay';
import ErrorBanner from '@/components/ErrorBanner';
import { displayWeight } from '@/constants/platform';
import { TAB_BAR_HEIGHT } from '@/constants/platform';

export default function RoadmapScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const router = useRouter();
    const { bottom } = useSafeAreaInsets();
    const reducedMotion = useReducedMotion();

    // Resolve candidates.id from users.id via candidate_profiles bridge
    const [candidateId, setCandidateId] = useState<string | undefined>();
    useEffect(() => {
        if (!user?.id) return;
        getCandidateIdForUser(user.id).then((id) => {
            if (id) setCandidateId(id);
        });
    }, [user?.id]);

    const {
        programmes,
        nodeStates,
        isLoading,
        error,
        refresh,
        isRefreshing,
        activeProgrammeIndex,
        setActiveProgrammeIndex,
    } = useRoadmap(candidateId);

    const activeProgramme = programmes[activeProgrammeIndex];
    const seedProgramme = programmes.find((p) => p.slug === 'seedlyfe');
    const isLocked = activeProgramme?.isLocked && !activeProgramme?.manuallyUnlocked;

    const handleModulePress = useCallback(
        (moduleId: string) => {
            router.push(`/(tabs)/roadmap/module/${moduleId}`);
        },
        [router],
    );

    // When locked, pass empty modules so the grid just renders the header
    const activeModules = isLocked ? [] : (activeProgramme?.modules.filter((m) => m.is_active && !m.isArchived) ?? []);

    // Single unified header: hero + tabs + locked overlay or unlocked-early banner
    const gridHeader = activeProgramme ? (
        <View style={styles.headerSection}>
            <ProgrammeHero
                iconType={activeProgramme.icon_type}
                title={activeProgramme.title}
                completedCount={activeProgramme.completedCount}
                totalCount={activeProgramme.totalCount}
                percentage={activeProgramme.percentage}
                colors={colors}
                reducedMotion={reducedMotion}
            />

            <ProgrammeTabs
                programmes={programmes}
                activeIndex={activeProgrammeIndex}
                onSelect={setActiveProgrammeIndex}
                colors={colors}
            />

            {/* Locked overlay OR unlocked-early banner */}
            {isLocked && <ProgrammeLockedOverlay seedProgramme={seedProgramme} colors={colors} />}
            {activeProgramme.manuallyUnlocked && (
                <ProgrammeLockedOverlay
                    seedProgramme={seedProgramme}
                    manuallyUnlocked
                    unlockedByName={activeProgramme.unlockedByName}
                    colors={colors}
                />
            )}
        </View>
    ) : undefined;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <ScreenHeader title="My Roadmap" />

            {error && <ErrorBanner message={error} onRetry={refresh} />}

            {isLoading && !isRefreshing ? (
                <View style={styles.loading}>
                    <ActivityIndicator size="large" color={colors.accent} />
                    <Text style={[styles.loadingText, { color: colors.textTertiary }]}>Loading your roadmap...</Text>
                </View>
            ) : programmes.length === 0 ? (
                <ScrollView
                    contentContainerStyle={styles.empty}
                    refreshControl={
                        <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.accent} />
                    }
                >
                    {/* Icon in accent on accentLight — visible at a glance (was grey-on-cream) */}
                    <View style={[styles.emptyIcon, { backgroundColor: colors.accentLight }]}>
                        <Ionicons name="leaf-outline" size={48} color={colors.accent} />
                    </View>
                    <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No roadmap assigned yet</Text>
                    <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                        Contact your manager to get started.
                    </Text>
                </ScrollView>
            ) : (
                <RoadmapGrid
                    modules={activeModules}
                    nodeStates={nodeStates}
                    onModulePress={handleModulePress}
                    colors={colors}
                    reducedMotion={reducedMotion}
                    ListHeaderComponent={gridHeader}
                    contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + bottom + 16 }}
                    refreshing={isRefreshing}
                    onRefresh={refresh}
                    scrollToCurrentOnMount={!isLocked}
                    hideEmptyState={isLocked}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headerSection: {
        marginBottom: 16,
    },
    loading: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
    },
    loadingText: {
        fontSize: 14,
    },
    empty: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
        gap: 12,
    },
    emptyIcon: {
        width: 96,
        height: 96,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: displayWeight('600'),
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
});
