/**
 * Tests for contexts/NotificationContext.tsx — Notification provider and hook
 */
import React from 'react';
import { renderHook, act } from '@testing-library/react-native';

import { NotificationProvider, useNotifications } from '@/contexts/NotificationContext';

// Mock AuthContext
let mockUser: any = null;
jest.mock('@/contexts/AuthContext', () => ({
    useAuth: () => ({ user: mockUser }),
}));

// Mock lib/notifications
const mockFetchUnreadCount = jest.fn();
const mockMarkAsReadSvc = jest.fn();
const mockMarkAllAsReadSvc = jest.fn();
jest.mock('@/lib/notifications', () => ({
    fetchUnreadCount: (...args: any[]) => mockFetchUnreadCount(...args),
    markAsRead: (...args: any[]) => mockMarkAsReadSvc(...args),
    markAllAsRead: (...args: any[]) => mockMarkAllAsReadSvc(...args),
}));

// Mock lib/supabase
jest.mock('@/lib/supabase', () => ({
    supabase: {
        channel: jest.fn(() => {
            const ch = {
                on: jest.fn().mockReturnThis(),
                subscribe: jest.fn().mockReturnThis(),
                unsubscribe: jest.fn(),
            };
            return ch;
        }),
        removeChannel: jest.fn(),
    },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <NotificationProvider>{children}</NotificationProvider>
);

beforeEach(() => {
    jest.clearAllMocks();
    mockUser = null;
    mockFetchUnreadCount.mockResolvedValue({ count: 0, error: null });
    mockMarkAsReadSvc.mockResolvedValue({ error: null });
    mockMarkAllAsReadSvc.mockResolvedValue({ error: null });
});

describe('NotificationContext', () => {
    it('fetches unread count on mount when user is authenticated', async () => {
        mockUser = { id: 'user-1' };
        mockFetchUnreadCount.mockResolvedValue({ count: 3, error: null });

        const { result } = renderHook(() => useNotifications(), { wrapper });
        await act(async () => {});

        expect(mockFetchUnreadCount).toHaveBeenCalledWith('user-1');
        expect(result.current.unreadCount).toBe(3);
    });

    it('unread count is 0 when no user', async () => {
        mockUser = null;

        const { result } = renderHook(() => useNotifications(), { wrapper });
        await act(async () => {});

        expect(mockFetchUnreadCount).not.toHaveBeenCalled();
        expect(result.current.unreadCount).toBe(0);
    });

    it('markAsRead decrements unread count optimistically', async () => {
        mockUser = { id: 'user-1' };
        mockFetchUnreadCount.mockResolvedValue({ count: 5, error: null });

        const { result } = renderHook(() => useNotifications(), { wrapper });
        await act(async () => {});

        expect(result.current.unreadCount).toBe(5);

        await act(async () => {
            await result.current.markAsRead('notif-1');
        });

        expect(mockMarkAsReadSvc).toHaveBeenCalledWith('notif-1');
        expect(result.current.unreadCount).toBe(4);
    });

    it('markAsRead rolls back on error', async () => {
        mockUser = { id: 'user-1' };
        mockFetchUnreadCount.mockResolvedValue({ count: 2, error: null });
        mockMarkAsReadSvc.mockResolvedValue({ error: 'Failed' });

        const { result } = renderHook(() => useNotifications(), { wrapper });
        await act(async () => {});

        await act(async () => {
            await result.current.markAsRead('notif-1');
        });

        expect(result.current.unreadCount).toBe(2);
    });

    it('markAllAsRead resets unread count to 0', async () => {
        mockUser = { id: 'user-1' };
        mockFetchUnreadCount.mockResolvedValue({ count: 7, error: null });

        const { result } = renderHook(() => useNotifications(), { wrapper });
        await act(async () => {});

        expect(result.current.unreadCount).toBe(7);

        await act(async () => {
            await result.current.markAllAsRead();
        });

        expect(mockMarkAllAsReadSvc).toHaveBeenCalledWith('user-1');
        expect(result.current.unreadCount).toBe(0);
    });

    it('markAllAsRead rolls back on error', async () => {
        mockUser = { id: 'user-1' };
        mockFetchUnreadCount.mockResolvedValue({ count: 4, error: null });
        mockMarkAllAsReadSvc.mockResolvedValue({ error: 'Failed' });

        const { result } = renderHook(() => useNotifications(), { wrapper });
        await act(async () => {});

        await act(async () => {
            await result.current.markAllAsRead();
        });

        expect(result.current.unreadCount).toBe(4);
    });

    it('throws when used outside provider', () => {
        expect(() => {
            renderHook(() => useNotifications());
        }).toThrow('useNotifications must be used within a NotificationProvider');
    });
});
