import Avatar from '@/components/Avatar';
import { CASE_CLOSED_COLOR } from '@/components/events/roadshowShared';
import { activityLabel, activityTypeColor, getAvatarColor, ROADSHOW_PINK } from '@/constants/ui';
import { formatCheckinTime } from '@/lib/dateTime';
import type { EventAttendee, RoadshowActivity } from '@/types/event';
import type { Colors } from '@/constants/Colors';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

// ── Leaderboard ──

export interface LeaderboardEntry extends EventAttendee {
    sitdowns: number;
    pitches: number;
    closed: number;
    afyc: number;
    isCheckedIn: boolean;
}

export interface RoadshowLeaderboardProps {
    colors: typeof Colors.light;
    leaderboard: LeaderboardEntry[];
    userId: string | undefined;
}

function RoadshowLeaderboardInner({ colors, leaderboard, userId }: RoadshowLeaderboardProps) {
    return (
        <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Booth Leaderboard</Text>
            <View style={styles.lbHeader}>
                <Text style={[styles.lbHeaderName, { color: colors.textTertiary }]}>Agent</Text>
                <Text style={[styles.lbHeaderNum, { color: colors.textTertiary }]}>S</Text>
                <Text style={[styles.lbHeaderNum, { color: colors.textTertiary }]}>P</Text>
                <Text style={[styles.lbHeaderNum, { color: colors.textTertiary }]}>C</Text>
                <Text style={[styles.lbHeaderAfyc, { color: colors.textTertiary }]}>AFYC</Text>
            </View>
            {leaderboard.map((agent, i) => {
                const isSelf = agent.user_id === userId;
                return (
                    <View
                        key={agent.id}
                        style={[styles.lbRow, isSelf && { backgroundColor: ROADSHOW_PINK + '10' }]}
                        accessibilityLabel={`Rank ${i + 1}, ${agent.full_name}, ${agent.sitdowns} sitdowns, ${agent.pitches} pitches, ${agent.closed} case closed, $${agent.afyc} AFYC`}
                    >
                        <Text style={[styles.lbRank, { color: colors.textTertiary }]}>{i + 1}</Text>
                        <Text
                            style={[styles.lbName, { color: colors.textPrimary, fontWeight: isSelf ? '700' : '500' }]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                        >
                            {agent.full_name ?? '?'}
                        </Text>
                        <Text style={[styles.lbNum, { color: colors.textPrimary }]}>{agent.sitdowns}</Text>
                        <Text style={[styles.lbNum, { color: colors.textPrimary }]}>{agent.pitches}</Text>
                        <Text style={[styles.lbNum, { color: colors.textPrimary }]}>{agent.closed}</Text>
                        <Text
                            style={[styles.lbAfyc, { color: agent.afyc > 0 ? CASE_CLOSED_COLOR : colors.textTertiary }]}
                        >
                            ${agent.afyc >= 1000 ? `${(agent.afyc / 1000).toFixed(1)}k` : agent.afyc}
                        </Text>
                    </View>
                );
            })}
            {leaderboard.length === 0 && (
                <Text style={{ color: colors.textTertiary, fontSize: 13 }}>No activity logged yet.</Text>
            )}
        </View>
    );
}

export const RoadshowLeaderboard = React.memo(RoadshowLeaderboardInner);

// ── Activity Feed ──

export interface RoadshowActivityFeedProps {
    colors: typeof Colors.light;
    activities: RoadshowActivity[];
}

function RoadshowActivityFeedInner({ colors, activities }: RoadshowActivityFeedProps) {
    const feed = activities.slice(0, 20);
    return (
        <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Activity Feed</Text>
            {feed.length === 0 && <Text style={{ color: colors.textTertiary, fontSize: 13 }}>No activities yet.</Text>}
            {feed.map((act) => (
                <View key={act.id} style={styles.feedRow}>
                    <Text style={[styles.feedTime, { color: colors.textTertiary }]}>
                        {formatCheckinTime(act.logged_at)}
                    </Text>
                    <Avatar
                        name={act.full_name ?? '?'}
                        avatarUrl={null}
                        size={24}
                        backgroundColor={getAvatarColor(act.full_name ?? '?') + '18'}
                        textColor={getAvatarColor(act.full_name ?? '?')}
                    />
                    <Text style={[styles.feedName, { color: colors.textPrimary }]} numberOfLines={1}>
                        {act.full_name}
                    </Text>
                    <Text style={[styles.feedType, { color: activityTypeColor(act.type, colors.textSecondary) }]}>
                        {act.type === 'case_closed' && act.afyc_amount != null && act.afyc_amount > 0
                            ? `Closed $${act.afyc_amount.toLocaleString()} AFYC`
                            : activityLabel(act.type)}
                    </Text>
                </View>
            ))}
            {activities.length > 20 && (
                <Text style={{ color: colors.accent, fontSize: 13, textAlign: 'center', marginTop: 4 }}>
                    {activities.length - 20} more entries not shown
                </Text>
            )}
        </View>
    );
}

export const RoadshowActivityFeed = React.memo(RoadshowActivityFeedInner);

const styles = StyleSheet.create({
    card: { borderRadius: 16, padding: 16, gap: 12 },
    cardTitle: { fontSize: 15, fontWeight: '700' },

    lbHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
    lbHeaderName: { flex: 1, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
    lbHeaderNum: { width: 28, textAlign: 'center', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
    lbHeaderAfyc: { width: 52, textAlign: 'right', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
    lbRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 6, borderRadius: 8 },
    lbRank: { width: 20, fontSize: 12 },
    lbName: { flex: 1, fontSize: 14 },
    lbNum: { width: 28, textAlign: 'center', fontSize: 14 },
    lbAfyc: { width: 52, textAlign: 'right', fontSize: 13, fontWeight: '600' },

    feedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    feedTime: { fontSize: 12, width: 62 },
    feedName: { flex: 1, fontSize: 13 },
    feedType: { fontSize: 13, fontWeight: '600' },
});
