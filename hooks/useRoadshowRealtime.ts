import { supabase } from '@/lib/supabase';
import type { RoadshowActivity, RoadshowAttendance } from '@/types/event';
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
                    (payload: any) => {
                        retryCountRef.current = 0;
                        if (payload.new.user_id !== currentUserId) {
                            onNewActivity(payload.new);
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
                    (payload: any) => {
                        retryCountRef.current = 0;
                        if (payload.new.user_id !== currentUserId) {
                            onNewAttendance(payload.new);
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
                setTimeout(() => {
                    supabase.removeChannel(channel);
                    channel = createChannel().subscribe();
                }, delay);
            }
        });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [eventId, isLiveRoadshow, currentUserId, onNewActivity, onNewAttendance]);
}
