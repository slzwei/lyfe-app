import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Lead } from '@/types/lead';
import { useEffect, useRef } from 'react';

export function useLeadRealtime(onNewLead: (lead: Lead) => void) {
    const { user } = useAuth();
    const retryCountRef = useRef(0);

    useEffect(() => {
        if (!user?.id) return;

        let channel = supabase
            .channel(`leads:${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'leads',
                    filter: `assigned_to=eq.${user.id}`,
                },
                (payload) => {
                    retryCountRef.current = 0;
                    onNewLead(payload.new as Lead);
                },
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    retryCountRef.current = 0;
                }
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    const delay = Math.min(1000 * 2 ** retryCountRef.current, 30000);
                    retryCountRef.current++;
                    if (__DEV__) console.warn(`[useLeadRealtime] ${status}, reconnecting in ${delay}ms`);
                    setTimeout(() => {
                        supabase.removeChannel(channel);
                        channel = supabase
                            .channel(`leads:${user.id}`)
                            .on(
                                'postgres_changes',
                                {
                                    event: 'INSERT',
                                    schema: 'public',
                                    table: 'leads',
                                    filter: `assigned_to=eq.${user.id}`,
                                },
                                (payload) => {
                                    retryCountRef.current = 0;
                                    onNewLead(payload.new as Lead);
                                },
                            )
                            .subscribe();
                    }, delay);
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id, onNewLead]);
}
