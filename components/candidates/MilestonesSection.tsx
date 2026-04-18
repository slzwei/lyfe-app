import type { CandidateMilestone, MilestoneCode, MilestoneStatus } from '@/types/recruitment';
import type { ThemeColors } from '@/types/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import SectionCard from './SectionCard';

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

function statusMeta(status: MilestoneStatus, colors: ThemeColors) {
    switch (status) {
        case 'completed':
        case 'issued':
            return {
                label: status === 'issued' ? 'Issued' : 'Completed',
                color: colors.success,
                bg: colors.successLight,
                icon: 'checkmark-circle' as const,
            };
        case 'scheduled':
            return {
                label: 'Scheduled',
                color: colors.warning,
                bg: colors.warningLight,
                icon: 'calendar-outline' as const,
            };
        case 'lodged_to_mas':
            return {
                label: 'Lodged to MAS',
                color: colors.accent,
                bg: colors.surfaceSecondary,
                icon: 'paper-plane-outline' as const,
            };
        default:
            return {
                label: 'Not Started',
                color: colors.textTertiary,
                bg: colors.surfaceSecondary,
                icon: 'ellipse-outline' as const,
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
    if (milestone.milestone_code === 'rnf' && milestone.reference_number) {
        parts.push(`Ref ${milestone.reference_number}`);
    }
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

export default function MilestonesSection({ milestoneByCode, colors, onMark }: Props) {
    const completedCount = DISPLAY_ORDER.filter((d) => {
        const s = milestoneByCode[d.code]?.status;
        return s === 'completed' || s === 'issued';
    }).length;
    const interactive = !!onMark;

    return (
        <SectionCard
            title="Milestones"
            icon="flag-outline"
            badge={`${completedCount}/${DISPLAY_ORDER.length}`}
            colors={colors}
        >
            {DISPLAY_ORDER.map((def, index) => {
                const milestone = milestoneByCode[def.code];
                const status: MilestoneStatus = milestone?.status ?? 'not_started';
                const meta = statusMeta(status, colors);
                const detail = buildDetail(milestone);

                const body = (
                    <View style={styles.rowMain}>
                        <Ionicons name={meta.icon} size={20} color={meta.color} />
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.label, { color: colors.textPrimary }]}>
                                {def.label}
                                {def.hint && (
                                    <Text style={[styles.hint, { color: colors.textTertiary }]}>{`  ${def.hint}`}</Text>
                                )}
                            </Text>
                            {detail && <Text style={[styles.detail, { color: colors.textTertiary }]}>{detail}</Text>}
                        </View>
                        <View style={[styles.pill, { backgroundColor: meta.bg }]}>
                            <Text style={[styles.pillText, { color: meta.color }]}>{meta.label}</Text>
                        </View>
                        {interactive && (
                            <Ionicons
                                name="chevron-forward"
                                size={16}
                                color={colors.textTertiary}
                                style={{ marginLeft: 4 }}
                            />
                        )}
                    </View>
                );

                const rowStyle = [
                    styles.row,
                    index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                ];

                if (interactive) {
                    return (
                        <TouchableOpacity
                            key={def.code}
                            style={rowStyle}
                            onPress={() => onMark?.(def.code, def.label)}
                            activeOpacity={0.7}
                            testID={`milestones-section-row-${def.code}`}
                        >
                            {body}
                        </TouchableOpacity>
                    );
                }
                return (
                    <View key={def.code} style={rowStyle}>
                        {body}
                    </View>
                );
            })}
        </SectionCard>
    );
}

const styles = StyleSheet.create({
    row: { paddingVertical: 10 },
    rowMain: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    label: { fontSize: 14, fontWeight: '600' },
    hint: { fontSize: 11, fontWeight: '500' },
    detail: { fontSize: 12, fontWeight: '500', marginTop: 2 },
    pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    pillText: { fontSize: 11, fontWeight: '700' },
});
