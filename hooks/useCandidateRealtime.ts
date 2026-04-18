import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useEffect, useRef } from 'react';

/**
 * Subscribe to the progress_signals singleton table for real-time candidate
 * pipeline updates. Fires onUpdate whenever any candidate-related data changes
 * (candidate_profiles, disc_responses, disc_results, invitations, candidates).
 *
 * progress_signals RLS allows SELECT for any authenticated role, but the
 * realtime server needs the user's JWT on the channel to authenticate the
 * postgres_changes subscription. On first boot, supabase-js sometimes hasn't
 * propagated the restored-session JWT to its internal realtime client by the
 * time `user.id` flips truthy in AuthContext — the channel then joins with
 * just the anon key and the realtime server responds with TIMED_OUT in a
 * loop. Fix: fetch the session explicitly, call realtime.setAuth(), THEN
 * subscribe. Channel name includes user.id so stale server-side topics from
 * a previous session don't collide.
 */
export function useCandidateRealtime(onUpdate: () => void) {
    const { user } = useAuth();
    const retryCountRef = useRef(0);
    const retryTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
    const onUpdateRef = useRef(onUpdate);
    onUpdateRef.current = onUpdate;

    useEffect(() => {
        if (!user?.id) return;

        let cancelled = false;
        let channel: ReturnType<typeof supabase.channel> | null = null;
        const userId = user.id;

        const subscribe = () =>
            supabase
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
                .subscribe((status) => {
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
                            if (!cancelled) channel = subscribe();
                        }, delay);
                    }
                });

        // Ensure realtime has the current JWT before joining the topic.
        (async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (cancelled) return;
            if (session?.access_token) {
                try {
                    await supabase.realtime.setAuth(session.access_token);
                } catch (e) {
                    if (__DEV__) console.warn('[useCandidateRealtime] setAuth failed', e);
                }
            }
            if (!cancelled) channel = subscribe();
        })();

        return () => {
            cancelled = true;
            clearTimeout(retryTimeoutRef.current);
            if (channel) supabase.removeChannel(channel);
        };
    }, [user?.id]);
}
