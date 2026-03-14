import { displayWeight, letterSpacing } from '@/constants/platform';
import StatCardSmall from '@/components/home/StatCardSmall';
import type { ThemeColors } from '@/types/theme';
import type { LeadPipelineStats, ManagerDashboardStats } from '@/lib/leads';
import type { ProgrammeWithModules } from '@/types/roadmap';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

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
}: Props) {
    const agentStats = stats || { totalLeads: 0, newThisWeek: 0, conversionRate: 0, activeFollowUps: 0 };

    if (isCandidate) {
        return (
            <View style={styles.heroStatsContainer}>
                <View style={styles.statsRow}>
                    <View style={[styles.heroCardPrimary, { backgroundColor: colors.accent }]}>
                        <Ionicons name="map" size={80} color="rgba(255,255,255,0.15)" style={styles.heroIconBg} />
                        <Text style={[styles.heroStatValue, { color: colors.textInverse }]}>
                            {currentProgramme ? `${currentProgramme.percentage}%` : '\u2014'}
                        </Text>
                        <Text style={[styles.heroStatLabel, { color: colors.textInverse, opacity: 0.9 }]}>
                            {currentProgramme?.title || 'Roadmap'}
                        </Text>
                    </View>
                    <View style={styles.statsColumn}>
                        <StatCardSmall
                            label="Modules Done"
                            value={
                                currentProgramme
                                    ? `${currentProgramme.completedCount}/${currentProgramme.totalCount}`
                                    : '\u2014'
                            }
                            colors={colors}
                        />
                        <StatCardSmall label="Programmes" value={candidateRoadmapCount.toString()} colors={colors} />
                    </View>
                </View>
            </View>
        );
    }

    if (isPa) {
        return (
            <View style={styles.heroStatsContainer}>
                <View style={styles.statsRow}>
                    <View style={[styles.heroCardPrimary, { backgroundColor: colors.accent }]}>
                        <Ionicons
                            name="document-text"
                            size={80}
                            color="rgba(255,255,255,0.15)"
                            style={styles.heroIconBg}
                        />
                        <Text style={[styles.heroStatValue, { color: colors.textInverse }]}>
                            {paStats.candidateCount}
                        </Text>
                        <Text style={[styles.heroStatLabel, { color: colors.textInverse, opacity: 0.9 }]}>
                            Candidates
                        </Text>
                    </View>
                    <View style={styles.statsColumn}>
                        <StatCardSmall label="Interviews" value={paStats.interviewCount.toString()} colors={colors} />
                        <StatCardSmall label="Events" value={paStats.eventCount.toString()} colors={colors} />
                    </View>
                </View>
            </View>
        );
    }

    if (isAdminRole || isManagerView) {
        return (
            <View style={styles.heroStatsContainer}>
                <View style={styles.statsRow}>
                    <View style={[styles.heroCardPrimary, { backgroundColor: colors.accent }]}>
                        <Ionicons name="people" size={80} color="rgba(255,255,255,0.15)" style={styles.heroIconBg} />
                        <Text style={[styles.heroStatValue, { color: colors.textInverse }]}>
                            {stats?.totalLeads ?? 0}
                        </Text>
                        <Text style={[styles.heroStatLabel, { color: colors.textInverse, opacity: 0.9 }]}>
                            Team Leads
                        </Text>
                    </View>
                    <View style={styles.statsColumn}>
                        <StatCardSmall
                            label="Candidates"
                            value={(managerStats?.activeCandidates ?? 0).toString()}
                            colors={colors}
                        />
                        <StatCardSmall
                            label="Agents"
                            value={(managerStats?.agentsManaged ?? 0).toString()}
                            colors={colors}
                        />
                    </View>
                </View>
            </View>
        );
    }

    // Agent view
    return (
        <View style={styles.heroStatsContainer}>
            <View style={styles.statsRow}>
                <View style={[styles.heroCardPrimary, { backgroundColor: colors.accent }]}>
                    <Ionicons name="briefcase" size={80} color="rgba(255,255,255,0.15)" style={styles.heroIconBg} />
                    <Text style={[styles.heroStatValue, { color: colors.textInverse }]}>{agentStats.totalLeads}</Text>
                    <Text style={[styles.heroStatLabel, { color: colors.textInverse, opacity: 0.9 }]}>Total Leads</Text>
                </View>
                <View style={styles.statsColumn}>
                    <StatCardSmall label="New Leads" value={agentStats.newThisWeek.toString()} colors={colors} />
                    <StatCardSmall label="Conversion" value={`${agentStats.conversionRate}%`} colors={colors} />
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
        fontSize: 40,
        fontWeight: displayWeight('800'),
        marginBottom: 4,
        letterSpacing: letterSpacing(-1),
    },
    heroStatLabel: { fontSize: 15, fontWeight: '500' },
    statsColumn: {
        flex: 1,
        gap: 12,
    },
});

export default React.memo(HeroStatsSection);
