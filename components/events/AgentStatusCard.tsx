import Avatar from '@/components/Avatar';
import { type ActivityCounts } from '@/components/events/roadshowTokens';
import { EventStatusPill } from '@/components/roadshow/atoms/EventStatusPill';
import type { Colors } from '@/constants/Colors';
import { getRoadshowColors } from '@/constants/roadshow/tokens';
import { RoadshowType, TropicFonts } from '@/constants/roadshow/typography';
import { getAvatarColor } from '@/constants/ui';
import { useTheme } from '@/contexts/ThemeContext';
import type { AgencyEvent, EventAttendee, RoadshowAttendance } from '@/types/event';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export interface AgentStatusCardProps {
    colors: typeof Colors.light;
    event: AgencyEvent;
    attendance: RoadshowAttendance[];
    activityCounts: (userId: string) => ActivityCounts;
    openOverride: (agent: EventAttendee) => void;
    currentUserId?: string;
}

function AgentStatusCardInner({
    colors,
    event,
    attendance,
    activityCounts,
    openOverride,
    currentUserId,
}: AgentStatusCardProps) {
    const { resolved } = useTheme();
    const stage = getRoadshowColors(resolved);

    return (
        <View style={styles.wrap}>
            <View style={styles.eyebrowRow}>
                <Text style={[RoadshowType.eyebrow, { color: colors.textTertiary }]}>
                    AGENTS · {event.attendees.length}
                </Text>
            </View>

            <View style={styles.list}>
                {event.attendees.map((agent, i) => {
                    const att = attendance.find((a) => a.user_id === agent.user_id);
                    const counts = activityCounts(agent.user_id);
                    const ac = getAvatarColor(agent.full_name ?? '?');
                    const status: 'on' | 'late' | 'out' = !att ? 'out' : att.is_late ? 'late' : 'on';
                    const isSelf = currentUserId === agent.user_id;

                    const borderColor = status === 'late' ? stage.late + '66' : colors.cardBorder;
                    const bg = status === 'out' ? colors.cardBackground : colors.surfaceElevated;

                    return (
                        <Pressable
                            key={agent.id}
                            onPress={() => {
                                if (status === 'out') openOverride(agent);
                            }}
                            style={[
                                styles.card,
                                {
                                    backgroundColor: bg,
                                    borderColor,
                                    opacity: status === 'out' ? 0.75 : 1,
                                },
                            ]}
                        >
                            <View style={styles.topRow}>
                                <Avatar
                                    name={agent.full_name ?? '?'}
                                    avatarUrl={null}
                                    size={32}
                                    backgroundColor={ac + '22'}
                                    textColor={ac}
                                />
                                <View style={styles.nameCol}>
                                    <View style={styles.nameRow}>
                                        <Text
                                            style={[RoadshowType.statMd, { color: colors.textPrimary }]}
                                            numberOfLines={1}
                                        >
                                            {agent.full_name ?? '—'}
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
                                        {status === 'on' ? <EventStatusPill status="on" compact /> : null}
                                        {status === 'late' ? <EventStatusPill status="late" compact /> : null}
                                        {status === 'out' ? (
                                            <Text
                                                style={[
                                                    RoadshowType.eyebrowSm,
                                                    { color: colors.textTertiary, letterSpacing: 1 },
                                                ]}
                                            >
                                                NOT IN
                                            </Text>
                                        ) : null}
                                    </View>
                                    <Text
                                        style={[RoadshowType.caption, { color: colors.textTertiary, marginTop: 2 }]}
                                        numberOfLines={1}
                                    >
                                        {att && att.minutes_late > 0 && status === 'late'
                                            ? `${att.minutes_late} min late`
                                            : (att?.late_reason ?? 'on booth')}
                                    </Text>
                                </View>
                                {status !== 'out' ? (
                                    <Text
                                        style={[
                                            RoadshowType.statMd,
                                            { color: stage.closes, fontVariant: ['tabular-nums'] },
                                        ]}
                                    >
                                        ${counts.afyc.toLocaleString()}
                                    </Text>
                                ) : (
                                    <Pressable
                                        onPress={(e) => {
                                            e?.stopPropagation?.();
                                            openOverride(agent);
                                        }}
                                        hitSlop={8}
                                    >
                                        <Text
                                            style={[
                                                RoadshowType.caption,
                                                {
                                                    color: stage.live,
                                                    fontFamily: TropicFonts.uiSemiBold,
                                                },
                                            ]}
                                        >
                                            Override →
                                        </Text>
                                    </Pressable>
                                )}
                            </View>

                            {status !== 'out' ? (
                                <View style={styles.metricStrip}>
                                    <Metric letter="S" value={counts.sitdowns} color={stage.sitdowns} />
                                    <Metric letter="P" value={counts.pitches} color={stage.pitches} />
                                    <Metric letter="C" value={counts.closed} color={stage.closes} />
                                </View>
                            ) : null}
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}

function Metric({ letter, value, color }: { letter: string; value: number; color: string }) {
    return (
        <View style={styles.metricCell}>
            <View style={[styles.metricChip, { backgroundColor: color + '22' }]}>
                <Text style={[styles.metricLetter, { color }]}>{letter}</Text>
            </View>
            <Text style={[RoadshowType.statMd, styles.metricValue]}>{value}</Text>
        </View>
    );
}

export const AgentStatusCard = React.memo(AgentStatusCardInner);

const styles = StyleSheet.create({
    wrap: { gap: 8 },
    eyebrowRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        paddingHorizontal: 2,
    },
    list: { gap: 8 },

    card: {
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
        gap: 8,
    },

    topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    nameCol: { flex: 1, minWidth: 0 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },

    metricStrip: {
        flexDirection: 'row',
        gap: 16,
        paddingLeft: 42,
    },
    metricCell: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    metricChip: {
        width: 16,
        height: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    metricLetter: { fontSize: 9, fontFamily: TropicFonts.uiBold },
    metricValue: { fontSize: 13, fontVariant: ['tabular-nums'] },
});
