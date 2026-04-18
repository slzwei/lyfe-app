import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useEffect, useRef } from 'react';

/**
 * Subscribe to the progress_signals singleton table for real-time candidate
 * pipeline updates. Fires onUpdate whenever any candidate-related data changes
 * (candidate_profiles, disc_responses, disc_results, invitations, candidates).
 *
 * Gated on user.id so the subscription only fires once the session is
 * restored. progress_signals RLS limits SELECT to the authenticated role —
 * subscribing anonymously loops on TIMED_OUT forever.
 */
export function useCandidateRealtime(onUpdate: () => void) {
    const { user } = useAuth();
    const retryCountRef = useRef(0);
    const retryTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
    const onUpdateRef = useRef(onUpdate);
    onUpdateRef.current = onUpdate;

    useEffect(() => {
        if (!user?.id) return;

        const subscribe = () =>
            supabase
                .channel('candidate-progress')
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
                            supabase.removeChannel(erroredChannel);
                            channel = subscribe();
                        }, delay);
                    }
                });

        let channel = subscribe();

        return () => {
            clearTimeout(retryTimeoutRef.current);
            supabase.removeChannel(channel);
        };
    }, [user?.id]);
}
