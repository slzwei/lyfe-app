/**
 * Tests for hooks/useCandidatePipeline.ts — shared fetch state for the
 * pipeline-sorted candidate list. The hook composes useFocusEffect +
 * useCandidateRealtime; we mock both so the test only exercises the
 * fetch-and-state logic.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useCandidatePipeline } from '@/hooks/useCandidatePipeline';
import { fetchPipelineSnapshot } from '@/lib/recruitment/pipelineFetch';

// ── Mocks ──

let realtimeCallback: (() => void) | null = null;

jest.mock('@/lib/supabase');
jest.mock('@/contexts/AuthContext', () => ({
    useAuth: jest.fn(() => ({ user: { id: 'user-1' } })),
}));
jest.mock('@/hooks/useCandidateRealtime', () => ({
    useCandidateRealtime: jest.fn((cb: () => void) => {
        realtimeCallback = cb;
    }),
}));
jest.mock('@/lib/recruitment/pipelineFetch');
jest.mock('@/lib/analytics', () => ({
    pipelineAnalytics: {
        snapshotLoaded: jest.fn(),
        sortModeChanged: jest.fn(),
        flaggedRowOpened: jest.fn(),
        homeSectionSeeAllTapped: jest.fn(),
        homeRowTapped: jest.fn(),
    },
}));

// expo-router's useFocusEffect mock just fires the callback synchronously.
// The hook defers `load` via setTimeout to avoid the "too many re-renders"
// trap that mock creates — exercise that defer path with fake timers.
jest.mock('expo-router', () => ({
    useFocusEffect: jest.fn((cb: () => void | (() => void)) => cb()),
}));

const mockFetchSnapshot = fetchPipelineSnapshot as jest.MockedFunction<typeof fetchPipelineSnapshot>;

const POPULATED_SNAPSHOT = {
    rows: [
        { candidate: { id: 'cand-1', name: 'A' } as any, nextStep: { urgency: 'at-risk', text: 'Follow up' } as any },
        {
            candidate: { id: 'cand-2', name: 'B' } as any,
            nextStep: { urgency: 'on-track', text: 'Stay course' } as any,
        },
    ],
    counts: { 'at-risk': 1, 'this-week': 0, ready: 0, 'on-track': 1, hidden: 0 },
    error: null as string | null,
};

beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    realtimeCallback = null;
    mockFetchSnapshot.mockResolvedValue(POPULATED_SNAPSHOT);
});

afterEach(() => {
    jest.useRealTimers();
});

describe('useCandidatePipeline', () => {
    it('starts in a loading state and populates rows + counts after fetch', async () => {
        const { result } = renderHook(() => useCandidatePipeline({ isManagerView: true }));

        expect(result.current.isLoading).toBe(true);
        expect(result.current.rows).toEqual([]);

        // Drain the deferred setTimeout(load, 0) inside useFocusEffect.
        await act(async () => {
            jest.advanceTimersByTime(1);
        });
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.rows).toHaveLength(2);
        expect(result.current.counts['at-risk']).toBe(1);
        expect(result.current.error).toBeNull();
        expect(mockFetchSnapshot).toHaveBeenCalledWith('user-1', true);
    });

    it('respects enabled=false by skipping the fetch and clearing the loading flag', async () => {
        const { result } = renderHook(() => useCandidatePipeline({ enabled: false }));

        await act(async () => {
            jest.advanceTimersByTime(1);
        });
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(mockFetchSnapshot).not.toHaveBeenCalled();
        expect(result.current.rows).toEqual([]);
    });

    it('captures an error from fetchPipelineSnapshot without throwing', async () => {
        mockFetchSnapshot.mockResolvedValue({ ...POPULATED_SNAPSHOT, error: 'rls denied' });

        const { result } = renderHook(() => useCandidatePipeline({ isManagerView: false }));

        await act(async () => {
            jest.advanceTimersByTime(1);
        });
        await waitFor(() => expect(result.current.error).toBe('rls denied'));
        // Rows still come through — partial-failure UX.
        expect(result.current.rows).toHaveLength(2);
    });

    it('refresh() toggles isRefreshing and re-runs the fetch', async () => {
        const { result } = renderHook(() => useCandidatePipeline({ isManagerView: true }));

        await act(async () => {
            jest.advanceTimersByTime(1);
        });
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(mockFetchSnapshot).toHaveBeenCalledTimes(1);

        await act(async () => {
            await result.current.refresh();
        });

        expect(mockFetchSnapshot).toHaveBeenCalledTimes(2);
        expect(result.current.isRefreshing).toBe(false);
    });

    it('refresh() is a no-op when enabled=false', async () => {
        const { result } = renderHook(() => useCandidatePipeline({ enabled: false }));

        await act(async () => {
            jest.advanceTimersByTime(1);
        });

        await act(async () => {
            await result.current.refresh();
        });

        expect(mockFetchSnapshot).not.toHaveBeenCalled();
    });

    it('subscribes a realtime callback that triggers a refetch when invoked', async () => {
        renderHook(() => useCandidatePipeline({ isManagerView: true }));

        await act(async () => {
            jest.advanceTimersByTime(1);
        });
        expect(mockFetchSnapshot).toHaveBeenCalledTimes(1);

        // Simulate a realtime event from useCandidateRealtime → triggers the load callback.
        await act(async () => {
            realtimeCallback?.();
        });
        expect(mockFetchSnapshot).toHaveBeenCalledTimes(2);
    });
});
