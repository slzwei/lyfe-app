import { supabase } from '@/lib/supabase';
import type { RoadshowActivity, RoadshowAttendance } from '@/types/event';
import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js';
import { useEffect, useRef } from 'react';

/**
 * Subscribe to realtime roadshow activity/attendance inserts.
 * Filters out own user's activities to avoid duplicates from optimistic updates.
 * Includes exponential backoff reconnect on error.
 *
 * `onResync` (optional) fires when the channel *re*-subscribes after a dropped
 * connection — the consumer uses it to backfill inserts missed while offline
 * (audit H6). It does NOT fire on the first subscribe, since the consumer
 * already loads on mount/focus.
 */
export function useRoadshowRealtime(
    eventId: string | undefined,
    isLiveRoadshow: boolean,
    currentUserId: string | undefined,
    onNewActivity: (activity: RoadshowActivity) => void,
    onNewAttendance: (attendance: RoadshowAttendance) => void,
    onResync?: () => void,
) {
    const retryCountRef = useRef(0);
    const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const onNewActivityRef = useRef(onNewActivity);
    onNewActivityRef.current = onNewActivity;
    const onNewAttendanceRef = useRef(onNewAttendance);
    onNewAttendanceRef.current = onNewAttendance;
    const onResyncRef = useRef(onResync);
    onResyncRef.current = onResync;
    const currentUserIdRef = useRef(currentUserId);
    currentUserIdRef.current = currentUserId;

    useEffect(() => {
        if (!eventId || !isLiveRoadshow) return;

        // Only resync on a *re*-subscribe: the consumer already loads on
        // mount/focus, so the first successful join needs no backfill.
        let hasSubscribed = false;

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

        const handleStatus = (status: string) => {
            if (status === 'SUBSCRIBED') {
                retryCountRef.current = 0;
                if (hasSubscribed) {
                    // Re-joined after a drop — backfill anything missed while offline.
                    onResyncRef.current?.();
                } else {
                    hasSubscribed = true;
                }
            }
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                const delay = Math.min(1000 * 2 ** retryCountRef.current, 30000);
                retryCountRef.current++;
                if (__DEV__) console.warn(`[useRoadshowRealtime] ${status}, reconnecting in ${delay}ms`);
                const erroredChannel = channel;
                retryTimeoutRef.current = setTimeout(() => {
                    supabase.removeChannel(erroredChannel);
                    // Re-attach the same status handler so subsequent drops also
                    // reconnect + resync (without it the channel went silent after
                    // one blip).
                    channel = createChannel().subscribe(handleStatus);
                }, delay);
            }
        };

        let channel = createChannel().subscribe(handleStatus);

        return () => {
            clearTimeout(retryTimeoutRef.current);
            supabase.removeChannel(channel);
        };
    }, [eventId, isLiveRoadshow]);
}
