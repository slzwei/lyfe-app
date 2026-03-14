import { ROADSHOW_PINK } from '@/constants/ui';
import type { RoadshowConfig } from '@/types/event';
import type { Colors } from '@/constants/Colors';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export interface RoadshowUpcomingProps {
    roadshowConfig: RoadshowConfig | null;
    colors: typeof Colors.light;
}

function RoadshowUpcomingInner({ roadshowConfig, colors }: RoadshowUpcomingProps) {
    return (
        <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Cost Overview</Text>
            {roadshowConfig ? (
                <>
                    <View style={styles.costRow}>
                        <Text style={[styles.costLabel, { color: colors.textTertiary }]}>Weekly cost</Text>
                        <Text style={[styles.costValue, { color: colors.textPrimary }]}>
                            ${roadshowConfig.weekly_cost.toFixed(2)}
                        </Text>
                    </View>
                    <View style={styles.costRow}>
                        <Text style={[styles.costLabel, { color: colors.textTertiary }]}>Daily cost</Text>
                        <Text style={[styles.costValue, { color: colors.textPrimary }]}>
                            ${roadshowConfig.daily_cost.toFixed(2)}
                        </Text>
                    </View>
                    <View style={styles.costRow}>
                        <Text style={[styles.costLabel, { color: colors.textTertiary }]}>Per-agent slot</Text>
                        <Text style={[styles.costValue, { color: ROADSHOW_PINK, fontWeight: '700' }]}>
                            ${roadshowConfig.slot_cost.toFixed(2)}
                        </Text>
                    </View>
                </>
            ) : (
                <Text style={{ color: colors.textTertiary, fontSize: 13 }}>No config set</Text>
            )}

            {roadshowConfig && (
                <>
                    <View style={[styles.separator, { backgroundColor: colors.border }]} />
                    <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Suggested Daily Targets</Text>
                    <View style={styles.targetsRow}>
                        <View style={styles.targetCell}>
                            <Text style={[styles.targetNum, { color: ROADSHOW_PINK }]}>
                                {roadshowConfig.suggested_sitdowns}
                            </Text>
                            <Text style={[styles.targetLabel, { color: colors.textTertiary }]}>Sitdowns</Text>
                        </View>
                        <View style={styles.targetCell}>
                            <Text style={[styles.targetNum, { color: ROADSHOW_PINK }]}>
                                {roadshowConfig.suggested_pitches}
                            </Text>
                            <Text style={[styles.targetLabel, { color: colors.textTertiary }]}>Pitches</Text>
                        </View>
                        <View style={styles.targetCell}>
                            <Text style={[styles.targetNum, { color: ROADSHOW_PINK }]}>
                                {roadshowConfig.suggested_closed}
                            </Text>
                            <Text style={[styles.targetLabel, { color: colors.textTertiary }]}>Closed</Text>
                        </View>
                    </View>
                </>
            )}
        </View>
    );
}

export const RoadshowUpcoming = React.memo(RoadshowUpcomingInner);

const styles = StyleSheet.create({
    card: { borderRadius: 16, padding: 16, gap: 12 },
    cardTitle: { fontSize: 15, fontWeight: '700' },
    separator: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
    costRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    costLabel: { fontSize: 14 },
    costValue: { fontSize: 14, fontWeight: '600' },
    targetsRow: { flexDirection: 'row', justifyContent: 'space-around' },
    targetCell: { alignItems: 'center', gap: 2 },
    targetNum: { fontSize: 24, fontWeight: '800' },
    targetLabel: { fontSize: 12 },
});
