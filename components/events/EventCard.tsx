import Avatar from '@/components/Avatar';
import { AVATAR_COLORS } from '@/constants/ui';
import { letterSpacing } from '@/constants/platform';
import { formatTime, getRoadshowStatus } from '@/lib/dateTime';
import type { AgencyEvent } from '@/types/event';
import { EVENT_TYPE_LABELS } from '@/types/event';
import { EVENT_TYPE_CONFIG, getEventTypeColor } from '@/constants/displayConfigs';
import type { ThemeColors } from '@/types/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export interface EventCardProps {
    event: AgencyEvent;
    onPress: () => void;
    colors: ThemeColors;
}

export default function EventCard({ event, onPress, colors }: EventCardProps) {
    const typeColor = getEventTypeColor(event.event_type, colors);
    const isLiveRoadshow =
        event.event_type === 'roadshow' &&
        getRoadshowStatus(event.event_date, event.start_time, event.end_time) === 'live';

    const livePulse = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        if (!isLiveRoadshow) return;
        const anim = Animated.loop(
            Animated.sequence([
                Animated.timing(livePulse, { toValue: 0.3, duration: 600, useNativeDriver: true }),
                Animated.timing(livePulse, { toValue: 1, duration: 600, useNativeDriver: true }),
            ]),
        );
        anim.start();
        return () => anim.stop();
    }, [isLiveRoadshow]);

    const allAttendeeNames: { key: string; name: string; avatarUrl?: string | null }[] = [
        ...event.attendees.map((a) => ({ key: a.id, name: a.full_name ?? '?', avatarUrl: a.avatar_url })),
        ...(event.external_attendees ?? []).map((a, i) => ({ key: `ext_${i}`, name: a.name, avatarUrl: null })),
    ];
    const visibleAttendees = allAttendeeNames.slice(0, 3);
    const overflow = allAttendeeNames.length - 3;

    return (
        <TouchableOpacity
            style={[cardStyles.card, { backgroundColor: colors.cardBackground }]}
            onPress={onPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={event.title}
        >
            <View style={[cardStyles.timeBar, { backgroundColor: typeColor }]} />
            <View style={cardStyles.content}>
                <View style={cardStyles.topRow}>
                    <Text style={[cardStyles.time, { color: colors.textTertiary }]}>
                        {formatTime(event.start_time)}
                        {event.end_time ? ` – ${formatTime(event.end_time)}` : ''}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {isLiveRoadshow && (
                            <View style={[cardStyles.livePill, { backgroundColor: colors.statusLive + '18' }]}>
                                <Animated.View
                                    style={[
                                        cardStyles.liveDot,
                                        { backgroundColor: colors.statusLive, opacity: livePulse },
                                    ]}
                                />
                                <Text style={[cardStyles.liveText, { color: colors.statusLive }]}>LIVE</Text>
                            </View>
                        )}
                        <View style={[cardStyles.typeBadge, { backgroundColor: typeColor + '18' }]}>
                            <Text style={[cardStyles.typeText, { color: typeColor }]}>
                                {EVENT_TYPE_LABELS[event.event_type]}
                            </Text>
                        </View>
                    </View>
                </View>

                <Text style={[cardStyles.title, { color: colors.textPrimary }]} numberOfLines={1}>
                    {event.title}
                </Text>

                {event.location && (
                    <View style={cardStyles.locationRow}>
                        <Ionicons name="location-outline" size={12} color={colors.textTertiary} />
                        <Text style={[cardStyles.location, { color: colors.textTertiary }]} numberOfLines={1}>
                            {event.location}
                        </Text>
                    </View>
                )}

                {allAttendeeNames.length > 0 && (
                    <View style={cardStyles.attendees}>
                        {visibleAttendees.map((a, i) => {
                            const color = AVATAR_COLORS[a.name.charCodeAt(0) % AVATAR_COLORS.length];
                            return (
                                <View
                                    key={a.key}
                                    style={[
                                        cardStyles.avatarChip,
                                        {
                                            marginLeft: i === 0 ? 0 : -10,
                                            borderColor: colors.cardBackground,
                                            zIndex: visibleAttendees.length - i,
                                        },
                                    ]}
                                >
                                    <Avatar
                                        name={a.name}
                                        avatarUrl={a.avatarUrl}
                                        size={24}
                                        backgroundColor={color + '18'}
                                        textColor={color}
                                    />
                                </View>
                            );
                        })}
                        {overflow > 0 && (
                            <View
                                style={[
                                    cardStyles.overflowChip,
                                    {
                                        backgroundColor: colors.surfaceSecondary,
                                        borderColor: colors.cardBackground,
                                        marginLeft: -10,
                                    },
                                ]}
                            >
                                <Text style={[cardStyles.overflowText, { color: colors.textTertiary }]}>
                                    +{overflow}
                                </Text>
                            </View>
                        )}
                    </View>
                )}
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} style={cardStyles.chevron} />
        </TouchableOpacity>
    );
}

const cardStyles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        borderRadius: 14,
        marginBottom: 10,
        overflow: 'hidden',
    },
    timeBar: { width: 4 },
    content: { flex: 1, padding: 14, gap: 4 },
    chevron: { alignSelf: 'center', paddingRight: 12 },
    topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
    time: { fontSize: 12, fontWeight: '500' },
    typeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
    typeText: { fontSize: 10, fontWeight: '700' },
    title: { fontSize: 16, fontWeight: '700', letterSpacing: letterSpacing(-0.2) },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    location: { fontSize: 12 },
    attendees: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    avatarChip: {
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        overflow: 'hidden',
    },
    overflowChip: {
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
    },
    overflowText: { fontSize: 9, fontWeight: '700' },
    livePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 5,
    },
    liveDot: { width: 6, height: 6, borderRadius: 3 },
    liveText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
});
