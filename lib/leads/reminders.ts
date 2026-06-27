/**
 * Local "Remind me" notifications for lead follow-ups (a reminder ~30 min before).
 *
 * The app already registers a notification handler (app/_layout.tsx) and uses Expo
 * push; this adds LOCAL scheduling. Best-effort — never throws; reports the outcome
 * so the caller can warn on a denied permission. `scheduleFollowUpReminder` returns
 * the scheduled notification id so the caller can cancel/reschedule when the
 * follow-up changes (the id is stashed on the follow_up activity's metadata).
 */
import { Alert, Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const REMINDER_LEAD_MS = 30 * 60 * 1000;
const ANDROID_CHANNEL_ID = 'leads-reminders';

export type ReminderPermission = 'granted' | 'denied' | 'unsupported';
export type ScheduleOutcome = { result: 'scheduled'; id: string } | { result: 'past' | 'denied' | 'unsupported' };

/**
 * Notification permission, requesting once if undetermined. Respects iOS
 * `canAskAgain` (no re-prompt after a denial) so we report 'denied' instead of
 * a silent no-op request.
 */
export async function ensureReminderPermission(): Promise<ReminderPermission> {
    try {
        const current = await Notifications.getPermissionsAsync();
        if (current.status === 'granted') return 'granted';
        if (current.canAskAgain === false) return 'denied';
        const next = await Notifications.requestPermissionsAsync();
        return next.status === 'granted' ? 'granted' : 'denied';
    } catch {
        return 'unsupported';
    }
}

async function ensureAndroidChannel(): Promise<void> {
    if (Platform.OS !== 'android') return;
    try {
        await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
            name: 'Lead follow-ups',
            importance: Notifications.AndroidImportance.DEFAULT,
            sound: 'default',
        });
    } catch {
        /* best-effort */
    }
}

/** Shared "reminders need notifications" Alert with an Open-Settings shortcut. */
export function warnRemindersDisabled(): void {
    Alert.alert(
        'Reminders need notifications',
        'Turn on notifications in Settings to get a reminder before your follow-up.',
        [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings().catch(() => {}) },
        ],
    );
}

/**
 * Schedule a local reminder ~30 min before `at`. Returns the notification id on
 * success so the caller can cancel/reschedule. 'past' if it's already within the
 * 30-min window. Never throws.
 */
export async function scheduleFollowUpReminder(at: Date, leadName: string, task: string): Promise<ScheduleOutcome> {
    try {
        const fireAt = new Date(at.getTime() - REMINDER_LEAD_MS);
        if (fireAt.getTime() <= Date.now()) return { result: 'past' };
        const perm = await ensureReminderPermission();
        if (perm !== 'granted') return { result: perm };
        await ensureAndroidChannel();
        const id = await Notifications.scheduleNotificationAsync({
            content: { title: `Follow up: ${leadName}`, body: task || 'Follow up', sound: 'default' },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: fireAt,
                channelId: ANDROID_CHANNEL_ID,
            },
        });
        return { result: 'scheduled', id };
    } catch {
        return { result: 'unsupported' };
    }
}

/** Cancel a previously-scheduled reminder (for reschedule/clear). Never throws. */
export async function cancelFollowUpReminder(id: string | null | undefined): Promise<void> {
    if (!id) return;
    try {
        await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
        /* best-effort */
    }
}
