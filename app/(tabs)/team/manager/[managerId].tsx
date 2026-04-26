import Avatar from '@/components/Avatar';
import LoadingState from '@/components/LoadingState';
import ScreenHeader from '@/components/ScreenHeader';
import { letterSpacing } from '@/constants/platform';
import { Fonts } from '@/constants/type';
import { useTheme } from '@/contexts/ThemeContext';
import { useTypedRouter } from '@/hooks/useTypedRouter';
import { formatMonthYear } from '@/lib/dateTime';
import { fetchManagerOverview, type ManagerOverview } from '@/lib/team';
import { CANDIDATE_STATUS_CONFIG } from '@/types/recruitment';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Linking, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const AVATAR_COLOR_KEYS = ['statusProposed', 'accent', 'warning', 'info', 'accentMuted', 'success'] as const;

function daysAgoLabel(days: number) {
    if (days <= 0) return 'today';
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
}

export default function ManagerDetailScreen() {
    const { colors } = useTheme();
    const router = useTypedRouter();
    const { managerId } = useLocalSearchParams<{ managerId: string }>();

    const [overview, setOverview] = useState<ManagerOverview | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!managerId) return;
        const { data, error: err } = await fetchManagerOverview(managerId);
        if (err) {
            setError(err);
        } else {
            setOverview(data);
            setError(null);
        }
        setIsLoading(false);
        setIsRefreshing(false);
    }, [managerId]);

    useEffect(() => {
        load();
    }, [load]);

    const onRefresh = useCallback(() => {
        setIsRefreshing(true);
        load();
    }, [load]);

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <ScreenHeader title="Manager" showBack backLabel="Team" />
                <LoadingState />
            </SafeAreaView>
        );
    }

    if (!overview) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <ScreenHeader title="Manager" showBack backLabel="Team" />
                <View style={styles.errorContainer}>
                    <Ionicons name="person-outline" size={48} color={colors.textTertiary} />
                    <Text style={[styles.errorText, { color: colors.textSecondary }]}>
                        {error ?? 'Manager not found'}
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    const { manager, candidatePipeline, teamPerformance, teamRoster } = overview;
    const avatarColor = colors[AVATAR_COLOR_KEYS[manager.name.charCodeAt(0) % AVATAR_COLOR_KEYS.length]];

    const handleCall = () => {
        if (manager.phone) Linking.openURL(`tel:${manager.phone.replace(/\s/g, '')}`);
    };

    const handleEmail = () => {
        if (manager.email) Linking.openURL(`mailto:${manager.email}`);
    };

    const stageEntries = (Object.entries(candidatePipeline.byStage) as [keyof typeof CANDIDATE_STATUS_CONFIG, number][])
        .filter(([, count]) => (count ?? 0) > 0)
        .sort(([a], [b]) => CANDIDATE_STATUS_CONFIG[a].order - CANDIDATE_STATUS_CONFIG[b].order);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <ScreenHeader title="Manager" showBack backLabel="Team" />
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.accent} />
                }
            >
                {/* ── Profile Header ── */}
                <View
                    style={[
                        styles.profileCard,
                        { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder },
                    ]}
                >
                    <View style={styles.profileTop}>
                        <Avatar
                            name={manager.name}
                            avatarUrl={manager.avatarUrl}
                            size={60}
                            backgroundColor={avatarColor + '18'}
                            textColor={avatarColor}
                        />
                        <View style={styles.profileInfo}>
                            <Text style={[styles.profileName, { color: colors.textPrimary }]} numberOfLines={1}>
                                {manager.name}
                            </Text>
                            <View style={styles.profileMeta}>
                                <View style={[styles.roleBadge, { backgroundColor: colors.infoLight }]}>
                                    <Text style={[styles.roleText, { color: colors.info }]}>Manager</Text>
                                </View>
                                <View
                                    style={[
                                        styles.statusPill,
                                        {
                                            backgroundColor: manager.isActive
                                                ? colors.successLight
                                                : colors.surfaceSecondary,
                                        },
                                    ]}
                                >
                                    <View
                                        style={[
                                            styles.statusDot,
                                            {
                                                backgroundColor: manager.isActive
                                                    ? colors.success
                                                    : colors.textTertiary,
                                            },
                                        ]}
                                    />
                                    <Text
                                        style={[
                                            styles.statusText,
                                            {
                                                color: manager.isActive ? colors.success : colors.textTertiary,
                                            },
                                        ]}
                                    >
                                        {manager.isActive ? 'Active' : 'Inactive'}
                                    </Text>
                                </View>
                            </View>
                            {manager.joinedDate ? (
                                <Text style={[styles.metaLine, { color: colors.textTertiary }]}>
                                    Member since {formatMonthYear(manager.joinedDate)}
                                </Text>
                            ) : null}
                            <Text style={[styles.metaLine, { color: colors.textTertiary }]}>
                                {`${manager.teamSize ?? 0} ${(manager.teamSize ?? 0) === 1 ? 'agent' : 'agents'} · ${
                                    manager.outstandingCandidatesCount ?? 0
                                } ${(manager.outstandingCandidatesCount ?? 0) === 1 ? 'candidate' : 'candidates'}`}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.actionRow}>
                        <TouchableOpacity
                            style={[
                                styles.actionBtn,
                                {
                                    backgroundColor: manager.phone ? colors.accent : colors.surfaceSecondary,
                                    opacity: manager.phone ? 1 : 0.5,
                                },
                            ]}
                            onPress={handleCall}
                            activeOpacity={0.8}
                            disabled={!manager.phone}
                            accessibilityRole="button"
                            accessibilityLabel="Call manager"
                        >
                            <Ionicons
                                name="call"
                                size={18}
                                color={manager.phone ? colors.textInverse : colors.textTertiary}
                            />
                            <Text
                                style={[
                                    styles.actionBtnText,
                                    { color: manager.phone ? colors.textInverse : colors.textTertiary },
                                ]}
                            >
                                Call
                            </Text>
                        </TouchableOpacity>
                        {manager.email ? (
                            <TouchableOpacity
                                style={[
                                    styles.actionBtn,
                                    {
                                        backgroundColor: colors.cardBackground,
                                        borderWidth: 1,
                                        borderColor: colors.border,
                                    },
                                ]}
                                onPress={handleEmail}
                                activeOpacity={0.8}
                                accessibilityRole="button"
                                accessibilityLabel="Email manager"
                            >
                                <Ionicons name="mail" size={18} color={colors.textPrimary} />
                                <Text style={[styles.actionBtnText, { color: colors.textPrimary }]}>Email</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>
                </View>

                {/* ── Recruitment ── */}
                <Text style={[styles.kicker, { color: colors.accent }]}>Recruitment</Text>
                <View
                    style={[
                        styles.sectionCard,
                        { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder },
                    ]}
                >
                    <View style={styles.heroRow}>
                        <Text style={[styles.heroNumber, { color: colors.textPrimary }]}>
                            {candidatePipeline.outstandingTotal}
                        </Text>
                        <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>
                            outstanding {candidatePipeline.outstandingTotal === 1 ? 'candidate' : 'candidates'}
                        </Text>
                    </View>

                    {stageEntries.length > 0 ? (
                        <View style={styles.chipRow}>
                            {stageEntries.map(([stage, count]) => {
                                const config = CANDIDATE_STATUS_CONFIG[stage];
                                return (
                                    <View
                                        key={stage}
                                        style={[styles.stageChip, { backgroundColor: config.color + '1A' }]}
                                    >
                                        <Text style={[styles.stageChipText, { color: config.color }]}>
                                            {config.label} {count}
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>
                    ) : (
                        <View
                            style={[
                                styles.quietRow,
                                { backgroundColor: colors.surfacePrimary, borderColor: colors.border },
                            ]}
                        >
                            <Ionicons name="checkmark-circle-outline" size={18} color={colors.success} />
                            <Text style={[styles.quietRowText, { color: colors.textSecondary }]}>
                                No candidates currently in pipeline.
                            </Text>
                        </View>
                    )}

                    {candidatePipeline.recentlyUpdated.length > 0 ? (
                        <>
                            <View style={[styles.divider, { borderTopColor: colors.border }]} />
                            <Text style={[styles.subSectionTitle, { color: colors.textSecondary }]}>Last updated</Text>
                            {candidatePipeline.recentlyUpdated.map((cand) => {
                                const config = CANDIDATE_STATUS_CONFIG[cand.status];
                                return (
                                    <TouchableOpacity
                                        key={cand.id}
                                        style={[styles.candRow, { borderColor: colors.border }]}
                                        onPress={() => router.push(`/(tabs)/team/candidate/${cand.id}`)}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Open ${cand.name}`}
                                    >
                                        <View style={styles.candRowLeft}>
                                            <Text
                                                style={[styles.candName, { color: colors.textPrimary }]}
                                                numberOfLines={1}
                                            >
                                                {cand.name}
                                            </Text>
                                            <Text style={[styles.candStage, { color: config.color }]} numberOfLines={1}>
                                                {config.label}
                                            </Text>
                                        </View>
                                        <Text style={[styles.candDays, { color: colors.textTertiary }]}>
                                            {daysAgoLabel(cand.daysSinceLastUpdate)}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </>
                    ) : null}
                </View>

                {/* ── Team Performance ── */}
                <Text style={[styles.kicker, { color: colors.accent }]}>Team performance · last 30 days</Text>
                <View
                    style={[
                        styles.sectionCard,
                        { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder },
                    ]}
                >
                    <View style={styles.perfRow}>
                        <View style={styles.perfBlock}>
                            <Text style={[styles.perfValue, { color: colors.textPrimary }]}>
                                {teamPerformance.activitiesLogged}
                            </Text>
                            <Text style={[styles.perfLabel, { color: colors.textTertiary }]}>activities logged</Text>
                        </View>
                        <View style={[styles.perfDivider, { backgroundColor: colors.border }]} />
                        <View style={styles.perfBlock}>
                            <Text style={[styles.perfValue, { color: colors.textPrimary }]}>
                                {teamPerformance.leadsClosed}
                            </Text>
                            <Text style={[styles.perfLabel, { color: colors.textTertiary }]}>
                                {`leads closed · ${teamPerformance.leadsWon} won · ${teamPerformance.winRate}%`}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* ── Agents ── */}
                <Text style={[styles.kicker, { color: colors.accent }]}>{`Agents · ${teamRoster.length}`}</Text>
                {teamRoster.length === 0 ? (
                    <View
                        style={[
                            styles.quietRow,
                            { backgroundColor: colors.cardBackground, borderColor: colors.border },
                        ]}
                    >
                        <Ionicons name="people-outline" size={18} color={colors.textTertiary} />
                        <Text style={[styles.quietRowText, { color: colors.textSecondary }]}>
                            No agents reporting to this manager yet.
                        </Text>
                    </View>
                ) : (
                    teamRoster.map((agent) => {
                        const hasStale = agent.staleLeadsCount > 0;
                        return (
                            <TouchableOpacity
                                key={agent.id}
                                style={[
                                    styles.agentRow,
                                    { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder },
                                ]}
                                onPress={() => router.push(`/(tabs)/team/agent/${agent.id}`)}
                                activeOpacity={0.72}
                                accessibilityRole="button"
                                accessibilityLabel={`Open ${agent.name}`}
                            >
                                <View style={styles.agentLeft}>
                                    <Text style={[styles.agentName, { color: colors.textPrimary }]} numberOfLines={1}>
                                        {agent.name}
                                    </Text>
                                    <Text style={[styles.agentMeta, { color: colors.textTertiary }]}>
                                        {`${agent.openLeadsCount} open · ${agent.wonCount} won${
                                            agent.isActive ? '' : ' · inactive'
                                        }`}
                                    </Text>
                                </View>
                                {hasStale ? (
                                    <View style={[styles.stalePill, { backgroundColor: colors.dangerLight }]}>
                                        <Text style={[styles.stalePillText, { color: colors.danger }]}>
                                            {`${agent.staleLeadsCount} stale`}
                                        </Text>
                                    </View>
                                ) : null}
                                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                            </TouchableOpacity>
                        );
                    })
                )}

                <View style={{ height: 32 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
    errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
    errorText: { fontFamily: Fonts.sans, fontSize: 15, textAlign: 'center' },

    profileCard: {
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 20,
        padding: 18,
        marginBottom: 18,
    },
    profileTop: { flexDirection: 'row', gap: 14 },
    profileInfo: { flex: 1, minWidth: 0, gap: 4 },
    profileName: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 20,
        lineHeight: 26,
        letterSpacing: letterSpacing(-0.2),
    },
    profileMeta: { flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 2 },
    roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7 },
    roleText: { fontFamily: Fonts.sansSemibold, fontSize: 12, lineHeight: 16 },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 7,
    },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontFamily: Fonts.sansSemibold, fontSize: 12, lineHeight: 16 },
    metaLine: { fontFamily: Fonts.sans, fontSize: 13, lineHeight: 18, marginTop: 2 },
    actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 11,
        borderRadius: 12,
    },
    actionBtnText: { fontFamily: Fonts.sansSemibold, fontSize: 15, lineHeight: 20 },

    kicker: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 13,
        lineHeight: 18,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        marginTop: 4,
        marginBottom: 8,
    },
    sectionCard: {
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 20,
        padding: 18,
        marginBottom: 18,
    },

    heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
    heroNumber: { fontFamily: Fonts.serif, fontSize: 40, lineHeight: 48 },
    heroLabel: { fontFamily: Fonts.sansSemibold, fontSize: 16, lineHeight: 22 },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
    stageChip: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
    stageChipText: { fontFamily: Fonts.sansSemibold, fontSize: 13, lineHeight: 17 },

    quietRow: {
        minHeight: 48,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 10,
    },
    quietRowText: { flex: 1, fontFamily: Fonts.sans, fontSize: 14, lineHeight: 20 },

    divider: { borderTopWidth: StyleSheet.hairlineWidth, marginVertical: 14 },

    subSectionTitle: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 13,
        lineHeight: 18,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        marginBottom: 8,
    },
    candRow: {
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    candRowLeft: { flex: 1, minWidth: 0 },
    candName: { fontFamily: Fonts.sansSemibold, fontSize: 15, lineHeight: 20 },
    candStage: { fontFamily: Fonts.sans, fontSize: 12, lineHeight: 16, marginTop: 1 },
    candDays: { fontFamily: Fonts.mono, fontSize: 11, lineHeight: 15 },

    perfRow: { flexDirection: 'row', alignItems: 'stretch' },
    perfBlock: { flex: 1, gap: 4 },
    perfDivider: { width: StyleSheet.hairlineWidth, marginHorizontal: 14 },
    perfValue: { fontFamily: Fonts.sansSemibold, fontSize: 26, lineHeight: 32 },
    perfLabel: { fontFamily: Fonts.sans, fontSize: 13, lineHeight: 18 },

    agentRow: {
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    agentLeft: { flex: 1, minWidth: 0 },
    agentName: { fontFamily: Fonts.sansSemibold, fontSize: 15, lineHeight: 20 },
    agentMeta: { fontFamily: Fonts.sans, fontSize: 13, lineHeight: 18, marginTop: 1 },
    stalePill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
    stalePillText: { fontFamily: Fonts.sansSemibold, fontSize: 12, lineHeight: 16 },
});
