/**
 * NotificationContext — provides unread count + mark-as-read helpers.
 *
 * Subscribes to Supabase Realtime INSERT on the notifications table
 * so the badge updates instantly when a new notification arrives.
 */
import { useAuth } from '@/contexts/AuthContext';
import { fetchUnreadCount, markAllAsRead as markAllAsReadSvc, markAsRead as markAsReadSvc } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

interface NotificationContextType {
    unreadCount: number;
    refreshUnreadCount: () => Promise<void>;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);

    const refreshUnreadCount = useCallback(async () => {
        if (!user?.id) return;
        const { count } = await fetchUnreadCount(user.id);
        setUnreadCount(count);
    }, [user?.id]);

    // Fetch on mount + when user changes
    useEffect(() => {
        if (!user?.id) {
            setUnreadCount(0);
            return;
        }
        refreshUnreadCount();
    }, [user?.id, refreshUnreadCount]);

    // Subscribe to realtime INSERT → increment count
    useEffect(() => {
        if (!user?.id) return;

        const channel = supabase
            .channel(`notifications:${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`,
                },
                () => {
                    setUnreadCount((prev) => prev + 1);
                },
            )
            .subscribe();

        return () => {
            channel.unsubscribe?.();
            supabase.removeChannel(channel);
        };
    }, [user?.id]);

    const markAsRead = useCallback(async (id: string) => {
        // Optimistic decrement
        setUnreadCount((prev) => Math.max(0, prev - 1));
        const { error } = await markAsReadSvc(id);
        if (error) {
            // Rollback on error
            setUnreadCount((prev) => prev + 1);
        }
    }, []);

    const markAllAsRead = useCallback(async () => {
        if (!user?.id) return;
        // Optimistic reset
        setUnreadCount(0);
        const { error } = await markAllAsReadSvc(user.id);
        if (error) {
            // Re-fetch actual count instead of rolling back to stale prevCount
            await refreshUnreadCount();
        }
    }, [user?.id, refreshUnreadCount]);

    const value = useMemo(
        () => ({ unreadCount, refreshUnreadCount, markAsRead, markAllAsRead }),
        [unreadCount, refreshUnreadCount, markAsRead, markAllAsRead],
    );

    return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
}
