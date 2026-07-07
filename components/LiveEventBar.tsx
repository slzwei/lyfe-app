import { TAB_BAR_HEIGHT } from '@/constants/platform';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { formatTime, isEventLive } from '@/lib/dateTime';
import { fetchTodayEvents } from '@/lib/events';
import type { AgencyEvent } from '@/types/event';
import { useTypedRouter } from '@/hooks/useTypedRouter';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useNavigation } from 'expo-router';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AccessibilityInfo,
    Animated,
    PanResponder,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const BAR_H = 64;
const BAR_MARGIN_H = 16;
const BAR_MARGIN_BOTTOM = 8;
const SLIDE_INTERVAL = 5000;
const FADE_DURATION = 400;
const RECHECK_INTERVAL = 60000;

const LIVE_BAR_TOTAL_H = BAR_H + BAR_MARGIN_BOTTOM;

export default memo(function LiveEventBar() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const router = useTypedRouter();
    const pathname = usePathname();
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const isPa = user?.role === 'pa' || user?.role === 'ro';
    const onHomeTab = pathname === '/' || pathname.startsWith('/home');

    const [allEvents, setAllEvents] = useState<AgencyEvent[]>([]);
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
    const [currentIndex, setCurrentIndex] = useState(0);
    const [pendingFadeIn, setPendingFadeIn] = useState(false);
    const [screenReaderOn, setScreenReaderOn] = useState(false);

    const fadeAnim = useRef(new Animated.Value(1)).current;
    const entranceAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const swipeAnim = useRef(new Animated.Value(0)).current;

    // Track screen reader state
    useEffect(() => {
        const check = async () => {
            const enabled = await AccessibilityInfo.isScreenReaderEnabled();
            setScreenReaderOn(enabled);
        };
        check();
        const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReaderOn);
        return () => sub.remove();
    }, []);

    // Fetch today's events (separate from any screen-level data). The
    // query recomputes "today" on every call, so the bar survives midnight
    // and picks up events created after mount.
    const loadEvents = useCallback(async () => {
        if (!user?.id) return;
        const result = await fetchTodayEvents(user.id);
        if (result?.data) setAllEvents(result.data);
    }, [user?.id]);

    useEffect(() => {
        loadEvents();
    }, [loadEvents]);

    // Refetch every 60s — re-evaluates liveness AND catches new events
    // (the old interval only re-mapped the stale first fetch).
    useEffect(() => {
        const interval = setInterval(() => {
            loadEvents();
        }, RECHECK_INTERVAL);
        return () => clearInterval(interval);
    }, [loadEvents]);

    // Filter to currently live, non-dismissed events
    const liveEvents = useMemo(
        () => allEvents.filter((e) => isEventLive(e.event_date, e.start_time, e.end_time) && !dismissedIds.has(e.id)),
        [allEvents, dismissedIds],
    );

    const isVisible = liveEvents.length > 0 && onHomeTab;

    // Clamp index when events change
    useEffect(() => {
        if (currentIndex >= liveEvents.length && liveEvents.length > 0) {
            setCurrentIndex(0);
        }
    }, [liveEvents.length, currentIndex]);

    // Entrance/exit animation
    useEffect(() => {
        Animated.spring(entranceAnim, {
            toValue: isVisible ? 1 : 0,
            tension: 65,
            friction: 12,
            useNativeDriver: true,
        }).start();
    }, [isVisible, entranceAnim]);

    // Pulse animation for LIVE dot
    useEffect(() => {
        if (!isVisible) return;
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 0.3, duration: 600, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
            ]),
        );
        loop.start();
        return () => loop.stop();
    }, [isVisible, pulseAnim]);

    // Auto-advance: fade out on interval tick
    useEffect(() => {
        if (liveEvents.length <= 1 || screenReaderOn) return;
        const interval = setInterval(() => {
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: FADE_DURATION / 2,
                useNativeDriver: true,
            }).start(() => {
                // Update index + flag; fade-in happens after React re-renders with new content
                setCurrentIndex((prev) => (prev + 1) % liveEvents.length);
                setPendingFadeIn(true);
            });
        }, SLIDE_INTERVAL);
        return () => clearInterval(interval);
    }, [liveEvents.length, screenReaderOn, fadeAnim]);

    // Fade in after content has updated (runs on the render AFTER index changes)
    useEffect(() => {
        if (!pendingFadeIn) return;
        setPendingFadeIn(false);
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: FADE_DURATION / 2,
            useNativeDriver: true,
        }).start();
    }, [pendingFadeIn, fadeAnim]);

    const handleDismiss = useCallback(() => {
        const visibleIds = new Set(liveEvents.map((e) => e.id));
        setDismissedIds((prev) => new Set([...prev, ...visibleIds]));
    }, [liveEvents]);

    const dismissRef = useRef(handleDismiss);
    dismissRef.current = handleDismiss;

    const panResponder = useMemo(
        () =>
            PanResponder.create({
                onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy),
                onPanResponderMove: (_, g) => {
                    if (g.dx < 0) swipeAnim.setValue(g.dx);
                },
                onPanResponderRelease: (_, g) => {
                    if (g.dx < -80) {
                        Animated.timing(swipeAnim, {
                            toValue: -400,
                            duration: 200,
                            useNativeDriver: true,
                        }).start(() => {
                            dismissRef.current();
                            swipeAnim.setValue(0);
                        });
                    } else {
                        Animated.spring(swipeAnim, {
                            toValue: 0,
                            useNativeDriver: true,
                        }).start();
                    }
                },
            }),
        [swipeAnim],
    );

    const handlePress = useCallback(
        (event: AgencyEvent) => {
            if (isPa) {
                router.push(`/(tabs)/pa/event/${event.id}`);
                return;
            }
            // `initial: false` tells React Navigation to put the events tab's
            // initial route (calendar) below [eventId] in the stack, so back
            // pops to the calendar instead of falling through to home.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (navigation as any).navigate('(tabs)', {
                screen: 'events',
                params: {
                    screen: '[eventId]',
                    initial: false,
                    params: { eventId: event.id },
                },
            });
        },
        [isPa, router, navigation],
    );

    const currentEvent = liveEvents[currentIndex];
    if (!currentEvent && liveEvents.length === 0) return null;

    // Content slide: fades out sliding up, fades in sliding up from below
    const contentTranslateY = fadeAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [10, 0],
    });

    const translateX = entranceAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [400, 0],
    });

    return (
        <Animated.View
            {...panResponder.panHandlers}
            style={[
                styles.wrapper,
                {
                    bottom: TAB_BAR_HEIGHT + BAR_MARGIN_BOTTOM + (Platform.OS === 'android' ? insets.bottom : 0),
                    transform: [{ translateX: Animated.add(translateX, swipeAnim) }],
                    opacity: entranceAnim,
                },
            ]}
            pointerEvents={isVisible ? 'auto' : 'none'}
            testID="live-event-bar"
            accessibilityRole="alert"
            accessibilityLabel={`${liveEvents.length} live event${liveEvents.length !== 1 ? 's' : ''} happening now`}
        >
            <View
                style={[
                    styles.bar,
                    {
                        backgroundColor: colors.cardBackground,
                        shadowColor: colors.textPrimary,
                        borderColor: colors.border,
                    },
                ]}
            >
                {/* Dismiss button */}
                <TouchableOpacity
                    style={styles.dismissBtn}
                    onPress={handleDismiss}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityRole="button"
                    accessibilityLabel="Dismiss live events bar"
                >
                    <Ionicons name="close" size={16} color={colors.textTertiary} />
                </TouchableOpacity>

                {/* Current event — LIVE chip stays solid, only content cross-fades */}
                {currentEvent && (
                    <TouchableOpacity
                        style={styles.slide}
                        onPress={() => handlePress(currentEvent)}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`${currentEvent.title}, live now at ${currentEvent.location || 'unknown location'}`}
                    >
                        <View
                            testID="live-event-bar-chip"
                            style={[styles.liveChip, { backgroundColor: colors.statusLive + '18' }]}
                        >
                            <Animated.View
                                style={[styles.liveDot, { backgroundColor: colors.statusLive, opacity: pulseAnim }]}
                            />
                            <Text style={[styles.liveText, { color: colors.statusLive }]}>LIVE</Text>
                        </View>
                        <Animated.View
                            style={[
                                styles.content,
                                { opacity: fadeAnim, transform: [{ translateY: contentTranslateY }] },
                            ]}
                        >
                            <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
                                {currentEvent.title}
                            </Text>
                            <Text style={[styles.meta, { color: colors.textTertiary }]} numberOfLines={1}>
                                {formatTime(currentEvent.start_time)}
                                {currentEvent.end_time ? ` – ${formatTime(currentEvent.end_time)}` : ''}
                                {currentEvent.location ? `  ·  ${currentEvent.location}` : ''}
                            </Text>
                        </Animated.View>
                        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} style={styles.chevron} />
                    </TouchableOpacity>
                )}

                {/* Dot indicators */}
                {liveEvents.length > 1 && (
                    <View style={styles.dots}>
                        {liveEvents.map((e, i) => (
                            <View
                                key={e.id}
                                style={[
                                    styles.dot,
                                    {
                                        backgroundColor: i === currentIndex ? colors.accent : colors.borderLight,
                                    },
                                ]}
                            />
                        ))}
                    </View>
                )}
            </View>
        </Animated.View>
    );
});

const styles = StyleSheet.create({
    wrapper: {
        position: 'absolute',
        left: BAR_MARGIN_H,
        right: BAR_MARGIN_H,
        zIndex: 100,
    },
    bar: {
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 12,
    },
    dismissBtn: {
        position: 'absolute',
        top: 6,
        right: 6,
        zIndex: 10,
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    slide: {
        flexDirection: 'row',
        alignItems: 'center',
        height: BAR_H,
        paddingLeft: 14,
        paddingRight: 32,
    },
    liveChip: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 3,
        gap: 4,
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    liveText: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    content: {
        flex: 1,
        marginLeft: 8,
        justifyContent: 'center',
    },
    title: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 1,
    },
    meta: {
        fontSize: 11,
        fontWeight: '500',
    },
    chevron: {
        marginLeft: 4,
    },
    dots: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 4,
        paddingBottom: 6,
        marginTop: -4,
    },
    dot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
    },
});
