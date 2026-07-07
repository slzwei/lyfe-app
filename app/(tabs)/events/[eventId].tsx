import { MilestoneConfetti, CONFETTI_DURATION, type MilestoneKind } from '@/components/roadshow/MilestoneConfetti';
import ScreenHeader from '@/components/ScreenHeader';
import { EventStatusPill } from '@/components/roadshow/atoms/EventStatusPill';
import { TropicFonts } from '@/constants/roadshow/typography';
import { FaceCaptureFlow } from '@/components/face/FaceCaptureFlow';
import { useEventDetail } from '@/hooks/useEventDetail';
import { useCheckInFlow } from '@/hooks/useCheckInFlow';
import { useActivityLog } from '@/hooks/useActivityLog';
import { useManagerOverride } from '@/hooks/useManagerOverride';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { deleteEvent } from '@/lib/events';
import { logRoadshowActivity } from '@/lib/roadshow';
import { formatCreatedAt, formatDateLong, formatTime, getRoadshowStatus } from '@/lib/dateTime';
import type { AttendeeRole, EventAttendee } from '@/types/event';
import { useViewMode } from '@/contexts/ViewModeContext';
import { letterSpacing } from '@/constants/platform';
import { EVENT_TYPE_CONFIG, getEventTypeColor } from '@/constants/displayConfigs';
import AddToCalendarRow from '@/components/events/AddToCalendarRow';
import { EVENT_TYPE_LABELS } from '@/types/event';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useSegments } from 'expo-router';
import { useTypedRouter } from '@/hooks/useTypedRouter';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

// ── Extracted sub-components ──
import { RoadshowUpcoming } from '@/components/events/RoadshowUpcoming';
import { RoadshowLiveT1 } from '@/components/events/RoadshowLiveT1';
import { RoadshowLiveT2 } from '@/components/events/RoadshowLiveT2';
import { RoadshowPast } from '@/components/events/RoadshowPast';
import { EventAttendees } from '@/components/events/EventAttendees';

// ── Location row helper ──────────────────────────────────────
//
// Display-only on this screen — location is edited exclusively via the Edit
// Event page (pencil icon in the header). Folds the three meaningful states
// (pinned, unpinned-with-text, missing) into one visual row. Raw lat/lng are
// intentionally hidden from end users — still stored on the event row and
// used by the check-in proximity gate, we just don't pollute the UI with
// numbers nobody can read.
function renderLocationRow(props: {
    location: string | null;
    pinned: boolean;
    colors: ReturnType<typeof useTheme>['colors'];
}) {
    const { location, pinned, colors } = props;

    if (location && pinned) {
        return (
            <View style={styles.metaRow}>
                <Ionicons name="location" size={16} color={colors.accent} />
                <Text style={[styles.metaText, { color: colors.textSecondary, flex: 1 }]}>{location}</Text>
            </View>
        );
    }

    if (location && !pinned) {
        return (
            <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={16} color={colors.textTertiary} />
                <View style={{ flex: 1 }}>
                    <Text style={[styles.metaText, { color: colors.textSecondary }]}>{location}</Text>
                    <Text style={[styles.metaSubtext, { color: colors.warning }]}>
                        Not yet pinned — check-in unavailable
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={16} color={colors.warning} />
            <Text style={[styles.metaText, { color: colors.warning }]}>Location not set — check-in unavailable</Text>
        </View>
    );
}

// ── Main Screen ───────────────────────────────────────────────
export default function EventDetailScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const { viewMode, canToggle, setViewMode } = useViewMode();
    const router = useTypedRouter();
    const { eventId } = useLocalSearchParams<{ eventId: string }>();
    const segments = useSegments() as unknown as string[];
    const entryTab = segments[1] as string | undefined;
    const backLabel =
        entryTab === 'events' ? 'Events' : entryTab === 'home' ? 'Home' : entryTab === 'pa' ? 'Candidates' : 'Back';
    const insets = useSafeAreaInsets();

    // ── Hook: event detail (data loading, realtime) ──
    const {
        event,
        isLoading,
        refreshing,
        roadshowConfig,
        attendance,
        activities,
        myAttendance,
        loadEvent,
        setActivities,
    } = useEventDetail(eventId, user?.id);

    // ── Milestone celebration (triggered by activity log's onMilestone) ──
    const [milestoneVisible, setMilestoneVisible] = useState(false);
    const [milestoneKind, setMilestoneKind] = useState<MilestoneKind>('case');
    const milestoneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const triggerConfetti = useCallback((kind: MilestoneKind = 'case') => {
        if (milestoneTimer.current) clearTimeout(milestoneTimer.current);
        setMilestoneKind(kind);
        setMilestoneVisible(true);
        // Auto-dismiss after CONFETTI_DURATION if user doesn't tap
        milestoneTimer.current = setTimeout(() => setMilestoneVisible(false), CONFETTI_DURATION + 1200);
    }, []);

    // ── Hook: check-in flow ──
    const {
        lateReason,
        setLateReason,
        showPledgeSheet,
        setShowPledgeSheet,
        pledgeSitdowns,
        setPledgeSitdowns,
        pledgePitches,
        setPledgePitches,
        pledgeClosed,
        setPledgeClosed,
        pledgeAfyc,
        setPledgeAfyc,
        checkingIn,
        checkinError,
        handleOpenCheckin,
        handleOpenReturn,
        handleConfirmPledge,
        faceCaptureVisible,
        handleFacePhotoCaptured,
        handleFaceDismiss,
    } = useCheckInFlow({
        eventId,
        userId: user?.id,
        userFullName: user?.full_name,
        faceRegisteredAt: user?.face_registered_at,
        roadshowConfig,
        onCheckedIn: () => loadEvent(true),
    });

    // ── Hook: activity log ──
    const {
        logDebounce,
        confirmActivity,
        setConfirmActivity,
        showAfycSheet,
        setShowAfycSheet,
        afycInput,
        setAfycInput,
        loggingActivity,
        logHour,
        setLogHour,
        logMinuteIdx,
        setLogMinuteIdx,
        logAmPm,
        setLogAmPm,
        myCounts,
        initLogTime,
        handleLogActivity,
        handleLogCaseClosed,
        handleLogDeparture,
    } = useActivityLog({
        eventId,
        userId: user?.id,
        userFullName: user?.full_name,
        myAttendance,
        activities,
        setActivities,
        onMilestone: triggerConfetti,
    });

    // ── Hook: manager override ──
    const {
        overrideTarget,
        setOverrideTarget,
        overrideTime,
        setOverrideTime,
        overrideLateReason,
        setOverrideLateReason,
        overridePledgeSitdowns,
        setOverridePledgeSitdowns,
        overridePledgePitches,
        setOverridePledgePitches,
        overridePledgeClosed,
        setOverridePledgeClosed,
        overridePledgeAfyc,
        setOverridePledgeAfyc,
        overrideSubmitting,
        overrideError,
        openOverride,
        handleConfirmOverride,
    } = useManagerOverride({
        eventId,
        userId: user?.id,
        roadshowConfig,
        onOverrideComplete: () => loadEvent(true),
    });

    const liveAnim = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(liveAnim, { toValue: 0.2, duration: 700, useNativeDriver: true }),
                Animated.timing(liveAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
            ]),
        );
        pulse.start();
        return () => pulse.stop();
    }, []);

    // Auto-log departure 1 hour after event ends if agent hasn't left yet
    const autoDepFired = useRef(false);
    useEffect(() => {
        const today = new Date().toLocaleDateString('en-CA');
        if (event?.event_type !== 'roadshow') return;
        if (event?.event_date !== today) return;
        if (!myAttendance) return;
        if (!event?.end_time) return;
        if (autoDepFired.current) return;

        const hasDeparted = activities.some((a) => a.user_id === user?.id && a.type === 'departure');
        if (hasDeparted) {
            autoDepFired.current = true;
            return;
        }

        const [h, m] = event.end_time.split(':').map(Number);
        const autoLeave = new Date();
        autoLeave.setHours(h, m + 60, 0, 0);
        const ms = autoLeave.getTime() - Date.now();

        const doAutoDepart = () => {
            autoDepFired.current = true;
            logRoadshowActivity(eventId!, user!.id, 'departure').then(({ data }) => {
                if (data) setActivities((prev) => [{ ...data, full_name: user?.full_name ?? 'Me' }, ...prev]);
            });
        };

        if (ms <= 0) {
            doAutoDepart();
            return;
        }
        const timer = setTimeout(doAutoDepart, ms);
        return () => clearTimeout(timer);
    }, [event?.event_date, event?.end_time, event?.event_type, myAttendance?.id]);

    // ── Derived state ─────────────────────────────────────────
    const isRoadshow = event?.event_type === 'roadshow';
    const roadshowStatus = isRoadshow ? getRoadshowStatus(event!.event_date, event!.start_time, event!.end_time) : null;
    const isLive = roadshowStatus === 'live';
    const isPast = roadshowStatus === 'past';
    const isUpcoming = roadshowStatus === 'upcoming';
    const isT1 = user?.role === 'agent' || viewMode === 'agent';
    const isT2orT3 = (user?.role === 'manager' || user?.role === 'director') && viewMode !== 'agent';
    const hasCheckedIn = !!myAttendance;

    // Late detection (client-side for UI display before check-in)
    const isCurrentlyLate = (() => {
        if (!roadshowConfig || !isLive) return false;
        const now = new Date();
        const [h, m] = roadshowConfig.expected_start_time.split(':').map(Number);
        const grace = new Date();
        grace.setHours(h, m + roadshowConfig.late_grace_minutes, 0, 0);
        return now > grace;
    })();

    const minutesCurrentlyLate = (() => {
        if (!roadshowConfig || !isCurrentlyLate) return 0;
        const now = new Date();
        const [h, m] = roadshowConfig.expected_start_time.split(':').map(Number);
        const grace = new Date();
        grace.setHours(h, m + roadshowConfig.late_grace_minutes, 0, 0);
        return Math.ceil((now.getTime() - grace.getTime()) / 60000);
    })();

    // Activity counts per user
    const activityCounts = useCallback(
        (userId: string) => {
            const mine = activities.filter((a) => a.user_id === userId);
            return {
                sitdowns: mine.filter((a) => a.type === 'sitdown').length,
                pitches: mine.filter((a) => a.type === 'pitch').length,
                closed: mine.filter((a) => a.type === 'case_closed').length,
                afyc: mine.filter((a) => a.type === 'case_closed').reduce((s, a) => s + (a.afyc_amount ?? 0), 0),
            };
        },
        [activities],
    );

    // ── Render guards ─────────────────────────────────────────
    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <ScreenHeader title="Event" showBack onBack={() => router.back()} />
                <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
            </SafeAreaView>
        );
    }

    if (!event) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <ScreenHeader title="Event" showBack onBack={() => router.back()} />
                <View style={styles.notFound}>
                    <Ionicons name="alert-circle-outline" size={48} color={colors.textTertiary} />
                    <Text style={[styles.notFoundText, { color: colors.textSecondary }]}>Event not found</Text>
                </View>
            </SafeAreaView>
        );
    }

    const typeColor = getEventTypeColor(event.event_type, colors);
    const canEdit =
        !!user &&
        (user.id === event.created_by ||
            user.role === 'admin' ||
            (user.role === 'pa' && user.reports_to === event.created_by));
    const canDelete = !!user && (user.id === event.created_by || user.role === 'admin');

    const handleDelete = () => {
        Alert.alert('Delete Event', `Are you sure you want to delete "${event.title}"? This cannot be undone.`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    const { error } = await deleteEvent(event.id);
                    if (error) Alert.alert('Error', error);
                    else router.back();
                },
            },
        ]);
    };

    const grouped: Record<AttendeeRole, EventAttendee[]> = { host: [], duty_manager: [], presenter: [], attendee: [] };
    event.attendees.forEach((a) => {
        if (grouped[a.attendee_role]) grouped[a.attendee_role].push(a);
    });
    const totalAttendees = event.attendees.length + (event.external_attendees?.length ?? 0);

    // ── Leaderboard data ──────────────────────────────────────
    const leaderboard = event.attendees
        .map((a) => {
            const counts = activityCounts(a.user_id);
            const att = attendance.find((x) => x.user_id === a.user_id);
            return { ...a, ...counts, isCheckedIn: !!att };
        })
        .sort((a, b) => b.closed * 10000 + b.afyc - (a.closed * 10000 + a.afyc));

    // ── Booth totals ──────────────────────────────────────────
    const boothTotals = {
        sitdowns: attendance.reduce((s, a) => s + activityCounts(a.user_id).sitdowns, 0),
        pitches: attendance.reduce((s, a) => s + activityCounts(a.user_id).pitches, 0),
        closed: attendance.reduce((s, a) => s + activityCounts(a.user_id).closed, 0),
        afyc: attendance.reduce((s, a) => s + activityCounts(a.user_id).afyc, 0),
        pledgedSitdowns: attendance.reduce((s, a) => s + a.pledged_sitdowns, 0),
        pledgedPitches: attendance.reduce((s, a) => s + a.pledged_pitches, 0),
        pledgedClosed: attendance.reduce((s, a) => s + a.pledged_closed, 0),
        pledgedAfyc: attendance.reduce((s, a) => s + a.pledged_afyc, 0),
    };

    // ── Full render ───────────────────────────────────────────
    // Wrap in a plain View so FaceCaptureFlow can absolute-fill the entire
    // screen (including above the top safe-area inset) as a sibling overlay
    // instead of replacing the event tree. Keeping the tree mounted preserves
    // the realtime subscriptions and autodepart timer during the ~10-15s
    // liveness loop.
    return (
        <View style={styles.container}>
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                {/* Minimal back row (RSBack pattern) */}
                <View style={styles.backRow}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel={`Back to ${backLabel}`}
                    >
                        <Text style={[styles.backLabel, { color: colors.textTertiary }]}>← {backLabel}</Text>
                    </TouchableOpacity>
                    <View style={styles.backRight}>
                        {event.event_type === 'roadshow' ? (
                            <EventStatusPill
                                status={
                                    getRoadshowStatus(event.event_date, event.start_time, event.end_time) === 'live'
                                        ? 'live'
                                        : getRoadshowStatus(event.event_date, event.start_time, event.end_time) ===
                                            'past'
                                          ? 'past'
                                          : 'setup'
                                }
                            />
                        ) : null}
                        {canEdit && (
                            <TouchableOpacity
                                onPress={() => router.push(`/(tabs)/events/create?eventId=${event.id}`)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                accessibilityLabel="Edit event"
                            >
                                <Ionicons name="pencil-outline" size={20} color={colors.accent} />
                            </TouchableOpacity>
                        )}
                        {canDelete && (
                            <TouchableOpacity
                                onPress={handleDelete}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                accessibilityLabel="Delete event"
                            >
                                <Ionicons name="trash-outline" size={20} color={colors.danger} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => loadEvent(true)}
                            tintColor={colors.accent}
                        />
                    }
                >
                    {/* Editorial hero */}
                    <View style={styles.editorialHero}>
                        <Text style={[styles.editorialEyebrow, { color: colors.textTertiary }]}>
                            {formatDateLong(event.event_date).toUpperCase()} · {formatTime(event.start_time)}
                            {event.end_time ? `–${formatTime(event.end_time)}` : ''}
                        </Text>
                        {(() => {
                            const title = event.title.trim();
                            const splitMatch =
                                event.event_type === 'roadshow' ? title.match(/^(.+?)[,·]\s*(.+)$/) : null;
                            if (splitMatch) {
                                return (
                                    <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>
                                        {splitMatch[1]},{'\n'}
                                        <Text style={[styles.heroTitleItalic, { color: colors.accent }]}>
                                            {splitMatch[2].replace(/\.$/, '')}
                                        </Text>
                                        .
                                    </Text>
                                );
                            }
                            return <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>{title}</Text>;
                        })()}
                        {isLive && event.event_type !== 'roadshow' ? (
                            <View
                                style={[
                                    styles.livePill,
                                    {
                                        backgroundColor: colors.statusLive + '18',
                                        alignSelf: 'flex-start',
                                        marginTop: 8,
                                    },
                                ]}
                            >
                                <Animated.View
                                    style={[styles.liveDot, { backgroundColor: colors.statusLive, opacity: liveAnim }]}
                                />
                                <Text style={[styles.liveText, { color: colors.statusLive }]}>LIVE</Text>
                            </View>
                        ) : null}
                        {/* Location row — display-only. Editing happens on the
                        Edit Event page. */}
                        <View style={{ marginTop: 12 }}>
                            {renderLocationRow({
                                location: event.location,
                                pinned: event.latitude != null && event.longitude != null,
                                colors,
                            })}
                        </View>
                        <AddToCalendarRow event={event} colors={colors} />
                    </View>

                    {/* Description */}
                    {event.description && (
                        <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
                            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Description</Text>
                            <Text style={[styles.description, { color: colors.textSecondary }]}>
                                {event.description}
                            </Text>
                        </View>
                    )}

                    {/* ── Roadshow sections ── */}
                    {isUpcoming && <RoadshowUpcoming roadshowConfig={roadshowConfig} colors={colors} />}

                    {isLive && isT1 && (
                        <RoadshowLiveT1
                            colors={colors}
                            attendance={attendance}
                            myAttendance={myAttendance}
                            myCounts={myCounts}
                            roadshowConfig={roadshowConfig}
                            activities={activities}
                            isCurrentlyLate={isCurrentlyLate}
                            minutesCurrentlyLate={minutesCurrentlyLate}
                            insets={insets}
                            userId={user?.id}
                            hasCheckedIn={hasCheckedIn}
                            lateReason={lateReason}
                            setLateReason={setLateReason}
                            showPledgeSheet={showPledgeSheet}
                            setShowPledgeSheet={setShowPledgeSheet}
                            pledgeSitdowns={pledgeSitdowns}
                            setPledgeSitdowns={setPledgeSitdowns}
                            pledgePitches={pledgePitches}
                            setPledgePitches={setPledgePitches}
                            pledgeClosed={pledgeClosed}
                            setPledgeClosed={setPledgeClosed}
                            pledgeAfyc={pledgeAfyc}
                            setPledgeAfyc={setPledgeAfyc}
                            checkingIn={checkingIn}
                            checkinError={checkinError}
                            handleOpenCheckin={handleOpenCheckin}
                            handleConfirmPledge={handleConfirmPledge}
                            logDebounce={logDebounce}
                            confirmActivity={confirmActivity}
                            setConfirmActivity={setConfirmActivity}
                            showAfycSheet={showAfycSheet}
                            setShowAfycSheet={setShowAfycSheet}
                            afycInput={afycInput}
                            setAfycInput={setAfycInput}
                            loggingActivity={loggingActivity}
                            logHour={logHour}
                            setLogHour={setLogHour}
                            logMinuteIdx={logMinuteIdx}
                            setLogMinuteIdx={setLogMinuteIdx}
                            logAmPm={logAmPm}
                            setLogAmPm={setLogAmPm}
                            initLogTime={initLogTime}
                            handleLogActivity={handleLogActivity}
                            handleLogCaseClosed={handleLogCaseClosed}
                            handleLogDeparture={handleLogDeparture}
                            handleReturnToBooth={handleOpenReturn}
                        />
                    )}

                    {isLive && isT2orT3 && (
                        <RoadshowLiveT2
                            colors={colors}
                            event={event}
                            attendance={attendance}
                            activityCounts={activityCounts}
                            boothTotals={boothTotals}
                            roadshowConfig={roadshowConfig}
                            overrideTarget={overrideTarget}
                            setOverrideTarget={setOverrideTarget}
                            overrideTime={overrideTime}
                            setOverrideTime={setOverrideTime}
                            overrideLateReason={overrideLateReason}
                            setOverrideLateReason={setOverrideLateReason}
                            overridePledgeSitdowns={overridePledgeSitdowns}
                            setOverridePledgeSitdowns={setOverridePledgeSitdowns}
                            overridePledgePitches={overridePledgePitches}
                            setOverridePledgePitches={setOverridePledgePitches}
                            overridePledgeClosed={overridePledgeClosed}
                            setOverridePledgeClosed={setOverridePledgeClosed}
                            overridePledgeAfyc={overridePledgeAfyc}
                            setOverridePledgeAfyc={setOverridePledgeAfyc}
                            overrideSubmitting={overrideSubmitting}
                            overrideError={overrideError}
                            openOverride={openOverride}
                            handleConfirmOverride={handleConfirmOverride}
                            userFullName={user?.full_name}
                            userId={user?.id}
                            viewMode={canToggle ? viewMode : undefined}
                            onViewModeToggle={canToggle ? setViewMode : undefined}
                            activities={activities}
                        />
                    )}

                    {isPast && (
                        <RoadshowPast
                            colors={colors}
                            roadshowConfig={roadshowConfig}
                            attendance={attendance}
                            activityCounts={activityCounts}
                            totalAttendees={event.attendees.length}
                            userId={user?.id}
                            activities={activities}
                        />
                    )}

                    {/* Assigned Agents (upcoming + non-roadshow) */}
                    {(!isRoadshow || isUpcoming) && (
                        <EventAttendees
                            colors={colors}
                            grouped={grouped}
                            totalAttendees={totalAttendees}
                            externalAttendees={event.external_attendees ?? []}
                        />
                    )}

                    {/* Footer */}
                    <View style={[styles.footer, { backgroundColor: colors.cardBackground }]}>
                        {event.creator_name && (
                            <Text style={[styles.footerText, { color: colors.textTertiary }]}>
                                Created by {event.creator_name}
                            </Text>
                        )}
                        <Text style={[styles.footerText, { color: colors.textTertiary }]}>
                            {formatCreatedAt(event.created_at)}
                        </Text>
                    </View>
                </ScrollView>

                <MilestoneConfetti
                    visible={milestoneVisible}
                    kind={milestoneKind}
                    onDismiss={() => setMilestoneVisible(false)}
                />
            </SafeAreaView>
            {faceCaptureVisible && (
                <View style={StyleSheet.absoluteFill}>
                    <FaceCaptureFlow
                        mode="verify"
                        onPhotoCaptured={handleFacePhotoCaptured}
                        onDismiss={handleFaceDismiss}
                    />
                </View>
            )}
        </View>
    );
}

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 40, gap: 12 },
    notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    notFoundText: { fontSize: 16 },
    hero: { borderRadius: 16, padding: 20, gap: 10 },
    backRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 18,
        paddingTop: 12,
        paddingBottom: 4,
    },
    backLabel: { fontSize: 13, fontFamily: TropicFonts.uiMedium, letterSpacing: 0 },
    backRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    editorialHero: {
        paddingHorizontal: 20,
        paddingTop: 14,
        paddingBottom: 8,
        gap: 6,
    },
    editorialEyebrow: {
        fontSize: 10.5,
        fontFamily: TropicFonts.uiSemiBold,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
    },
    typePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    typeDot: { width: 6, height: 6, borderRadius: 3 },
    typePillText: { fontSize: 12, fontWeight: '700' },
    heroTitle: {
        fontSize: 30,
        fontFamily: 'Fraunces',
        fontWeight: '400',
        letterSpacing: letterSpacing(-0.7),
        lineHeight: 32,
    },
    heroTitleItalic: { fontFamily: 'Fraunces-Italic', fontWeight: '500' },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    metaText: { fontSize: 14, flex: 1 },
    metaSubtext: { fontSize: 11, marginTop: 2 },
    metaAction: { fontSize: 13, fontWeight: '600' },
    card: { borderRadius: 16, padding: 16, gap: 12 },
    cardTitle: { fontSize: 15, fontWeight: '700' },
    description: { fontSize: 14, lineHeight: 21 },
    footer: { borderRadius: 12, padding: 14, alignItems: 'center' },
    footerText: { fontSize: 13 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    livePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    liveDot: { width: 7, height: 7, borderRadius: 3.5 },
    liveText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
});
