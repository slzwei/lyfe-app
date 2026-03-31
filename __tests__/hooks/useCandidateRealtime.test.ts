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
    it('subscribes to progress_signals on mount', () => {
        const onUpdate = jest.fn();
        renderHook(() => useCandidateRealtime(onUpdate));

        const { supabase } = require('@/lib/supabase');
        expect(supabase.channel).toHaveBeenCalledWith('candidate-progress');
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

        // Simulate a postgres change event
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

        // Simulate channel error
        act(() => {
            subscribeCallback?.('CHANNEL_ERROR');
        });

        // First retry after 1s (2^0 * 1000)
        expect(mockRemoveChannel).not.toHaveBeenCalled();
        act(() => {
            jest.advanceTimersByTime(1000);
        });
        expect(mockRemoveChannel).toHaveBeenCalledTimes(1);

        // Reset for second error
        mockRemoveChannel.mockClear();
        act(() => {
            subscribeCallback?.('CHANNEL_ERROR');
        });

        // Second retry after 2s (2^1 * 1000)
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

        // Trigger a retry
        act(() => {
            subscribeCallback?.('TIMED_OUT');
        });

        // Unmount before timeout fires
        unmount();

        // Advance past all timeouts — removeChannel should only be called once (from cleanup)
        act(() => {
            jest.advanceTimersByTime(30000);
        });
        // cleanup calls removeChannel once; the cleared timeout should NOT call it again
        expect(mockRemoveChannel).toHaveBeenCalledTimes(1);
    });

    it('resets retry count on successful subscription', () => {
        const onUpdate = jest.fn();
        renderHook(() => useCandidateRealtime(onUpdate));

        // Trigger errors to increment retry count
        act(() => {
            subscribeCallback?.('CHANNEL_ERROR');
        });
        act(() => {
            jest.advanceTimersByTime(1000);
        });

        // Now simulate successful subscription
        act(() => {
            subscribeCallback?.('SUBSCRIBED');
        });

        // Next error should use 1s delay (retry count reset)
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
