import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useCandidateSchedule } from '@/hooks/useCandidateSchedule';

const mockFetch = jest.fn();
jest.mock('@/lib/recruitment/schedule', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fetchMyCandidateSchedule: (...args: any[]) => mockFetch(...args),
}));

const sampleItem = {
    kind: 'interview' as const,
    id: 'iv1',
    code: 'zoom',
    startAt: '2026-07-04T07:00:00+08:00',
    endAt: null,
    location: null,
    isOnline: true,
    status: 'scheduled',
};

beforeEach(() => {
    mockFetch.mockReset();
});

describe('useCandidateSchedule', () => {
    it('fetches upcoming items when enabled and passes options through', async () => {
        mockFetch.mockResolvedValue({ data: [sampleItem], error: null });
        const { result } = renderHook(() => useCandidateSchedule({ enabled: true, limit: 3 }));

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(mockFetch).toHaveBeenCalledWith({ limit: 3, includePast: false });
        expect(result.current.items).toHaveLength(1);
        expect(result.current.error).toBeNull();
    });

    it('skips fetching and stays empty when disabled', async () => {
        const { result } = renderHook(() => useCandidateSchedule({ enabled: false }));

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(mockFetch).not.toHaveBeenCalled();
        expect(result.current.items).toEqual([]);
        expect(result.current.error).toBeNull();
    });

    it('surfaces the error message on failure', async () => {
        mockFetch.mockResolvedValue({ data: [], error: 'boom' });
        const { result } = renderHook(() => useCandidateSchedule());

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.error).toBe('boom');
        expect(result.current.items).toEqual([]);
    });

    it('refresh() re-fetches', async () => {
        mockFetch.mockResolvedValue({ data: [], error: null });
        const { result } = renderHook(() => useCandidateSchedule({ enabled: true }));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        mockFetch.mockClear();
        await act(async () => {
            await result.current.refresh();
        });
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });
});
