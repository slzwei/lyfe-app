/**
 * Tracks user presence by writing last_seen_at to the users table.
 *
 * - Writes on app foreground + background transitions
 * - 3-minute heartbeat while in foreground
 * - Throttled to at most one write per 30 seconds
 * - Skips when offline or unauthenticated
 */
import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { supabase } from '@/lib/supabase';

const HEARTBEAT_MS = 3 * 60_000; // 3 minutes
const THROTTLE_MS = 30_000; // 30 seconds

export function useLastSeen(): void {
    const { session } = useAuth();
    const { isConnected } = useNetworkStatus();
    const connectedRef = useRef(isConnected);
    connectedRef.current = isConnected;

    const lastWriteRef = useRef(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const userId = session?.user?.id;

    const updateLastSeen = useCallback(async () => {
        if (!userId || !connectedRef.current) return;

        const now = Date.now();
        if (now - lastWriteRef.current < THROTTLE_MS) return;
        lastWriteRef.current = now;

        // Column added in migration 20260410120000; cast until types are regenerated
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await supabase
            .from('users')
            .update({ last_seen_at: new Date(now).toISOString() } as any)
            .eq('id', userId);
    }, [userId]);

    useEffect(() => {
        if (!userId) return;

        // Write immediately on mount
        updateLastSeen();

        // Start heartbeat
        intervalRef.current = setInterval(updateLastSeen, HEARTBEAT_MS);

        const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
            if (state === 'active') {
                updateLastSeen();
                // Restart heartbeat
                if (!intervalRef.current) {
                    intervalRef.current = setInterval(updateLastSeen, HEARTBEAT_MS);
                }
            } else if (state === 'background') {
                updateLastSeen();
                // Stop heartbeat while backgrounded
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }
            }
            // 'inactive' (iOS notification shade, etc.) — ignore
        });

        return () => {
            subscription.remove();
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [userId, updateLastSeen]);
}
