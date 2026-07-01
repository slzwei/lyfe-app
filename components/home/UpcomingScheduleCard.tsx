import { Fonts } from '@/constants/type';
import {
    formatScheduleWhen,
    scheduleItemLocation,
    scheduleItemTitle,
    type CandidateScheduleItem,
    type ScheduleItemKind,
} from '@/lib/recruitment/schedule';
import type { ThemeColors } from '@/types/theme';
import type { IconName } from '@/types/ui';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

/** Leading icon + accent per item kind, mapped onto theme tokens (dark-mode safe). */
export function scheduleKindVisual(kind: ScheduleItemKind, colors: ThemeColors): { icon: IconName; color: string } {
    switch (kind) {
        case 'interview':
            return { icon: 'videocam-outline', color: colors.statusProposed };
        case 'paper':
            return { icon: 'document-text-outline', color: colors.accent };
        case 'prep_course':
            return { icon: 'school-outline', color: colors.info };
        case 'milestone':
            return { icon: 'flag-outline', color: colors.success };
        default:
            return { icon: 'calendar-outline', color: colors.textTertiary };
    }
}

/** One agenda row — shared by the home card and the full schedule screen. */
export function ScheduleItemRow({ item, colors }: { item: CandidateScheduleItem; colors: ThemeColors }) {
    const { icon, color } = scheduleKindVisual(item.kind, colors);
    const title = scheduleItemTitle(item);
    const when = formatScheduleWhen(item);
    const sub = scheduleItemLocation(item);

    return (
        <View
            style={styles.row}
            accessibilityRole="text"
            accessibilityLabel={`${title}, ${when}${sub ? `, ${sub}` : ''}`}
        >
            <View style={[styles.iconChip, { backgroundColor: color + '1F' }]}>
                <Ionicons name={icon} size={18} color={color} />
            </View>
            <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {title}
                </Text>
                <Text style={[styles.rowWhen, { color: colors.textTertiary }]} numberOfLines={1}>
                    {when}
                </Text>
                {sub ? (
                    <Text style={[styles.rowSub, { color: colors.textSecondary }]} numberOfLines={1}>
                        {sub}
                    </Text>
                ) : null}
            </View>
        </View>
    );
}

interface Props {
    items: CandidateScheduleItem[];
    colors: ThemeColors;
    isLoading?: boolean;
    onSeeAll: () => void;
}

/**
 * Candidate home "What's next" card — the next few upcoming recruitment dates
 * (interviews / exams / prep courses / milestones). Rows are informational; the
 * whole list opens via "See All".
 */
function UpcomingScheduleCard({ items, colors, isLoading, onSeeAll }: Props) {
    return (
        <View style={[styles.card, { backgroundColor: colors.cardBackground, shadowColor: colors.textPrimary }]}>
            <View style={styles.headerRow}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>What&apos;s next</Text>
                <TouchableOpacity
                    onPress={onSeeAll}
                    accessibilityRole="button"
                    accessibilityLabel="See all upcoming items"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Text style={[styles.seeAll, { color: colors.accent }]}>See All</Text>
                </TouchableOpacity>
            </View>

            {isLoading ? (
                <ActivityIndicator size="small" color={colors.accent} style={styles.loader} />
            ) : items.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                    Nothing scheduled yet. Interviews, exam dates, and prep courses will appear here.
                </Text>
            ) : (
                items.map((item) => <ScheduleItemRow key={`${item.kind}:${item.id}`} item={item} colors={colors} />)
            )}
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
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    title: { fontFamily: Fonts.sansSemibold, fontSize: 17, fontWeight: '600', letterSpacing: -0.2 },
    seeAll: { fontFamily: Fonts.sansSemibold, fontSize: 14, fontWeight: '600' },
    loader: { paddingVertical: 16 },
    emptyText: { fontFamily: Fonts.sans, fontSize: 15, lineHeight: 22, paddingVertical: 4 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
    iconChip: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    rowContent: { flex: 1, minWidth: 0 },
    rowTitle: { fontFamily: Fonts.sansSemibold, fontSize: 15, fontWeight: '600', marginBottom: 2 },
    // Date/time meta: mono is legitimate here (timestamp-adjacent)
    rowWhen: { fontFamily: Fonts.mono, fontSize: 11 },
    rowSub: { fontFamily: Fonts.sansSemibold, fontSize: 12, fontWeight: '600', marginTop: 2 },
});

export default React.memo(UpcomingScheduleCard);
