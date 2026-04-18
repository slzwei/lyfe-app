import type { PaperRequirement, PaperRequirementStatus } from '@/types/recruitment';
import type { ThemeColors } from '@/types/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import SectionCard from './SectionCard';

interface Props {
    requirements: PaperRequirement[];
    colors: ThemeColors;
    onMark?: (requirement: PaperRequirement) => void;
}

function statusMeta(status: PaperRequirementStatus, colors: ThemeColors) {
    switch (status) {
        case 'passed':
            return {
                label: 'Passed',
                color: colors.success,
                bg: colors.successLight,
                icon: 'checkmark-circle' as const,
            };
        case 'failed':
            return { label: 'Failed', color: colors.danger, bg: colors.dangerLight, icon: 'close-circle' as const };
        case 'scheduled':
            return {
                label: 'Scheduled',
                color: colors.warning,
                bg: colors.warningLight,
                icon: 'calendar-outline' as const,
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

function formatShortDate(iso: string | null): string | null {
    if (!iso) return null;
    try {
        return new Date(iso).toLocaleDateString('en-SG', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    } catch {
        return null;
    }
}

function buildSubtitle(req: PaperRequirement): string {
    const attemptCount = req.attempts.length;
    const plural = attemptCount === 1 ? '' : 's';

    if (req.status === 'passed' && req.passedAttempt) {
        const when = formatShortDate(req.passedAttempt.exam_at);
        return when
            ? `${req.passedAttempt.paper_code} · passed ${when} · ${attemptCount} attempt${plural}`
            : `${req.passedAttempt.paper_code} · ${attemptCount} attempt${plural}`;
    }
    if (req.status === 'failed' && req.latest) {
        const when = formatShortDate(req.latest.exam_at);
        return when
            ? `${req.latest.paper_code} · latest ${when} — retake needed`
            : `${req.latest.paper_code} · retake needed`;
    }
    if (req.status === 'scheduled' && req.latest) {
        const when = formatShortDate(req.latest.exam_at);
        const cost = req.latest.cost != null ? ` · S$${Number(req.latest.cost).toFixed(0)}` : '';
        return when ? `${req.latest.paper_code} · ${when}${cost}` : `${req.latest.paper_code}${cost}`;
    }
    return req.acceptedPaperCodes.join(' or ');
}

export default function PapersSection({ requirements, colors, onMark }: Props) {
    const passedCount = requirements.filter((r) => r.satisfied).length;
    const interactive = !!onMark;

    return (
        <SectionCard title="Papers" icon="book-outline" badge={`${passedCount}/${requirements.length}`} colors={colors}>
            {requirements.map((req, index) => {
                const meta = statusMeta(req.status, colors);
                const subtitle = buildSubtitle(req);

                const body = (
                    <View style={styles.rowMain}>
                        <Ionicons name={meta.icon} size={20} color={meta.color} />
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.label, { color: colors.textPrimary }]}>{req.label}</Text>
                            <Text style={[styles.sublabel, { color: colors.textTertiary }]}>{subtitle}</Text>
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
                            key={req.code}
                            style={rowStyle}
                            onPress={() => onMark?.(req)}
                            activeOpacity={0.7}
                            testID={`papers-section-row-${req.code}`}
                        >
                            {body}
                        </TouchableOpacity>
                    );
                }
                return (
                    <View key={req.code} style={rowStyle}>
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
    sublabel: { fontSize: 12, fontWeight: '500', marginTop: 2 },
    pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    pillText: { fontSize: 11, fontWeight: '700' },
});
