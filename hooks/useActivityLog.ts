import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { logRoadshowActivity } from '@/lib/roadshow';
import { PICKER_MINUTES } from '@/constants/ui';
import type { RoadshowActivity, RoadshowAttendance } from '@/types/event';

interface UseActivityLogParams {
    eventId: string | undefined;
    userId: string | undefined;
    userFullName: string | undefined;
    myAttendance: RoadshowAttendance | null;
    activities: RoadshowActivity[];
    setActivities: React.Dispatch<React.SetStateAction<RoadshowActivity[]>>;
    onMilestone: (kind?: 'sit' | 'pitch' | 'case') => void;
}

export function useActivityLog({
    eventId,
    userId,
    userFullName,
    myAttendance,
    activities,
    setActivities,
    onMilestone,
}: UseActivityLogParams) {
    const [logDebounce, setLogDebounce] = useState<Record<string, boolean>>({});
    const [confirmActivity, setConfirmActivity] = useState<'sitdown' | 'pitch' | null>(null);
    const [showAfycSheet, setShowAfycSheet] = useState(false);
    const [afycInput, setAfycInput] = useState('');
    const [loggingActivity, setLoggingActivity] = useState(false);
    const [logHour, setLogHour] = useState(0);
    const [logMinuteIdx, setLogMinuteIdx] = useState(0);
    const [logAmPm, setLogAmPm] = useState(0);

    const myCounts = useMemo(() => {
        if (!myAttendance) return { sitdowns: 0, pitches: 0, closed: 0, afyc: 0 };
        const mine = activities.filter((a) => a.user_id === myAttendance.user_id);
        return {
            sitdowns: mine.filter((a) => a.type === 'sitdown').length,
            pitches: mine.filter((a) => a.type === 'pitch').length,
            closed: mine.filter((a) => a.type === 'case_closed').length,
            afyc: mine.filter((a) => a.type === 'case_closed').reduce((s, a) => s + (a.afyc_amount ?? 0), 0),
        };
    }, [activities, myAttendance]);

    const initLogTime = useCallback(() => {
        const now = new Date();
        let h = now.getHours();
        const mins = now.getMinutes();
        const roundedMin = Math.round(mins / 5) * 5;
        const ampm = h >= 12 ? 1 : 0;
        if (h > 12) h -= 12;
        if (h === 0) h = 12;
        const minIdx = Math.min(Math.floor(roundedMin / 5), PICKER_MINUTES.length - 1);
        setLogHour(h - 1);
        setLogMinuteIdx(minIdx);
        setLogAmPm(ampm);
    }, []);

    const logTimeToISO = useCallback((): string => {
        let h = logHour + 1; // 1-12
        if (logAmPm === 1 && h !== 12) h += 12;
        if (logAmPm === 0 && h === 12) h = 0;
        const mins = Number(PICKER_MINUTES[logMinuteIdx]);
        const d = new Date();
        d.setHours(h, mins, 0, 0);
        return d.toISOString();
    }, [logHour, logMinuteIdx, logAmPm]);

    const handleLogActivity = useCallback(
        async (type: 'sitdown' | 'pitch', afycAmount?: number) => {
            if (logDebounce[type]) return;
            setLogDebounce((prev) => ({ ...prev, [type]: true }));

            // Check if this tap will exactly hit the pledged target -> celebrate
            const currentCount = type === 'sitdown' ? myCounts.sitdowns : myCounts.pitches;
            const pledgedTarget =
                type === 'sitdown' ? (myAttendance?.pledged_sitdowns ?? 0) : (myAttendance?.pledged_pitches ?? 0);
            if (pledgedTarget > 0 && currentCount + 1 === pledgedTarget) {
                onMilestone(type === 'sitdown' ? 'sit' : 'pitch');
            }

            // Optimistic update
            const tempId = `opt_${Date.now()}`;
            const loggedAt = logTimeToISO();
            const optimistic: RoadshowActivity = {
                id: tempId,
                event_id: eventId!,
                user_id: userId!,
                full_name: userFullName ?? 'Me',
                type,
                afyc_amount: afycAmount ?? null,
                logged_at: loggedAt,
            };
            setActivities((prev) => [optimistic, ...prev]);

            const { error } = await logRoadshowActivity(eventId!, userId!, type, afycAmount, loggedAt);
            if (error) {
                setActivities((prev) => prev.filter((a) => a.id !== tempId));
                Alert.alert('Failed', 'Could not log activity. Please try again.');
            }

            setTimeout(() => setLogDebounce((prev) => ({ ...prev, [type]: false })), 400);
        },
        [logDebounce, myCounts, myAttendance, eventId, userId, userFullName, setActivities, onMilestone, logTimeToISO],
    );

    const handleLogCaseClosed = useCallback(async () => {
        if (loggingActivity) return;
        setLoggingActivity(true);
        const amount = Number(afycInput) || 0;

        if (amount === 0) {
            const confirmed = await new Promise<boolean>((resolve) =>
                Alert.alert('Log $0 AFYC?', 'Are you sure you want to log a Case Closed with $0 AFYC?', [
                    { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
                    { text: 'Log', onPress: () => resolve(true) },
                ]),
            );
            if (!confirmed) {
                setLoggingActivity(false);
                return;
            }
        }

        const tempId = `opt_cc_${Date.now()}`;
        const loggedAt = logTimeToISO();
        const optimistic: RoadshowActivity = {
            id: tempId,
            event_id: eventId!,
            user_id: userId!,
            full_name: userFullName ?? 'Me',
            type: 'case_closed',
            afyc_amount: amount,
            logged_at: loggedAt,
        };
        setActivities((prev) => [optimistic, ...prev]);
        setShowAfycSheet(false);
        setAfycInput('');
        onMilestone('case');

        const { error: ccError } = await logRoadshowActivity(eventId!, userId!, 'case_closed', amount, loggedAt);
        if (ccError) {
            setActivities((prev) => prev.filter((a) => a.id !== tempId));
            Alert.alert('Failed', 'Could not log case closed.');
        }
        setLoggingActivity(false);
    }, [loggingActivity, afycInput, eventId, userId, userFullName, setActivities, onMilestone, logTimeToISO]);

    const handleLogDeparture = () => {
        Alert.alert('Leave Roadshow?', 'This will log your departure from the booth.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Leave',
                style: 'destructive',
                onPress: async () => {
                    const tempId = `opt_dep_${Date.now()}`;
                    const optimistic: RoadshowActivity = {
                        id: tempId,
                        event_id: eventId!,
                        user_id: userId!,
                        full_name: userFullName ?? 'Me',
                        type: 'departure',
                        afyc_amount: null,
                        logged_at: new Date().toISOString(),
                    };
                    setActivities((prev) => [optimistic, ...prev]);
                    const { error: depError } = await logRoadshowActivity(eventId!, userId!, 'departure');
                    if (depError) setActivities((prev) => prev.filter((a) => a.id !== tempId));
                },
            },
        ]);
    };

    return {
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
        logTimeToISO,
        handleLogActivity,
        handleLogCaseClosed,
        handleLogDeparture,
    };
}
