/**
 * Tests for app/(tabs)/home/notifications.tsx — Notifications inbox screen
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useTypedRouter } from '@/hooks/useTypedRouter';
import { Colors } from '@/constants/Colors';
import { useNotifications } from '@/contexts/NotificationContext';
import { fetchNotifications } from '@/lib/notifications';

import NotificationsScreen from '@/app/(tabs)/home/notifications';

jest.mock('@/lib/supabase');
jest.mock('@/contexts/AuthContext');
jest.mock('@/contexts/ThemeContext');
jest.mock('@/contexts/NotificationContext');
jest.mock('@/hooks/useTypedRouter');
jest.mock('@/lib/notifications');

const mockPush = jest.fn();
const mockMarkAsRead = jest.fn();
const mockMarkAllAsRead = jest.fn();

const NOTIFICATIONS = [
    {
        id: 'notif-1',
        user_id: 'user-1',
        type: 'roadshow_pledge',
        title: 'Alice pledged for Roadshow',
        body: 'S2 P3 C1 AFYC $5,000',
        data: { route: '/(tabs)/events/evt-1' },
        is_read: false,
        created_at: '2026-03-10T10:00:00Z',
    },
    {
        id: 'notif-2',
        user_id: 'user-1',
        type: 'event_reminder',
        title: 'Upcoming Team Meeting',
        body: 'Tomorrow at 2 PM',
        data: { route: '/(tabs)/events/evt-2' },
        is_read: true,
        created_at: '2026-03-09T08:00:00Z',
    },
];

let mockUnreadCount = 2;

beforeEach(() => {
    jest.clearAllMocks();
    mockUnreadCount = 2;

    (useAuth as jest.Mock).mockReturnValue({
        user: { id: 'user-1', full_name: 'Test User' },
    });

    (useTheme as jest.Mock).mockReturnValue({
        colors: Colors.light,
        isDark: false,
        mode: 'light',
        resolved: 'light',
        setMode: jest.fn(),
    });

    (useTypedRouter as jest.Mock).mockReturnValue({
        push: mockPush,
        replace: jest.fn(),
        back: jest.fn(),
    });

    mockMarkAsRead.mockResolvedValue(undefined);
    mockMarkAllAsRead.mockResolvedValue(undefined);

    (useNotifications as jest.Mock).mockImplementation(() => ({
        unreadCount: mockUnreadCount,
        refreshUnreadCount: jest.fn(),
        markAsRead: mockMarkAsRead,
        markAllAsRead: mockMarkAllAsRead,
    }));

    (fetchNotifications as jest.Mock).mockResolvedValue({
        data: NOTIFICATIONS,
        error: null,
        hasMore: false,
    });
});

describe('NotificationsScreen', () => {
    it('renders notification rows after loading', async () => {
        const { getByText } = render(<NotificationsScreen />);

        await waitFor(() => {
            expect(getByText('Alice pledged for Roadshow')).toBeTruthy();
            expect(getByText('Upcoming Team Meeting')).toBeTruthy();
        });
    });

    it('shows empty state when no notifications', async () => {
        (fetchNotifications as jest.Mock).mockResolvedValue({ data: [], error: null, hasMore: false });

        const { getByText } = render(<NotificationsScreen />);

        await waitFor(() => {
            expect(getByText('No Notifications')).toBeTruthy();
        });
    });

    it('shows error banner on fetch failure', async () => {
        (fetchNotifications as jest.Mock).mockResolvedValue({ data: [], error: 'Network error', hasMore: false });

        const { getByText } = render(<NotificationsScreen />);

        await waitFor(() => {
            expect(getByText('Network error')).toBeTruthy();
        });
    });

    it('taps notification — marks as read and navigates', async () => {
        const { getByText } = render(<NotificationsScreen />);

        await waitFor(() => {
            expect(getByText('Alice pledged for Roadshow')).toBeTruthy();
        });

        fireEvent.press(getByText('Alice pledged for Roadshow'));

        await waitFor(() => {
            expect(mockMarkAsRead).toHaveBeenCalledWith('notif-1');
            expect(mockPush).toHaveBeenCalledWith('/(tabs)/home/event/evt-1');
        });
    });

    it('does not call markAsRead for already-read notification', async () => {
        const { getByText } = render(<NotificationsScreen />);

        await waitFor(() => {
            expect(getByText('Upcoming Team Meeting')).toBeTruthy();
        });

        fireEvent.press(getByText('Upcoming Team Meeting'));

        await waitFor(() => {
            expect(mockMarkAsRead).not.toHaveBeenCalled();
            expect(mockPush).toHaveBeenCalledWith('/(tabs)/home/event/evt-2');
        });
    });

    it('shows Mark All Read button when unread > 0', async () => {
        const { getByText } = render(<NotificationsScreen />);

        await waitFor(() => {
            expect(getByText('Mark All Read')).toBeTruthy();
        });
    });

    it('calls markAllAsRead when Mark All Read is pressed', async () => {
        const { getByText } = render(<NotificationsScreen />);

        await waitFor(() => {
            expect(getByText('Mark All Read')).toBeTruthy();
        });

        fireEvent.press(getByText('Mark All Read'));

        await waitFor(() => {
            expect(mockMarkAllAsRead).toHaveBeenCalled();
        });
    });

    it('hides Mark All Read when unreadCount is 0', async () => {
        mockUnreadCount = 0;
        (useNotifications as jest.Mock).mockImplementation(() => ({
            unreadCount: 0,
            refreshUnreadCount: jest.fn(),
            markAsRead: mockMarkAsRead,
            markAllAsRead: mockMarkAllAsRead,
        }));

        const { queryByText } = render(<NotificationsScreen />);

        await waitFor(() => {
            expect(queryByText('Mark All Read')).toBeNull();
        });
    });

    it('renders header with back button', async () => {
        const { getByText } = render(<NotificationsScreen />);

        await waitFor(() => {
            expect(getByText('Notifications')).toBeTruthy();
            expect(getByText('Home')).toBeTruthy();
        });
    });

    it('unread row has accessibility label with Unread suffix', async () => {
        const { getByLabelText } = render(<NotificationsScreen />);

        await waitFor(() => {
            const row = getByLabelText(/Roadshow Pledge:.*Unread/);
            expect(row).toBeTruthy();
        });
    });

    it('read row accessibility label does not contain Unread', async () => {
        const { getByLabelText } = render(<NotificationsScreen />);

        await waitFor(() => {
            const row = getByLabelText(/Event Reminder:.*Upcoming Team Meeting/);
            expect(row.props.accessibilityLabel).not.toContain('Unread');
        });
    });

    it('Mark All Read button has accessibility label', async () => {
        const { getByLabelText } = render(<NotificationsScreen />);

        await waitFor(() => {
            expect(getByLabelText('Mark all notifications as read')).toBeTruthy();
        });
    });

    it('renders notification body text', async () => {
        const { getByText } = render(<NotificationsScreen />);

        await waitFor(() => {
            expect(getByText('S2 P3 C1 AFYC $5,000')).toBeTruthy();
            expect(getByText('Tomorrow at 2 PM')).toBeTruthy();
        });
    });
});
