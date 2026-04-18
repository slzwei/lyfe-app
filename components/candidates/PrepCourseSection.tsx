import type { CandidatePrepCourseBooking, PrepCourseCode } from '@/types/recruitment';
import type { ThemeColors } from '@/types/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import SectionCard from './SectionCard';

interface Props {
    prepCourseByCode: Record<PrepCourseCode, CandidatePrepCourseBooking | null>;
    colors: ThemeColors;
    onMark?: (code: PrepCourseCode, label: string) => void;
}

// Display order + labels for the three decoupled prep courses.
const DISPLAY_ORDER: { code: PrepCourseCode; label: string }[] = [
    { code: 'M9_M9A', label: 'M9 / M9A Prep Course' },
    { code: 'RES5', label: 'RES5 Prep Course' },
    { code: 'HI', label: 'Health Insurance Prep Course' },
];

function formatDate(iso: string | null): string | null {
    if (!iso) return null;
    try {
        return new Date(iso).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
        return null;
    }
}

function statusMeta(booking: CandidatePrepCourseBooking | null, colors: ThemeColors) {
    if (!booking || !booking.booked_date) {
        return {
            label: 'Not Booked',
            color: colors.textTertiary,
            bg: colors.surfaceSecondary,
            icon: 'ellipse-outline' as const,
        };
    }
    if (booking.attended) {
        return { label: 'Attended', color: colors.success, bg: colors.successLight, icon: 'checkmark-circle' as const };
    }
    return { label: 'Booked', color: colors.warning, bg: colors.warningLight, icon: 'calendar-outline' as const };
}

export default function PrepCourseSection({ prepCourseByCode, colors, onMark }: Props) {
    const attendedCount = DISPLAY_ORDER.filter((d) => prepCourseByCode[d.code]?.attended).length;
    const interactive = !!onMark;

    return (
        <SectionCard
            title="Prep Courses"
            icon="school-outline"
            badge={`${attendedCount}/${DISPLAY_ORDER.length}`}
            colors={colors}
        >
            {DISPLAY_ORDER.map((def, index) => {
                const booking = prepCourseByCode[def.code];
                const meta = statusMeta(booking, colors);
                const dateStr = booking ? formatDate(booking.booked_date) : null;

                const body = (
                    <View style={styles.rowMain}>
                        <Ionicons name={meta.icon} size={20} color={meta.color} />
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.label, { color: colors.textPrimary }]}>{def.label}</Text>
                            {dateStr && (
                                <Text style={[styles.meta, { color: colors.textTertiary }]}>Booked {dateStr}</Text>
                            )}
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
                            testID={`prep-course-section-row-${def.code}`}
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
    meta: { fontSize: 12, fontWeight: '500', marginTop: 2 },
    pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    pillText: { fontSize: 11, fontWeight: '700' },
});
