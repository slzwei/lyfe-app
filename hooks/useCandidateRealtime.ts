import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useEffect, useRef } from 'react';

/**
 * Subscribe to the progress_signals singleton table for real-time candidate
 * pipeline updates. Fires onUpdate whenever any candidate-related data changes
 * (candidate_profiles, disc_responses, disc_results, invitations, candidates).
 *
 * Earlier versions of this hook explicitly called supabase.realtime.setAuth()
 * before subscribing to "fix" a cold-start auth race. That turned out to be
 * the cause of the actual TIMED_OUT loop: calling setAuth before the WebSocket
 * is open stores the token internally but doesn't propagate it into the first
 * channel's phx_join payload, so Realtime receives an anon join, RLS rejects,
 * and the server drops the subscription. Matching useLeadRealtime's implicit
 * pattern (rely on supabase-js's internal JWT handling once user.id is truthy)
 * is what actually works. Channel name includes user.id so stale server-side
 * topics from a previous session don't collide.
 */
export function useCandidateRealtime(onUpdate: () => void) {
    const { user } = useAuth();
    const retryCountRef = useRef(0);
    const retryTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
    const onUpdateRef = useRef(onUpdate);
    onUpdateRef.current = onUpdate;

    useEffect(() => {
        if (!user?.id) return;
        const userId = user.id;

        let channel: ReturnType<typeof supabase.channel> | null = null;

        const handleStatus = (status: string) => {
            if (status === 'SUBSCRIBED') {
                retryCountRef.current = 0;
            }
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                const delay = Math.min(1000 * 2 ** retryCountRef.current, 30000);
                retryCountRef.current++;
                if (__DEV__) console.warn(`[useCandidateRealtime] ${status}, reconnecting in ${delay}ms`);
                const erroredChannel = channel;
                retryTimeoutRef.current = setTimeout(() => {
                    if (erroredChannel) supabase.removeChannel(erroredChannel);
                    subscribe();
                }, delay);
            }
        };

        const subscribe = () => {
            channel = supabase
                .channel(`candidate-progress:${userId}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'progress_signals',
                    },
                    () => {
                        retryCountRef.current = 0;
                        onUpdateRef.current();
                    },
                )
                .subscribe(handleStatus);
        };

        subscribe();

        return () => {
            clearTimeout(retryTimeoutRef.current);
            if (channel) supabase.removeChannel(channel);
        };
    }, [user?.id]);
}
