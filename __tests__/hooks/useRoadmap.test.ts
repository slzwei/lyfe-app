/**
 * Tests for hooks/useRoadmap.ts — Candidate-facing read-only roadmap hook
 */

// Override useFocusEffect to behave like useEffect (proper React lifecycle for async updates)
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useRoadmap } from '@/hooks/useRoadmap';

jest.mock('expo-router', () => ({
    useFocusEffect: (cb: () => void) => {
        const { useEffect } = require('react');
        useEffect(() => {
            cb();
        }, [cb]);
    },
    useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() })),
    useLocalSearchParams: jest.fn(() => ({})),
    Link: 'Link',
    Tabs: { Screen: 'Screen' },
}));

// ── Mocks ──

const mockFetchCandidateRoadmap = jest.fn();
const mockComputeNodeStates = jest.fn();

jest.mock('@/lib/roadmap', () => ({
    fetchCandidateRoadmap: (...args: any[]) => mockFetchCandidateRoadmap(...args),
    computeNodeStates: (...args: any[]) => mockComputeNodeStates(...args),
}));

// ── Fixtures ──

const MOCK_MODULE_1 = {
    id: 'm1',
    programme_id: 'prog-seed',
    title: 'Module 1',
    description: null,
    learning_objectives: null,
    module_type: 'training',
    display_order: 1,
    is_active: true,
    is_required: true,
    estimated_minutes: null,
    exam_paper_id: null,
    icon_name: null,
    icon_color: null,
    archived_at: null,
    archived_by: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    progress: null,
    resources: [],
    isLocked: false,
    examPaper: null,
    prerequisiteIds: [],
    isArchived: false,
};

const MOCK_MODULE_2 = {
    ...MOCK_MODULE_1,
    id: 'm2',
    display_order: 2,
    progress: {
        id: 'prog-m2',
        candidate_id: 'cand-1',
        module_id: 'm2',
        status: 'completed' as const,
        completed_at: '2026-02-01T00:00:00Z',
        completed_by: 'mgr-1',
        score: null,
        notes: null,
        updated_at: '2026-02-01T00:00:00Z',
        created_at: '2026-02-01T00:00:00Z',
    },
};

const MOCK_MODULE_3 = {
    ...MOCK_MODULE_1,
    id: 'm3',
    programme_id: 'prog-sprout',
    display_order: 1,
    isLocked: true,
};

const MOCK_PROGRAMME_SEED = {
    id: 'prog-seed',
    slug: 'seedlyfe',
    title: 'SeedLYFE',
    description: 'Foundation',
    display_order: 1,
    icon_type: 'seedling',
    is_active: true,
    archived_at: null,
    archived_by: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    modules: [MOCK_MODULE_1, MOCK_MODULE_2],
    completedCount: 1,
    totalCount: 2,
    percentage: 50,
    isLocked: false,
    manuallyUnlocked: false,
    unlockedByName: null,
};

const MOCK_PROGRAMME_SPROUT = {
    ...MOCK_PROGRAMME_SEED,
    id: 'prog-sprout',
    slug: 'sproutlyfe',
    title: 'SproutLYFE',
    display_order: 2,
    icon_type: 'sprout',
    modules: [MOCK_MODULE_3],
    completedCount: 0,
    totalCount: 1,
    percentage: 0,
    isLocked: true,
    manuallyUnlocked: false,
};

// ── Setup ──

beforeEach(() => {
    jest.clearAllMocks();
    // Default: computeNodeStates returns a sensible state per module
    mockComputeNodeStates.mockImplementation((modules: any[]) =>
        modules.map((m: any) => {
            if (m.isLocked) return 'locked';
            if (m.progress?.status === 'completed') return 'completed';
            return 'current';
        }),
    );
});

// ── Tests ──

describe('useRoadmap', () => {
    it('starts in loading state', () => {
        mockFetchCandidateRoadmap.mockReturnValue(new Promise(() => {})); // never resolves

        const { result } = renderHook(() => useRoadmap('cand-1'));

        expect(result.current.isLoading).toBe(true);
        expect(result.current.programmes).toEqual([]);
        expect(result.current.error).toBeNull();
        expect(result.current.nodeStates).toBeInstanceOf(Map);
        expect(result.current.nodeStates.size).toBe(0);
    });

    it('populates programmes and nodeStates on successful fetch', async () => {
        mockFetchCandidateRoadmap.mockResolvedValue({
            data: [MOCK_PROGRAMME_SEED, MOCK_PROGRAMME_SPROUT],
            error: null,
        });

        const { result } = renderHook(() => useRoadmap('cand-1'));

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.error).toBeNull();
        expect(result.current.programmes).toHaveLength(2);
        expect(result.current.programmes[0].slug).toBe('seedlyfe');
        expect(result.current.programmes[1].slug).toBe('sproutlyfe');

        // computeNodeStates called once per programme
        expect(mockComputeNodeStates).toHaveBeenCalledTimes(2);
        expect(mockComputeNodeStates).toHaveBeenCalledWith(MOCK_PROGRAMME_SEED.modules);
        expect(mockComputeNodeStates).toHaveBeenCalledWith(MOCK_PROGRAMME_SPROUT.modules);
    });

    it('builds nodeStates map with correct module-to-state mapping', async () => {
        mockFetchCandidateRoadmap.mockResolvedValue({
            data: [MOCK_PROGRAMME_SEED],
            error: null,
        });
        // Return known states
        mockComputeNodeStates.mockReturnValue(['current', 'completed']);

        const { result } = renderHook(() => useRoadmap('cand-1'));

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.nodeStates.get('m1')).toBe('current');
        expect(result.current.nodeStates.get('m2')).toBe('completed');
    });

    it('sets error state and clears loading on fetch error', async () => {
        mockFetchCandidateRoadmap.mockResolvedValue({
            data: null,
            error: 'DB connection failed',
        });

        const { result } = renderHook(() => useRoadmap('cand-1'));

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.error).toBe('DB connection failed');
        expect(result.current.programmes).toEqual([]);
    });

    it('does not fetch when candidateId is undefined', () => {
        const { result } = renderHook(() => useRoadmap(undefined));

        expect(mockFetchCandidateRoadmap).not.toHaveBeenCalled();
        // isLoading stays true (loadRoadmap returns early without clearing it)
        expect(result.current.programmes).toEqual([]);
    });

    it('refresh re-fetches roadmap data', async () => {
        mockFetchCandidateRoadmap.mockResolvedValue({
            data: [MOCK_PROGRAMME_SEED],
            error: null,
        });

        const { result } = renderHook(() => useRoadmap('cand-1'));

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(mockFetchCandidateRoadmap).toHaveBeenCalledTimes(1);

        await act(async () => {
            await result.current.refresh();
        });

        expect(mockFetchCandidateRoadmap).toHaveBeenCalledTimes(2);
        expect(mockFetchCandidateRoadmap).toHaveBeenCalledWith('cand-1');
    });

    it('refresh clears error state before re-fetching', async () => {
        mockFetchCandidateRoadmap
            .mockResolvedValueOnce({ data: null, error: 'Network error' })
            .mockResolvedValueOnce({ data: [MOCK_PROGRAMME_SEED], error: null });

        const { result } = renderHook(() => useRoadmap('cand-1'));

        await waitFor(() => {
            expect(result.current.error).toBe('Network error');
        });

        await act(async () => {
            await result.current.refresh();
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.error).toBeNull();
        expect(result.current.programmes).toHaveLength(1);
    });

    it('activeProgrammeIndex defaults to 0', async () => {
        mockFetchCandidateRoadmap.mockResolvedValue({
            data: [MOCK_PROGRAMME_SEED],
            error: null,
        });

        const { result } = renderHook(() => useRoadmap('cand-1'));

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.activeProgrammeIndex).toBe(0);
    });

    it('setActiveProgrammeIndex updates the active index', async () => {
        mockFetchCandidateRoadmap.mockResolvedValue({
            data: [MOCK_PROGRAMME_SEED, MOCK_PROGRAMME_SPROUT],
            error: null,
        });

        const { result } = renderHook(() => useRoadmap('cand-1'));

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        act(() => {
            result.current.setActiveProgrammeIndex(1);
        });

        expect(result.current.activeProgrammeIndex).toBe(1);
    });

    it('setActiveProgrammeIndex does not trigger a re-fetch', async () => {
        mockFetchCandidateRoadmap.mockResolvedValue({
            data: [MOCK_PROGRAMME_SEED, MOCK_PROGRAMME_SPROUT],
            error: null,
        });

        const { result } = renderHook(() => useRoadmap('cand-1'));

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        const callCountBefore = mockFetchCandidateRoadmap.mock.calls.length;

        act(() => {
            result.current.setActiveProgrammeIndex(1);
        });

        expect(mockFetchCandidateRoadmap.mock.calls.length).toBe(callCountBefore);
    });

    it('re-fetches when candidateId changes', async () => {
        mockFetchCandidateRoadmap.mockResolvedValue({
            data: [MOCK_PROGRAMME_SEED],
            error: null,
        });

        const { result, rerender } = renderHook((id: string) => useRoadmap(id), {
            initialProps: 'cand-1',
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(mockFetchCandidateRoadmap).toHaveBeenCalledWith('cand-1');

        rerender('cand-2');

        await waitFor(() => {
            expect(mockFetchCandidateRoadmap).toHaveBeenCalledWith('cand-2');
        });
    });

    it('handles empty programmes array without crashing', async () => {
        mockFetchCandidateRoadmap.mockResolvedValue({
            data: [],
            error: null,
        });

        const { result } = renderHook(() => useRoadmap('cand-1'));

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.programmes).toEqual([]);
        expect(result.current.nodeStates.size).toBe(0);
        expect(result.current.error).toBeNull();
    });

    it('exposes refresh function that is stable across re-renders', async () => {
        mockFetchCandidateRoadmap.mockResolvedValue({
            data: [MOCK_PROGRAMME_SEED],
            error: null,
        });

        const { result, rerender } = renderHook(() => useRoadmap('cand-1'));

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        const firstRefresh = result.current.refresh;
        rerender({ initialProps: undefined } as any);
        expect(result.current.refresh).toBe(firstRefresh);
    });

    it('nodeStates includes states for all modules across all programmes', async () => {
        mockFetchCandidateRoadmap.mockResolvedValue({
            data: [MOCK_PROGRAMME_SEED, MOCK_PROGRAMME_SPROUT],
            error: null,
        });
        mockComputeNodeStates
            .mockReturnValueOnce(['current', 'completed']) // SeedLYFE modules
            .mockReturnValueOnce(['locked']); // SproutLYFE modules

        const { result } = renderHook(() => useRoadmap('cand-1'));

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        // All 3 modules across both programmes
        expect(result.current.nodeStates.size).toBe(3);
        expect(result.current.nodeStates.get('m1')).toBe('current');
        expect(result.current.nodeStates.get('m2')).toBe('completed');
        expect(result.current.nodeStates.get('m3')).toBe('locked');
    });
});
