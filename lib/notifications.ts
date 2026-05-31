/**
 * Notifications service — Supabase CRUD for in-app notification inbox
 */
import type { AppNotification } from '@/types/notification';
import { applyPageRange, resolvePage } from './pagination';
import { supabase } from './supabase';
import { queueMutation } from './offline';

/**
 * Fetch notifications for a user, newest first, paginated.
 */
export async function fetchNotifications(
    userId: string,
    page = 0,
    pageSize = 20,
): Promise<{ data: AppNotification[]; error: string | null; hasMore: boolean }> {
    let query = supabase
        .from('notifications')
        .select('id, user_id, type, title, body, data, is_read, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    query = applyPageRange(query, page, pageSize);

    const { data, error } = await query;
    if (error) return { data: [], error: error.message, hasMore: false };

    const rows = (data || []) as AppNotification[];
    const { data: paged, hasMore } = resolvePage(rows, page, pageSize);
    return { data: paged, error: null, hasMore };
}

/**
 * Fetch the count of unread notifications for a user.
 */
export async function fetchUnreadCount(userId: string): Promise<{ count: number; error: string | null }> {
    const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);

    if (error) return { count: 0, error: error.message };
    return { count: count ?? 0, error: null };
}

/**
 * Mark a single notification as read.
 */
export async function markAsRead(notificationId: string): Promise<{ error: string | null }> {
    const res = await queueMutation('notifications', 'update', { is_read: true }, { id: notificationId }, () =>
        supabase.from('notifications').update({ is_read: true }).eq('id', notificationId),
    );
    return { error: res.error };
}

/**
 * Mark all unread notifications as read for a user.
 */
export async function markAllAsRead(userId: string): Promise<{ error: string | null }> {
    const res = await queueMutation(
        'notifications',
        'update',
        { is_read: true },
        { user_id: userId, is_read: false },
        () => supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false),
    );
    return { error: res.error };
}
