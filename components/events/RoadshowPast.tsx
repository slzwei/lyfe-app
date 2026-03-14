import Avatar from '@/components/Avatar';
import { type ActivityCounts, CASE_CLOSED_COLOR } from '@/components/events/roadshowShared';
import { getAvatarColor, ROADSHOW_PINK } from '@/constants/ui';
import { formatCheckinTime } from '@/lib/dateTime';
import type { RoadshowAttendance, RoadshowConfig } from '@/types/event';
import type { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export interface RoadshowPastProps {
    colors: typeof Colors.light;
    roadshowConfig: RoadshowConfig | null;
    attendance: RoadshowAttendance[];
    activityCounts: (userId: string) => ActivityCounts;
    totalAttendees: number;
}

function RoadshowPastInner({ colors, roadshowConfig, attendance, activityCounts, totalAttendees }: RoadshowPastProps) {
    // Booth totals (computed locally from attendance + activityCounts)
    const boothTotals = {
        sitdowns: attendance.reduce((s, a) => s + activityCounts(a.user_id).sitdowns, 0),
        pitches: attendance.reduce((s, a) => s + activityCounts(a.user_id).pitches, 0),
        closed: attendance.reduce((s, a) => s + activityCounts(a.user_id).closed, 0),
        afyc: attendance.reduce((s, a) => s + activityCounts(a.user_id).afyc, 0),
        pledgedSitdowns: attendance.reduce((s, a) => s + a.pledged_sitdowns, 0),
        pledgedPitches: attendance.reduce((s, a) => s + a.pledged_pitches, 0),
        pledgedClosed: attendance.reduce((s, a) => s + a.pledged_closed, 0),
        pledgedAfyc: attendance.reduce((s, a) => s + a.pledged_afyc, 0),
    };

    return (
        <>
            {/* Attendance */}
            <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
                <View style={styles.sectionHeaderRow}>
                    <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Attendance</Text>
                    <Text style={[styles.countBadge, { color: colors.textTertiary }]}>
                        {attendance.length}/{totalAttendees}
                    </Text>
                </View>
                {attendance.map((att) => (
                    <View key={att.id} style={styles.pastAttRow}>
                        <View style={styles.pastAttTop}>
                            <Avatar
                                name={att.full_name ?? '?'}
                                avatarUrl={null}
                                size={28}
                                backgroundColor={getAvatarColor(att.full_name ?? '?') + '18'}
                                textColor={getAvatarColor(att.full_name ?? '?')}
                            />
                            <Text style={[styles.agentName, { color: colors.textPrimary }]}>{att.full_name}</Text>
                            <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
                                {formatCheckinTime(att.checked_in_at)}
                            </Text>
                            <View
                                style={[
                                    styles.latePill,
                                    { backgroundColor: att.is_late ? colors.warningLight : colors.successLight },
                                ]}
                            >
                                <Ionicons
                                    name={att.is_late ? 'warning' : 'checkmark'}
                                    size={11}
                                    color={att.is_late ? colors.warning : colors.success}
                                />
                                <Text
                                    style={{
                                        color: att.is_late ? colors.warning : colors.success,
                                        fontSize: 11,
                                        fontWeight: '600',
                                    }}
                                >
                                    {att.is_late ? `Late ${att.minutes_late}m` : 'On time'}
                                </Text>
                            </View>
                        </View>
                        {att.late_reason && (
                            <Text style={{ color: colors.textTertiary, fontSize: 12, marginLeft: 36, marginTop: 2 }}>
                                "{att.late_reason}"
                            </Text>
                        )}
                    </View>
                ))}
            </View>

            {/* Results vs Pledges */}
            <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Results vs Pledges</Text>
                <View style={styles.pastTableHeader}>
                    <Text style={[styles.pastHeaderName, { color: colors.textTertiary }]}>Name</Text>
                    <Text style={[styles.pastHeaderNum, { color: colors.textTertiary }]}>S</Text>
                    <Text style={[styles.pastHeaderNum, { color: colors.textTertiary }]}>P</Text>
                    <Text style={[styles.pastHeaderNum, { color: colors.textTertiary }]}>C</Text>
                    <Text style={[styles.pastHeaderAfyc, { color: colors.textTertiary }]}>AFYC</Text>
                </View>
                {attendance.map((att) => {
                    const counts = activityCounts(att.user_id);
                    const exceededAfyc = counts.afyc > att.pledged_afyc;
                    return (
                        <View key={att.id} style={styles.pastTableRow}>
                            <Text style={[styles.pastCellName, { color: colors.textPrimary }]} numberOfLines={1}>
                                {att.full_name}
                            </Text>
                            <Text style={[styles.pastCellNum, { color: colors.textPrimary }]}>
                                {counts.sitdowns}/{att.pledged_sitdowns}
                            </Text>
                            <Text style={[styles.pastCellNum, { color: colors.textPrimary }]}>
                                {counts.pitches}/{att.pledged_pitches}
                            </Text>
                            <Text style={[styles.pastCellNum, { color: colors.textPrimary }]}>
                                {counts.closed}/{att.pledged_closed}
                            </Text>
                            <Text
                                style={[
                                    styles.pastCellAfyc,
                                    { color: exceededAfyc ? CASE_CLOSED_COLOR : colors.textPrimary },
                                ]}
                            >
                                ${counts.afyc.toLocaleString()}
                            </Text>
                        </View>
                    );
                })}
                {attendance.length > 0 && (
                    <View style={[styles.pastTableRow, styles.pastTotalRow, { borderTopColor: colors.border }]}>
                        <Text style={[styles.pastCellName, { color: colors.textPrimary, fontWeight: '700' }]}>
                            TOTAL
                        </Text>
                        <Text style={[styles.pastCellNum, { color: colors.textPrimary, fontWeight: '700' }]}>
                            {boothTotals.sitdowns}/{boothTotals.pledgedSitdowns}
                        </Text>
                        <Text style={[styles.pastCellNum, { color: colors.textPrimary, fontWeight: '700' }]}>
                            {boothTotals.pitches}/{boothTotals.pledgedPitches}
                        </Text>
                        <Text style={[styles.pastCellNum, { color: colors.textPrimary, fontWeight: '700' }]}>
                            {boothTotals.closed}/{boothTotals.pledgedClosed}
                        </Text>
                        <Text style={[styles.pastCellAfyc, { color: CASE_CLOSED_COLOR, fontWeight: '700' }]}>
                            ${boothTotals.afyc.toLocaleString()}
                        </Text>
                    </View>
                )}
            </View>

            {/* Cost Summary */}
            {roadshowConfig && (
                <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
                    <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Cost Summary</Text>
                    <View style={styles.costRow}>
                        <Text style={[styles.costLabel, { color: colors.textTertiary }]}>Weekly cost</Text>
                        <Text style={[styles.costValue, { color: colors.textPrimary }]}>
                            ${roadshowConfig.weekly_cost.toFixed(2)}
                        </Text>
                    </View>
                    <View style={styles.costRow}>
                        <Text style={[styles.costLabel, { color: colors.textTertiary }]}>This day</Text>
                        <Text style={[styles.costValue, { color: colors.textPrimary }]}>
                            ${roadshowConfig.daily_cost.toFixed(2)}
                        </Text>
                    </View>
                    <View style={styles.costRow}>
                        <Text style={[styles.costLabel, { color: colors.textTertiary }]}>Per agent</Text>
                        <Text style={[styles.costValue, { color: ROADSHOW_PINK, fontWeight: '700' }]}>
                            ${roadshowConfig.slot_cost.toFixed(2)}
                        </Text>
                    </View>
                </View>
            )}
        </>
    );
}

export const RoadshowPast = React.memo(RoadshowPastInner);

const styles = StyleSheet.create({
    card: { borderRadius: 16, padding: 16, gap: 12 },
    cardTitle: { fontSize: 15, fontWeight: '700' },

    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    countBadge: { fontSize: 13, fontWeight: '600' },

    agentName: { flex: 1, fontSize: 15, fontWeight: '600' },

    pastAttRow: { gap: 2 },
    pastAttTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    latePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },

    pastTableHeader: { flexDirection: 'row', paddingVertical: 4 },
    pastHeaderName: { flex: 1, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
    pastHeaderNum: { width: 36, textAlign: 'center', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
    pastHeaderAfyc: { width: 64, textAlign: 'right', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
    pastTableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
    pastTotalRow: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 4, paddingTop: 8 },
    pastCellName: { flex: 1, fontSize: 13 },
    pastCellNum: { width: 36, textAlign: 'center', fontSize: 13 },
    pastCellAfyc: { width: 64, textAlign: 'right', fontSize: 13 },

    costRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    costLabel: { fontSize: 14 },
    costValue: { fontSize: 14, fontWeight: '600' },
});
