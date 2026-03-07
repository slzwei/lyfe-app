import Avatar from '@/components/Avatar';
import LoadingState from '@/components/LoadingState';
import ScreenHeader from '@/components/ScreenHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { fetchAllEvents, fetchEvents } from '@/lib/events';
import { isMockMode } from '@/lib/mockMode';
import { MOCK_EVENTS } from '@/lib/mockData';
import { formatTime, toDateStr } from '@/lib/dateTime';
import { AVATAR_COLORS } from '@/constants/ui';
import type { AgencyEvent } from '@/types/event';
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from '@/types/event';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    FlatList,
    PanResponder,
    RefreshControl,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

// ── Calendar layout constants ──────────────────────────────────
const CAL_HEADER_H = 44;   // nav row
const CAL_LABELS_H = 24;   // Mon–Sun initials
const CAL_ROW_H = 44;   // each week row
const CAL_HANDLE_H = 20;   // drag handle
const CAL_WEEK_H = CAL_HEADER_H + CAL_LABELS_H + CAL_ROW_H + CAL_HANDLE_H;       // 132
const CAL_MONTH_H = CAL_HEADER_H + CAL_LABELS_H + CAL_ROW_H * 6 + CAL_HANDLE_H;  // 352

const HIT = { top: 12, bottom: 12, left: 12, right: 12 };
const DAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
/** Build a 6-row (42 cell) Mon-first calendar grid for a given month */
function buildMonthGrid(year: number, month: number): (Date | null)[][] {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDow = (firstDay.getDay() + 6) % 7; // Mon=0, Sun=6

    const cells: (Date | null)[] = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) cells.push(new Date(year, month, d));
    while (cells.length < 42) cells.push(null); // always 6 rows

    const weeks: (Date | null)[][] = [];
    for (let i = 0; i < 42; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
}

// ── CalendarPicker ─────────────────────────────────────────────
interface CalendarPickerProps {
    selectedDate: string;
    onSelectDate: (date: string) => void;
    eventDates: Set<string>;
    colors: any;
}

function CalendarPicker({ selectedDate, onSelectDate, eventDates, colors }: CalendarPickerProps) {
    const todayStr = toDateStr(new Date());

    // ── State ──
    const expandAnim = useRef(new Animated.Value(0)).current;
    const isExpandedRef = useRef(false);
    const [isExpanded, setIsExpanded] = useState(false);

    const [displayMonth, setDisplayMonth] = useState(() => {
        const d = new Date(selectedDate + 'T00:00:00');
        return { year: d.getFullYear(), month: d.getMonth() };
    });

    // ── Grid ──
    const monthGrid = useMemo(
        () => buildMonthGrid(displayMonth.year, displayMonth.month),
        [displayMonth],
    );

    // Row index containing selectedDate (used to position grid in week view)
    const weekRowIndex = useMemo(() => {
        const idx = monthGrid.findIndex(week =>
            week.some(d => d && toDateStr(d) === selectedDate),
        );
        return idx >= 0 ? idx : 0;
    }, [monthGrid, selectedDate]);

    // ── Animated values ──
    const calHeight = expandAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [CAL_WEEK_H, CAL_MONTH_H],
        extrapolate: 'clamp',
    });

    const gridClipH = expandAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [CAL_ROW_H, CAL_ROW_H * 6],
        extrapolate: 'clamp',
    });

    // Translate the grid up so the selected week's row sits at y=0 in week view
    const gridTranslateY = expandAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [-weekRowIndex * CAL_ROW_H, 0],
        extrapolate: 'clamp',
    });

    const weekNavOpacity = expandAnim.interpolate({
        inputRange: [0, 0.3], outputRange: [1, 0], extrapolate: 'clamp',
    });
    const monthNavOpacity = expandAnim.interpolate({
        inputRange: [0.7, 1], outputRange: [0, 1], extrapolate: 'clamp',
    });

    // ── animateTo (stable ref so PanResponder closure never goes stale) ──
    const animateToRef = useRef<(v: number) => void>(() => { });
    animateToRef.current = (toValue: number) => {
        const willExpand = toValue === 1;
        isExpandedRef.current = willExpand;
        setIsExpanded(willExpand);

        if (willExpand) {
            const d = new Date(selectedDate + 'T00:00:00');
            setDisplayMonth({ year: d.getFullYear(), month: d.getMonth() });
        }

        Animated.spring(expandAnim, {
            toValue,
            useNativeDriver: false,
            tension: 65,
            friction: 12,
        }).start();
    };

    // ── PanResponder — covers full calendar surface ──
    // onStartShouldSetPanResponder stays false so child taps (day cells, arrows) fire normally.
    // onMoveShouldSetPanResponder activates only when the user actually starts dragging.
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (_, gs) =>
                Math.abs(gs.dy) > 6 && Math.abs(gs.dy) > Math.abs(gs.dx) * 1.5,
            onPanResponderMove: (_, gs) => {
                const base = isExpandedRef.current ? 1 : 0;
                const range = CAL_MONTH_H - CAL_WEEK_H;
                const next = Math.max(0, Math.min(1, base + gs.dy / range));
                expandAnim.setValue(next);
            },
            onPanResponderRelease: (_, gs) => {
                const current = (expandAnim as any)._value as number;
                const shouldExpand = Math.abs(gs.vy) > 0.3 ? gs.vy > 0 : current > 0.5;
                animateToRef.current(shouldExpand ? 1 : 0);
            },
        }),
    ).current;

    // ── Navigation ──
    const navigateWeek = (delta: number) => {
        const d = new Date(selectedDate + 'T00:00:00');
        d.setDate(d.getDate() + delta * 7);
        const next = toDateStr(d);
        onSelectDate(next);
        const nd = new Date(next + 'T00:00:00');
        setDisplayMonth({ year: nd.getFullYear(), month: nd.getMonth() });
    };

    const navigateMonth = (delta: number) => {
        setDisplayMonth(prev => {
            const d = new Date(prev.year, prev.month + delta, 1);
            return { year: d.getFullYear(), month: d.getMonth() };
        });
    };

    // ── Labels ──
    const monthLabel = new Date(displayMonth.year, displayMonth.month, 1)
        .toLocaleDateString('en-SG', { month: 'long', year: 'numeric' });

    const currentWeek = monthGrid[weekRowIndex] ?? [];
    const firstOfWeek = currentWeek.find(Boolean);
    const lastOfWeek = [...currentWeek].reverse().find(Boolean);
    const weekLabel = firstOfWeek && lastOfWeek
        ? `${firstOfWeek.toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })} – ${lastOfWeek.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}`
        : '';

    return (
        <Animated.View
            style={[
                calStyles.container,
                { backgroundColor: colors.cardBackground, height: calHeight, borderBottomColor: colors.border },
            ]}
            {...panResponder.panHandlers}
        >
            {/* ── Header ── */}
            <View style={calStyles.header}>
                {/* Week nav — fades out as calendar expands */}
                <Animated.View
                    style={[calStyles.navRow, { opacity: weekNavOpacity }]}
                    pointerEvents={isExpanded ? 'none' : 'auto'}
                >
                    <TouchableOpacity onPress={() => navigateWeek(-1)} hitSlop={HIT} accessibilityLabel="Previous week">
                        <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                    <Text style={[calStyles.navLabel, { color: colors.textSecondary }]}>{weekLabel}</Text>
                    <TouchableOpacity onPress={() => navigateWeek(1)} hitSlop={HIT} accessibilityLabel="Next week">
                        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                </Animated.View>

                {/* Month nav — fades in as calendar expands */}
                <Animated.View
                    style={[calStyles.navRow, calStyles.navRowOverlay, { opacity: monthNavOpacity }]}
                    pointerEvents={isExpanded ? 'auto' : 'none'}
                >
                    <TouchableOpacity onPress={() => navigateMonth(-1)} hitSlop={HIT} accessibilityLabel="Previous month">
                        <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                    <Text style={[calStyles.navLabel, { color: colors.textPrimary }]}>{monthLabel}</Text>
                    <TouchableOpacity onPress={() => navigateMonth(1)} hitSlop={HIT} accessibilityLabel="Next month">
                        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                </Animated.View>
            </View>

            {/* ── Day-of-week initials ── */}
            <View style={calStyles.dayLabels}>
                {DAY_INITIALS.map((lbl, i) => (
                    <View key={i} style={calStyles.dayLabelCell}>
                        <Text style={[calStyles.dayLabelText, { color: colors.textTertiary }]}>{lbl}</Text>
                    </View>
                ))}
            </View>

            {/* ── Grid clip — height animates, translateY scrolls to selected week ── */}
            <Animated.View style={{ height: gridClipH, overflow: 'hidden' }}>
                <Animated.View style={{ transform: [{ translateY: gridTranslateY }] }}>
                    {monthGrid.map((week, wi) => (
                        <View key={wi} style={calStyles.weekRow}>
                            {week.map((date, di) => {
                                if (!date) return <View key={di} style={calStyles.dayCell} />;

                                const ds = toDateStr(date);
                                const isSelected = ds === selectedDate;
                                const isToday = ds === todayStr;
                                const hasEvent = eventDates.has(ds);
                                const isOtherMon = date.getMonth() !== displayMonth.month;

                                return (
                                    <TouchableOpacity
                                        key={di}
                                        style={calStyles.dayCell}
                                        onPress={() => {
                                            onSelectDate(ds);
                                            if (isOtherMon) {
                                                setDisplayMonth({ year: date.getFullYear(), month: date.getMonth() });
                                            }
                                        }}
                                        activeOpacity={0.7}
                                        accessibilityLabel={ds}
                                        accessibilityRole="button"
                                        accessibilityState={{ selected: isSelected }}
                                    >
                                        <View style={[
                                            calStyles.dayInner,
                                            isSelected && { backgroundColor: colors.accent },
                                            isToday && !isSelected && { borderWidth: 1.5, borderColor: colors.accent },
                                        ]}>
                                            <Text style={[
                                                calStyles.dayText,
                                                {
                                                    color: isSelected
                                                        ? '#FFFFFF'
                                                        : isToday
                                                            ? colors.accent
                                                            : isOtherMon
                                                                ? colors.textTertiary
                                                                : colors.textPrimary,
                                                    fontWeight: isSelected ? '700' : '500',
                                                },
                                            ]}>
                                                {date.getDate()}
                                            </Text>
                                        </View>
                                        {hasEvent && (
                                            <View style={[
                                                calStyles.dot,
                                                { backgroundColor: isSelected ? '#FFFFFF' : colors.accent },
                                            ]} />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    ))}
                </Animated.View>
            </Animated.View>

            {/* ── Drag handle — visual affordance only, pan is on the whole calendar ── */}
            <View style={calStyles.handleArea}>
                <View style={[calStyles.handlePill, { backgroundColor: colors.divider }]} />
            </View>
        </Animated.View>
    );
}

const calStyles = StyleSheet.create({
    container: {
        overflow: 'hidden',
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    header: {
        height: CAL_HEADER_H,
        justifyContent: 'center',
    },
    navRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
    },
    navRowOverlay: {
        position: 'absolute',
        left: 0,
        right: 0,
    },
    navLabel: {
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    dayLabels: {
        height: CAL_LABELS_H,
        flexDirection: 'row',
        paddingHorizontal: 4,
    },
    dayLabelCell: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dayLabelText: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    weekRow: {
        height: CAL_ROW_H,
        flexDirection: 'row',
        paddingHorizontal: 4,
    },
    dayCell: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
    },
    dayInner: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dayText: {
        fontSize: 14,
    },
    dot: {
        width: 4,
        height: 4,
        borderRadius: 2,
    },
    handleArea: {
        height: CAL_HANDLE_H,
        alignItems: 'center',
        justifyContent: 'center',
    },
    handlePill: {
        width: 36,
        height: 4,
        borderRadius: 2,
        opacity: 0.6,
    },
});

// ── Event Card ─────────────────────────────────────────────────
interface EventCardProps {
    event: AgencyEvent;
    onPress: () => void;
    colors: any;
}

function EventCard({ event, onPress, colors }: EventCardProps) {
    const typeColor = EVENT_TYPE_COLORS[event.event_type];
    const todayStr = toDateStr(new Date());
    const isLiveRoadshow = (() => {
        if (event.event_type !== 'roadshow' || event.event_date !== todayStr) return false;
        const now = new Date();
        const nowMins = now.getHours() * 60 + now.getMinutes();
        const [sh, sm] = event.start_time.split(':').map(Number);
        if (nowMins < sh * 60 + sm) return false;
        if (event.end_time) {
            const [eh, em] = event.end_time.split(':').map(Number);
            if (nowMins >= eh * 60 + em) return false;
        }
        return true;
    })();

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
        ...event.attendees.map(a => ({ key: a.id, name: a.full_name ?? '?', avatarUrl: a.avatar_url })),
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
                            <View style={[cardStyles.livePill, { backgroundColor: '#22C55E18' }]}>
                                <Animated.View style={[cardStyles.liveDot, { opacity: livePulse }]} />
                                <Text style={cardStyles.liveText}>LIVE</Text>
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
                                        { marginLeft: i === 0 ? 0 : -10, borderColor: colors.cardBackground, zIndex: visibleAttendees.length - i },
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
                            <View style={[cardStyles.overflowChip, { backgroundColor: colors.surfaceSecondary, borderColor: colors.cardBackground, marginLeft: -10 }]}>
                                <Text style={[cardStyles.overflowText, { color: colors.textTertiary }]}>+{overflow}</Text>
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
    title: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    location: { fontSize: 12 },
    attendees: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    avatarChip: {
        width: 26, height: 26, borderRadius: 13,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1.5, borderColor: '#FFFFFF',
        overflow: 'hidden',
    },
    overflowChip: {
        width: 26, height: 26, borderRadius: 13,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1.5,
    },
    overflowText: { fontSize: 9, fontWeight: '700' },
    livePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E' },
    liveText: { fontSize: 10, fontWeight: '800', color: '#22C55E', letterSpacing: 0.5 },
});

// ── Main Screen ────────────────────────────────────────────────
export default function EventsScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const router = useRouter();
    const MOCK_OTP = isMockMode();

    const todayStr = toDateStr(new Date());
    const [selectedDate, setSelectedDate] = useState(todayStr);
    const [allEvents, setAllEvents] = useState<AgencyEvent[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [isLoading, setIsLoading] = useState(!MOCK_OTP);

    const isPA = user?.role === 'pa' || user?.role === 'admin';

    const loadEvents = useCallback(async () => {
        if (MOCK_OTP) {
            setAllEvents(MOCK_EVENTS);
            return;
        }
        if (!user?.id) return;

        const { data, error } = isPA
            ? await fetchAllEvents()
            : await fetchEvents(user.id);

        if (!error) setAllEvents(data);
        setIsLoading(false);
    }, [user?.id, isPA]);

    useFocusEffect(
        useCallback(() => { loadEvents(); }, [loadEvents])
    );

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadEvents();
        setRefreshing(false);
    }, [loadEvents]);

    const eventDates = useMemo(
        () => new Set(allEvents.map(e => e.event_date)),
        [allEvents],
    );

    const dayEvents = useMemo(
        () => allEvents.filter(e => e.event_date === selectedDate),
        [allEvents, selectedDate],
    );

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <ScreenHeader title="Events" />
                <LoadingState />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScreenHeader title="Events" />

            <CalendarPicker
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                eventDates={eventDates}
                colors={colors}
            />

            <FlatList
                data={dayEvents}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="calendar-outline" size={48} color={colors.textTertiary} />
                        <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No events</Text>
                        <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
                            Nothing scheduled for this day
                        </Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <EventCard
                        event={item}
                        onPress={() => router.push(`/events/${item.id}` as any)}
                        colors={colors}
                    />
                )}
            />

            <TouchableOpacity
                style={[styles.fab, { backgroundColor: colors.accent }]}
                onPress={() => router.push('/events/create' as any)}
                activeOpacity={0.85}
                accessibilityLabel="Create event"
            >
                <Ionicons name="add" size={28} color="#FFFFFF" />
            </TouchableOpacity>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    listContent: { padding: 16, paddingBottom: 100 },

    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 60,
        gap: 8,
    },
    emptyTitle: { fontSize: 17, fontWeight: '600' },
    emptySubtitle: { fontSize: 14 },

    fab: {
        position: 'absolute',
        right: 20,
        bottom: 28,
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
