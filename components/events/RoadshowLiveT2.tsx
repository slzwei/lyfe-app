import { type ActivityCounts, type BoothTotals } from '@/components/events/roadshowTokens';
import { DarkHeroCard } from '@/components/roadshow/atoms/DarkHeroCard';
import { RealtimeFeed } from '@/components/roadshow/atoms/RealtimeFeed';
import type { Colors } from '@/constants/Colors';
import { getRoadshowColors } from '@/constants/roadshow/tokens';
import { RoadshowType, TropicFonts } from '@/constants/roadshow/typography';
import { useTheme } from '@/contexts/ThemeContext';
import type { AgencyEvent, EventAttendee, RoadshowActivity, RoadshowAttendance, RoadshowConfig } from '@/types/event';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AgentStatusCard } from './AgentStatusCard';
import { ManagerOverrideSheet } from './ManagerOverrideSheet';

export interface RoadshowLiveT2Props {
    colors: typeof Colors.light;
    event: AgencyEvent;
    attendance: RoadshowAttendance[];
    activityCounts: (userId: string) => ActivityCounts;
    boothTotals: BoothTotals;
    roadshowConfig: RoadshowConfig | null;
    // Manager override
    overrideTarget: EventAttendee | null;
    setOverrideTarget: (v: EventAttendee | null) => void;
    overrideTime: string;
    setOverrideTime: (v: string) => void;
    overrideLateReason: string;
    setOverrideLateReason: (v: string) => void;
    overridePledgeSitdowns: number;
    setOverridePledgeSitdowns: React.Dispatch<React.SetStateAction<number>>;
    overridePledgePitches: number;
    setOverridePledgePitches: React.Dispatch<React.SetStateAction<number>>;
    overridePledgeClosed: number;
    setOverridePledgeClosed: React.Dispatch<React.SetStateAction<number>>;
    overridePledgeAfyc: string;
    setOverridePledgeAfyc: (v: string) => void;
    overrideSubmitting: boolean;
    overrideError: string | null;
    openOverride: (agent: EventAttendee) => void;
    handleConfirmOverride: () => void;
    userFullName: string | undefined;
    userId?: string;
    viewMode?: 'manager' | 'agent';
    onViewModeToggle?: (mode: 'manager' | 'agent') => void;
    activities?: RoadshowActivity[];
}

function RoadshowLiveT2Inner(props: RoadshowLiveT2Props) {
    const {
        colors,
        event,
        attendance,
        activityCounts,
        boothTotals,
        roadshowConfig,
        overrideTarget,
        setOverrideTarget,
        overrideTime,
        setOverrideTime,
        overrideLateReason,
        setOverrideLateReason,
        overridePledgeSitdowns,
        setOverridePledgeSitdowns,
        overridePledgePitches,
        setOverridePledgePitches,
        overridePledgeClosed,
        setOverridePledgeClosed,
        overridePledgeAfyc,
        setOverridePledgeAfyc,
        overrideSubmitting,
        overrideError,
        openOverride,
        handleConfirmOverride,
        userFullName,
        userId,
        viewMode,
        onViewModeToggle,
        activities,
    } = props;

    const { resolved } = useTheme();
    const stage = getRoadshowColors(resolved);

    const CREAM = '#F4EEE1';
    const CREAM_MUTED = 'rgba(244,238,225,0.55)';

    const todayCost = roadshowConfig?.daily_cost ?? 0;

    const bars = useMemo(
        () => [
            { k: 'sits', v: boothTotals.sitdowns, p: boothTotals.pledgedSitdowns, c: stage.sitdowns },
            { k: 'pitches', v: boothTotals.pitches, p: boothTotals.pledgedPitches, c: stage.pitches },
            { k: 'closes', v: boothTotals.closed, p: boothTotals.pledgedClosed, c: stage.closes },
        ],
        [boothTotals, stage],
    );

    return (
        <View style={styles.container}>
            {/* View-mode toggle */}
            {onViewModeToggle ? (
                <View style={styles.toggleRow}>
                    <View
                        style={[
                            styles.toggleTrack,
                            { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder },
                        ]}
                    >
                        {(['manager', 'agent'] as const).map((v) => {
                            const on = viewMode === v;
                            return (
                                <Pressable
                                    key={v}
                                    onPress={() => onViewModeToggle(v)}
                                    style={[
                                        styles.toggleBtn,
                                        {
                                            backgroundColor: on ? colors.textPrimary : 'transparent',
                                        },
                                    ]}
                                    hitSlop={4}
                                >
                                    <Text
                                        style={[
                                            RoadshowType.eyebrowSm,
                                            {
                                                color: on ? CREAM : colors.textTertiary,
                                                letterSpacing: 0.6,
                                            },
                                        ]}
                                    >
                                        {v === 'manager' ? 'MANAGER' : 'AGENT'}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </View>
            ) : null}

            {/* ── Team AFYC hero ── */}
            <DarkHeroCard glow="terra" glowSize="lg" radius={18}>
                <View style={styles.heroTopRow}>
                    <Text style={[RoadshowType.eyebrow, { color: stage.live }]}>TEAM AFYC</Text>
                    <Text style={[RoadshowType.caption, { color: CREAM_MUTED }]}>
                        cost today ·{' '}
                        <Text style={{ color: CREAM, fontFamily: TropicFonts.uiSemiBold }}>
                            ${todayCost.toFixed(0)}
                        </Text>
                    </Text>
                </View>

                <Text style={[RoadshowType.heroNumber, { color: CREAM, marginTop: 2 }]}>
                    ${(boothTotals.afyc / 1000).toFixed(1).replace('.0', '')}
                    <Text style={{ fontSize: 22, color: CREAM_MUTED }}>k</Text>
                    {boothTotals.pledgedAfyc > 0 ? (
                        <Text
                            style={{ fontSize: 14, color: CREAM_MUTED, fontFamily: TropicFonts.ui, fontWeight: '400' }}
                        >
                            {' '}
                            / ${(boothTotals.pledgedAfyc / 1000).toFixed(1).replace('.0', '')}k
                        </Text>
                    ) : null}
                </Text>

                <View style={styles.barsRow}>
                    {bars.map((m) => (
                        <View key={m.k} style={styles.barCol}>
                            <View style={styles.barHead}>
                                <Text style={[RoadshowType.eyebrowSm, { color: CREAM_MUTED, letterSpacing: 0.7 }]}>
                                    {m.k.toUpperCase()}
                                </Text>
                                <Text style={[RoadshowType.statMd, { color: CREAM, fontSize: 13 }]}>
                                    {m.v}
                                    <Text style={{ color: CREAM_MUTED }}>/{m.p}</Text>
                                </Text>
                            </View>
                            <View style={styles.barTrack}>
                                <View
                                    style={[
                                        styles.barFill,
                                        {
                                            width: `${m.p > 0 ? Math.min(100, (m.v / m.p) * 100) : 0}%`,
                                            backgroundColor: m.c,
                                        },
                                    ]}
                                />
                            </View>
                        </View>
                    ))}
                </View>
            </DarkHeroCard>

            {/* Override affordance */}
            <View style={styles.overrideRow}>
                <Pressable
                    onPress={() => openOverride({} as EventAttendee)}
                    hitSlop={4}
                    accessibilityLabel="Manual override check-in"
                >
                    <Text style={[RoadshowType.caption, { color: stage.live, fontFamily: TropicFonts.uiSemiBold }]}>
                        + Override
                    </Text>
                </Pressable>
            </View>

            {/* ── Roster (per-agent cards) ── */}
            <AgentStatusCard
                colors={colors}
                event={event}
                attendance={attendance}
                activityCounts={activityCounts}
                openOverride={openOverride}
                currentUserId={userId}
            />

            {/* ── Realtime feed ── */}
            {activities ? (
                <RealtimeFeed colors={colors} activities={activities} userId={userId} title="ACTIVITY · REALTIME" />
            ) : null}

            {/* ── Manager override sheet ── */}
            <ManagerOverrideSheet
                colors={colors}
                overrideTarget={overrideTarget}
                setOverrideTarget={setOverrideTarget}
                overrideTime={overrideTime}
                setOverrideTime={setOverrideTime}
                overrideLateReason={overrideLateReason}
                setOverrideLateReason={setOverrideLateReason}
                overridePledgeSitdowns={overridePledgeSitdowns}
                setOverridePledgeSitdowns={setOverridePledgeSitdowns}
                overridePledgePitches={overridePledgePitches}
                setOverridePledgePitches={setOverridePledgePitches}
                overridePledgeClosed={overridePledgeClosed}
                setOverridePledgeClosed={setOverridePledgeClosed}
                overridePledgeAfyc={overridePledgeAfyc}
                setOverridePledgeAfyc={setOverridePledgeAfyc}
                overrideSubmitting={overrideSubmitting}
                overrideError={overrideError}
                handleConfirmOverride={handleConfirmOverride}
                userFullName={userFullName}
            />
        </View>
    );
}

export const RoadshowLiveT2 = React.memo(RoadshowLiveT2Inner);

const styles = StyleSheet.create({
    container: { gap: 16 },

    toggleRow: { flexDirection: 'row', justifyContent: 'flex-end' },
    toggleTrack: {
        flexDirection: 'row',
        borderRadius: 10,
        padding: 3,
        borderWidth: 1,
        gap: 2,
    },
    toggleBtn: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 7,
    },

    heroTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
    },

    barsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
    barCol: { flex: 1, gap: 4 },
    barHead: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
    },
    barTrack: {
        height: 3,
        backgroundColor: 'rgba(244,238,225,0.12)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    barFill: { height: 3, borderRadius: 2 },

    overrideRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingHorizontal: 2,
    },
});
