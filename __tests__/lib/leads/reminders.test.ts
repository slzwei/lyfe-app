/**
 * Tests for lib/leads/reminders.ts — local "Remind me" follow-up notifications.
 * Covers permission gating (incl. iOS canAskAgain), the 30-min pre-window 'past'
 * guard, schedule success returning an id, and best-effort cancel.
 */
import { Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
    ensureReminderPermission,
    scheduleFollowUpReminder,
    cancelFollowUpReminder,
    warnRemindersDisabled,
} from '@/lib/leads/reminders';

jest.mock('expo-notifications', () => ({
    getPermissionsAsync: jest.fn(),
    requestPermissionsAsync: jest.fn(),
    setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
    scheduleNotificationAsync: jest.fn(),
    cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
    AndroidImportance: { DEFAULT: 3 },
    SchedulableTriggerInputTypes: { DATE: 'date' },
}));

const N = Notifications as jest.Mocked<typeof Notifications>;
const HOURS_2 = 2 * 60 * 60 * 1000;

beforeEach(() => {
    jest.clearAllMocks();
    (N.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted', canAskAgain: true });
    (N.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted', canAskAgain: true });
    (N.scheduleNotificationAsync as jest.Mock).mockResolvedValue('notif-1');
});

describe('ensureReminderPermission', () => {
    it('returns granted without re-requesting when already granted', async () => {
        (N.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
        await expect(ensureReminderPermission()).resolves.toBe('granted');
        expect(N.requestPermissionsAsync).not.toHaveBeenCalled();
    });

    it('returns denied (no re-prompt) when canAskAgain is false', async () => {
        (N.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied', canAskAgain: false });
        await expect(ensureReminderPermission()).resolves.toBe('denied');
        expect(N.requestPermissionsAsync).not.toHaveBeenCalled();
    });

    it('requests when undetermined and returns granted on grant', async () => {
        (N.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'undetermined', canAskAgain: true });
        (N.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
        await expect(ensureReminderPermission()).resolves.toBe('granted');
        expect(N.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    });

    it('returns denied when the request is declined', async () => {
        (N.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'undetermined', canAskAgain: true });
        (N.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
        await expect(ensureReminderPermission()).resolves.toBe('denied');
    });

    it('returns unsupported when the permissions API throws', async () => {
        (N.getPermissionsAsync as jest.Mock).mockRejectedValue(new Error('no module'));
        await expect(ensureReminderPermission()).resolves.toBe('unsupported');
    });
});

describe('scheduleFollowUpReminder', () => {
    it('schedules ~30 min before and returns the notification id', async () => {
        const at = new Date(Date.now() + HOURS_2);
        const out = await scheduleFollowUpReminder(at, 'Siti Rahman', 'Send quote');
        expect(out).toEqual({ result: 'scheduled', id: 'notif-1' });

        const arg = (N.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
        expect(arg.content.title).toBe('Follow up: Siti Rahman');
        expect(arg.content.body).toBe('Send quote');
        // fires 30 min before the follow-up time
        expect(new Date(arg.trigger.date).getTime()).toBe(at.getTime() - 30 * 60 * 1000);
    });

    it('returns past (and does not schedule) when within the 30-min window', async () => {
        const at = new Date(Date.now() + 10 * 60 * 1000); // 10 min away → fire time already passed
        await expect(scheduleFollowUpReminder(at, 'Raj', 'call')).resolves.toEqual({ result: 'past' });
        expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('returns the permission result and does not schedule when not granted', async () => {
        (N.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied', canAskAgain: false });
        const at = new Date(Date.now() + HOURS_2);
        await expect(scheduleFollowUpReminder(at, 'Wei Ming', 'call')).resolves.toEqual({ result: 'denied' });
        expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('falls back to a default body when task is blank', async () => {
        const at = new Date(Date.now() + HOURS_2);
        await scheduleFollowUpReminder(at, 'Priya', '');
        expect((N.scheduleNotificationAsync as jest.Mock).mock.calls[0][0].content.body).toBe('Follow up');
    });

    it('returns unsupported (never throws) when scheduling fails', async () => {
        (N.scheduleNotificationAsync as jest.Mock).mockRejectedValue(new Error('boom'));
        const at = new Date(Date.now() + HOURS_2);
        await expect(scheduleFollowUpReminder(at, 'X', 'y')).resolves.toEqual({ result: 'unsupported' });
    });
});

describe('cancelFollowUpReminder', () => {
    it('no-ops on a falsy id', async () => {
        await cancelFollowUpReminder(null);
        await cancelFollowUpReminder(undefined);
        await cancelFollowUpReminder('');
        expect(N.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    });

    it('cancels the given id', async () => {
        await cancelFollowUpReminder('notif-1');
        expect(N.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notif-1');
    });

    it('swallows cancel errors', async () => {
        (N.cancelScheduledNotificationAsync as jest.Mock).mockRejectedValue(new Error('gone'));
        await expect(cancelFollowUpReminder('notif-1')).resolves.toBeUndefined();
    });
});

describe('warnRemindersDisabled', () => {
    it('shows an alert with an Open Settings shortcut', () => {
        const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
        warnRemindersDisabled();
        expect(spy).toHaveBeenCalledWith(
            'Reminders need notifications',
            expect.stringContaining('Settings'),
            expect.arrayContaining([
                expect.objectContaining({ text: 'Not now' }),
                expect.objectContaining({ text: 'Open Settings' }),
            ]),
        );
        spy.mockRestore();
    });
});
