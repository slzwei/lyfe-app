import { Fonts } from '@/constants/type';
import { formatDateShort, formatTime } from '@/lib/dateTime';
import { EVENT_TYPE_CONFIG } from '@/constants/displayConfigs';
import type { AgencyEvent, EventType } from '@/types/event';
import type { ThemeColors } from '@/types/theme';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
    title: string;
    events: AgencyEvent[];
    colors: ThemeColors;
    isLoading?: boolean;
    onSeeAll: () => void;
    onEventPress: (eventId: string) => void;
}

/**
 * Theme-aware tag/rail color per event type — maps onto Tropic tokens so the
 * card reads correctly in both light and dark mode. (The global
 * EVENT_TYPE_CONFIG.color values are legacy hardcoded hex that break dark mode;
 * we keep its labels but override the color here.)
 */
function eventTagColor(eventType: EventType, colors: ThemeColors): string {
    switch (eventType) {
        case 'roadshow':
            return colors.statusProposed;
        case 'training':
            return colors.info;
        case 'team_meeting':
            return colors.success;
        case 'agency_event':
            return colors.warning;
        case 'exam':
            return colors.accent;
        case 'other':
        default:
            return colors.textTertiary;
    }
}

function UpcomingEventsCard({ title, events, colors, isLoading, onSeeAll, onEventPress }: Props) {
    return (
        <View style={[styles.card, { backgroundColor: colors.cardBackground, shadowColor: colors.textPrimary }]}>
            <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
                <TouchableOpacity
                    onPress={onSeeAll}
                    accessibilityRole="button"
                    accessibilityLabel={`See all ${title.toLowerCase()}`}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Text style={[styles.seeAllText, { color: colors.accent }]}>See All</Text>
                </TouchableOpacity>
            </View>

            {isLoading ? (
                <ActivityIndicator size="small" color={colors.accent} style={styles.loader} />
            ) : events.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No upcoming events</Text>
            ) : (
                events.map((event) => {
                    const tagColor = eventTagColor(event.event_type, colors);
                    const tagLabel = EVENT_TYPE_CONFIG[event.event_type]?.label ?? 'Event';
                    return (
                        <TouchableOpacity
                            key={event.id}
                            style={styles.eventRow}
                            onPress={() => onEventPress(event.id)}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            accessibilityLabel={`${event.title}, ${tagLabel}, ${formatDateShort(event.event_date)} ${formatTime(event.start_time)}`}
                        >
                            <View style={[styles.eventStripe, { backgroundColor: tagColor }]} />
                            <View style={styles.eventContent}>
                                <View style={styles.eventTitleRow}>
                                    <Text style={[styles.eventTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                                        {event.title}
                                    </Text>
                                    <View style={[styles.typeTag, { backgroundColor: tagColor + '1F' }]}>
                                        <Text style={[styles.typeTagText, { color: tagColor }]} numberOfLines={1}>
                                            {tagLabel}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={[styles.eventMeta, { color: colors.textTertiary }]}>
                                    {formatDateShort(event.event_date)} · {formatTime(event.start_time)}
                                </Text>
                                {event.location ? (
                                    <Text
                                        style={[styles.eventLocation, { color: colors.textSecondary }]}
                                        numberOfLines={1}
                                    >
                                        {event.location}
                                    </Text>
                                ) : null}
                            </View>
                        </TouchableOpacity>
                    );
                })
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
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    // Section header: sans per role rules
    sectionTitle: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 17,
        fontWeight: '600',
        marginBottom: 0,
        letterSpacing: -0.2,
    },
    seeAllText: { fontFamily: Fonts.sansSemibold, fontSize: 14, fontWeight: '600' },
    loader: { paddingVertical: 16 },
    emptyText: { fontFamily: Fonts.sans, fontSize: 15, textAlign: 'center', paddingVertical: 8, lineHeight: 22 },
    eventRow: { flexDirection: 'row', alignItems: 'stretch', gap: 12, marginBottom: 14 },
    eventStripe: { width: 4, borderRadius: 2 },
    eventContent: { flex: 1, minWidth: 0 },
    eventTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
    // Event-row title: sans per role rules (list rows are NEVER serif)
    eventTitle: { flex: 1, fontFamily: Fonts.sansSemibold, fontSize: 15, fontWeight: '600' },
    // Type tag: eyebrow treatment (uppercase, tracked) — color-on-tint, theme-aware
    typeTag: { flexShrink: 0, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7 },
    typeTagText: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    // Event metadata: mono for date/time is legitimate (timestamp-adjacent)
    eventMeta: { fontFamily: Fonts.mono, fontSize: 11, marginBottom: 2 },
    eventLocation: { fontFamily: Fonts.sansSemibold, fontSize: 12, fontWeight: '600' },
});

export default React.memo(UpcomingEventsCard);
