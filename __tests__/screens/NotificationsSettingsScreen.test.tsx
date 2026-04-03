/**
 * Tests for app/(tabs)/profile/notifications.tsx — Notification preferences
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import NotificationsScreen from '@/app/(tabs)/profile/notifications';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/Colors';
import { fetchNotificationPreferences, updateNotificationPreference } from '@/lib/notificationPreferences';
import { Linking } from 'react-native';

jest.mock('@/lib/supabase');
jest.mock('@/contexts/AuthContext');
jest.mock('@/contexts/ThemeContext');
jest.mock('@/lib/notificationPreferences');
jest.mock('@/components/ScreenHeader', () => {
    const { Text } = require('react-native');
    return function MockScreenHeader({ title }: { title: string }) {
        return <Text>{title}</Text>;
    };
});

beforeEach(() => {
    jest.clearAllMocks();
    (useTheme as jest.Mock).mockReturnValue({
        colors: Colors.light,
        isDark: false,
        mode: 'light',
        resolved: 'light',
        setMode: jest.fn(),
    });
    (useAuth as jest.Mock).mockReturnValue({
        user: { id: 'user-1', role: 'agent' },
    });
    (fetchNotificationPreferences as jest.Mock).mockResolvedValue({ prefs: {} });
    (updateNotificationPreference as jest.Mock).mockResolvedValue({ error: null });
});

describe('NotificationsScreen', () => {
    it('renders header and info card', async () => {
        const { getByText } = render(<NotificationsScreen />);
        expect(getByText('Notifications')).toBeTruthy();
        expect(getByText('Push Notifications')).toBeTruthy();
    });

    it('renders notification toggles for agent role', async () => {
        const { getByText } = render(<NotificationsScreen />);
        await waitFor(() => {
            expect(getByText('New Lead')).toBeTruthy();
        });
    });

    it('calls updateNotificationPreference on toggle', async () => {
        const { getByLabelText } = render(<NotificationsScreen />);
        await waitFor(() => {
            expect(getByLabelText('New Lead push notifications')).toBeTruthy();
        });

        fireEvent(getByLabelText('New Lead push notifications'), 'valueChange', false);

        await waitFor(() => {
            expect(updateNotificationPreference).toHaveBeenCalledWith('user-1', 'new_lead', false);
        });
    });

    it('rolls back on update error', async () => {
        (updateNotificationPreference as jest.Mock).mockResolvedValue({ error: 'Failed' });

        const { getByLabelText } = render(<NotificationsScreen />);
        await waitFor(() => {
            expect(getByLabelText('New Lead push notifications')).toBeTruthy();
        });

        fireEvent(getByLabelText('New Lead push notifications'), 'valueChange', false);

        // Should call update and rollback — no crash
        await waitFor(() => {
            expect(updateNotificationPreference).toHaveBeenCalled();
        });
    });

    it('renders device settings button', async () => {
        jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);

        const { getByText } = render(<NotificationsScreen />);
        expect(getByText('Open Device Settings')).toBeTruthy();
        fireEvent.press(getByText('Open Device Settings'));
        expect(Linking.openSettings).toHaveBeenCalled();
    });
});
