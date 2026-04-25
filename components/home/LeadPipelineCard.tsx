import { Fonts } from '@/constants/type';
import { STATUS_CONFIG, type LeadStatus } from '@/types/lead';
import type { ThemeColors } from '@/types/theme';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface PipelineSegment {
    status: LeadStatus;
    count: number;
}

interface Props {
    pipeline: PipelineSegment[];
    colors: ThemeColors;
}

function LeadPipelineCard({ pipeline, colors }: Props) {
    const totalPipeline = useMemo(() => pipeline.reduce((n, s) => n + s.count, 0), [pipeline]);

    return (
        <View style={[styles.card, { backgroundColor: colors.cardBackground, shadowColor: colors.textPrimary }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Lead Pipeline</Text>
            <View style={[styles.pipelineWrapper, { backgroundColor: colors.borderLight }]}>
                <View style={styles.pipelineBar}>
                    {pipeline
                        .filter((s) => s.count > 0)
                        .map((seg) => (
                            <View
                                key={seg.status}
                                style={[
                                    styles.pipelineSegment,
                                    {
                                        flex: seg.count / totalPipeline,
                                        backgroundColor: STATUS_CONFIG[seg.status].color,
                                    },
                                ]}
                            />
                        ))}
                </View>
            </View>
            <View style={styles.pipelineLegend}>
                {pipeline.map((seg) => {
                    if (seg.count === 0) return null;
                    return (
                        <View key={seg.status} style={[styles.legendChip, { backgroundColor: colors.background }]}>
                            <View style={[styles.legendDot, { backgroundColor: STATUS_CONFIG[seg.status].color }]} />
                            <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>
                                {STATUS_CONFIG[seg.status].label}
                            </Text>
                            <Text style={[styles.legendCount, { color: colors.textPrimary }]}>{seg.count}</Text>
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        marginHorizontal: 16,
        marginBottom: 20,
        borderRadius: 20,
        padding: 20,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 2,
    },
    // Section header: sans per role rules (serif reserved for greetings + hero numbers)
    sectionTitle: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 17,
        fontWeight: '600',
        marginBottom: 12,
        letterSpacing: -0.2,
    },
    pipelineWrapper: {
        borderRadius: 10,
        padding: 4,
        marginBottom: 16,
    },
    pipelineBar: {
        flexDirection: 'row',
        height: 12,
        borderRadius: 8,
        overflow: 'hidden',
        gap: 2,
    },
    pipelineSegment: { borderRadius: 8 },
    pipelineLegend: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    legendChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        gap: 6,
    },
    legendDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    legendLabel: { fontFamily: Fonts.sans, fontSize: 12, fontWeight: '500', lineHeight: 16 },
    // Counts are not IDs/timestamps — sans, not mono (role rule enforcement)
    legendCount: { fontFamily: Fonts.sansSemibold, fontSize: 13, fontWeight: '600' },
});

export default React.memo(LeadPipelineCard);
