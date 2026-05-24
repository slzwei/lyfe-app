import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { OfflineQueue, SyncManager, type SyncStatus } from '@/lib/offline';
import { supabase } from '@/lib/supabase';

// NetInfo requires a native module that may not be present in older dev builds.
// Fall back to a no-op listener when the native module is missing.
type NetInfoState = { isConnected: boolean | null; isInternetReachable: boolean | null };
interface NetInfoLike {
    addEventListener: (listener: (state: NetInfoState) => void) => () => void;
}
let NetInfo: NetInfoLike;
try {
    const mod = require('@react-native-community/netinfo');
    NetInfo = mod.default ?? mod;
    if (!NetInfo?.addEventListener) throw new Error('missing addEventListener');
} catch {
    NetInfo = {
        addEventListener: () => () => {},
    };
}

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

            // Connectivity restored: refresh auth (autoRefreshToken's retry
            // gives up after a few offline failures and never resumes on its
            // own) and drain the offline queue.
            if (connected && !prevConnectedRef.current) {
                supabase.auth.refreshSession().catch(() => {});
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
