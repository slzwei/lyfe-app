import { Fonts } from '@/constants/type';
import { formatDateShort, formatTime } from '@/lib/dateTime';
import { EVENT_TYPE_CONFIG } from '@/constants/displayConfigs';
import type { AgencyEvent } from '@/types/event';
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

function UpcomingEventsCard({ title, events, colors, isLoading, onSeeAll, onEventPress }: Props) {
    return (
        <View style={[styles.card, { backgroundColor: colors.cardBackground, shadowColor: colors.textPrimary }]}>
            <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
                <TouchableOpacity onPress={onSeeAll}>
                    <Text style={[styles.seeAllText, { color: colors.accent }]}>See All</Text>
                </TouchableOpacity>
            </View>

            {isLoading ? (
                <ActivityIndicator size="small" color={colors.accent} style={styles.loader} />
            ) : events.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No upcoming events</Text>
            ) : (
                events.map((event) => {
                    const typeColor = EVENT_TYPE_CONFIG[event.event_type].color ?? colors.accent;
                    return (
                        <TouchableOpacity
                            key={event.id}
                            style={styles.eventRow}
                            onPress={() => onEventPress(event.id)}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.eventStripe, { backgroundColor: typeColor }]} />
                            <View style={styles.eventContent}>
                                <Text style={[styles.eventTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                                    {event.title}
                                </Text>
                                <Text style={[styles.eventMeta, { color: colors.textTertiary }]}>
                                    {formatDateShort(event.event_date)} · {formatTime(event.start_time)}
                                </Text>
                                {event.location ? (
                                    <Text style={[styles.eventLocation, { color: typeColor }]} numberOfLines={1}>
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
    sectionTitle: { fontFamily: Fonts.serif, fontSize: 18, fontWeight: '500', marginBottom: 0 },
    seeAllText: { fontFamily: Fonts.sansSemibold, fontSize: 14, fontWeight: '600' },
    loader: { paddingVertical: 16 },
    emptyText: { fontFamily: Fonts.sans, fontSize: 14, textAlign: 'center', paddingVertical: 8 },
    eventRow: { flexDirection: 'row', alignItems: 'stretch', gap: 12, marginBottom: 14 },
    eventStripe: { width: 4, borderRadius: 2 },
    eventContent: { flex: 1 },
    eventTitle: { fontFamily: Fonts.serif, fontSize: 15, fontWeight: '500', marginBottom: 2 },
    eventMeta: { fontFamily: Fonts.mono, fontSize: 11, marginBottom: 2 },
    eventLocation: { fontFamily: Fonts.sansSemibold, fontSize: 12, fontWeight: '600' },
});

export default React.memo(UpcomingEventsCard);
