import { supabase } from '@/lib/supabase';
import type { RoadshowActivity, RoadshowAttendance } from '@/types/event';
import { useEffect } from 'react';

/**
 * Subscribe to realtime roadshow activity/attendance inserts.
 * Filters out own user's activities to avoid duplicates from optimistic updates.
 */
export function useRoadshowRealtime(
    eventId: string | undefined,
    isLiveRoadshow: boolean,
    currentUserId: string | undefined,
    onNewActivity: (activity: RoadshowActivity) => void,
    onNewAttendance: (attendance: RoadshowAttendance) => void,
) {
    useEffect(() => {
        if (!eventId || !isLiveRoadshow) return;

        const channel = supabase
            .channel(`roadshow-${eventId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'roadshow_activities', filter: `event_id=eq.${eventId}` },
                (payload: any) => {
                    if (payload.new.user_id !== currentUserId) {
                        onNewActivity(payload.new);
                    }
                }
            )
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'roadshow_attendance', filter: `event_id=eq.${eventId}` },
                (payload: any) => {
                    if (payload.new.user_id !== currentUserId) {
                        onNewAttendance(payload.new);
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [eventId, isLiveRoadshow, currentUserId, onNewActivity, onNewAttendance]);
}
