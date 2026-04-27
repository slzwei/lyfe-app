import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Lead } from '@/types/lead';
import { useEffect, useRef } from 'react';

export function useLeadRealtime(onNewLead: (lead: Lead) => void) {
    const { user } = useAuth();
    const retryCountRef = useRef(0);
    const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const onNewLeadRef = useRef(onNewLead);
    onNewLeadRef.current = onNewLead;

    useEffect(() => {
        if (!user?.id) return;

        const createChannel = () =>
            supabase.channel(`leads:${user.id}`).on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'leads',
                    filter: `assigned_to=eq.${user.id}`,
                },
                (payload) => {
                    retryCountRef.current = 0;
                    onNewLeadRef.current(payload.new as Lead);
                },
            );

        let channel = createChannel().subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                retryCountRef.current = 0;
            }
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                const delay = Math.min(1000 * 2 ** retryCountRef.current, 30000);
                retryCountRef.current++;
                if (__DEV__) console.warn(`[useLeadRealtime] ${status}, reconnecting in ${delay}ms`);
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
    }, [user?.id]);
}
