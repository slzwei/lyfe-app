import { Fonts } from '@/constants/type';
import { letterSpacing } from '@/constants/platform';
import type { CandidateMilestone, MilestoneCode, MilestoneStatus } from '@/types/recruitment';
import type { ThemeColors } from '@/types/theme';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
    milestoneByCode: Record<MilestoneCode, CandidateMilestone | null>;
    colors: ThemeColors;
    onMark?: (code: MilestoneCode, label: string) => void;
}

// Preferred display order in UI (not DB-enforced).
// BDM is listed first — it's a pre-contracting formality, a gate before the
// principal-onboarding milestones. It never fails and never has a
// reference_number; same status shape as BES / SOAR.
const DISPLAY_ORDER: { code: MilestoneCode; label: string; hint?: string }[] = [
    { code: 'bdm', label: 'BDM Interview' },
    { code: 'bes_induction', label: 'BES Induction' },
    { code: 'soar', label: 'SOAR', hint: 'Optional' },
    { code: 'rnf', label: 'RNF' },
    { code: 'sales_authority', label: 'Sales Authority' },
];

type NodeState = 'filled' | 'hollow' | 'empty';

function statusMeta(status: MilestoneStatus, colors: ThemeColors): { label: string; color: string; node: NodeState } {
    switch (status) {
        case 'completed':
        case 'issued':
            return {
                label: status === 'issued' ? 'Issued' : 'Completed',
                color: colors.success,
                node: 'filled',
            };
        case 'scheduled':
            return {
                label: 'Scheduled',
                color: colors.warning,
                node: 'hollow',
            };
        case 'lodged_to_mas':
            return {
                label: 'Lodged to MAS',
                color: colors.accent,
                node: 'hollow',
            };
        default:
            return {
                label: 'Not Started',
                color: colors.textTertiary,
                node: 'empty',
            };
    }
}

function formatDate(iso: string | null): string | null {
    if (!iso) return null;
    try {
        return new Date(iso).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
        return null;
    }
}

function buildDetail(milestone: CandidateMilestone | null): string | null {
    if (!milestone) return null;
    const parts: string[] = [];
    if (milestone.scheduled_date && milestone.status === 'scheduled') {
        const d = formatDate(milestone.scheduled_date);
        if (d) parts.push(`Scheduled ${d}`);
    }
    if (milestone.completed_date && (milestone.status === 'completed' || milestone.status === 'issued')) {
        const d = formatDate(milestone.completed_date);
        if (d) parts.push(milestone.status === 'issued' ? `Issued ${d}` : `Completed ${d}`);
    }
    return parts.length > 0 ? parts.join(' · ') : null;
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

export default function MilestonesSection({ milestoneByCode, colors, onMark }: Props) {
    const completedCount = DISPLAY_ORDER.filter((d) => {
        const s = milestoneByCode[d.code]?.status;
        return s === 'completed' || s === 'issued';
    }).length;
    const counter = `${pad2(completedCount)}/${pad2(DISPLAY_ORDER.length)}`;
    const interactive = !!onMark;

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <Text style={[styles.heading, { color: colors.textPrimary }]}>
                    {'Pipeline '}
                    <Text style={[styles.headingItalic, { color: colors.accent }]}>milestones</Text>
                </Text>
                <Text style={[styles.counter, { color: colors.textTertiary }]}>{counter}</Text>
            </View>

            <View style={[styles.list, { borderTopColor: colors.cardBorder, borderBottomColor: colors.cardBorder }]}>
                <View style={[styles.rail, { backgroundColor: colors.accent }]} pointerEvents="none" />
                {DISPLAY_ORDER.map((def) => {
                    const milestone = milestoneByCode[def.code];
                    const status: MilestoneStatus = milestone?.status ?? 'not_started';
                    const meta = statusMeta(status, colors);
                    const detail = buildDetail(milestone);
                    const refNum =
                        milestone?.milestone_code === 'rnf' && milestone?.reference_number
                            ? milestone.reference_number
                            : null;

                    const body = (
                        <View style={styles.row}>
                            <View style={styles.nodeCol}>
                                {meta.node === 'filled' && (
                                    <View style={[styles.node, { backgroundColor: meta.color }]} />
                                )}
                                {meta.node === 'hollow' && (
                                    <View
                                        style={[
                                            styles.node,
                                            styles.nodeRing,
                                            { borderColor: meta.color, backgroundColor: colors.background },
                                        ]}
                                    />
                                )}
                                {meta.node === 'empty' && (
                                    <View
                                        style={[
                                            styles.node,
                                            styles.nodeRing,
                                            { borderColor: colors.textTertiary, backgroundColor: colors.background },
                                        ]}
                                    />
                                )}
                            </View>
                            <View style={styles.rowBody}>
                                <Text style={[styles.label, { color: colors.textPrimary }]}>
                                    {def.label}
                                    {def.hint && (
                                        <Text
                                            style={[styles.hint, { color: colors.textTertiary }]}
                                        >{`  ${def.hint}`}</Text>
                                    )}
                                </Text>
                                {detail && (
                                    <Text style={[styles.detail, { color: colors.textSecondary }]}>{detail}</Text>
                                )}
                                {refNum && (
                                    <Text
                                        style={[styles.refNum, { color: colors.textTertiary }]}
                                    >{`Ref ${refNum}`}</Text>
                                )}
                            </View>
                            <Text style={[styles.status, { color: meta.color }]}>{meta.label}</Text>
                        </View>
                    );

                    if (interactive) {
                        return (
                            <TouchableOpacity
                                key={def.code}
                                activeOpacity={0.7}
                                onPress={() => onMark?.(def.code, def.label)}
                                testID={`milestones-section-row-${def.code}`}
                            >
                                {body}
                            </TouchableOpacity>
                        );
                    }
                    return <View key={def.code}>{body}</View>;
                })}
            </View>
        </View>
    );
}

const RAIL_LEFT = 11;
const NODE_SIZE = 14;

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 20,
        marginTop: 28,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
        gap: 12,
    },
    // Section heading: sans per role rules; italic accent word stays serifItalic for editorial feel
    heading: {
        flex: 1,
        fontFamily: Fonts.sansSemibold,
        fontSize: 17,
        fontWeight: '600',
        lineHeight: 22,
        letterSpacing: letterSpacing(-0.2),
    },
    headingItalic: {
        fontFamily: Fonts.serifItalic,
    },
    counter: {
        fontFamily: Fonts.mono,
        fontSize: 11,
        lineHeight: 14,
    },
    list: {
        position: 'relative',
        borderTopWidth: 1,
        borderBottomWidth: 1,
        paddingVertical: 20,
    },
    rail: {
        position: 'absolute',
        left: RAIL_LEFT,
        top: 28,
        bottom: 28,
        width: 2,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 10,
        gap: 10,
    },
    nodeCol: {
        width: 24,
        alignItems: 'center',
        paddingTop: 4,
    },
    node: {
        width: NODE_SIZE,
        height: NODE_SIZE,
        borderRadius: NODE_SIZE / 2,
    },
    nodeRing: {
        borderWidth: 2,
    },
    rowBody: {
        flex: 1,
    },
    // Milestone label: sans (list rows are NEVER serif per role rules)
    label: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 15,
        fontWeight: '600',
        lineHeight: 20,
        letterSpacing: letterSpacing(-0.1),
    },
    hint: {
        fontFamily: Fonts.sans,
        fontSize: 11,
        fontWeight: '500',
    },
    detail: {
        fontFamily: Fonts.sans,
        fontSize: 12,
        fontWeight: '400',
        lineHeight: 16,
        marginTop: 2,
    },
    refNum: {
        fontFamily: Fonts.mono,
        fontSize: 11,
        lineHeight: 14,
        marginTop: 3,
    },
    status: {
        fontFamily: Fonts.mono,
        fontSize: 10,
        lineHeight: 14,
        letterSpacing: letterSpacing(1),
        textTransform: 'uppercase',
        marginTop: 4,
        marginLeft: 4,
    },
});
