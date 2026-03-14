import Avatar from '@/components/Avatar';
import { type ActivityCounts, PITCH_COLOR, CASE_CLOSED_COLOR } from '@/components/events/roadshowTokens';
import { getAvatarColor, ROADSHOW_PINK } from '@/constants/ui';
import { formatCheckinTime } from '@/lib/dateTime';
import type { AgencyEvent, EventAttendee, RoadshowAttendance } from '@/types/event';
import type { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export interface AgentStatusCardProps {
    colors: typeof Colors.light;
    event: AgencyEvent;
    attendance: RoadshowAttendance[];
    activityCounts: (userId: string) => ActivityCounts;
    openOverride: (agent: EventAttendee) => void;
}

function AgentStatusCardInner({ colors, event, attendance, activityCounts, openOverride }: AgentStatusCardProps) {
    return (
        <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.sectionHeaderRow}>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Agent Status</Text>
                <Text style={[styles.countBadge, { color: colors.textTertiary }]}>
                    {attendance.length} / {event.attendees.length}
                </Text>
            </View>
            {event.attendees.map((agent) => {
                const att = attendance.find((a) => a.user_id === agent.user_id);
                const counts = activityCounts(agent.user_id);
                const ac = getAvatarColor(agent.full_name ?? '?');
                return (
                    <View key={agent.id} style={[styles.agentCard, { backgroundColor: colors.surfaceSecondary }]}>
                        <View style={styles.agentHeader}>
                            <Avatar
                                name={agent.full_name ?? '?'}
                                avatarUrl={null}
                                size={32}
                                backgroundColor={ac + '18'}
                                textColor={ac}
                            />
                            <Text style={[styles.agentName, { color: colors.textPrimary }]}>{agent.full_name}</Text>
                            {!att && (
                                <TouchableOpacity
                                    style={[styles.overrideBtn, { borderColor: ROADSHOW_PINK }]}
                                    onPress={() => openOverride(agent)}
                                    accessibilityLabel={`Check in ${agent.full_name}`}
                                >
                                    <Ionicons name="add" size={16} color={ROADSHOW_PINK} />
                                </TouchableOpacity>
                            )}
                        </View>
                        {att ? (
                            <>
                                <View style={styles.agentCheckinRow}>
                                    <Ionicons
                                        name={att.is_late ? 'warning' : 'checkmark-circle'}
                                        size={14}
                                        color={att.is_late ? colors.warning : colors.accent}
                                    />
                                    <Text
                                        style={{
                                            color: att.is_late ? colors.warning : colors.accent,
                                            fontSize: 13,
                                        }}
                                    >
                                        {formatCheckinTime(att.checked_in_at)} ·{' '}
                                        {att.is_late ? `Late ${att.minutes_late} min` : 'On time'}
                                    </Text>
                                    {att.checked_in_by && (
                                        <Text style={{ color: colors.textTertiary, fontSize: 11 }}>(override)</Text>
                                    )}
                                </View>
                                {att.late_reason && (
                                    <Text
                                        style={{
                                            color: colors.textTertiary,
                                            fontSize: 12,
                                            marginTop: 2,
                                            marginLeft: 18,
                                        }}
                                    >
                                        "{att.late_reason}"
                                    </Text>
                                )}
                                <View style={[styles.agentStatsTable, { marginTop: 10 }]}>
                                    <View
                                        style={[
                                            styles.agentStatsBand,
                                            {
                                                borderColor: colors.border,
                                                backgroundColor: colors.surfaceSecondary,
                                            },
                                        ]}
                                    >
                                        <Text style={[styles.agentBandLabel, { color: colors.textTertiary }]}>
                                            TARGET
                                        </Text>
                                        <View style={styles.agentBandRow}>
                                            <View style={styles.agentBandCol}>
                                                <Text style={[styles.agentBandNum, { color: colors.textSecondary }]}>
                                                    {att.pledged_sitdowns}
                                                </Text>
                                                <Text style={styles.agentBandCaption}>Sitdowns</Text>
                                            </View>
                                            <View style={styles.agentBandCol}>
                                                <Text style={[styles.agentBandNum, { color: colors.textSecondary }]}>
                                                    {att.pledged_pitches}
                                                </Text>
                                                <Text style={styles.agentBandCaption}>Pitches</Text>
                                            </View>
                                            <View style={styles.agentBandCol}>
                                                <Text style={[styles.agentBandNum, { color: colors.textSecondary }]}>
                                                    {att.pledged_closed}
                                                </Text>
                                                <Text style={styles.agentBandCaption}>Cases</Text>
                                            </View>
                                            <View style={styles.agentBandCol}>
                                                <Text style={[styles.agentBandNum, { color: colors.textSecondary }]}>
                                                    $
                                                    {att.pledged_afyc >= 1000
                                                        ? `${(att.pledged_afyc / 1000).toFixed(0)}k`
                                                        : att.pledged_afyc > 0
                                                          ? att.pledged_afyc
                                                          : '\u2014'}
                                                </Text>
                                                <Text style={styles.agentBandCaption}>AFYC</Text>
                                            </View>
                                        </View>
                                    </View>
                                    <View style={styles.agentStatsBand}>
                                        <Text style={[styles.agentBandLabel, { color: colors.textSecondary }]}>
                                            ACTUAL
                                        </Text>
                                        <View style={styles.agentBandRow}>
                                            <View style={styles.agentBandCol}>
                                                <Text
                                                    style={[
                                                        styles.agentActualNum,
                                                        {
                                                            color:
                                                                counts.sitdowns >= att.pledged_sitdowns &&
                                                                att.pledged_sitdowns > 0
                                                                    ? PITCH_COLOR
                                                                    : colors.textPrimary,
                                                        },
                                                    ]}
                                                >
                                                    {counts.sitdowns}
                                                </Text>
                                                <Text style={styles.agentBandCaption}>Sitdowns</Text>
                                            </View>
                                            <View style={styles.agentBandCol}>
                                                <Text
                                                    style={[
                                                        styles.agentActualNum,
                                                        {
                                                            color:
                                                                counts.pitches >= att.pledged_pitches &&
                                                                att.pledged_pitches > 0
                                                                    ? PITCH_COLOR
                                                                    : colors.textPrimary,
                                                        },
                                                    ]}
                                                >
                                                    {counts.pitches}
                                                </Text>
                                                <Text style={styles.agentBandCaption}>Pitches</Text>
                                            </View>
                                            <View style={styles.agentBandCol}>
                                                <Text
                                                    style={[
                                                        styles.agentActualNum,
                                                        {
                                                            color:
                                                                counts.closed >= att.pledged_closed &&
                                                                att.pledged_closed > 0
                                                                    ? PITCH_COLOR
                                                                    : colors.textPrimary,
                                                        },
                                                    ]}
                                                >
                                                    {counts.closed}
                                                </Text>
                                                <Text style={styles.agentBandCaption}>Cases</Text>
                                            </View>
                                            <View style={styles.agentBandCol}>
                                                <Text
                                                    style={[
                                                        styles.agentActualNum,
                                                        {
                                                            color:
                                                                counts.afyc >= att.pledged_afyc && att.pledged_afyc > 0
                                                                    ? CASE_CLOSED_COLOR
                                                                    : colors.textPrimary,
                                                        },
                                                    ]}
                                                >
                                                    $
                                                    {counts.afyc >= 1000
                                                        ? `${(counts.afyc / 1000).toFixed(0)}k`
                                                        : counts.afyc}
                                                </Text>
                                                <Text style={styles.agentBandCaption}>AFYC</Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            </>
                        ) : (
                            <View style={styles.agentCheckinRow}>
                                <Ionicons name="remove-circle-outline" size={14} color={colors.textTertiary} />
                                <Text style={{ color: colors.textTertiary, fontSize: 13 }}>Not checked in</Text>
                            </View>
                        )}
                    </View>
                );
            })}
        </View>
    );
}

export const AgentStatusCard = React.memo(AgentStatusCardInner);

const styles = StyleSheet.create({
    card: { borderRadius: 16, padding: 16, gap: 12 },
    cardTitle: { fontSize: 15, fontWeight: '700' },
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    countBadge: { fontSize: 13, fontWeight: '600' },
    agentCard: { borderRadius: 12, padding: 12, gap: 6 },
    agentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    agentName: { flex: 1, fontSize: 15, fontWeight: '600' },
    agentCheckinRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    agentStatsTable: { gap: 8 },
    agentStatsBand: {
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'transparent',
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    agentBandLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 6 },
    agentBandRow: { flexDirection: 'row' },
    agentBandCol: { flex: 1, alignItems: 'center', gap: 2 },
    agentBandNum: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
    agentBandCaption: { fontSize: 10, color: '#8E8E93', textAlign: 'center' },
    agentActualNum: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
    overrideBtn: {
        width: 30,
        height: 30,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
    },
});
