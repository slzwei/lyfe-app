import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useRoadshowRealtime } from '@/hooks/useRoadshowRealtime';
import { fetchEventById } from '@/lib/events';
import { fetchRoadshowActivities, fetchRoadshowAttendance, fetchRoadshowConfig } from '@/lib/roadshow';
import { todayLocalStr } from '@/lib/dateTime';
import type { AgencyEvent, RoadshowActivity, RoadshowAttendance, RoadshowConfig } from '@/types/event';

export function useEventDetail(eventId: string | undefined, userId: string | undefined) {
    const [event, setEvent] = useState<AgencyEvent | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [roadshowConfig, setRoadshowConfig] = useState<RoadshowConfig | null>(null);
    const [attendance, setAttendance] = useState<RoadshowAttendance[]>([]);
    const [activities, setActivities] = useState<RoadshowActivity[]>([]);
    const [myAttendance, setMyAttendance] = useState<RoadshowAttendance | null>(null);

    const todayStr = todayLocalStr();

    const loadEvent = useCallback(
        async (isRefresh = false) => {
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
                setMyAttendance(attRes.data.find((a) => a.user_id === userId) ?? null);
                setActivities(activitiesRes.data);
            }

            setIsLoading(false);
            setRefreshing(false);
        },
        [eventId, userId],
    );

    useFocusEffect(
        useCallback(() => {
            if (event) {
                loadEvent(true);
            } else {
                loadEvent(false);
            }
        }, [loadEvent]),
    );

    // Realtime subscription for live roadshow
    useRoadshowRealtime(
        eventId,
        !!(event && event.event_type === 'roadshow' && event.event_date === todayStr),
        userId,
        useCallback((activity: RoadshowActivity) => {
            setActivities((prev) => [activity, ...prev]);
        }, []),
        useCallback((att: RoadshowAttendance) => {
            setAttendance((prev) => [...prev, att]);
        }, []),
    );

    return {
        event,
        isLoading,
        refreshing,
        roadshowConfig,
        attendance,
        activities,
        myAttendance,
        loadEvent,
        setActivities,
        setAttendance,
        setMyAttendance,
    };
}
