import Avatar from '@/components/Avatar';
import { type ActivityCounts } from '@/components/events/roadshowTokens';
import { DarkHeroCard } from '@/components/roadshow/atoms/DarkHeroCard';
import { RealtimeFeed } from '@/components/roadshow/atoms/RealtimeFeed';
import type { Colors } from '@/constants/Colors';
import { getRoadshowColors, leaderboardSort } from '@/constants/roadshow/tokens';
import { RoadshowType, TropicFonts } from '@/constants/roadshow/typography';
import { getAvatarColor } from '@/constants/ui';
import { useTheme } from '@/contexts/ThemeContext';
import type { RoadshowActivity, RoadshowAttendance, RoadshowConfig } from '@/types/event';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export interface RoadshowPastProps {
    colors: typeof Colors.light;
    roadshowConfig: RoadshowConfig | null;
    attendance: RoadshowAttendance[];
    activityCounts: (userId: string) => ActivityCounts;
    totalAttendees: number;
    userId?: string;
    activities?: RoadshowActivity[];
}

function RoadshowPastInner({
    colors,
    roadshowConfig,
    attendance,
    activityCounts,
    totalAttendees,
    userId,
    activities,
}: RoadshowPastProps) {
    const { resolved } = useTheme();
    const stage = getRoadshowColors(resolved);

    const CREAM = '#F4EEE1';
    const CREAM_MUTED = 'rgba(244,238,225,0.55)';

    const ranked = useMemo(
        () =>
            attendance
                .map((att) => {
                    const c = activityCounts(att.user_id);
                    return { att, counts: c, cases: c.closed, afyc: c.afyc };
                })
                .sort(leaderboardSort),
        [attendance, activityCounts],
    );

    const boothTotals = useMemo(
        () => ({
            sitdowns: attendance.reduce((s, a) => s + activityCounts(a.user_id).sitdowns, 0),
            pitches: attendance.reduce((s, a) => s + activityCounts(a.user_id).pitches, 0),
            closed: attendance.reduce((s, a) => s + activityCounts(a.user_id).closed, 0),
            afyc: attendance.reduce((s, a) => s + activityCounts(a.user_id).afyc, 0),
            pledgedSitdowns: attendance.reduce((s, a) => s + a.pledged_sitdowns, 0),
            pledgedPitches: attendance.reduce((s, a) => s + a.pledged_pitches, 0),
            pledgedClosed: attendance.reduce((s, a) => s + a.pledged_closed, 0),
            pledgedAfyc: attendance.reduce((s, a) => s + a.pledged_afyc, 0),
        }),
        [attendance, activityCounts],
    );

    const costToday = roadshowConfig?.daily_cost ?? 0;

    return (
        <View style={styles.container}>
            {/* ── Topline hero ── */}
            <DarkHeroCard glow="sage" glowSize="lg" radius={18}>
                <Text style={[RoadshowType.eyebrow, { color: stage.closes }]}>TOTAL AFYC</Text>
                <Text style={[RoadshowType.heroNumber, { color: CREAM, marginTop: 2 }]}>
                    ${(boothTotals.afyc / 1000).toFixed(1).replace('.0', '')}
                    <Text style={{ fontSize: 24, color: CREAM_MUTED }}>k</Text>
                </Text>

                <View style={styles.statsStrip}>
                    <HeroStat
                        label="sits"
                        value={`${boothTotals.sitdowns}/${boothTotals.pledgedSitdowns}`}
                        cream={CREAM}
                        creamMuted={CREAM_MUTED}
                    />
                    <HeroStat
                        label="pitches"
                        value={`${boothTotals.pitches}/${boothTotals.pledgedPitches}`}
                        cream={CREAM}
                        creamMuted={CREAM_MUTED}
                    />
                    <HeroStat
                        label="closes"
                        value={`${boothTotals.closed}/${boothTotals.pledgedClosed}`}
                        cream={CREAM}
                        creamMuted={CREAM_MUTED}
                    />
                    <HeroStat label="cost" value={`$${costToday.toFixed(0)}`} cream={CREAM} creamMuted={CREAM_MUTED} />
                </View>
            </DarkHeroCard>

            {/* ── Leaderboard ── */}
            <View style={styles.section}>
                <View style={styles.eyebrowRow}>
                    <Text style={[RoadshowType.eyebrow, { color: colors.textTertiary }]}>
                        LEADERBOARD · CASES × AFYC
                    </Text>
                    <Text style={[RoadshowType.caption, { color: colors.textTertiary }]}>
                        {attendance.length}/{totalAttendees}
                    </Text>
                </View>
                <View
                    style={[
                        styles.listCard,
                        { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder },
                    ]}
                >
                    {ranked.length === 0 ? (
                        <Text style={[RoadshowType.caption, { color: colors.textTertiary, padding: 16 }]}>
                            No one checked in.
                        </Text>
                    ) : (
                        ranked.map(({ att, counts }, i) => {
                            const isTop = i === 0;
                            const isSelf = att.user_id === userId;
                            const ac = getAvatarColor(att.full_name ?? '?');
                            return (
                                <View
                                    key={att.id}
                                    style={[
                                        styles.lbRow,
                                        {
                                            borderBottomColor: colors.hairline,
                                            borderBottomWidth: i < ranked.length - 1 ? StyleSheet.hairlineWidth : 0,
                                            backgroundColor: isSelf ? colors.tintTerra + '66' : 'transparent',
                                        },
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.rankNum,
                                            {
                                                color: isTop ? stage.live : colors.textTertiary,
                                                fontFamily: TropicFonts.serifItalic,
                                            },
                                        ]}
                                    >
                                        {i + 1}
                                    </Text>
                                    <Avatar
                                        name={att.full_name ?? '?'}
                                        avatarUrl={null}
                                        size={30}
                                        backgroundColor={ac + '22'}
                                        textColor={ac}
                                    />
                                    <View style={styles.lbNameCol}>
                                        <View style={styles.lbNameRow}>
                                            <Text
                                                style={[RoadshowType.statMd, { color: colors.textPrimary }]}
                                                numberOfLines={1}
                                            >
                                                {att.full_name}
                                            </Text>
                                            {isSelf ? (
                                                <Text
                                                    style={[
                                                        RoadshowType.eyebrowSm,
                                                        { color: stage.live, letterSpacing: 0.8 },
                                                    ]}
                                                >
                                                    YOU
                                                </Text>
                                            ) : null}
                                            {isTop ? <Text style={{ fontSize: 11 }}>✦</Text> : null}
                                        </View>
                                        <Text
                                            style={[
                                                RoadshowType.caption,
                                                {
                                                    color: colors.textTertiary,
                                                    marginTop: 2,
                                                    fontVariant: ['tabular-nums'],
                                                },
                                            ]}
                                        >
                                            {counts.sitdowns} sits · {counts.pitches} pitch ·{' '}
                                            <Text style={{ color: stage.closes, fontFamily: TropicFonts.uiSemiBold }}>
                                                {counts.closed} close{counts.closed !== 1 ? 's' : ''}
                                            </Text>
                                        </Text>
                                    </View>
                                    <View style={styles.lbTrail}>
                                        <Text
                                            style={[
                                                RoadshowType.statMd,
                                                {
                                                    color: isTop ? stage.live : colors.textPrimary,
                                                    fontVariant: ['tabular-nums'],
                                                },
                                            ]}
                                        >
                                            ${counts.afyc.toLocaleString()}
                                        </Text>
                                        <Text
                                            style={[RoadshowType.caption, { color: colors.textTertiary, fontSize: 10 }]}
                                        >
                                            AFYC
                                        </Text>
                                    </View>
                                </View>
                            );
                        })
                    )}
                </View>
            </View>

            {/* ── Activity feed (reverse chrono) ── */}
            {activities ? (
                <RealtimeFeed
                    colors={colors}
                    activities={activities}
                    userId={userId}
                    title="ACTIVITY · REVERSE CHRONO"
                    rightLabel={null}
                />
            ) : null}

            {/* ── Cost summary ── */}
            {roadshowConfig ? (
                <View style={styles.section}>
                    <View style={styles.eyebrowRow}>
                        <Text style={[RoadshowType.eyebrow, { color: colors.textTertiary }]}>COST SUMMARY</Text>
                    </View>
                    <View
                        style={[
                            styles.listCard,
                            {
                                backgroundColor: colors.cardBackground,
                                borderColor: colors.cardBorder,
                                padding: 14,
                                gap: 8,
                            },
                        ]}
                    >
                        <CostRow
                            label="Weekly"
                            value={`$${roadshowConfig.weekly_cost.toLocaleString()}`}
                            colors={colors}
                        />
                        <CostRow
                            label="This day"
                            value={`$${roadshowConfig.daily_cost.toLocaleString()}`}
                            colors={colors}
                        />
                        <CostRow
                            label="Per agent"
                            value={`$${roadshowConfig.slot_cost.toFixed(2)}`}
                            colors={colors}
                            accent={stage.live}
                        />
                    </View>
                </View>
            ) : null}
        </View>
    );
}

function HeroStat({
    label,
    value,
    cream,
    creamMuted,
}: {
    label: string;
    value: string;
    cream: string;
    creamMuted: string;
}) {
    return (
        <View style={styles.heroStat}>
            <Text style={[RoadshowType.eyebrowSm, { color: creamMuted, letterSpacing: 0.7 }]}>
                {label.toUpperCase()}
            </Text>
            <Text style={[RoadshowType.statMd, { color: cream, fontVariant: ['tabular-nums'], marginTop: 1 }]}>
                {value}
            </Text>
        </View>
    );
}

function CostRow({
    label,
    value,
    colors,
    accent,
}: {
    label: string;
    value: string;
    colors: typeof Colors.light;
    accent?: string;
}) {
    return (
        <View style={styles.costRow}>
            <Text style={[RoadshowType.body, { color: colors.textTertiary }]}>{label}</Text>
            <Text
                style={[
                    RoadshowType.bodyMd,
                    {
                        color: accent ?? colors.textPrimary,
                        fontVariant: ['tabular-nums'],
                        fontFamily: accent ? TropicFonts.uiBold : TropicFonts.uiSemiBold,
                    },
                ]}
            >
                {value}
            </Text>
        </View>
    );
}

export const RoadshowPast = React.memo(RoadshowPastInner);

const styles = StyleSheet.create({
    container: { gap: 16 },

    section: { gap: 8 },
    eyebrowRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        paddingHorizontal: 2,
    },

    statsStrip: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 10,
        marginTop: 14,
    },
    heroStat: { flex: 1 },

    listCard: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },

    lbRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 14,
        paddingVertical: 11,
    },
    rankNum: {
        width: 22,
        textAlign: 'center',
        fontSize: 15,
        fontVariant: ['tabular-nums'],
    },
    lbNameCol: { flex: 1, minWidth: 0 },
    lbNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    lbTrail: { alignItems: 'flex-end' },

    costRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
});
