import Avatar from '@/components/Avatar';
import Confetti, { CONFETTI_DURATION } from '@/components/Confetti';
import ProgressRing from '@/components/events/ProgressRing';
import ScreenHeader from '@/components/ScreenHeader';
import WheelPicker from '@/components/WheelPicker';
import { useRoadshowRealtime } from '@/hooks/useRoadshowRealtime';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
    deleteEvent, fetchEventById, fetchRoadshowActivities, fetchRoadshowAttendance,
    fetchRoadshowConfig, hasUserCheckedIn, logRoadshowActivity, logRoadshowAttendanceWithPledge,
    managerCheckIn, type PledgeInput,
} from '@/lib/events';
import { formatActivityTime, formatCheckinTime, formatCreatedAt, formatDateLong, formatTime, todayLocalStr } from '@/lib/dateTime';
import { activityLabel, activityTypeColor, ATTENDEE_ROLE_COLORS, ATTENDEE_ROLE_LABELS, ATTENDEE_ROLE_ORDER, AVATAR_COLORS, ERROR_BG, ERROR_TEXT, getAvatarColor, PICKER_HOURS, PICKER_MINUTES, PICKER_AMPM, ROADSHOW_PINK } from '@/constants/ui';
import { supabase } from '@/lib/supabase';
import type { AgencyEvent, AttendeeRole, EventAttendee, RoadshowActivity, RoadshowAttendance, RoadshowConfig } from '@/types/event';
import { useViewMode } from '@/contexts/ViewModeContext';
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from '@/types/event';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    KeyboardAvoidingView,
    Modal,
    Platform,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ── Main Screen ───────────────────────────────────────────────
export default function EventDetailScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const { viewMode } = useViewMode();
    const router = useRouter();
    const { eventId } = useLocalSearchParams<{ eventId: string }>();
    const insets = useSafeAreaInsets();

    // Base event state
    const [event, setEvent] = useState<AgencyEvent | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Roadshow state
    const [roadshowConfig, setRoadshowConfig] = useState<RoadshowConfig | null>(null);
    const [attendance, setAttendance] = useState<RoadshowAttendance[]>([]);
    const [activities, setActivities] = useState<RoadshowActivity[]>([]);
    const [myAttendance, setMyAttendance] = useState<RoadshowAttendance | null>(null);

    // Check-in flow
    const [showLateReason, setShowLateReason] = useState(false);
    const [lateReason, setLateReason] = useState('');
    const [showPledgeSheet, setShowPledgeSheet] = useState(false);
    const [pledgeSitdowns, setPledgeSitdowns] = useState(5);
    const [pledgePitches, setPledgePitches] = useState(3);
    const [pledgeClosed, setPledgeClosed] = useState(1);
    const [pledgeAfyc, setPledgeAfyc] = useState('');
    const [checkingIn, setCheckingIn] = useState(false);
    const [checkinError, setCheckinError] = useState<string | null>(null);

    // Activity log
    const [logDebounce, setLogDebounce] = useState<Record<string, boolean>>({});
    const [confirmActivity, setConfirmActivity] = useState<'sitdown' | 'pitch' | null>(null);
    const [confettiVisible, setConfettiVisible] = useState(false);
    const [confettiKey, setConfettiKey] = useState(0);
    const confettiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [showAfycSheet, setShowAfycSheet] = useState(false);
    const [afycInput, setAfycInput] = useState('');
    const [loggingActivity, setLoggingActivity] = useState(false);
    // Log time picker state
    const [logHour, setLogHour] = useState(0);       // index into PICKER_HOURS (0=1, 11=12)
    const [logMinuteIdx, setLogMinuteIdx] = useState(0); // index into PICKER_MINUTES
    const [logAmPm, setLogAmPm] = useState(0);        // 0=AM, 1=PM

    // Manager override
    const [overrideTarget, setOverrideTarget] = useState<EventAttendee | null>(null);
    const [overrideTime, setOverrideTime] = useState('');
    const [overrideLateReason, setOverrideLateReason] = useState('');
    const [overridePledgeSitdowns, setOverridePledgeSitdowns] = useState(5);
    const [overridePledgePitches, setOverridePledgePitches] = useState(3);
    const [overridePledgeClosed, setOverridePledgeClosed] = useState(1);
    const [overridePledgeAfyc, setOverridePledgeAfyc] = useState('');
    const [overrideSubmitting, setOverrideSubmitting] = useState(false);
    const [overrideError, setOverrideError] = useState<string | null>(null);

    const liveAnim = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(liveAnim, { toValue: 0.2, duration: 700, useNativeDriver: true }),
                Animated.timing(liveAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
            ])
        );
        pulse.start();
        return () => pulse.stop();
    }, [liveAnim]);

    // Auto-log departure 1 hour after event ends if agent hasn't left yet
    const autoDepFired = useRef(false);
    useEffect(() => {
        const today = new Date().toLocaleDateString('en-CA');
        if (event?.event_type !== 'roadshow') return;
        if (event?.event_date !== today) return;
        if (!myAttendance) return;
        if (!event?.end_time) return;
        if (autoDepFired.current) return;

        const hasDeparted = activities.some(a => a.user_id === user?.id && a.type === 'departure');
        if (hasDeparted) { autoDepFired.current = true; return; }

        const [h, m] = event.end_time.split(':').map(Number);
        const autoLeave = new Date();
        autoLeave.setHours(h, m + 60, 0, 0);
        const ms = autoLeave.getTime() - Date.now();

        const doAutoDepart = () => {
            autoDepFired.current = true;
            logRoadshowActivity(eventId!, user!.id, 'departure').then(({ data }) => {
                if (data) setActivities(prev => [{ ...data, full_name: user?.full_name ?? 'Me' }, ...prev]);
            });
        };

        if (ms <= 0) { doAutoDepart(); return; }
        const timer = setTimeout(doAutoDepart, ms);
        return () => clearTimeout(timer);
    }, [event?.event_date, event?.end_time, event?.event_type, myAttendance?.id]);

    const todayStr = todayLocalStr();

    const loadEvent = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);

        if (!eventId) return;
        const { data } = await fetchEventById(eventId);
        setEvent(data);

        if (data?.event_type === 'roadshow') {
            const [configRes, activitiesRes] = await Promise.all([
                fetchRoadshowConfig(eventId),
                fetchRoadshowActivities(eventId),
            ]);
            const cfg = configRes.data;
            setRoadshowConfig(cfg);
            const attRes = await fetchRoadshowAttendance(eventId, cfg);
            setAttendance(attRes.data);
            setMyAttendance(attRes.data.find(a => a.user_id === user?.id) ?? null);
            setActivities(activitiesRes.data);
        }

        setIsLoading(false);
        setRefreshing(false);
    }, [eventId, user?.id]);

    useFocusEffect(useCallback(() => {
        if (event) { loadEvent(true); } else { loadEvent(false); }
    }, [loadEvent]));

    // Realtime subscription for live roadshow
    useRoadshowRealtime(
        eventId,
        !!(event && event.event_type === 'roadshow' && event.event_date === todayStr),
        user?.id,
        useCallback((activity: RoadshowActivity) => {
            setActivities(prev => [activity, ...prev]);
        }, []),
        useCallback((att: RoadshowAttendance) => {
            setAttendance(prev => [...prev, att]);
        }, []),
    );

    // ── Derived state ─────────────────────────────────────────
    const isRoadshow = event?.event_type === 'roadshow';
    const isLive = isRoadshow && event!.event_date === todayStr;
    const isPast = isRoadshow && event!.event_date < todayStr;
    const isUpcoming = isRoadshow && !isLive && !isPast;
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
    const activityCounts = (userId: string) => {
        const mine = activities.filter(a => a.user_id === userId);
        return {
            sitdowns: mine.filter(a => a.type === 'sitdown').length,
            pitches: mine.filter(a => a.type === 'pitch').length,
            closed: mine.filter(a => a.type === 'case_closed').length,
            afyc: mine.filter(a => a.type === 'case_closed').reduce((s, a) => s + (a.afyc_amount ?? 0), 0),
        };
    };

    const myCounts = myAttendance ? activityCounts(myAttendance.user_id) : { sitdowns: 0, pitches: 0, closed: 0, afyc: 0 };

    // ── Check-in handlers ─────────────────────────────────────
    const handleOpenCheckin = () => {
        if (roadshowConfig) {
            setPledgeSitdowns(roadshowConfig.suggested_sitdowns);
            setPledgePitches(roadshowConfig.suggested_pitches);
            setPledgeClosed(roadshowConfig.suggested_closed);
        }
        setShowPledgeSheet(true);
    };

    const handleConfirmPledge = async () => {
        if (checkingIn) return;
        setCheckingIn(true);
        setCheckinError(null);

        // Check for existing attendance (manager may have checked in already)
        const alreadyCheckedIn = await hasUserCheckedIn(eventId!, user!.id);
        if (alreadyCheckedIn) {
            setCheckingIn(false);
            setShowPledgeSheet(false);
            Alert.alert('Already Checked In', 'You were already checked in by your manager.');
            loadEvent(true);
            return;
        }

        const pledges: PledgeInput = {
            sitdowns: pledgeSitdowns,
            pitches: pledgePitches,
            closed: pledgeClosed,
            afyc: Number(pledgeAfyc) || 0,
        };

        const { error } = await logRoadshowAttendanceWithPledge(eventId!, user!.id, lateReason || null, pledges);
        if (error) {
            setCheckinError(error);
            setCheckingIn(false);
            return;
        }

        // Log check_in activity (fire-and-forget)
        logRoadshowActivity(eventId!, user!.id, 'check_in').catch(() => { });

        // Fire-and-forget push notification
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) return;
            fetch(`${supabaseUrl}/functions/v1/notify-roadshow-pledge`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    eventId, agentId: user!.id, agentName: user!.full_name,
                    pledgedSitdowns: pledges.sitdowns, pledgedPitches: pledges.pitches,
                    pledgedClosed: pledges.closed, pledgedAfyc: pledges.afyc,
                }),
            }).catch(() => { });
        });

        setShowPledgeSheet(false);
        setCheckingIn(false);
        loadEvent(true);
    };

    // ── Log time helpers ──────────────────────────────────────
    const initLogTime = () => {
        const now = new Date();
        let h = now.getHours();
        const mins = now.getMinutes();
        const roundedMin = Math.round(mins / 5) * 5;
        const ampm = h >= 12 ? 1 : 0;
        if (h > 12) h -= 12;
        if (h === 0) h = 12;
        const minIdx = Math.min(Math.floor(roundedMin / 5), PICKER_MINUTES.length - 1);
        setLogHour(h - 1); // PICKER_HOURS[0] = '1', so index = h - 1
        setLogMinuteIdx(minIdx);
        setLogAmPm(ampm);
    };

    const logTimeToISO = (): string => {
        let h = logHour + 1; // 1-12
        if (logAmPm === 1 && h !== 12) h += 12;
        if (logAmPm === 0 && h === 12) h = 0;
        const mins = Number(PICKER_MINUTES[logMinuteIdx]);
        const d = new Date();
        d.setHours(h, mins, 0, 0);
        return d.toISOString();
    };

    // ── Activity logging ──────────────────────────────────────
    const handleLogActivity = async (type: 'sitdown' | 'pitch', afycAmount?: number) => {
        if (logDebounce[type]) return;
        setLogDebounce(prev => ({ ...prev, [type]: true }));

        // Check if this tap will exactly hit the pledged target → celebrate
        const currentCount = type === 'sitdown' ? myCounts.sitdowns : myCounts.pitches;
        const pledgedTarget = type === 'sitdown'
            ? (myAttendance?.pledged_sitdowns ?? 0)
            : (myAttendance?.pledged_pitches ?? 0);
        if (pledgedTarget > 0 && currentCount + 1 === pledgedTarget) {
            triggerConfetti();
        }

        // Optimistic update
        const tempId = `opt_${Date.now()}`;
        const loggedAt = logTimeToISO();
        const optimistic: RoadshowActivity = {
            id: tempId, event_id: eventId!, user_id: user!.id, full_name: user?.full_name ?? 'Me',
            type, afyc_amount: afycAmount ?? null, logged_at: loggedAt,
        };
        setActivities(prev => [optimistic, ...prev]);

        const { error } = await logRoadshowActivity(eventId!, user!.id, type, afycAmount, loggedAt);
        if (error) {
            setActivities(prev => prev.filter(a => a.id !== tempId));
            Alert.alert('Failed', 'Could not log activity. Please try again.');
        }

        setTimeout(() => setLogDebounce(prev => ({ ...prev, [type]: false })), 400);
    };

    const handleLogCaseClosed = async () => {
        if (loggingActivity) return;
        setLoggingActivity(true);
        const amount = Number(afycInput) || 0;

        if (amount === 0) {
            const confirmed = await new Promise<boolean>(resolve =>
                Alert.alert('Log $0 AFYC?', 'Are you sure you want to log a Case Closed with $0 AFYC?', [
                    { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
                    { text: 'Log', onPress: () => resolve(true) },
                ])
            );
            if (!confirmed) { setLoggingActivity(false); return; }
        }

        const tempId = `opt_cc_${Date.now()}`;
        const loggedAt = logTimeToISO();
        const optimistic: RoadshowActivity = {
            id: tempId, event_id: eventId!, user_id: user!.id, full_name: user?.full_name ?? 'Me',
            type: 'case_closed', afyc_amount: amount, logged_at: loggedAt,
        };
        setActivities(prev => [optimistic, ...prev]);
        setShowAfycSheet(false);
        setAfycInput('');
        triggerConfetti();

        const { error: ccError } = await logRoadshowActivity(eventId!, user!.id, 'case_closed', amount, loggedAt);
        if (ccError) {
            setActivities(prev => prev.filter(a => a.id !== tempId));
            Alert.alert('Failed', 'Could not log case closed.');
        }
        setLoggingActivity(false);
    };

    // ── Manager override ──────────────────────────────────────
    const openOverride = (agent: EventAttendee) => {
        setOverrideTarget(agent);
        setOverrideTime(formatCheckinTime(new Date().toISOString()));
        setOverrideLateReason('');
        if (roadshowConfig) {
            setOverridePledgeSitdowns(roadshowConfig.suggested_sitdowns);
            setOverridePledgePitches(roadshowConfig.suggested_pitches);
            setOverridePledgeClosed(roadshowConfig.suggested_closed);
        }
        setOverridePledgeAfyc('');
        setOverrideError(null);
    };

    const handleConfirmOverride = async () => {
        if (!overrideTarget || overrideSubmitting) return;

        // Parse override time as today
        const timeParsed = overrideTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (!timeParsed) { setOverrideError('Enter time as HH:MM AM/PM'); return; }
        let h = parseInt(timeParsed[1]);
        const mins = parseInt(timeParsed[2]);
        const ampm = timeParsed[3].toUpperCase();
        if (ampm === 'PM' && h !== 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        const checkedInAt = new Date();
        checkedInAt.setHours(h, mins, 0, 0);
        if (checkedInAt > new Date()) { setOverrideError('Arrival time cannot be in the future.'); return; }

        Alert.alert(
            'Confirm Override',
            `Check in ${overrideTarget.full_name} at ${overrideTime}? This cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm', onPress: async () => {
                        setOverrideSubmitting(true);
                        setOverrideError(null);
                        const pledges: PledgeInput = {
                            sitdowns: overridePledgeSitdowns,
                            pitches: overridePledgePitches,
                            closed: overridePledgeClosed,
                            afyc: Number(overridePledgeAfyc) || 0,
                        };
                        const { error } = await managerCheckIn(
                            eventId!, overrideTarget.user_id, checkedInAt.toISOString(),
                            overrideLateReason || null, pledges, user!.id,
                        );
                        if (error) {
                            const msg = error.includes('unique') ? `${overrideTarget.full_name} just checked in themselves.` : error;
                            setOverrideError(msg);
                            setOverrideSubmitting(false);
                            return;
                        }
                        // Log check_in activity for the agent (fire-and-forget)
                        logRoadshowActivity(eventId!, overrideTarget.user_id, 'check_in').catch(() => { });
                        setOverrideTarget(null);
                        setOverrideSubmitting(false);
                        loadEvent(true);
                    },
                },
            ],
        );
    };

    // ── Confetti ──────────────────────────────────────────────
    const triggerConfetti = () => {
        if (confettiTimer.current) clearTimeout(confettiTimer.current);
        setConfettiKey(k => k + 1);
        setConfettiVisible(true);
        confettiTimer.current = setTimeout(() => setConfettiVisible(false), CONFETTI_DURATION + 400);
    };

    // ── Departure ─────────────────────────────────────────────
    const handleLogDeparture = () => {
        Alert.alert('Leave Roadshow?', 'This will log your departure from the booth.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Leave', style: 'destructive', onPress: async () => {
                    const tempId = `opt_dep_${Date.now()}`;
                    const optimistic: RoadshowActivity = {
                        id: tempId, event_id: eventId!, user_id: user!.id,
                        full_name: user?.full_name ?? 'Me', type: 'departure',
                        afyc_amount: null, logged_at: new Date().toISOString(),
                    };
                    setActivities(prev => [optimistic, ...prev]);
                    const { error: depError } = await logRoadshowActivity(eventId!, user!.id, 'departure');
                    if (depError) setActivities(prev => prev.filter(a => a.id !== tempId));
                },
            },
        ]);
    };

    const handleReturnToBooth = async () => {
        const tempId = `opt_ret_${Date.now()}`;
        const optimistic: RoadshowActivity = {
            id: tempId, event_id: eventId!, user_id: user!.id,
            full_name: user?.full_name ?? 'Me', type: 'check_in',
            afyc_amount: null, logged_at: new Date().toISOString(),
        };
        setActivities(prev => [optimistic, ...prev]);
        const { error: retError } = await logRoadshowActivity(eventId!, user!.id, 'check_in');
        if (retError) setActivities(prev => prev.filter(a => a.id !== tempId));
    };

    // ── Render guards ─────────────────────────────────────────
    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <ScreenHeader title="Event" showBack onBack={() => router.back()} />
                <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
            </SafeAreaView>
        );
    }

    if (!event) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <ScreenHeader title="Event" showBack onBack={() => router.back()} />
                <View style={styles.notFound}>
                    <Ionicons name="alert-circle-outline" size={48} color={colors.textTertiary} />
                    <Text style={[styles.notFoundText, { color: colors.textSecondary }]}>Event not found</Text>
                </View>
            </SafeAreaView>
        );
    }

    const typeColor = EVENT_TYPE_COLORS[event.event_type];
    const canEdit = !!user && (user.id === event.created_by || user.role === 'admin' || (user.role === 'pa' && user.reports_to === event.created_by));
    const canDelete = !!user && (user.id === event.created_by || user.role === 'admin');

    const handleDelete = () => {
        Alert.alert('Delete Event', `Are you sure you want to delete "${event.title}"? This cannot be undone.`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    const { error } = await deleteEvent(event.id);
                    if (error) Alert.alert('Error', error);
                    else router.back();
                },
            },
        ]);
    };

    const grouped: Record<AttendeeRole, EventAttendee[]> = { host: [], duty_manager: [], presenter: [], attendee: [] };
    event.attendees.forEach(a => { if (grouped[a.attendee_role]) grouped[a.attendee_role].push(a); });
    const totalAttendees = event.attendees.length + (event.external_attendees?.length ?? 0);

    // ── Leaderboard data ──────────────────────────────────────
    const leaderboard = event.attendees.map(a => {
        const counts = activityCounts(a.user_id);
        const att = attendance.find(x => x.user_id === a.user_id);
        return { ...a, ...counts, isCheckedIn: !!att };
    }).sort((a, b) => (b.closed * 10000 + b.afyc) - (a.closed * 10000 + a.afyc));

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

    const totalPledgedActivities = boothTotals.pledgedSitdowns + boothTotals.pledgedPitches + boothTotals.pledgedClosed;
    const totalActualActivities = boothTotals.sitdowns + boothTotals.pitches + boothTotals.closed;
    const boothPct = totalPledgedActivities > 0 ? Math.min(1, totalActualActivities / totalPledgedActivities) : 0;

    // ── Render roadshow specific sections ────────────────────

    // ---- Upcoming state ----
    const renderUpcoming = () => (
        <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Cost Overview</Text>
            {roadshowConfig ? (
                <>
                    <View style={rsStyles.costRow}>
                        <Text style={[rsStyles.costLabel, { color: colors.textTertiary }]}>Weekly cost</Text>
                        <Text style={[rsStyles.costValue, { color: colors.textPrimary }]}>${roadshowConfig.weekly_cost.toFixed(2)}</Text>
                    </View>
                    <View style={rsStyles.costRow}>
                        <Text style={[rsStyles.costLabel, { color: colors.textTertiary }]}>Daily cost</Text>
                        <Text style={[rsStyles.costValue, { color: colors.textPrimary }]}>${roadshowConfig.daily_cost.toFixed(2)}</Text>
                    </View>
                    <View style={rsStyles.costRow}>
                        <Text style={[rsStyles.costLabel, { color: colors.textTertiary }]}>Per-agent slot</Text>
                        <Text style={[rsStyles.costValue, { color: ROADSHOW_PINK, fontWeight: '700' }]}>${roadshowConfig.slot_cost.toFixed(2)}</Text>
                    </View>
                </>
            ) : (
                <Text style={{ color: colors.textTertiary, fontSize: 13 }}>No config set</Text>
            )}

            {roadshowConfig && (
                <>
                    <View style={[styles.separator, { backgroundColor: colors.border }]} />
                    <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Suggested Daily Targets</Text>
                    <View style={rsStyles.targetsRow}>
                        <View style={rsStyles.targetCell}>
                            <Text style={[rsStyles.targetNum, { color: ROADSHOW_PINK }]}>{roadshowConfig.suggested_sitdowns}</Text>
                            <Text style={[rsStyles.targetLabel, { color: colors.textTertiary }]}>Sitdowns</Text>
                        </View>
                        <View style={rsStyles.targetCell}>
                            <Text style={[rsStyles.targetNum, { color: ROADSHOW_PINK }]}>{roadshowConfig.suggested_pitches}</Text>
                            <Text style={[rsStyles.targetLabel, { color: colors.textTertiary }]}>Pitches</Text>
                        </View>
                        <View style={rsStyles.targetCell}>
                            <Text style={[rsStyles.targetNum, { color: ROADSHOW_PINK }]}>{roadshowConfig.suggested_closed}</Text>
                            <Text style={[rsStyles.targetLabel, { color: colors.textTertiary }]}>Closed</Text>
                        </View>
                    </View>
                </>
            )}
        </View>
    );

    // ---- T1 live: check-in CTA ----
    const renderT1CheckIn = () => {
        const checkedInByManager = attendance.find(a => a.user_id === user?.id && a.checked_in_by);

        if (checkedInByManager) {
            return (
                <View style={[rsStyles.infoBanner, { backgroundColor: '#DBEAFE', borderColor: '#93C5FD' }]}>
                    <Ionicons name="information-circle" size={16} color="#2563EB" />
                    <Text style={{ color: '#1D4ED8', fontSize: 13, flex: 1 }}>
                        You were checked in by your manager at {formatCheckinTime(checkedInByManager.checked_in_at)}.
                    </Text>
                </View>
            );
        }

        return (
            <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
                {/* Expected time info */}
                <View style={rsStyles.boothInfoRow}>
                    <Ionicons name="storefront-outline" size={16} color={ROADSHOW_PINK} />
                    <Text style={[rsStyles.boothInfoText, { color: colors.textSecondary }]}>
                        Booth opens {roadshowConfig ? formatTime(roadshowConfig.expected_start_time) : '--'}{roadshowConfig ? ` · ${roadshowConfig.late_grace_minutes} min grace` : ''}
                    </Text>
                </View>
                {roadshowConfig && (
                    <Text style={[rsStyles.slotCostText, { color: colors.textTertiary }]}>
                        Your slot cost today: ${roadshowConfig.slot_cost.toFixed(2)}
                    </Text>
                )}

                {isCurrentlyLate && (
                    <View style={[rsStyles.lateBanner, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}>
                        <Ionicons name="warning" size={14} color={colors.warning} />
                        <Text style={[rsStyles.lateText, { color: colors.warning }]}>
                            {formatCheckinTime(new Date().toISOString())} — {minutesCurrentlyLate} min late
                        </Text>
                    </View>
                )}

                {isCurrentlyLate && (
                    <View style={styles.field}>
                        <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 4 }}>Late reason (optional)</Text>
                        <TextInput
                            style={[styles.inputSm, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                            placeholder="e.g. MRT delay"
                            placeholderTextColor={colors.textTertiary}
                            value={lateReason}
                            onChangeText={setLateReason}
                        />
                    </View>
                )}

                <TouchableOpacity
                    style={[rsStyles.checkinBtn, { backgroundColor: isCurrentlyLate ? colors.warning : colors.accent }]}
                    onPress={handleOpenCheckin}
                    accessibilityLabel={isCurrentlyLate ? 'Mark Attendance Late' : 'Check In Now'}
                >
                    <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
                    <Text style={rsStyles.checkinBtnText}>
                        {isCurrentlyLate ? 'Mark Attendance (Late)' : 'Check In Now'}
                    </Text>
                </TouchableOpacity>

                {checkinError && (
                    <View style={[rsStyles.errorBanner, { backgroundColor: ERROR_BG }]}>
                        <Text style={{ color: ERROR_TEXT, fontSize: 13 }}>{checkinError}</Text>
                    </View>
                )}
            </View>
        );
    };

    // ---- T1 live: progress ----
    const renderT1Progress = () => (
        <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
            <View style={rsStyles.progressHeaderRow}>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Your Progress</Text>
                {myAttendance && (
                    <Text style={[rsStyles.checkinLabel, { color: colors.textTertiary }]}>
                        In since {formatCheckinTime(myAttendance.checked_in_at)}
                    </Text>
                )}
            </View>
            <View style={rsStyles.ringsRow}>
                <ProgressRing
                    actual={myCounts.sitdowns}
                    pledged={myAttendance?.pledged_sitdowns ?? 0}
                    color="#6366F1"
                    label="Sitdowns"
                    accessLabel={`Sitdowns: ${myCounts.sitdowns} of ${myAttendance?.pledged_sitdowns ?? 0}`}
                />
                <ProgressRing
                    actual={myCounts.pitches}
                    pledged={myAttendance?.pledged_pitches ?? 0}
                    color="#0D9488"
                    label="Pitches"
                    accessLabel={`Pitches: ${myCounts.pitches} of ${myAttendance?.pledged_pitches ?? 0}`}
                />
                <ProgressRing
                    actual={myCounts.closed}
                    pledged={myAttendance?.pledged_closed ?? 0}
                    color="#F59E0B"
                    label="Closed"
                    accessLabel={`Cases Closed: ${myCounts.closed} of ${myAttendance?.pledged_closed ?? 0}`}
                />
            </View>

            {/* AFYC bar */}
            <View style={rsStyles.afycSection}>
                <View style={rsStyles.afycRow}>
                    <Text style={[rsStyles.afycLabel, { color: colors.textSecondary }]}>AFYC</Text>
                    <Text style={[rsStyles.afycValue, { color: colors.textPrimary }]}>
                        ${myCounts.afyc.toLocaleString()}
                        {(myAttendance?.pledged_afyc ?? 0) > 0 && (
                            <Text style={{ color: colors.textTertiary }}> of ${(myAttendance?.pledged_afyc ?? 0).toLocaleString()} pledged</Text>
                        )}
                    </Text>
                </View>
                {(myAttendance?.pledged_afyc ?? 0) > 0 && (
                    <View style={[rsStyles.afycTrack, { backgroundColor: colors.surfaceSecondary }]}>
                        <View style={[rsStyles.afycFill, {
                            width: `${Math.min(100, (myCounts.afyc / (myAttendance?.pledged_afyc ?? 1)) * 100)}%` as any,
                            backgroundColor: '#F59E0B',
                        }]} />
                    </View>
                )}
            </View>
        </View>
    );

    // ---- Leaderboard ----
    const renderLeaderboard = () => (
        <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Booth Leaderboard</Text>
            <View style={rsStyles.lbHeader}>
                <Text style={[rsStyles.lbHeaderName, { color: colors.textTertiary }]}>Agent</Text>
                <Text style={[rsStyles.lbHeaderNum, { color: colors.textTertiary }]}>S</Text>
                <Text style={[rsStyles.lbHeaderNum, { color: colors.textTertiary }]}>P</Text>
                <Text style={[rsStyles.lbHeaderNum, { color: colors.textTertiary }]}>C</Text>
                <Text style={[rsStyles.lbHeaderAfyc, { color: colors.textTertiary }]}>AFYC</Text>
            </View>
            {leaderboard.map((agent, i) => {
                const isSelf = agent.user_id === user?.id;
                return (
                    <View
                        key={agent.id}
                        style={[rsStyles.lbRow, isSelf && { backgroundColor: ROADSHOW_PINK + '10' }]}
                        accessibilityLabel={`Rank ${i + 1}, ${agent.full_name}, ${agent.sitdowns} sitdowns, ${agent.pitches} pitches, ${agent.closed} case closed, $${agent.afyc} AFYC`}
                    >
                        <Text style={[rsStyles.lbRank, { color: colors.textTertiary }]}>{i + 1}</Text>
                        <Text style={[rsStyles.lbName, { color: colors.textPrimary, fontWeight: isSelf ? '700' : '500' }]} numberOfLines={1} ellipsizeMode="tail">
                            {agent.full_name ?? '?'}
                        </Text>
                        <Text style={[rsStyles.lbNum, { color: colors.textPrimary }]}>{agent.sitdowns}</Text>
                        <Text style={[rsStyles.lbNum, { color: colors.textPrimary }]}>{agent.pitches}</Text>
                        <Text style={[rsStyles.lbNum, { color: colors.textPrimary }]}>{agent.closed}</Text>
                        <Text style={[rsStyles.lbAfyc, { color: agent.afyc > 0 ? '#F59E0B' : colors.textTertiary }]}>
                            ${agent.afyc >= 1000 ? `${(agent.afyc / 1000).toFixed(1)}k` : agent.afyc}
                        </Text>
                    </View>
                );
            })}
            {leaderboard.length === 0 && (
                <Text style={{ color: colors.textTertiary, fontSize: 13 }}>No activity logged yet.</Text>
            )}
        </View>
    );

    // ---- Activity feed ----
    const renderActivityFeed = () => {
        const feed = activities.slice(0, 20);
        return (
            <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Activity Feed</Text>
                {feed.length === 0 && (
                    <Text style={{ color: colors.textTertiary, fontSize: 13 }}>No activities yet.</Text>
                )}
                {feed.map(act => (
                    <View key={act.id} style={rsStyles.feedRow}>
                        <Text style={[rsStyles.feedTime, { color: colors.textTertiary }]}>{formatCheckinTime(act.logged_at)}</Text>
                        <Avatar name={act.full_name ?? '?'} avatarUrl={null} size={24} backgroundColor={getAvatarColor(act.full_name ?? '?') + '18'} textColor={getAvatarColor(act.full_name ?? '?')} />
                        <Text style={[rsStyles.feedName, { color: colors.textPrimary }]} numberOfLines={1}>{act.full_name}</Text>
                        <Text style={[rsStyles.feedType, { color: activityTypeColor(act.type, colors.textSecondary) }]}>
                            {act.type === 'case_closed' && act.afyc_amount != null && act.afyc_amount > 0
                                ? `Closed $${act.afyc_amount.toLocaleString()} AFYC`
                                : activityLabel(act.type)}
                        </Text>
                    </View>
                ))}
                {activities.length > 20 && (
                    <Text style={{ color: colors.accent, fontSize: 13, textAlign: 'center', marginTop: 4 }}>
                        {activities.length - 20} more entries not shown
                    </Text>
                )}
            </View>
        );
    };

    // ---- T2/T3 live: agent status ----
    const renderT2AgentStatus = () => {
        const checkedInCount = attendance.length;
        const totalAgents = event.attendees.length;
        return (
            <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
                <View style={rsStyles.sectionHeaderRow}>
                    <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Agent Status</Text>
                    <Text style={[rsStyles.countBadge, { color: colors.textTertiary }]}>{checkedInCount} / {totalAgents}</Text>
                </View>
                {event.attendees.map(agent => {
                    const att = attendance.find(a => a.user_id === agent.user_id);
                    const counts = activityCounts(agent.user_id);
                    const ac = getAvatarColor(agent.full_name ?? '?');
                    return (
                        <View key={agent.id} style={[rsStyles.agentCard, { backgroundColor: colors.surfaceSecondary }]}>
                            <View style={rsStyles.agentHeader}>
                                <Avatar name={agent.full_name ?? '?'} avatarUrl={null} size={32} backgroundColor={ac + '18'} textColor={ac} />
                                <Text style={[rsStyles.agentName, { color: colors.textPrimary }]}>{agent.full_name}</Text>
                                {!att && (
                                    <TouchableOpacity
                                        style={[rsStyles.overrideBtn, { borderColor: ROADSHOW_PINK }]}
                                        onPress={() => openOverride(agent)}
                                        accessibilityLabel={`Check in ${agent.full_name}`}
                                    >
                                        <Ionicons name="add" size={16} color={ROADSHOW_PINK} />
                                    </TouchableOpacity>
                                )}
                            </View>
                            {att ? (
                                <>
                                    <View style={rsStyles.agentCheckinRow}>
                                        <Ionicons name={att.is_late ? 'warning' : 'checkmark-circle'} size={14} color={att.is_late ? colors.warning : colors.accent} />
                                        <Text style={{ color: att.is_late ? colors.warning : colors.accent, fontSize: 13 }}>
                                            {formatCheckinTime(att.checked_in_at)} · {att.is_late ? `Late ${att.minutes_late} min` : 'On time'}
                                        </Text>
                                        {att.checked_in_by && <Text style={{ color: colors.textTertiary, fontSize: 11 }}>(override)</Text>}
                                    </View>
                                    {att.late_reason && (
                                        <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2, marginLeft: 18 }}>"{att.late_reason}"</Text>
                                    )}
                                    <View style={[rsStyles.agentStatsTable, { marginTop: 10 }]}>
                                        {/* TARGET section */}
                                        <View style={[rsStyles.agentStatsBand, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
                                            <Text style={[rsStyles.agentBandLabel, { color: colors.textTertiary }]}>TARGET</Text>
                                            <View style={rsStyles.agentBandRow}>
                                                <View style={rsStyles.agentBandCol}>
                                                    <Text style={[rsStyles.agentBandNum, { color: colors.textSecondary }]}>{att.pledged_sitdowns}</Text>
                                                    <Text style={rsStyles.agentBandCaption}>Sitdowns</Text>
                                                </View>
                                                <View style={rsStyles.agentBandCol}>
                                                    <Text style={[rsStyles.agentBandNum, { color: colors.textSecondary }]}>{att.pledged_pitches}</Text>
                                                    <Text style={rsStyles.agentBandCaption}>Pitches</Text>
                                                </View>
                                                <View style={rsStyles.agentBandCol}>
                                                    <Text style={[rsStyles.agentBandNum, { color: colors.textSecondary }]}>{att.pledged_closed}</Text>
                                                    <Text style={rsStyles.agentBandCaption}>Cases</Text>
                                                </View>
                                                <View style={rsStyles.agentBandCol}>
                                                    <Text style={[rsStyles.agentBandNum, { color: colors.textSecondary }]}>${att.pledged_afyc >= 1000 ? `${(att.pledged_afyc / 1000).toFixed(0)}k` : att.pledged_afyc > 0 ? att.pledged_afyc : '—'}</Text>
                                                    <Text style={rsStyles.agentBandCaption}>AFYC</Text>
                                                </View>
                                            </View>
                                        </View>
                                        {/* ACTUAL section */}
                                        <View style={rsStyles.agentStatsBand}>
                                            <Text style={[rsStyles.agentBandLabel, { color: colors.textSecondary }]}>ACTUAL</Text>
                                            <View style={rsStyles.agentBandRow}>
                                                <View style={rsStyles.agentBandCol}>
                                                    <Text style={[rsStyles.agentActualNum, { color: counts.sitdowns >= att.pledged_sitdowns && att.pledged_sitdowns > 0 ? '#0D9488' : colors.textPrimary }]}>{counts.sitdowns}</Text>
                                                    <Text style={rsStyles.agentBandCaption}>Sitdowns</Text>
                                                </View>
                                                <View style={rsStyles.agentBandCol}>
                                                    <Text style={[rsStyles.agentActualNum, { color: counts.pitches >= att.pledged_pitches && att.pledged_pitches > 0 ? '#0D9488' : colors.textPrimary }]}>{counts.pitches}</Text>
                                                    <Text style={rsStyles.agentBandCaption}>Pitches</Text>
                                                </View>
                                                <View style={rsStyles.agentBandCol}>
                                                    <Text style={[rsStyles.agentActualNum, { color: counts.closed >= att.pledged_closed && att.pledged_closed > 0 ? '#0D9488' : colors.textPrimary }]}>{counts.closed}</Text>
                                                    <Text style={rsStyles.agentBandCaption}>Cases</Text>
                                                </View>
                                                <View style={rsStyles.agentBandCol}>
                                                    <Text style={[rsStyles.agentActualNum, { color: counts.afyc >= att.pledged_afyc && att.pledged_afyc > 0 ? '#F59E0B' : colors.textPrimary }]}>${counts.afyc >= 1000 ? `${(counts.afyc / 1000).toFixed(0)}k` : counts.afyc}</Text>
                                                    <Text style={rsStyles.agentBandCaption}>AFYC</Text>
                                                </View>
                                            </View>
                                        </View>
                                    </View>
                                </>
                            ) : (
                                <View style={rsStyles.agentCheckinRow}>
                                    <Ionicons name="remove-circle-outline" size={14} color={colors.textTertiary} />
                                    <Text style={{ color: colors.textTertiary, fontSize: 13 }}>Not checked in</Text>
                                </View>
                            )}
                        </View>
                    );
                })}
            </View>
        );
    };

    // ---- T1 live: log activity card ----
    const renderLogActivity = () => {
        // Departed = latest check_in/departure event is a departure
        const lastCheckinOrDep = activities
            .filter(a => a.user_id === user?.id && (a.type === 'check_in' || a.type === 'departure'))
            .sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime())[0];
        const hasDeparted = lastCheckinOrDep?.type === 'departure';

        return (
            <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
                <View style={rsStyles.logHeaderRow}>
                    <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Log Activity</Text>
                    <Text style={[rsStyles.logHint, { color: colors.textTertiary }]}>Tap to record</Text>
                </View>
                <View style={[rsStyles.stickyRow, hasDeparted && { opacity: 0.35 }]}>
                    <TouchableOpacity
                        style={[rsStyles.logBtnLg, { backgroundColor: '#6366F118', borderColor: '#6366F1' }]}
                        onPress={() => { initLogTime(); setConfirmActivity('sitdown'); }}
                        disabled={!!logDebounce['sitdown'] || hasDeparted}
                        activeOpacity={0.7}
                        accessibilityLabel={`Log Sitdown, current count ${myCounts.sitdowns}`}
                    >
                        <Ionicons name="people-outline" size={26} color="#6366F1" />
                        <Text style={[rsStyles.logBtnLgLabel, { color: '#6366F1' }]}>Sitdown</Text>
                        <View style={[rsStyles.logBtnBadge, { backgroundColor: '#6366F1' }]}>
                            <Text style={rsStyles.logBtnBadgeText}>{myCounts.sitdowns}</Text>
                        </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[rsStyles.logBtnLg, { backgroundColor: '#0D948818', borderColor: '#0D9488' }]}
                        onPress={() => { initLogTime(); setConfirmActivity('pitch'); }}
                        disabled={!!logDebounce['pitch'] || hasDeparted}
                        activeOpacity={0.7}
                        accessibilityLabel={`Log Pitch, current count ${myCounts.pitches}`}
                    >
                        <Ionicons name="megaphone-outline" size={26} color="#0D9488" />
                        <Text style={[rsStyles.logBtnLgLabel, { color: '#0D9488' }]}>Pitch</Text>
                        <View style={[rsStyles.logBtnBadge, { backgroundColor: '#0D9488' }]}>
                            <Text style={rsStyles.logBtnBadgeText}>{myCounts.pitches}</Text>
                        </View>
                    </TouchableOpacity>
                </View>
                <TouchableOpacity
                    style={[rsStyles.caseClosedBtn, { backgroundColor: '#F59E0B', opacity: hasDeparted ? 0.35 : 1 }]}
                    onPress={() => { setAfycInput(''); initLogTime(); setShowAfycSheet(true); }}
                    disabled={hasDeparted}
                    activeOpacity={0.75}
                    accessibilityLabel={`Log Case Closed, current count ${myCounts.closed}`}
                >
                    <Ionicons name="checkmark-circle-outline" size={22} color="#FFFFFF" />
                    <Text style={rsStyles.caseClosedText}>Case Closed</Text>
                    <View style={[rsStyles.logBtnBadge, { backgroundColor: 'rgba(0,0,0,0.2)' }]}>
                        <Text style={rsStyles.logBtnBadgeText}>{myCounts.closed}</Text>
                    </View>
                </TouchableOpacity>
                {!hasDeparted && (
                    <TouchableOpacity
                        style={[rsStyles.leaveBtn, { borderColor: colors.border }]}
                        onPress={handleLogDeparture}
                        activeOpacity={0.7}
                        accessibilityLabel="Leave Roadshow"
                    >
                        <Ionicons name="log-out-outline" size={16} color={colors.textTertiary} />
                        <Text style={[rsStyles.leaveBtnText, { color: colors.textTertiary }]}>Leave Roadshow</Text>
                    </TouchableOpacity>
                )}
                {hasDeparted && (
                    <View style={{ gap: 8 }}>
                        <View style={rsStyles.departedBadge}>
                            <Ionicons name="walk-outline" size={14} color={colors.textTertiary} />
                            <Text style={[rsStyles.leaveBtnText, { color: colors.textTertiary }]}>You left the booth</Text>
                        </View>
                        <TouchableOpacity
                            style={[rsStyles.returnBtn, { backgroundColor: colors.accent + '15', borderColor: colors.accent }]}
                            onPress={handleReturnToBooth}
                            activeOpacity={0.7}
                            accessibilityLabel="Return to booth"
                        >
                            <Ionicons name="enter-outline" size={16} color={colors.accent} />
                            <Text style={[rsStyles.returnBtnText, { color: colors.accent }]}>Return to Booth</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    };

    // ---- T2/T3 live: booth totals ----
    const renderBoothTotals = () => (
        <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Booth Totals</Text>
            {roadshowConfig && (
                <Text style={[rsStyles.boothCostLabel, { color: colors.textTertiary }]}>
                    Cost today: ${roadshowConfig.daily_cost.toFixed(2)} ({roadshowConfig.slots_per_day} × ${roadshowConfig.slot_cost.toFixed(2)})
                </Text>
            )}
            <View style={rsStyles.ringsRow}>
                <ProgressRing
                    actual={boothTotals.sitdowns}
                    pledged={boothTotals.pledgedSitdowns}
                    color="#6366F1"
                    label="Sitdowns"
                    accessLabel={`Booth sitdowns: ${boothTotals.sitdowns} of ${boothTotals.pledgedSitdowns}`}
                />
                <ProgressRing
                    actual={boothTotals.pitches}
                    pledged={boothTotals.pledgedPitches}
                    color="#0D9488"
                    label="Pitches"
                    accessLabel={`Booth pitches: ${boothTotals.pitches} of ${boothTotals.pledgedPitches}`}
                />
                <ProgressRing
                    actual={boothTotals.closed}
                    pledged={boothTotals.pledgedClosed}
                    color="#F59E0B"
                    label="Closed"
                    accessLabel={`Booth cases: ${boothTotals.closed} of ${boothTotals.pledgedClosed}`}
                />
            </View>
            <View style={rsStyles.afycSection}>
                <View style={rsStyles.afycRow}>
                    <Text style={[rsStyles.afycLabel, { color: colors.textSecondary }]}>AFYC</Text>
                    <Text style={[rsStyles.afycValue, { color: colors.textPrimary }]}>
                        ${boothTotals.afyc.toLocaleString()}
                        {boothTotals.pledgedAfyc > 0 && (
                            <Text style={{ color: colors.textTertiary }}> of ${boothTotals.pledgedAfyc.toLocaleString()} pledged</Text>
                        )}
                    </Text>
                </View>
                {boothTotals.pledgedAfyc > 0 && (
                    <View style={[rsStyles.afycTrack, { backgroundColor: colors.surfaceSecondary }]}>
                        <View style={[rsStyles.afycFill, {
                            width: `${Math.min(100, (boothTotals.afyc / boothTotals.pledgedAfyc) * 100)}%` as any,
                            backgroundColor: '#F59E0B',
                        }]} />
                    </View>
                )}
            </View>
        </View>
    );

    // ---- Past: results table ----
    const renderPastResults = () => (
        <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Results vs Pledges</Text>
            <View style={rsStyles.pastTableHeader}>
                <Text style={[rsStyles.pastHeaderName, { color: colors.textTertiary }]}>Name</Text>
                <Text style={[rsStyles.pastHeaderNum, { color: colors.textTertiary }]}>S</Text>
                <Text style={[rsStyles.pastHeaderNum, { color: colors.textTertiary }]}>P</Text>
                <Text style={[rsStyles.pastHeaderNum, { color: colors.textTertiary }]}>C</Text>
                <Text style={[rsStyles.pastHeaderAfyc, { color: colors.textTertiary }]}>AFYC</Text>
            </View>
            {attendance.map(att => {
                const counts = activityCounts(att.user_id);
                const exceededAfyc = counts.afyc > att.pledged_afyc;
                return (
                    <View key={att.id} style={rsStyles.pastTableRow}>
                        <Text style={[rsStyles.pastCellName, { color: colors.textPrimary }]} numberOfLines={1}>{att.full_name}</Text>
                        <Text style={[rsStyles.pastCellNum, { color: colors.textPrimary }]}>{counts.sitdowns}/{att.pledged_sitdowns}</Text>
                        <Text style={[rsStyles.pastCellNum, { color: colors.textPrimary }]}>{counts.pitches}/{att.pledged_pitches}</Text>
                        <Text style={[rsStyles.pastCellNum, { color: colors.textPrimary }]}>{counts.closed}/{att.pledged_closed}</Text>
                        <Text style={[rsStyles.pastCellAfyc, { color: exceededAfyc ? '#F59E0B' : colors.textPrimary }]}>
                            ${counts.afyc.toLocaleString()}
                        </Text>
                    </View>
                );
            })}
            {attendance.length > 0 && (
                <View style={[rsStyles.pastTableRow, rsStyles.pastTotalRow, { borderTopColor: colors.border }]}>
                    <Text style={[rsStyles.pastCellName, { color: colors.textPrimary, fontWeight: '700' }]}>TOTAL</Text>
                    <Text style={[rsStyles.pastCellNum, { color: colors.textPrimary, fontWeight: '700' }]}>{boothTotals.sitdowns}/{boothTotals.pledgedSitdowns}</Text>
                    <Text style={[rsStyles.pastCellNum, { color: colors.textPrimary, fontWeight: '700' }]}>{boothTotals.pitches}/{boothTotals.pledgedPitches}</Text>
                    <Text style={[rsStyles.pastCellNum, { color: colors.textPrimary, fontWeight: '700' }]}>{boothTotals.closed}/{boothTotals.pledgedClosed}</Text>
                    <Text style={[rsStyles.pastCellAfyc, { color: '#F59E0B', fontWeight: '700' }]}>${boothTotals.afyc.toLocaleString()}</Text>
                </View>
            )}
        </View>
    );

    // ---- Past: attendance ----
    const renderPastAttendance = () => (
        <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
            <View style={rsStyles.sectionHeaderRow}>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Attendance</Text>
                <Text style={[rsStyles.countBadge, { color: colors.textTertiary }]}>{attendance.length}/{event.attendees.length}</Text>
            </View>
            {attendance.map(att => (
                <View key={att.id} style={rsStyles.pastAttRow}>
                    <View style={rsStyles.pastAttTop}>
                        <Avatar name={att.full_name ?? '?'} avatarUrl={null} size={28} backgroundColor={getAvatarColor(att.full_name ?? '?') + '18'} textColor={getAvatarColor(att.full_name ?? '?')} />
                        <Text style={[rsStyles.agentName, { color: colors.textPrimary }]}>{att.full_name}</Text>
                        <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{formatCheckinTime(att.checked_in_at)}</Text>
                        <View style={[rsStyles.latePill, { backgroundColor: att.is_late ? colors.warningLight : colors.successLight }]}>
                            <Ionicons name={att.is_late ? 'warning' : 'checkmark'} size={11} color={att.is_late ? colors.warning : colors.success} />
                            <Text style={{ color: att.is_late ? colors.warning : colors.success, fontSize: 11, fontWeight: '600' }}>
                                {att.is_late ? `Late ${att.minutes_late}m` : 'On time'}
                            </Text>
                        </View>
                    </View>
                    {att.late_reason && (
                        <Text style={{ color: colors.textTertiary, fontSize: 12, marginLeft: 36, marginTop: 2 }}>"{att.late_reason}"</Text>
                    )}
                </View>
            ))}
        </View>
    );

    // ---- Past: cost summary ----
    const renderPastCost = () => roadshowConfig ? (
        <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Cost Summary</Text>
            <View style={rsStyles.costRow}>
                <Text style={[rsStyles.costLabel, { color: colors.textTertiary }]}>Weekly cost</Text>
                <Text style={[rsStyles.costValue, { color: colors.textPrimary }]}>${roadshowConfig.weekly_cost.toFixed(2)}</Text>
            </View>
            <View style={rsStyles.costRow}>
                <Text style={[rsStyles.costLabel, { color: colors.textTertiary }]}>This day</Text>
                <Text style={[rsStyles.costValue, { color: colors.textPrimary }]}>${roadshowConfig.daily_cost.toFixed(2)}</Text>
            </View>
            <View style={rsStyles.costRow}>
                <Text style={[rsStyles.costLabel, { color: colors.textTertiary }]}>Per agent</Text>
                <Text style={[rsStyles.costValue, { color: ROADSHOW_PINK, fontWeight: '700' }]}>${roadshowConfig.slot_cost.toFixed(2)}</Text>
            </View>
        </View>
    ) : null;

    // ── Full render ───────────────────────────────────────────
    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScreenHeader
                title="Event Detail"
                showBack
                onBack={() => router.back()}
                rightAction={(canEdit || canDelete) ? (
                    <View style={styles.headerActions}>
                        {canEdit && (
                            <TouchableOpacity
                                onPress={() => router.push({ pathname: '/events/create' as any, params: { eventId: event.id } })}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                accessibilityLabel="Edit event"
                            >
                                <Ionicons name="pencil-outline" size={22} color={colors.accent} />
                            </TouchableOpacity>
                        )}
                        {canDelete && (
                            <TouchableOpacity
                                onPress={handleDelete}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                accessibilityLabel="Delete event"
                            >
                                <Ionicons name="trash-outline" size={22} color={colors.danger} />
                            </TouchableOpacity>
                        )}
                    </View>
                ) : undefined}
            />

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadEvent(true)} tintColor={colors.accent} />}
            >
                {/* Hero */}
                <View style={[styles.hero, { backgroundColor: colors.cardBackground }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={[styles.typePill, { backgroundColor: typeColor + '18' }]}>
                            <View style={[styles.typeDot, { backgroundColor: typeColor }]} />
                            <Text style={[styles.typePillText, { color: typeColor }]}>{EVENT_TYPE_LABELS[event.event_type]}</Text>
                        </View>
                        {isLive && (
                            <View style={[rsStyles.livePill, { backgroundColor: '#22C55E18' }]}>
                                <Animated.View style={[rsStyles.liveDot, { backgroundColor: '#22C55E', opacity: liveAnim }]} />
                                <Text style={[rsStyles.liveText, { color: '#22C55E' }]}>LIVE</Text>
                            </View>
                        )}
                    </View>
                    <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>{event.title}</Text>
                    <View style={styles.metaRow}>
                        <Ionicons name="calendar-outline" size={16} color={colors.textTertiary} />
                        <Text style={[styles.metaText, { color: colors.textSecondary }]}>{formatDateLong(event.event_date)}</Text>
                    </View>
                    <View style={styles.metaRow}>
                        <Ionicons name="time-outline" size={16} color={colors.textTertiary} />
                        <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                            {formatTime(event.start_time)}{event.end_time ? ` – ${formatTime(event.end_time)}` : ''}
                        </Text>
                    </View>
                    {event.location && (
                        <View style={styles.metaRow}>
                            <Ionicons name="location-outline" size={16} color={colors.textTertiary} />
                            <Text style={[styles.metaText, { color: colors.textSecondary }]}>{event.location}</Text>
                        </View>
                    )}
                </View>

                {/* Description */}
                {event.description && (
                    <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
                        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Description</Text>
                        <Text style={[styles.description, { color: colors.textSecondary }]}>{event.description}</Text>
                    </View>
                )}

                {/* ── Roadshow sections ── */}
                {isUpcoming && renderUpcoming()}

                {isLive && isT1 && !hasCheckedIn && renderT1CheckIn()}
                {isLive && isT1 && hasCheckedIn && renderLogActivity()}
                {isLive && isT1 && hasCheckedIn && renderT1Progress()}
                {isLive && isT2orT3 && renderBoothTotals()}
                {isLive && isT2orT3 && renderT2AgentStatus()}
                {isLive && renderLeaderboard()}
                {isLive && renderActivityFeed()}

                {isPast && renderPastAttendance()}
                {isPast && renderPastResults()}
                {isPast && renderPastCost()}
                {isPast && renderActivityFeed()}

                {/* Assigned Agents (upcoming + non-roadshow) */}
                {(!isRoadshow || isUpcoming) && (
                    <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
                        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Attendees ({totalAttendees})</Text>
                        {totalAttendees === 0 ? (
                            <Text style={[styles.noAttendees, { color: colors.textTertiary }]}>No attendees added yet</Text>
                        ) : (
                            <>
                                {ATTENDEE_ROLE_ORDER.filter(r => grouped[r].length > 0).map(role => (
                                    <View key={role} style={styles.roleGroup}>
                                        <Text style={[styles.roleGroupLabel, { color: colors.textTertiary }]}>{ATTENDEE_ROLE_LABELS[role]}</Text>
                                        {grouped[role].map(a => {
                                            const ac = AVATAR_COLORS[(a.full_name ?? '?').charCodeAt(0) % AVATAR_COLORS.length];
                                            return (
                                                <View key={a.id} style={styles.attendeeRow}>
                                                    <Avatar name={a.full_name ?? '?'} avatarUrl={a.avatar_url} size={36} backgroundColor={ac + '18'} textColor={ac} />
                                                    <Text style={[styles.attendeeName, { color: colors.textPrimary }]}>{a.full_name}</Text>
                                                    <View style={[styles.roleBadge, { backgroundColor: ATTENDEE_ROLE_COLORS[a.attendee_role] + '18' }]}>
                                                        <Text style={[styles.roleText, { color: ATTENDEE_ROLE_COLORS[a.attendee_role] }]}>{ATTENDEE_ROLE_LABELS[a.attendee_role]}</Text>
                                                    </View>
                                                </View>
                                            );
                                        })}
                                    </View>
                                ))}
                                {(event.external_attendees?.length ?? 0) > 0 && (
                                    <View style={styles.roleGroup}>
                                        <Text style={[styles.roleGroupLabel, { color: colors.textTertiary }]}>External Guests</Text>
                                        {event.external_attendees.map((a, i) => {
                                            const ac = AVATAR_COLORS[a.name.charCodeAt(0) % AVATAR_COLORS.length];
                                            return (
                                                <View key={i} style={styles.attendeeRow}>
                                                    <Avatar name={a.name} avatarUrl={null} size={36} backgroundColor={ac + '18'} textColor={ac} />
                                                    <Text style={[styles.attendeeName, { color: colors.textPrimary }]}>{a.name}</Text>
                                                    <View style={[styles.roleBadge, { backgroundColor: (ATTENDEE_ROLE_COLORS[a.attendee_role] ?? '#8E8E93') + '18' }]}>
                                                        <Text style={[styles.roleText, { color: ATTENDEE_ROLE_COLORS[a.attendee_role] ?? '#8E8E93' }]}>
                                                            {ATTENDEE_ROLE_LABELS[a.attendee_role] ?? a.attendee_role}
                                                        </Text>
                                                    </View>
                                                </View>
                                            );
                                        })}
                                    </View>
                                )}
                            </>
                        )}
                    </View>
                )}

                {/* Footer */}
                <View style={[styles.footer, { backgroundColor: colors.cardBackground }]}>
                    {event.creator_name && <Text style={[styles.footerText, { color: colors.textTertiary }]}>Created by {event.creator_name}</Text>}
                    <Text style={[styles.footerText, { color: colors.textTertiary }]}>{formatCreatedAt(event.created_at)}</Text>
                </View>
            </ScrollView>

            {/* ── Pledge Sheet ── */}
            <Modal visible={showPledgeSheet} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowPledgeSheet(false)}>
                <SafeAreaView style={[styles.sheetContainer, { backgroundColor: colors.background }]}>
                    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                        <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
                            <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>Your Pledge for Today</Text>
                            <TouchableOpacity onPress={() => setShowPledgeSheet(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <Ionicons name="close" size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView contentContainerStyle={styles.sheetContent}>
                            <Text style={{ color: colors.textTertiary, fontSize: 13, marginBottom: 16 }}>Pre-filled with suggested targets. Adjust as needed.</Text>
                            {([['pledgeSitdowns', 'Sitdowns today', setPledgeSitdowns, pledgeSitdowns], ['pledgePitches', 'Pitches today', setPledgePitches, pledgePitches], ['pledgeClosed', 'Cases to close', setPledgeClosed, pledgeClosed]] as any[]).map(([key, label, setter, val]) => (
                                <View key={key} style={rsStyles.pledgeRow}>
                                    <Text style={[rsStyles.pledgeLabel, { color: colors.textSecondary }]}>{label}</Text>
                                    <View style={rsStyles.pledgeStepperRow}>
                                        <TouchableOpacity style={[rsStyles.stepBtn, { backgroundColor: colors.surfaceSecondary }]} onPress={() => setter((v: number) => Math.max(0, v - 1))} accessibilityLabel={`Decrease ${label}`}>
                                            <Ionicons name="remove" size={18} color={colors.textPrimary} />
                                        </TouchableOpacity>
                                        <Text style={[rsStyles.stepVal, { color: colors.textPrimary }]}>{val}</Text>
                                        <TouchableOpacity style={[rsStyles.stepBtn, { backgroundColor: colors.surfaceSecondary }]} onPress={() => setter((v: number) => v + 1)} accessibilityLabel={`Increase ${label}`}>
                                            <Ionicons name="add" size={18} color={colors.textPrimary} />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                            <View style={styles.field}>
                                <Text style={[rsStyles.pledgeLabel, { color: colors.textSecondary }]}>AFYC target ($)</Text>
                                <TextInput
                                    style={[styles.inputSm, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                                    placeholder="e.g. 2000"
                                    placeholderTextColor={colors.textTertiary}
                                    value={pledgeAfyc}
                                    onChangeText={v => setPledgeAfyc(v.replace(/[^0-9]/g, ''))}
                                    keyboardType="number-pad"
                                />
                            </View>
                            {checkinError && (
                                <View style={[rsStyles.errorBanner, { backgroundColor: ERROR_BG }]}>
                                    <Text style={{ color: ERROR_TEXT, fontSize: 13 }}>{checkinError}</Text>
                                </View>
                            )}
                            <TouchableOpacity
                                style={[rsStyles.checkinBtn, { backgroundColor: colors.accent, opacity: checkingIn ? 0.6 : 1 }]}
                                onPress={handleConfirmPledge}
                                disabled={checkingIn}
                            >
                                {checkingIn
                                    ? <ActivityIndicator size="small" color="#FFFFFF" />
                                    : <>
                                        <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                                        <Text style={rsStyles.checkinBtnText}>Confirm &amp; Pledge</Text>
                                    </>
                                }
                            </TouchableOpacity>
                        </ScrollView>
                    </KeyboardAvoidingView>
                </SafeAreaView>
            </Modal>

            {/* ── Activity Confirm Sheet ── */}
            <Modal visible={confirmActivity !== null} transparent animationType="fade" onRequestClose={() => setConfirmActivity(null)}>
                {(() => {
                    const cfg = confirmActivity === 'sitdown'
                        ? { label: 'Sitdown', icon: 'people-outline' as const, color: '#6366F1', count: myCounts.sitdowns }
                        : { label: 'Pitch', icon: 'megaphone-outline' as const, color: '#0D9488', count: myCounts.pitches };
                    return (
                        <View style={rsStyles.confirmOverlay}>
                            {/* Backdrop tap to dismiss */}
                            <TouchableOpacity
                                style={StyleSheet.absoluteFillObject}
                                activeOpacity={1}
                                onPress={() => setConfirmActivity(null)}
                            />
                            {/* Sheet — plain View so ScrollView inside WheelPicker can scroll */}
                            <View style={[rsStyles.confirmSheet, { backgroundColor: colors.cardBackground, paddingBottom: insets.bottom + 24 }]}>
                                <View style={[rsStyles.confirmHandle, { backgroundColor: colors.border }]} />
                                <View style={[rsStyles.confirmIconBg, { backgroundColor: cfg.color + '18' }]}>
                                    <Ionicons name={cfg.icon} size={34} color={cfg.color} />
                                </View>
                                <Text style={[rsStyles.confirmTitle, { color: colors.textPrimary }]}>Log {cfg.label}?</Text>
                                <Text style={[rsStyles.confirmSubtitle, { color: colors.textTertiary }]}>
                                    {cfg.count === 0 ? 'First one today' : `${cfg.count} logged so far today`}
                                </Text>
                                <Text style={[rsStyles.confirmTimeLabel, { color: colors.textTertiary }]}>Time</Text>
                                <View style={rsStyles.wheelRow}>
                                    <WheelPicker items={PICKER_HOURS} selectedIndex={logHour} onChange={setLogHour} colors={colors} width={52} />
                                    <WheelPicker items={PICKER_MINUTES} selectedIndex={logMinuteIdx} onChange={setLogMinuteIdx} colors={colors} width={52} />
                                    <WheelPicker items={PICKER_AMPM} selectedIndex={logAmPm} onChange={setLogAmPm} colors={colors} width={60} />
                                </View>
                                <TouchableOpacity
                                    style={[rsStyles.confirmBtn, { backgroundColor: cfg.color }]}
                                    activeOpacity={0.8}
                                    onPress={() => { handleLogActivity(confirmActivity!); setConfirmActivity(null); }}
                                >
                                    <Text style={rsStyles.confirmBtnText}>Log {cfg.label}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={rsStyles.confirmCancel} onPress={() => setConfirmActivity(null)}>
                                    <Text style={[rsStyles.confirmCancelText, { color: colors.textSecondary }]}>Cancel</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    );
                })()}
            </Modal>

            {/* ── AFYC Input Sheet ── */}
            <Modal visible={showAfycSheet} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAfycSheet(false)}>
                <SafeAreaView style={[styles.sheetContainer, { backgroundColor: colors.background }]}>
                    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                        <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
                            <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>Log Case Closed</Text>
                            <TouchableOpacity onPress={() => setShowAfycSheet(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <Ionicons name="close" size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.sheetContent}>
                            <Text style={[rsStyles.pledgeLabel, { color: colors.textSecondary, marginBottom: 6 }]}>AFYC Amount ($)</Text>
                            <TextInput
                                style={[styles.inputSm, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.textPrimary, fontSize: 22, fontWeight: '700' }]}
                                placeholder="0"
                                placeholderTextColor={colors.textTertiary}
                                value={afycInput}
                                onChangeText={v => setAfycInput(v.replace(/[^0-9]/g, ''))}
                                keyboardType="number-pad"
                                autoFocus
                            />
                            <Text style={[rsStyles.pledgeLabel, { color: colors.textSecondary, marginTop: 20, marginBottom: 4 }]}>Time</Text>
                            <View style={[rsStyles.wheelRow, { marginBottom: 8 }]}>
                                <WheelPicker items={PICKER_HOURS} selectedIndex={logHour} onChange={setLogHour} colors={colors} width={52} />
                                <WheelPicker items={PICKER_MINUTES} selectedIndex={logMinuteIdx} onChange={setLogMinuteIdx} colors={colors} width={52} />
                                <WheelPicker items={PICKER_AMPM} selectedIndex={logAmPm} onChange={setLogAmPm} colors={colors} width={60} />
                            </View>
                            <TouchableOpacity
                                style={[rsStyles.checkinBtn, { backgroundColor: '#F59E0B', marginTop: 12, opacity: loggingActivity ? 0.6 : 1 }]}
                                onPress={handleLogCaseClosed}
                                disabled={loggingActivity}
                            >
                                {loggingActivity
                                    ? <ActivityIndicator size="small" color="#FFFFFF" />
                                    : <>
                                        <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                                        <Text style={rsStyles.checkinBtnText}>Log Case Closed</Text>
                                    </>
                                }
                            </TouchableOpacity>
                            <TouchableOpacity style={{ marginTop: 16, alignItems: 'center' }} onPress={() => { setAfycInput('0'); handleLogCaseClosed(); }}>
                                <Text style={{ color: colors.textTertiary, fontSize: 14 }}>Skip AFYC — log without amount</Text>
                            </TouchableOpacity>
                        </View>
                    </KeyboardAvoidingView>
                </SafeAreaView>
            </Modal>

            {/* ── Manager Override Sheet ── */}
            <Modal visible={!!overrideTarget} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOverrideTarget(null)}>
                <SafeAreaView style={[styles.sheetContainer, { backgroundColor: colors.background }]}>
                    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                        <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
                            <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
                                Check in for {overrideTarget?.full_name}
                            </Text>
                            <TouchableOpacity onPress={() => setOverrideTarget(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <Ionicons name="close" size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView contentContainerStyle={styles.sheetContent}>
                            <Text style={{ color: colors.textTertiary, fontSize: 12, marginBottom: 16 }}>
                                Recorded as override by {user?.full_name}
                            </Text>
                            <View style={styles.field}>
                                <Text style={[rsStyles.pledgeLabel, { color: colors.textSecondary }]}>Arrival time</Text>
                                <TextInput
                                    style={[styles.inputSm, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                                    placeholder="e.g. 10:15 AM"
                                    placeholderTextColor={colors.textTertiary}
                                    value={overrideTime}
                                    onChangeText={setOverrideTime}
                                />
                            </View>
                            <View style={styles.field}>
                                <Text style={[rsStyles.pledgeLabel, { color: colors.textSecondary }]}>Late reason (optional)</Text>
                                <TextInput
                                    style={[styles.inputSm, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                                    placeholder="e.g. MRT delay"
                                    placeholderTextColor={colors.textTertiary}
                                    value={overrideLateReason}
                                    onChangeText={setOverrideLateReason}
                                />
                            </View>
                            <Text style={[{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 8 }]}>Pledge on their behalf</Text>
                            {([['Sitdowns', overridePledgeSitdowns, setOverridePledgeSitdowns], ['Pitches', overridePledgePitches, setOverridePledgePitches], ['Cases', overridePledgeClosed, setOverridePledgeClosed]] as any[]).map(([label, val, setter]) => (
                                <View key={label} style={rsStyles.pledgeRow}>
                                    <Text style={[rsStyles.pledgeLabel, { color: colors.textSecondary }]}>{label}</Text>
                                    <View style={rsStyles.pledgeStepperRow}>
                                        <TouchableOpacity style={[rsStyles.stepBtn, { backgroundColor: colors.surfaceSecondary }]} onPress={() => setter((v: number) => Math.max(0, v - 1))}>
                                            <Ionicons name="remove" size={18} color={colors.textPrimary} />
                                        </TouchableOpacity>
                                        <Text style={[rsStyles.stepVal, { color: colors.textPrimary }]}>{val}</Text>
                                        <TouchableOpacity style={[rsStyles.stepBtn, { backgroundColor: colors.surfaceSecondary }]} onPress={() => setter((v: number) => v + 1)}>
                                            <Ionicons name="add" size={18} color={colors.textPrimary} />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                            <View style={styles.field}>
                                <Text style={[rsStyles.pledgeLabel, { color: colors.textSecondary }]}>AFYC target ($)</Text>
                                <TextInput
                                    style={[styles.inputSm, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                                    placeholder="e.g. 2000"
                                    placeholderTextColor={colors.textTertiary}
                                    value={overridePledgeAfyc}
                                    onChangeText={v => setOverridePledgeAfyc(v.replace(/[^0-9]/g, ''))}
                                    keyboardType="number-pad"
                                />
                            </View>
                            {overrideError && (
                                <View style={[rsStyles.errorBanner, { backgroundColor: ERROR_BG }]}>
                                    <Text style={{ color: ERROR_TEXT, fontSize: 13 }}>{overrideError}</Text>
                                </View>
                            )}
                            <TouchableOpacity
                                style={[rsStyles.checkinBtn, { backgroundColor: ROADSHOW_PINK, opacity: overrideSubmitting ? 0.6 : 1 }]}
                                onPress={handleConfirmOverride}
                                disabled={overrideSubmitting}
                            >
                                {overrideSubmitting
                                    ? <ActivityIndicator size="small" color="#FFFFFF" />
                                    : <>
                                        <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
                                        <Text style={rsStyles.checkinBtnText}>Confirm Override Check-in</Text>
                                    </>
                                }
                            </TouchableOpacity>
                        </ScrollView>
                    </KeyboardAvoidingView>
                </SafeAreaView>
            </Modal>

            <Confetti visible={confettiVisible} confettiKey={confettiKey} />
        </SafeAreaView>
    );
}

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 40, gap: 12 },
    notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    notFoundText: { fontSize: 16 },
    hero: { borderRadius: 16, padding: 20, gap: 10 },
    typePill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    typeDot: { width: 6, height: 6, borderRadius: 3 },
    typePillText: { fontSize: 12, fontWeight: '700' },
    heroTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4, lineHeight: 28 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    metaText: { fontSize: 14, flex: 1 },
    card: { borderRadius: 16, padding: 16, gap: 12 },
    cardTitle: { fontSize: 15, fontWeight: '700' },
    description: { fontSize: 14, lineHeight: 21 },
    noAttendees: { fontSize: 14 },
    roleGroup: { gap: 8, marginTop: 4 },
    roleGroupLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    attendeeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    attendeeName: { flex: 1, fontSize: 15, fontWeight: '500' },
    roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    roleText: { fontSize: 11, fontWeight: '700' },
    footer: { borderRadius: 12, padding: 14, alignItems: 'center' },
    footerText: { fontSize: 13 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    separator: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
    field: { gap: 4 },
    inputSm: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
    sheetContainer: { flex: 1 },
    sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
    sheetTitle: { fontSize: 17, fontWeight: '700' },
    sheetContent: { padding: 16, gap: 12 },
});

const rsStyles = StyleSheet.create({
    livePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    liveDot: { width: 7, height: 7, borderRadius: 3.5 },
    liveText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },

    costRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    costLabel: { fontSize: 14 },
    costValue: { fontSize: 14, fontWeight: '600' },

    targetsRow: { flexDirection: 'row', justifyContent: 'space-around' },
    targetCell: { alignItems: 'center', gap: 2 },
    targetNum: { fontSize: 24, fontWeight: '800' },
    targetLabel: { fontSize: 12 },

    infoBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12, borderWidth: 1 },
    lateBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, padding: 10, borderWidth: 1 },
    lateText: { fontSize: 13, fontWeight: '600' },
    errorBanner: { borderRadius: 8, padding: 10 },

    boothInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    boothInfoText: { fontSize: 14 },
    slotCostText: { fontSize: 13 },

    checkinBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 15, minHeight: 52 },
    checkinBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

    ringsRow: { flexDirection: 'row', justifyContent: 'space-around' },

    progressHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    checkinLabel: { fontSize: 13 },

    afycSection: { gap: 6 },
    afycRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    afycLabel: { fontSize: 14, fontWeight: '600' },
    afycValue: { fontSize: 14, fontWeight: '700' },
    afycTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
    afycFill: { height: 6, borderRadius: 3 },

    lbHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
    lbHeaderName: { flex: 1, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
    lbHeaderNum: { width: 28, textAlign: 'center', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
    lbHeaderAfyc: { width: 52, textAlign: 'right', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
    lbRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 6, borderRadius: 8 },
    lbRank: { width: 20, fontSize: 12 },
    lbName: { flex: 1, fontSize: 14 },
    lbNum: { width: 28, textAlign: 'center', fontSize: 14 },
    lbAfyc: { width: 52, textAlign: 'right', fontSize: 13, fontWeight: '600' },

    feedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    feedTime: { fontSize: 12, width: 62 },
    feedName: { flex: 1, fontSize: 13 },
    feedType: { fontSize: 13, fontWeight: '600' },

    stickyRow: { flexDirection: 'row', gap: 10 },
    confirmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end', position: 'relative' },
    confirmSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 12, alignItems: 'center', gap: 10 },
    confirmHandle: { width: 36, height: 4, borderRadius: 2, marginBottom: 4 },
    confirmIconBg: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
    confirmTitle: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
    confirmSubtitle: { fontSize: 14 },
    confirmBtn: { width: '100%', alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 16, minHeight: 52, marginTop: 6 },
    confirmBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
    confirmCancel: { paddingVertical: 12, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    confirmCancelText: { fontSize: 16 },
    confirmTimeLabel: { fontSize: 13, fontWeight: '500', marginTop: 4, marginBottom: -4 },
    wheelRow: { flexDirection: 'row', gap: 0, alignItems: 'center', justifyContent: 'center' },
    leaveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 10, paddingVertical: 10, minHeight: 40 },
    leaveBtnText: { fontSize: 13, fontWeight: '500' },
    departedBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 4 },
    returnBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderRadius: 10, paddingVertical: 11, minHeight: 44 },
    returnBtnText: { fontSize: 14, fontWeight: '600' },
    logBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingVertical: 13, borderWidth: 1.5, minHeight: 48 },
    logBtnText: { fontSize: 14, fontWeight: '700' },
    logBtnLg: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, paddingVertical: 18, borderWidth: 1.5, minHeight: 90, position: 'relative' },
    logBtnLgLabel: { fontSize: 15, fontWeight: '700' },
    logBtnBadge: { position: 'absolute', top: 8, right: 8, minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
    logBtnBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
    logHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    logHint: { fontSize: 12 },
    caseClosedBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 15, minHeight: 52 },
    caseClosedText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', flex: 1, textAlign: 'center' },

    boothCostLabel: { fontSize: 13 },
    boothTotalRow: { flexDirection: 'row', justifyContent: 'space-between' },
    boothTotalLabel: { fontSize: 14 },
    boothTotalValue: { fontSize: 14, fontWeight: '600' },

    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    countBadge: { fontSize: 13, fontWeight: '600' },

    agentCard: { borderRadius: 12, padding: 12, gap: 6 },
    agentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    agentName: { flex: 1, fontSize: 15, fontWeight: '600' },
    agentCheckinRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    agentStatsTable: { gap: 8 },
    agentStatsBand: { borderRadius: 8, borderWidth: 1, borderColor: 'transparent', paddingHorizontal: 10, paddingVertical: 8 },
    agentBandLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 6 },
    agentBandRow: { flexDirection: 'row' },
    agentBandCol: { flex: 1, alignItems: 'center', gap: 2 },
    agentBandNum: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
    agentBandCaption: { fontSize: 10, color: '#8E8E93', textAlign: 'center' },
    agentActualNum: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
    overrideBtn: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },

    pastTableHeader: { flexDirection: 'row', paddingVertical: 4 },
    pastHeaderName: { flex: 1, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
    pastHeaderNum: { width: 36, textAlign: 'center', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
    pastHeaderAfyc: { width: 64, textAlign: 'right', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
    pastTableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
    pastTotalRow: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 4, paddingTop: 8 },
    pastCellName: { flex: 1, fontSize: 13 },
    pastCellNum: { width: 36, textAlign: 'center', fontSize: 13 },
    pastCellAfyc: { width: 64, textAlign: 'right', fontSize: 13 },

    pastAttRow: { gap: 2 },
    pastAttTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    latePill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },

    pledgeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    pledgeLabel: { fontSize: 15, fontWeight: '500' },
    pledgeStepperRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    stepBtn: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    stepVal: { fontSize: 18, fontWeight: '700', minWidth: 32, textAlign: 'center' },
});
