/**
 * Notification preferences service — toggle push notifications per type.
 *
 * Preferences are stored as JSONB in users.notification_preferences.
 * Absent key = enabled (default). Set to false to opt out of push for that type.
 * In-app notifications are always stored regardless of preferences.
 */
import type { NotificationType } from '@/types/notification';
import { supabase } from './supabase';

export type NotificationPreferences = Partial<Record<NotificationType, boolean>>;

/**
 * Fetch notification preferences for a user.
 */
export async function fetchNotificationPreferences(
    userId: string,
): Promise<{ prefs: NotificationPreferences; error: string | null }> {
    const { data, error } = await supabase.from('users').select('notification_preferences').eq('id', userId).single();

    if (error) return { prefs: {}, error: error.message };
    return { prefs: (data?.notification_preferences as NotificationPreferences) || {}, error: null };
}

/**
 * Update a single notification preference.
 *
 * Calls are serialised so rapid toggles cannot race — each
 * fetch-modify-write cycle completes before the next one starts.
 */
let _updateChain: Promise<unknown> = Promise.resolve();

export function updateNotificationPreference(
    userId: string,
    type: NotificationType,
    enabled: boolean,
): Promise<{ error: string | null }> {
    const task = _updateChain.then(async (): Promise<{ error: string | null }> => {
        // Fetch current preferences
        const { data: user, error: fetchError } = await supabase
            .from('users')
            .select('notification_preferences')
            .eq('id', userId)
            .single();

        if (fetchError) return { error: fetchError.message };

        const currentPrefs = (user?.notification_preferences as NotificationPreferences) || {};
        const updatedPrefs = { ...currentPrefs };

        if (enabled) {
            // Remove the key (absent = enabled by default)
            delete updatedPrefs[type];
        } else {
            updatedPrefs[type] = false;
        }

        const { error } = await supabase
            .from('users')
            .update({ notification_preferences: updatedPrefs })
            .eq('id', userId);

        return { error: error ? error.message : null };
    });

    // Keep chain alive even if this task rejects
    _updateChain = task.then(
        () => {},
        () => {},
    );
    return task;
}
