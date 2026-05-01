import { letterSpacing } from '@/constants/platform';
import { Fonts } from '@/constants/type';
import StatCardSmall from '@/components/home/StatCardSmall';
import type { ThemeColors } from '@/types/theme';
import type { LeadPipelineStats, ManagerDashboardStats } from '@/lib/leads';
import type { ProgrammeWithModules } from '@/types/roadmap';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
    colors: ThemeColors;
    isCandidate: boolean;
    isPa: boolean;
    isManagerView: boolean;
    isAdminRole: boolean;
    stats: LeadPipelineStats | null;
    managerStats: ManagerDashboardStats | null;
    paStats: { candidateCount: number; interviewCount: number; eventCount: number };
    currentProgramme: ProgrammeWithModules | undefined;
    candidateRoadmapCount: number;
    onTeamLeadsPress?: () => void;
    onCandidatesPress?: () => void;
    onAgentsPress?: () => void;
    onRoadmapPress?: () => void;
    onPaCandidatesPress?: () => void;
    onPaEventsPress?: () => void;
    onLeadsPress?: () => void;
}

function HeroStatsSection({
    colors,
    isCandidate,
    isPa,
    isManagerView,
    isAdminRole,
    stats,
    managerStats,
    paStats,
    currentProgramme,
    candidateRoadmapCount,
    onTeamLeadsPress,
    onCandidatesPress,
    onAgentsPress,
    onRoadmapPress,
    onPaCandidatesPress,
    onPaEventsPress,
    onLeadsPress,
}: Props) {
    const agentStats = stats || { totalLeads: 0, newThisWeek: 0, conversionRate: 0, activeFollowUps: 0 };

    if (isCandidate) {
        const candidateHeroContent = (
            <>
                <Ionicons name="map" size={80} color="rgba(255,255,255,0.15)" style={styles.heroIconBg} />
                <Text style={[styles.heroStatValue, { color: colors.textInverse }]}>
                    {currentProgramme ? `${currentProgramme.percentage}%` : '\u2014'}
                </Text>
                <Text style={[styles.heroStatLabel, { color: colors.textInverse, opacity: 0.9 }]}>
                    {currentProgramme?.title || 'Roadmap'}
                </Text>
            </>
        );
        return (
            <View style={styles.heroStatsContainer}>
                <View style={styles.statsRow}>
                    {onRoadmapPress ? (
                        <TouchableOpacity
                            style={[styles.heroCardPrimary, { backgroundColor: colors.accent }]}
                            onPress={onRoadmapPress}
                            activeOpacity={0.85}
                            accessibilityRole="button"
                            accessibilityLabel={`Roadmap, ${currentProgramme?.percentage ?? 0} percent`}
                            testID="home-hero-roadmap"
                        >
                            {candidateHeroContent}
                        </TouchableOpacity>
                    ) : (
                        <View style={[styles.heroCardPrimary, { backgroundColor: colors.accent }]}>
                            {candidateHeroContent}
                        </View>
                    )}
                    <View style={styles.statsColumn}>
                        <StatCardSmall
                            label="Modules Done"
                            value={
                                currentProgramme
                                    ? `${currentProgramme.completedCount}/${currentProgramme.totalCount}`
                                    : '\u2014'
                            }
                            colors={colors}
                            onPress={onRoadmapPress}
                            testID="home-hero-modules"
                        />
                        <StatCardSmall
                            label="Programmes"
                            value={candidateRoadmapCount.toString()}
                            colors={colors}
                            onPress={onRoadmapPress}
                            testID="home-hero-programmes"
                        />
                    </View>
                </View>
            </View>
        );
    }

    if (isPa) {
        const paHeroContent = (
            <>
                <Ionicons name="document-text" size={80} color="rgba(255,255,255,0.15)" style={styles.heroIconBg} />
                <Text style={[styles.heroStatValue, { color: colors.textInverse }]}>{paStats.candidateCount}</Text>
                <Text style={[styles.heroStatLabel, { color: colors.textInverse, opacity: 0.9 }]}>Candidates</Text>
            </>
        );
        return (
            <View style={styles.heroStatsContainer}>
                <View style={styles.statsRow}>
                    {onPaCandidatesPress ? (
                        <TouchableOpacity
                            style={[styles.heroCardPrimary, { backgroundColor: colors.accent }]}
                            onPress={onPaCandidatesPress}
                            activeOpacity={0.85}
                            accessibilityRole="button"
                            accessibilityLabel={`Candidates, ${paStats.candidateCount}`}
                            testID="home-hero-pa-candidates"
                        >
                            {paHeroContent}
                        </TouchableOpacity>
                    ) : (
                        <View style={[styles.heroCardPrimary, { backgroundColor: colors.accent }]}>
                            {paHeroContent}
                        </View>
                    )}
                    <View style={styles.statsColumn}>
                        <StatCardSmall
                            label="Interviews"
                            value={paStats.interviewCount.toString()}
                            colors={colors}
                            onPress={onPaCandidatesPress}
                            testID="home-hero-pa-interviews"
                        />
                        <StatCardSmall
                            label="Events"
                            value={paStats.eventCount.toString()}
                            colors={colors}
                            onPress={onPaEventsPress}
                            testID="home-hero-pa-events"
                        />
                    </View>
                </View>
            </View>
        );
    }

    if (isAdminRole || isManagerView) {
        const teamLeadsValue = stats?.totalLeads ?? 0;
        const heroContent = (
            <>
                <Ionicons name="people" size={80} color="rgba(255,255,255,0.15)" style={styles.heroIconBg} />
                <Text style={[styles.heroStatValue, { color: colors.textInverse }]}>{teamLeadsValue}</Text>
                <Text style={[styles.heroStatLabel, { color: colors.textInverse, opacity: 0.9 }]}>Team Leads</Text>
            </>
        );
        return (
            <View style={styles.heroStatsContainer}>
                <View style={styles.statsRow}>
                    {onTeamLeadsPress ? (
                        <TouchableOpacity
                            style={[styles.heroCardPrimary, { backgroundColor: colors.accent }]}
                            onPress={onTeamLeadsPress}
                            activeOpacity={0.85}
                            accessibilityRole="button"
                            accessibilityLabel={`Team Leads, ${teamLeadsValue}`}
                            testID="home-hero-team-leads"
                        >
                            {heroContent}
                        </TouchableOpacity>
                    ) : (
                        <View style={[styles.heroCardPrimary, { backgroundColor: colors.accent }]}>{heroContent}</View>
                    )}
                    <View style={styles.statsColumn}>
                        <StatCardSmall
                            label="Candidates"
                            value={(managerStats?.activeCandidates ?? 0).toString()}
                            colors={colors}
                            onPress={onCandidatesPress}
                            testID="home-hero-candidates"
                        />
                        <StatCardSmall
                            label="Agents"
                            value={(managerStats?.agentsManaged ?? 0).toString()}
                            colors={colors}
                            onPress={onAgentsPress}
                            testID="home-hero-agents"
                        />
                    </View>
                </View>
            </View>
        );
    }

    // Agent view
    const agentHeroContent = (
        <>
            <Ionicons name="briefcase" size={80} color="rgba(255,255,255,0.15)" style={styles.heroIconBg} />
            <Text style={[styles.heroStatValue, { color: colors.textInverse }]}>{agentStats.totalLeads}</Text>
            <Text style={[styles.heroStatLabel, { color: colors.textInverse, opacity: 0.9 }]}>Total Leads</Text>
        </>
    );
    return (
        <View style={styles.heroStatsContainer}>
            <View style={styles.statsRow}>
                {onLeadsPress ? (
                    <TouchableOpacity
                        style={[styles.heroCardPrimary, { backgroundColor: colors.accent }]}
                        onPress={onLeadsPress}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityLabel={`Total Leads, ${agentStats.totalLeads}`}
                        testID="home-hero-agent-leads"
                    >
                        {agentHeroContent}
                    </TouchableOpacity>
                ) : (
                    <View style={[styles.heroCardPrimary, { backgroundColor: colors.accent }]}>{agentHeroContent}</View>
                )}
                <View style={styles.statsColumn}>
                    <StatCardSmall
                        label="New Leads"
                        value={agentStats.newThisWeek.toString()}
                        colors={colors}
                        onPress={onLeadsPress}
                        testID="home-hero-agent-new-leads"
                    />
                    <StatCardSmall
                        label="Conversion"
                        value={`${agentStats.conversionRate}%`}
                        colors={colors}
                        onPress={onLeadsPress}
                        testID="home-hero-agent-conversion"
                    />
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
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
    heroStatValue: {
        fontFamily: Fonts.serif,
        fontSize: 40,
        fontWeight: '500',
        marginBottom: 4,
        letterSpacing: letterSpacing(-1),
    },
    heroStatLabel: { fontFamily: Fonts.sans, fontSize: 15, fontWeight: '500' },
    statsColumn: {
        flex: 1,
        gap: 12,
    },
});

export default React.memo(HeroStatsSection);
