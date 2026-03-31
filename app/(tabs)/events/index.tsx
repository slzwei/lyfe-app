import ErrorBanner from '@/components/ErrorBanner';
import EventCard from '@/components/events/EventCard';
import InlineCalendar from '@/components/events/InlineCalendar';
import LoadingState from '@/components/LoadingState';
import ScreenHeader from '@/components/ScreenHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { fetchAllEvents, fetchEvents } from '@/lib/events';
import { toDateStr } from '@/lib/dateTime';
import type { AgencyEvent } from '@/types/event';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

// ── Helpers ────────────────────────────────────────────────────

/** Format a date section header like "TODAY", "TOMORROW", or "THURSDAY 19/3/26" */
function formatSectionHeader(dateStr: string, todayStr: string): { label: string; dateDisplay: string } {
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date(todayStr + 'T00:00:00');
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const dateDisplay = d.toLocaleDateString('en-SG', { day: 'numeric', month: 'numeric', year: '2-digit' });

    if (dateStr === todayStr) return { label: 'TODAY', dateDisplay };
    if (dateStr === toDateStr(tomorrow)) return { label: 'TOMORROW', dateDisplay };
    return { label: d.toLocaleDateString('en-SG', { weekday: 'long' }).toUpperCase(), dateDisplay };
}

/** Add N days to a YYYY-MM-DD string */
function addDays(dateStr: string, n: number): string {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return toDateStr(d);
}

/**
 * Build the list of dates to show as sections.
 * Includes: all event dates + selected date + up to 2 context days after selected date.
 * Sorted chronologically, deduplicated.
 */
function buildSectionDates(eventDatesSet: Set<string>, selectedDate: string): string[] {
    const dates = new Set<string>(eventDatesSet);

    // Always include selected date + 2 days of context after it
    dates.add(selectedDate);
    dates.add(addDays(selectedDate, 1));
    dates.add(addDays(selectedDate, 2));

    return Array.from(dates).sort();
}

// ── Main Screen ────────────────────────────────────────────────
export default function EventsScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const router = useRouter();
    const navigation = useNavigation();
    const { bottom } = useSafeAreaInsets();

    const scrollToTodayRef = useRef<(() => void) | null>(null);

    // Scroll to today when switching to Events tab
    useFocusEffect(
        useCallback(() => {
            scrollToTodayRef.current?.();
        }, []),
    );

    // Scroll to today when re-tapping the already-active Events tab
    useEffect(() => {
        const parent = navigation.getParent();
        if (!parent) return;
        const unsubscribe = parent.addListener('tabPress' as const, () => {
            scrollToTodayRef.current?.();
        });
        return unsubscribe;
    }, [navigation]);

    const todayStr = toDateStr(new Date());
    const [selectedDate, setSelectedDate] = useState(todayStr);
    const [allEvents, setAllEvents] = useState<AgencyEvent[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const isPA = user?.role === 'pa' || user?.role === 'admin';
    const canCreateEvents = user?.role && ['admin', 'director', 'manager', 'pa'].includes(user.role);

    const [eventError, setEventError] = useState<string | null>(null);

    const loadEvents = useCallback(async () => {
        if (!user?.id) return;
        setEventError(null);
        try {
            const { data, error } = isPA ? await fetchAllEvents() : await fetchEvents(user.id);
            if (error) {
                setEventError(error);
            } else {
                setAllEvents(data);
            }
        } catch {
            setEventError('Failed to load events');
        } finally {
            setIsLoading(false);
        }
    }, [user?.id, isPA]);

    useFocusEffect(
        useCallback(() => {
            loadEvents();
        }, [loadEvents]),
    );

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadEvents();
        setRefreshing(false);
    }, [loadEvents]);

    // ── Scroll machinery ───────────────────────────────────────
    const scrollRef = useRef<ScrollView>(null);
    const sectionOffsets = useRef<Map<string, number>>(new Map());
    const pendingScroll = useRef<string | null>(null);

    const scrollToDate = useCallback((date: string) => {
        const y = sectionOffsets.current.get(date);
        if (y != null) {
            scrollRef.current?.scrollTo({ y, animated: true });
            pendingScroll.current = null;
        }
    }, []);

    // Called by each section's onLayout — records offset and fulfils pending scroll
    const handleSectionLayout = useCallback(
        (date: string, y: number) => {
            sectionOffsets.current.set(date, y);
            if (pendingScroll.current === date) {
                scrollToDate(date);
            }
        },
        [scrollToDate],
    );

    // Scroll to selected date when it changes
    const prevSelectedDate = useRef(selectedDate);
    useEffect(() => {
        if (prevSelectedDate.current === selectedDate) return;
        prevSelectedDate.current = selectedDate;

        // Clear stale offsets — sections may have changed
        sectionOffsets.current.clear();

        pendingScroll.current = selectedDate;
        // Try immediately (works if section existed before and offset is still cached)
        scrollToDate(selectedDate);
        // If section is new, handleSectionLayout will fulfil the pending scroll on measure
    }, [selectedDate, scrollToDate]);

    // ── Section data ───────────────────────────────────────────
    const eventDates = useMemo(() => new Set(allEvents.map((e) => e.event_date)), [allEvents]);

    // Build sections: event dates + selected date + context days
    const allSections = useMemo(() => {
        const sectionDates = buildSectionDates(eventDates, selectedDate);

        // Group events by date
        const eventsByDate = new Map<string, AgencyEvent[]>();
        for (const ev of allEvents) {
            const arr = eventsByDate.get(ev.event_date);
            if (arr) arr.push(ev);
            else eventsByDate.set(ev.event_date, [ev]);
        }

        return sectionDates.map((date) => {
            const events = (eventsByDate.get(date) ?? []).sort((a, b) => a.start_time.localeCompare(b.start_time));
            return { date, events };
        });
    }, [allEvents, eventDates, selectedDate]);

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <ScreenHeader title="Events" />
                <LoadingState />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <ScreenHeader title="Events" />

            {eventError && <ErrorBanner message={eventError} onRetry={loadEvents} />}

            <InlineCalendar
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                eventDates={eventDates}
                colors={colors}
                scrollToTodayRef={scrollToTodayRef}
            />

            <ScrollView
                testID="events-list"
                ref={scrollRef}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
                }
            >
                {allSections.map((section) => {
                    const { label, dateDisplay } = formatSectionHeader(section.date, todayStr);
                    const isToday = section.date === todayStr;
                    const isEmpty = section.events.length === 0;

                    return (
                        <View
                            key={section.date}
                            onLayout={(e) => handleSectionLayout(section.date, e.nativeEvent.layout.y)}
                        >
                            {/* Section header — compact for empty dates, normal for dates with events */}
                            <View
                                style={[
                                    isEmpty ? styles.sectionHeaderCompact : styles.sectionHeader,
                                    { borderBottomColor: colors.border },
                                ]}
                                accessibilityRole="header"
                            >
                                <Text
                                    style={[
                                        styles.sectionLabel,
                                        { color: isToday ? colors.accent : colors.textPrimary },
                                    ]}
                                >
                                    {label}
                                </Text>
                                <Text style={[styles.sectionDate, { color: colors.textTertiary }]}>{dateDisplay}</Text>
                                {isEmpty && (
                                    <Text style={[styles.noEventsInline, { color: colors.textTertiary }]}>
                                        No Events
                                    </Text>
                                )}
                            </View>

                            {/* Event cards */}
                            {section.events.map((event) => (
                                <View key={event.id} testID={`events-card-${event.id}`} style={styles.eventCardWrap}>
                                    <EventCard
                                        event={event}
                                        onPress={() => router.push(`/(tabs)/events/${event.id}`)}
                                        colors={colors}
                                    />
                                </View>
                            ))}
                        </View>
                    );
                })}
            </ScrollView>

            {canCreateEvents && (
                <TouchableOpacity
                    testID="events-create-button"
                    style={[styles.fab, { backgroundColor: colors.accent, bottom: 28 + bottom }]}
                    onPress={() => router.push('/(tabs)/events/create')}
                    activeOpacity={0.85}
                    accessibilityLabel="Create event"
                >
                    <Ionicons name="add" size={28} color={colors.textInverse} />
                </TouchableOpacity>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    listContent: { paddingBottom: 100 },

    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 8,
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    sectionHeaderCompact: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 8,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    sectionLabel: {
        fontSize: 13,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    sectionDate: {
        fontSize: 13,
        fontWeight: '500',
    },
    noEventsInline: {
        fontSize: 13,
        fontWeight: '500',
        marginLeft: 'auto',
        color: '#999',
    },
    eventCardWrap: {
        paddingHorizontal: 16,
        paddingTop: 8,
    },

    fab: {
        position: 'absolute',
        right: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
    },
});
