import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { OfflineQueue, SyncManager, type SyncStatus } from '@/lib/offline';
import { supabase } from '@/lib/supabase';

export interface NetworkContextType {
    isConnected: boolean;
    isInternetReachable: boolean | null;
    syncStatus: { pending: number; lastSyncAt: string | null };
    triggerSync: () => Promise<void>;
}

export const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function NetworkProvider({ children }: { children: React.ReactNode }) {
    const [isConnected, setIsConnected] = useState(true);
    const [isInternetReachable, setIsInternetReachable] = useState<boolean | null>(true);
    const [syncStatus, setSyncStatus] = useState<{ pending: number; lastSyncAt: string | null }>({
        pending: 0,
        lastSyncAt: null,
    });

    const queueRef = useRef(new OfflineQueue());
    const syncManagerRef = useRef(new SyncManager(supabase, queueRef.current));
    const prevConnectedRef = useRef(true);

    // Set up sync status callback
    useEffect(() => {
        syncManagerRef.current.onStatusChange((status: SyncStatus) => {
            setSyncStatus({ pending: status.pending, lastSyncAt: status.lastSyncAt });
        });
    }, []);

    // Initialize pending count
    useEffect(() => {
        queueRef.current.size().then((pending) => {
            setSyncStatus((prev) => ({ ...prev, pending }));
        });
    }, []);

    const triggerSync = useCallback(async () => {
        const status = await syncManagerRef.current.sync();
        setSyncStatus({ pending: status.pending, lastSyncAt: status.lastSyncAt });
    }, []);

    // Listen for connectivity changes
    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
            const connected = state.isConnected ?? false;
            setIsConnected(connected);
            setIsInternetReachable(state.isInternetReachable ?? null);

            // Auto-sync when connectivity is restored
            if (connected && !prevConnectedRef.current) {
                triggerSync();
            }
            prevConnectedRef.current = connected;
        });

        return unsubscribe;
    }, [triggerSync]);

    const value = useMemo<NetworkContextType>(
        () => ({
            isConnected,
            isInternetReachable,
            syncStatus,
            triggerSync,
        }),
        [isConnected, isInternetReachable, syncStatus, triggerSync],
    );

    return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}
