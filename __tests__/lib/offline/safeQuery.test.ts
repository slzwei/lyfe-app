import { safeQuery, safeMutation } from '@/lib/offline/safeQuery';
import { OfflineQueue } from '@/lib/offline/queue';
import AsyncStorage from '@react-native-async-storage/async-storage';

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;

describe('safeQuery', () => {
    it('returns data on success', async () => {
        const result = await safeQuery(() => Promise.resolve({ data: [{ id: 1 }], error: null }));

        expect(result.data).toEqual([{ id: 1 }]);
        expect(result.error).toBeNull();
        expect(result.isOffline).toBe(false);
    });

    it('returns Supabase error on query failure', async () => {
        const result = await safeQuery(() =>
            Promise.resolve({ data: null, error: { message: 'Row not found' } }),
        );

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
            'users',
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
        expect(items[0].table).toBe('users');
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
});
