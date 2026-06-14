import { safeQuery, safeMutation, isNetworkError, isNetworkErrorResult } from '@/lib/offline/safeQuery';
import { OfflineQueue } from '@/lib/offline/queue';
import AsyncStorage from '@react-native-async-storage/async-storage';

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;

/**
 * The EXACT shape postgrest-js (2.98) resolves with on a network failure —
 * it catches the fetch rejection internally and resolves, it never throws.
 * (See PostgrestBuilder.then's `.catch(fetchError => ...)` handler.)
 */
const POSTGREST_NETWORK_FAILURE = {
    data: null,
    error: {
        message: 'TypeError: Network request failed',
        details: 'TypeError: Network request failed\n    at anonymous (fetch.umd.js:535:33)',
        hint: '',
        code: '',
    },
    count: null,
    status: 0,
    statusText: '',
};

describe('safeQuery', () => {
    it('returns data on success', async () => {
        const result = await safeQuery(() => Promise.resolve({ data: [{ id: 1 }], error: null }));

        expect(result.data).toEqual([{ id: 1 }]);
        expect(result.error).toBeNull();
        expect(result.isOffline).toBe(false);
    });

    it('returns Supabase error on query failure', async () => {
        const result = await safeQuery(() => Promise.resolve({ data: null, error: { message: 'Row not found' } }));

        expect(result.data).toBeNull();
        expect(result.error).toBe('Row not found');
        expect(result.isOffline).toBe(false);
    });

    it('returns offline result on network error', async () => {
        const result = await safeQuery(() => {
            throw new TypeError('Network request failed');
        });

        expect(result.data).toBeNull();
        expect(result.error).toBe('You are offline. Please check your connection.');
        expect(result.isOffline).toBe(true);
    });

    it('returns offline result when the client RESOLVES a network failure (postgrest-js behavior)', async () => {
        const result = await safeQuery(() => Promise.resolve(POSTGREST_NETWORK_FAILURE));

        expect(result.data).toBeNull();
        expect(result.error).toBe('You are offline. Please check your connection.');
        expect(result.isOffline).toBe(true);
    });

    it('does NOT classify a real server error as offline even if it mentions networking', async () => {
        const result = await safeQuery(() =>
            Promise.resolve({ data: null, error: { message: 'network request failed in trigger fn' }, status: 500 }),
        );

        expect(result.isOffline).toBe(false);
        expect(result.error).toBe('network request failed in trigger fn');
    });

    it('detects "Failed to fetch" as network error', async () => {
        const result = await safeQuery(() => {
            throw new Error('Failed to fetch');
        });

        expect(result.isOffline).toBe(true);
    });

    it('detects iOS offline error message', async () => {
        const result = await safeQuery(() => {
            throw new Error('The Internet connection appears to be offline');
        });

        expect(result.isOffline).toBe(true);
    });

    it('re-throws non-network errors', async () => {
        await expect(
            safeQuery(() => {
                throw new Error('Some other error');
            }),
        ).rejects.toThrow('Some other error');
    });

    it('passes through data even when error exists', async () => {
        const result = await safeQuery(() =>
            Promise.resolve({ data: { partial: true }, error: { message: 'Warning' } }),
        );

        expect(result.data).toEqual({ partial: true });
        expect(result.error).toBe('Warning');
    });
});

describe('safeMutation', () => {
    let queue: OfflineQueue;

    beforeEach(() => {
        jest.clearAllMocks();
        mockGetItem.mockResolvedValue(null);
        mockSetItem.mockResolvedValue(undefined);
        queue = new OfflineQueue();
    });

    it('returns data on successful mutation', async () => {
        const result = await safeMutation(
            'users',
            'insert',
            { full_name: 'Test' },
            undefined,
            () => Promise.resolve({ data: { id: '123' }, error: null }),
            queue,
        );

        expect(result.data).toEqual({ id: '123' });
        expect(result.error).toBeNull();
        expect(result.queued).toBe(false);
    });

    it('returns Supabase error on mutation failure', async () => {
        const result = await safeMutation(
            'users',
            'insert',
            { full_name: 'Test' },
            undefined,
            () => Promise.resolve({ data: null, error: { message: 'Duplicate key' } }),
            queue,
        );

        expect(result.error).toBe('Duplicate key');
        expect(result.queued).toBe(false);
    });

    it('queues mutation on network error and returns queued: true', async () => {
        const result = await safeMutation(
            'leads',
            'update',
            { full_name: 'Updated' },
            { id: '123' },
            () => {
                throw new TypeError('Network request failed');
            },
            queue,
        );

        expect(result.data).toBeNull();
        expect(result.error).toBeNull();
        expect(result.queued).toBe(true);

        const items = await queue.getAll();
        expect(items).toHaveLength(1);
        expect(items[0].table).toBe('leads');
        expect(items[0].operation).toBe('update');
        expect(items[0].payload).toEqual({ full_name: 'Updated' });
        expect(items[0].filters).toEqual({ id: '123' });
    });

    it('re-throws non-network errors', async () => {
        await expect(
            safeMutation(
                'users',
                'insert',
                {},
                undefined,
                () => {
                    throw new Error('Permission denied');
                },
                queue,
            ),
        ).rejects.toThrow('Permission denied');
    });

    it('queues when the client RESOLVES a network failure (postgrest-js behavior)', async () => {
        const result = await safeMutation(
            'leads',
            'update',
            { status: 'contacted' },
            { id: 'L1' },
            () => Promise.resolve(POSTGREST_NETWORK_FAILURE),
            queue,
        );

        expect(result.data).toBeNull();
        expect(result.error).toBeNull();
        expect(result.queued).toBe(true);

        const items = await queue.getAll();
        expect(items).toHaveLength(1);
        expect(items[0].table).toBe('leads');
        expect(items[0].payload).toEqual({ status: 'contacted' });
        expect(items[0].filters).toEqual({ id: 'L1' });
    });

    it('does NOT queue an aborted request (status 0 but AbortError)', async () => {
        const result = await safeMutation(
            'leads',
            'update',
            { status: 'contacted' },
            { id: 'L1' },
            () =>
                Promise.resolve({
                    data: null,
                    error: { message: 'AbortError: Aborted', details: '', hint: '', code: '' },
                    status: 0,
                }),
            queue,
        );

        expect(result.queued).toBe(false);
        expect(result.error).toBe('AbortError: Aborted');
        expect(await queue.size()).toBe(0);
    });

    it('fails loudly (queued: false + error) when the queue is full', async () => {
        jest.spyOn(queue, 'enqueue').mockResolvedValue(null);

        const result = await safeMutation(
            'leads',
            'update',
            { status: 'contacted' },
            { id: 'L1' },
            () => Promise.resolve(POSTGREST_NETWORK_FAILURE),
            queue,
        );

        expect(result.queued).toBe(false);
        expect(result.error).toMatch(/queue is full/i);
    });
});

describe('isNetworkErrorResult', () => {
    it('matches the resolved postgrest-js network-failure shape', () => {
        expect(isNetworkErrorResult(POSTGREST_NETWORK_FAILURE.error, POSTGREST_NETWORK_FAILURE.status)).toBe(true);
    });

    it('matches by message alone when the client reports no status (storage-js/auth-js)', () => {
        expect(isNetworkErrorResult({ message: 'Network request failed' })).toBe(true);
    });

    it('matches the supabase FunctionsFetchError message (edge-function transport failure)', () => {
        expect(isNetworkErrorResult({ message: 'Failed to send a request to the Edge Function' })).toBe(true);
        expect(isNetworkError(new Error('Failed to send a request to the Edge Function'))).toBe(true);
    });

    it('rejects real HTTP errors, aborts, and missing errors', () => {
        expect(isNetworkErrorResult({ message: 'network request failed' }, 500)).toBe(false);
        expect(isNetworkErrorResult({ message: 'AbortError: Aborted' }, 0)).toBe(false);
        expect(isNetworkErrorResult({ message: 'duplicate key value' }, 409)).toBe(false);
        expect(isNetworkErrorResult(null, 0)).toBe(false);
    });
});
