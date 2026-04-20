/**
 * Tests for hooks/useCandidateRealtime.ts — realtime subscription + retry
 */
import { renderHook, act } from '@testing-library/react-native';
import { useCandidateRealtime } from '@/hooks/useCandidateRealtime';

// Mock supabase channel
let subscribeCallback: ((status: string) => void) | null = null;
let postgresCallback: (() => void) | null = null;

const mockRemoveChannel = jest.fn();
const mockChannel = {
    on: jest.fn().mockImplementation((_event: string, _filter: any, cb: () => void) => {
        postgresCallback = cb;
        return mockChannel;
    }),
    subscribe: jest.fn().mockImplementation((cb?: (status: string) => void) => {
        subscribeCallback = cb || null;
        return mockChannel;
    }),
};

jest.mock('@/lib/supabase', () => ({
    supabase: {
        channel: jest.fn(() => mockChannel),
        removeChannel: (...args: any[]) => mockRemoveChannel(...args),
    },
}));

jest.mock('@/contexts/AuthContext', () => ({
    useAuth: jest.fn(() => ({ user: { id: 'user-1' } })),
}));

beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    subscribeCallback = null;
    postgresCallback = null;
});

afterEach(() => {
    jest.useRealTimers();
});

describe('useCandidateRealtime', () => {
    it('does not subscribe when user is not authenticated', () => {
        const { useAuth } = require('@/contexts/AuthContext');
        (useAuth as jest.Mock).mockReturnValueOnce({ user: null });
        const onUpdate = jest.fn();
        renderHook(() => useCandidateRealtime(onUpdate));

        const { supabase } = require('@/lib/supabase');
        expect(supabase.channel).not.toHaveBeenCalled();
    });

    it('subscribes to progress_signals for the current user', () => {
        const onUpdate = jest.fn();
        renderHook(() => useCandidateRealtime(onUpdate));

        const { supabase } = require('@/lib/supabase');
        expect(supabase.channel).toHaveBeenCalledWith('candidate-progress:user-1');
        expect(mockChannel.on).toHaveBeenCalledWith(
            'postgres_changes',
            expect.objectContaining({ table: 'progress_signals' }),
            expect.any(Function),
        );
        expect(mockChannel.subscribe).toHaveBeenCalled();
    });

    it('calls onUpdate when progress signal received', () => {
        const onUpdate = jest.fn();
        renderHook(() => useCandidateRealtime(onUpdate));

        act(() => {
            postgresCallback?.();
        });

        expect(onUpdate).toHaveBeenCalledTimes(1);
    });

    it('removes channel on unmount', () => {
        const onUpdate = jest.fn();
        const { unmount } = renderHook(() => useCandidateRealtime(onUpdate));

        unmount();

        expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannel);
    });

    it('retries with exponential backoff on CHANNEL_ERROR', () => {
        const onUpdate = jest.fn();
        renderHook(() => useCandidateRealtime(onUpdate));

        act(() => {
            subscribeCallback?.('CHANNEL_ERROR');
        });

        expect(mockRemoveChannel).not.toHaveBeenCalled();
        act(() => {
            jest.advanceTimersByTime(1000);
        });
        expect(mockRemoveChannel).toHaveBeenCalledTimes(1);

        mockRemoveChannel.mockClear();
        act(() => {
            subscribeCallback?.('CHANNEL_ERROR');
        });

        act(() => {
            jest.advanceTimersByTime(1000);
        });
        expect(mockRemoveChannel).not.toHaveBeenCalled();
        act(() => {
            jest.advanceTimersByTime(1000);
        });
        expect(mockRemoveChannel).toHaveBeenCalledTimes(1);
    });

    it('clears retry timeout on unmount', () => {
        const onUpdate = jest.fn();
        const { unmount } = renderHook(() => useCandidateRealtime(onUpdate));

        act(() => {
            subscribeCallback?.('TIMED_OUT');
        });

        unmount();

        act(() => {
            jest.advanceTimersByTime(30000);
        });
        // cleanup calls removeChannel once; the cleared timeout should NOT call it again
        expect(mockRemoveChannel).toHaveBeenCalledTimes(1);
    });

    it('resets retry count on successful subscription', () => {
        const onUpdate = jest.fn();
        renderHook(() => useCandidateRealtime(onUpdate));

        act(() => {
            subscribeCallback?.('CHANNEL_ERROR');
        });
        act(() => {
            jest.advanceTimersByTime(1000);
        });

        act(() => {
            subscribeCallback?.('SUBSCRIBED');
        });

        mockRemoveChannel.mockClear();
        act(() => {
            subscribeCallback?.('CHANNEL_ERROR');
        });
        act(() => {
            jest.advanceTimersByTime(1000);
        });
        expect(mockRemoveChannel).toHaveBeenCalledTimes(1);
    });
});
