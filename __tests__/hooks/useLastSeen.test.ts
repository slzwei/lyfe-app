/**
 * Tests for hooks/useLastSeen.ts — throttled presence writes with AppState hooks
 */
import { renderHook, act } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useLastSeen } from '@/hooks/useLastSeen';

// Mocks ────────────────────────────────────────────────────────────────────

const mockEq = jest.fn();
const mockUpdate = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn(() => ({ update: mockUpdate }));

jest.mock('@/lib/supabase', () => ({
    supabase: { from: (table: string) => mockFrom(table) },
}));

const mockUseAuth = jest.fn();
jest.mock('@/contexts/AuthContext', () => ({
    useAuth: () => mockUseAuth(),
}));

const mockUseNetworkStatus = jest.fn();
jest.mock('@/hooks/useNetworkStatus', () => ({
    useNetworkStatus: () => mockUseNetworkStatus(),
}));

// AppState listener capture ────────────────────────────────────────────────

let appStateListener: ((state: string) => void) | null = null;
const removeListener = jest.fn();

beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    appStateListener = null;
    mockEq.mockResolvedValue({ error: null });

    mockUseAuth.mockReturnValue({ session: { user: { id: 'user-1' } } });
    mockUseNetworkStatus.mockReturnValue({ isConnected: true });

    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_event: string, cb: (state: string) => void) => {
        appStateListener = cb;
        return { remove: removeListener };
    }) as any);
});

afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
});

// Helper: flush microtasks queued by the hook's fire-and-forget async update.
// Each scheduled microtask awaits two promises (await supabase...update().eq())
// so two flushes are enough to land the mock call.
async function flush() {
    await Promise.resolve();
    await Promise.resolve();
}

// Tests ────────────────────────────────────────────────────────────────────

describe('useLastSeen', () => {
    it('does nothing when the user is not authenticated', () => {
        mockUseAuth.mockReturnValue({ session: null });

        renderHook(() => useLastSeen());

        expect(mockFrom).not.toHaveBeenCalled();
        expect(AppState.addEventListener).not.toHaveBeenCalled();
    });

    it('writes last_seen_at on mount for an authenticated user', async () => {
        renderHook(() => useLastSeen());
        await flush();

        expect(mockFrom).toHaveBeenCalledWith('users');
        expect(mockUpdate).toHaveBeenCalledTimes(1);
        expect(mockEq).toHaveBeenCalledWith('id', 'user-1');
        const updatePayload = mockUpdate.mock.calls[0][0] as { last_seen_at: string };
        expect(typeof updatePayload.last_seen_at).toBe('string');
    });

    it('skips writes while offline', async () => {
        mockUseNetworkStatus.mockReturnValue({ isConnected: false });

        renderHook(() => useLastSeen());
        await flush();

        expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('throttles writes within a 30-second window', async () => {
        renderHook(() => useLastSeen());
        await flush();
        expect(mockUpdate).toHaveBeenCalledTimes(1);

        act(() => {
            jest.advanceTimersByTime(10_000);
            appStateListener?.('active');
        });
        await flush();

        expect(mockUpdate).toHaveBeenCalledTimes(1);
    });

    it('allows a new write after the throttle window lapses', async () => {
        renderHook(() => useLastSeen());
        await flush();

        act(() => {
            jest.advanceTimersByTime(31_000);
            appStateListener?.('active');
        });
        await flush();

        expect(mockUpdate).toHaveBeenCalledTimes(2);
    });

    it('ticks on a 3-minute heartbeat while foregrounded', async () => {
        renderHook(() => useLastSeen());
        await flush();
        expect(mockUpdate).toHaveBeenCalledTimes(1);

        act(() => {
            jest.advanceTimersByTime(3 * 60 * 1000);
        });
        await flush();
        expect(mockUpdate).toHaveBeenCalledTimes(2);

        act(() => {
            jest.advanceTimersByTime(3 * 60 * 1000);
        });
        await flush();
        expect(mockUpdate).toHaveBeenCalledTimes(3);
    });

    it('writes on background transition and stops the heartbeat', async () => {
        renderHook(() => useLastSeen());
        await flush();

        act(() => {
            jest.advanceTimersByTime(31_000);
            appStateListener?.('background');
        });
        await flush();
        expect(mockUpdate).toHaveBeenCalledTimes(2);

        act(() => {
            jest.advanceTimersByTime(10 * 60 * 1000);
        });
        await flush();
        expect(mockUpdate).toHaveBeenCalledTimes(2);
    });

    it('restarts the heartbeat when returning to foreground', async () => {
        renderHook(() => useLastSeen());
        await flush();

        act(() => {
            jest.advanceTimersByTime(31_000);
            appStateListener?.('background');
        });
        await flush();

        act(() => {
            jest.advanceTimersByTime(31_000);
            appStateListener?.('active');
        });
        await flush();
        expect(mockUpdate).toHaveBeenCalledTimes(3);

        act(() => {
            jest.advanceTimersByTime(3 * 60 * 1000);
        });
        await flush();
        expect(mockUpdate).toHaveBeenCalledTimes(4);
    });

    it('ignores inactive AppState transitions', async () => {
        renderHook(() => useLastSeen());
        await flush();

        act(() => {
            jest.advanceTimersByTime(31_000);
            appStateListener?.('inactive');
        });
        await flush();

        expect(mockUpdate).toHaveBeenCalledTimes(1);
    });

    it('removes the AppState listener on unmount', async () => {
        const { unmount } = renderHook(() => useLastSeen());
        await flush();

        unmount();

        expect(removeListener).toHaveBeenCalledTimes(1);
    });
});
