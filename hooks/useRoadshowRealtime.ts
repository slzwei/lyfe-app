import { supabase } from '@/lib/supabase';
import type { RoadshowActivity, RoadshowAttendance } from '@/types/event';
import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js';
import { useEffect, useRef } from 'react';

/**
 * Subscribe to realtime roadshow activity/attendance inserts.
 * Filters out own user's activities to avoid duplicates from optimistic updates.
 * Includes exponential backoff reconnect on error.
 */
export function useRoadshowRealtime(
    eventId: string | undefined,
    isLiveRoadshow: boolean,
    currentUserId: string | undefined,
    onNewActivity: (activity: RoadshowActivity) => void,
    onNewAttendance: (attendance: RoadshowAttendance) => void,
) {
    const retryCountRef = useRef(0);
    const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const onNewActivityRef = useRef(onNewActivity);
    onNewActivityRef.current = onNewActivity;
    const onNewAttendanceRef = useRef(onNewAttendance);
    onNewAttendanceRef.current = onNewAttendance;
    const currentUserIdRef = useRef(currentUserId);
    currentUserIdRef.current = currentUserId;

    useEffect(() => {
        if (!eventId || !isLiveRoadshow) return;

        const createChannel = () =>
            supabase
                .channel(`roadshow-${eventId}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'roadshow_activities',
                        filter: `event_id=eq.${eventId}`,
                    },
                    (payload: RealtimePostgresInsertPayload<Record<string, unknown>>) => {
                        retryCountRef.current = 0;
                        if (payload.new.user_id !== currentUserIdRef.current) {
                            onNewActivityRef.current(payload.new as unknown as RoadshowActivity);
                        }
                    },
                )
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'roadshow_attendance',
                        filter: `event_id=eq.${eventId}`,
                    },
                    (payload: RealtimePostgresInsertPayload<Record<string, unknown>>) => {
                        retryCountRef.current = 0;
                        if (payload.new.user_id !== currentUserIdRef.current) {
                            onNewAttendanceRef.current(payload.new as unknown as RoadshowAttendance);
                        }
                    },
                );

        let channel = createChannel().subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                retryCountRef.current = 0;
            }
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                const delay = Math.min(1000 * 2 ** retryCountRef.current, 30000);
                retryCountRef.current++;
                if (__DEV__) console.warn(`[useRoadshowRealtime] ${status}, reconnecting in ${delay}ms`);
                const erroredChannel = channel;
                retryTimeoutRef.current = setTimeout(() => {
                    supabase.removeChannel(erroredChannel);
                    channel = createChannel().subscribe();
                }, delay);
            }
        });

        return () => {
            clearTimeout(retryTimeoutRef.current);
            supabase.removeChannel(channel);
        };
    }, [eventId, isLiveRoadshow]);
}
