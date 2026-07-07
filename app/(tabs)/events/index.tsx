import EmptyState from '@/components/EmptyState';
import ErrorBanner from '@/components/ErrorBanner';
import EventCard from '@/components/events/EventCard';
import InlineCalendar from '@/components/events/InlineCalendar';
import LoadingState from '@/components/LoadingState';
import { DarkHeroCard } from '@/components/roadshow/atoms/DarkHeroCard';
import { EventStatusPill } from '@/components/roadshow/atoms/EventStatusPill';
import { getRoadshowColors } from '@/constants/roadshow/tokens';
import { RoadshowType, TropicFonts } from '@/constants/roadshow/typography';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useViewMode } from '@/contexts/ViewModeContext';
import { eventsWindowStart, fetchAllEvents, fetchEvents, fetchTeamEvents } from '@/lib/events';
import { formatTime, toDateStr, isEventLive } from '@/lib/dateTime';
import type { AgencyEvent } from '@/types/event';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

function formatMonthYear(date: Date): string {
    return date.toLocaleDateString('en-SG', { month: 'short', year: 'numeric' }).toUpperCase();
}

function getIsoWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
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

function splitTitle(title: string): { place: string; sub?: string } {
    const m = title.trim().match(/^(.+?)[,·]\s*(.+)$/);
    if (m) return { place: m[1], sub: m[2].replace(/\.$/, '') };
    return { place: title.trim() };
}

// ── Main Screen ────────────────────────────────────────────────
export default function EventsScreen() {
    const { colors, resolved } = useTheme();
    const stage = getRoadshowColors(resolved);
    const { user } = useAuth();
    const router = useRouter();
    const navigation = useNavigation();

    const scrollToTodayRef = useRef<(() => void) | null>(null);

    // Jump to today ONLY when the user re-taps the Events tab while already
    // on it (the iOS-native pattern). tabPress fires before navigation, from
    // a navigator-level listener, for EVERY tab's button — including when
    // switching into or away from Events — so both checks below matter.
    // Back-nav from event detail and tab switches preserve browsing position.
    useEffect(() => {
        const parent = navigation.getParent();
        if (!parent) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const unsubscribe = (parent as any).addListener('tabPress', (e: { target?: string }) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const state = (parent as any).getState?.();
            const focused = state?.routes?.[state.index];
            if (focused?.name !== 'events') return; // not on Events → switching in, keep position
            if (e?.target !== focused.key) return; // on Events but pressed another tab
            scrollToTodayRef.current?.();
        });
        return unsubscribe;
    }, [navigation]);

    const todayStr = toDateStr(new Date());
    const [selectedDate, setSelectedDate] = useState(todayStr);
    const [allEvents, setAllEvents] = useState<AgencyEvent[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const canSeeAllEvents = user?.role === 'pa' || user?.role === 'ro' || user?.role === 'admin';
    const canCreateEvents = user?.role && ['admin', 'director', 'manager', 'pa', 'ro'].includes(user.role);

    // Managers/directors (in manager view) can flip between their own
    // calendar and their team's. PA/RO/admin already see everything.
    const { viewMode } = useViewMode();
    const canToggleTeam = (user?.role === 'manager' || user?.role === 'director') && viewMode === 'manager';
    const [calendarScope, setCalendarScope] = useState<'mine' | 'team'>('mine');
    useEffect(() => {
        if (!canToggleTeam) setCalendarScope('mine');
    }, [canToggleTeam]);

    const [eventError, setEventError] = useState<string | null>(null);

    const loadEvents = useCallback(async () => {
        if (!user?.id) return;
        setEventError(null);
        try {
            const { data, error } =
                canToggleTeam && calendarScope === 'team'
                    ? await fetchTeamEvents(user.id, user.role)
                    : canSeeAllEvents
                      ? await fetchAllEvents(undefined, 50, eventsWindowStart())
                      : await fetchEvents(user.id);
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
    }, [user?.id, user?.role, canSeeAllEvents, canToggleTeam, calendarScope]);

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
    const pendingScroll = useRef<{ date: string; animated: boolean } | null>(null);

    const scrollToDate = useCallback((date: string, animated = true) => {
        const y = sectionOffsets.current.get(date);
        if (y != null) {
            scrollRef.current?.scrollTo({ y, animated });
        }
    }, []);

    const handleSectionLayout = useCallback((date: string, y: number) => {
        const prev = sectionOffsets.current.get(date);
        sectionOffsets.current.set(date, y);
        const pending = pendingScroll.current;
        if (pending?.date === date && prev !== y) {
            scrollRef.current?.scrollTo({ y, animated: pending.animated });
        }
    }, []);

    const isUserScrolling = useRef(false);
    const userScrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(
        () => () => {
            if (userScrollTimer.current) clearTimeout(userScrollTimer.current);
        },
        [],
    );

    const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (!isUserScrolling.current) return;
        const scrollY = e.nativeEvent.contentOffset.y + 1;
        let topDate: string | undefined;
        let topOffset = -1;
        for (const [date, y] of sectionOffsets.current) {
            if (y <= scrollY && y > topOffset) {
                topOffset = y;
                topDate = date;
            }
        }
        if (topDate === undefined) return;
        const next = topDate;
        setSelectedDate((prev) => (prev !== next ? next : prev));
    }, []);

    const handleScrollBeginDrag = useCallback(() => {
        isUserScrolling.current = true;
        if (userScrollTimer.current) {
            clearTimeout(userScrollTimer.current);
            userScrollTimer.current = null;
        }
    }, []);

    const handleScrollEndDrag = useCallback(() => {
        userScrollTimer.current = setTimeout(() => {
            isUserScrolling.current = false;
            userScrollTimer.current = null;
        }, 200);
    }, []);

    const handleMomentumScrollBegin = useCallback(() => {
        if (userScrollTimer.current) {
            clearTimeout(userScrollTimer.current);
            userScrollTimer.current = null;
        }
    }, []);

    const handleMomentumScrollEnd = useCallback(() => {
        if (userScrollTimer.current) {
            clearTimeout(userScrollTimer.current);
            userScrollTimer.current = null;
        }
        isUserScrolling.current = false;
    }, []);

    const prevSelectedDate = useRef(selectedDate);
    useEffect(() => {
        if (prevSelectedDate.current === selectedDate) return;
        prevSelectedDate.current = selectedDate;
        if (isUserScrolling.current) return;

        pendingScroll.current = { date: selectedDate, animated: true };
        scrollToDate(selectedDate);
        const timeout = setTimeout(() => {
            pendingScroll.current = null;
        }, 500);
        return () => clearTimeout(timeout);
    }, [selectedDate, scrollToDate]);

    // ── Live roadshow banner ───────────────────────────────────
    const liveRoadshow = useMemo(
        () => allEvents.find((e) => e.event_type === 'roadshow' && isEventLive(e.event_date, e.start_time, e.end_time)),
        [allEvents],
    );

    // ── Section data ───────────────────────────────────────────
    const eventDates = useMemo(() => new Set(allEvents.map((e) => e.event_date)), [allEvents]);

    const allSections = useMemo(() => {
        const sectionDates = buildSectionDates(eventDates, selectedDate);

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

    const didInitialScrollRef = useRef(false);
    useEffect(() => {
        if (didInitialScrollRef.current) return;
        if (isLoading || allSections.length === 0) return;
        didInitialScrollRef.current = true;

        pendingScroll.current = { date: selectedDate, animated: false };
        scrollToDate(selectedDate, false);
        const timeout = setTimeout(() => {
            pendingScroll.current = null;
        }, 1500);
        return () => clearTimeout(timeout);
    }, [isLoading, allSections.length, selectedDate, scrollToDate]);

    const now = new Date();
    const eyebrowText = `${formatMonthYear(now)} · WK ${getIsoWeek(now)}`;

    const renderEditorialHeader = () => (
        <View style={styles.editorialHeader}>
            <View style={styles.editorialTextCol}>
                <Text style={[RoadshowType.eyebrow, { color: colors.textTertiary }]}>{eyebrowText}</Text>
                <Text style={[styles.editorialTitle, { color: colors.textPrimary }]}>
                    Events, <Text style={[styles.editorialItalic, { color: colors.accent }]}>roadshows</Text>.
                </Text>
            </View>
            {canCreateEvents ? (
                <Pressable
                    testID="events-create-button"
                    onPress={() => router.push('/(tabs)/events/create')}
                    style={({ pressed }) => [
                        styles.newPill,
                        { borderColor: colors.accent, opacity: pressed ? 0.7 : 1 },
                    ]}
                    accessibilityLabel="Create event"
                >
                    <Text style={[styles.newPillText, { color: colors.accent }]}>+ New</Text>
                </Pressable>
            ) : null}
        </View>
    );

    const renderScopeToggle = () => {
        if (!canToggleTeam) return null;
        return (
            <View style={styles.scopeRow}>
                {(['mine', 'team'] as const).map((scope) => {
                    const active = calendarScope === scope;
                    return (
                        <Pressable
                            key={scope}
                            testID={`events-scope-${scope}`}
                            onPress={() => setCalendarScope(scope)}
                            style={[
                                styles.scopeChip,
                                {
                                    borderColor: active ? colors.accent : colors.border,
                                    backgroundColor: active ? colors.accent + '14' : 'transparent',
                                },
                            ]}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                            accessibilityLabel={scope === 'mine' ? 'My calendar' : "Team's calendar"}
                        >
                            <Text
                                style={[styles.scopeChipText, { color: active ? colors.accent : colors.textTertiary }]}
                            >
                                {scope === 'mine' ? 'Mine' : 'Team'}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>
        );
    };

    const renderLiveBanner = () => {
        if (!liveRoadshow) return null;
        const { place, sub } = splitTitle(liveRoadshow.title);
        return (
            <Pressable
                onPress={() => router.push(`/(tabs)/events/${liveRoadshow.id}`)}
                style={styles.liveBannerWrap}
                accessibilityLabel={`Open live roadshow ${liveRoadshow.title}`}
            >
                <DarkHeroCard glow="terra" glowSize="md">
                    <EventStatusPill status="live" />
                    <Text style={[styles.liveTitle, { color: '#F4EEE1' }]}>
                        {place}
                        {sub ? (
                            <>
                                ,{'\n'}
                                <Text style={[styles.liveTitleItalic, { color: stage.live }]}>{sub}</Text>.
                            </>
                        ) : null}
                    </Text>
                    <Text style={[styles.liveMeta, { color: 'rgba(244,238,225,0.6)' }]}>
                        {formatTime(liveRoadshow.start_time)}
                        {liveRoadshow.end_time ? ` – ${formatTime(liveRoadshow.end_time)}` : ''} · tap to open
                    </Text>
                </DarkHeroCard>
            </Pressable>
        );
    };

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                {renderEditorialHeader()}
                <LoadingState />
            </SafeAreaView>
        );
    }

    // First-run empty state teaches the screen instead of three bare
    // "No Events" header rows.
    if (allEvents.length === 0 && !eventError) {
        const teamScope = calendarScope === 'team';
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                {renderEditorialHeader()}
                {renderScopeToggle()}
                <EmptyState
                    icon="calendar-outline"
                    title={teamScope ? 'Nothing on for your team' : 'No events yet'}
                    subtitle={
                        teamScope
                            ? "Events your team members create or attend will show up here once they're scheduled."
                            : canCreateEvents
                              ? 'Roadshows, meetings and exam sittings you schedule will all land here, laid out day by day.'
                              : "When you're added to a roadshow, meeting or exam sitting, it'll show up here so you always know what's on."
                    }
                    actionLabel={!teamScope && canCreateEvents ? 'Create an event' : undefined}
                    onAction={!teamScope && canCreateEvents ? () => router.push('/(tabs)/events/create') : undefined}
                />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {renderEditorialHeader()}

            {renderScopeToggle()}

            {eventError && <ErrorBanner message={eventError} onRetry={loadEvents} />}

            {renderLiveBanner()}

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
                scrollEventThrottle={32}
                onScroll={handleScroll}
                onScrollBeginDrag={handleScrollBeginDrag}
                onScrollEndDrag={handleScrollEndDrag}
                onMomentumScrollBegin={handleMomentumScrollBegin}
                onMomentumScrollEnd={handleMomentumScrollEnd}
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
                            <View
                                style={[
                                    isEmpty ? styles.sectionHeaderCompact : styles.sectionHeader,
                                    { borderBottomColor: colors.hairline },
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
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    listContent: { paddingBottom: 100 },

    editorialHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 8,
        gap: 12,
    },
    editorialTextCol: { flex: 1, gap: 4 },
    editorialTitle: {
        fontSize: 30,
        fontFamily: TropicFonts.serif,
        fontWeight: '400',
        letterSpacing: -0.7,
        lineHeight: 32,
    },
    editorialItalic: { fontFamily: TropicFonts.serifItalic, fontWeight: '500' },
    newPill: {
        paddingHorizontal: 11,
        paddingVertical: 6,
        borderRadius: 14,
        borderWidth: 1,
    },
    newPillText: { fontSize: 11, fontFamily: TropicFonts.uiSemiBold },

    scopeRow: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 20,
        paddingBottom: 8,
    },
    scopeChip: {
        paddingHorizontal: 14,
        paddingVertical: 5,
        borderRadius: 14,
        borderWidth: 1,
    },
    scopeChipText: { fontSize: 12, fontFamily: TropicFonts.uiSemiBold },

    liveBannerWrap: {
        paddingHorizontal: 18,
        paddingTop: 4,
        paddingBottom: 8,
    },
    liveTitle: {
        fontSize: 22,
        fontFamily: TropicFonts.serif,
        fontWeight: '500',
        letterSpacing: -0.3,
        lineHeight: 26,
        marginTop: 4,
    },
    liveTitleItalic: { fontFamily: TropicFonts.serifItalic, fontWeight: '500' },
    liveMeta: {
        fontSize: 11.5,
        fontFamily: TropicFonts.ui,
        marginTop: 4,
    },

    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 8,
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    sectionHeaderCompact: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 8,
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    sectionLabel: {
        fontSize: 15,
        fontFamily: TropicFonts.serif,
        fontWeight: '500',
        letterSpacing: -0.2,
    },
    sectionDate: {
        fontSize: 12,
        fontFamily: TropicFonts.ui,
    },
    noEventsInline: {
        fontSize: 11,
        fontFamily: TropicFonts.ui,
        marginLeft: 'auto',
    },
    eventCardWrap: {
        paddingHorizontal: 16,
        paddingTop: 8,
    },
});
