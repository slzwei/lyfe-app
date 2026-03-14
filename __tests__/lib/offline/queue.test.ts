import AsyncStorage from '@react-native-async-storage/async-storage';
import { OfflineQueue, type QueueItem } from '@/lib/offline/queue';

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;

describe('OfflineQueue', () => {
    let queue: OfflineQueue;

    beforeEach(() => {
        jest.clearAllMocks();
        mockGetItem.mockResolvedValue(null);
        mockSetItem.mockResolvedValue(undefined);
        queue = new OfflineQueue();
    });

    describe('enqueue', () => {
        it('adds an item and persists to AsyncStorage', async () => {
            const item = await queue.enqueue({
                table: 'users',
                operation: 'insert',
                payload: { full_name: 'Test' },
            });

            expect(item.id).toBeDefined();
            expect(item.table).toBe('users');
            expect(item.operation).toBe('insert');
            expect(item.payload).toEqual({ full_name: 'Test' });
            expect(item.createdAt).toBeDefined();
            expect(mockSetItem).toHaveBeenCalledWith(
                'lyfe_offline_queue',
                expect.stringContaining('"table":"users"'),
            );
        });

        it('generates unique IDs for each item', async () => {
            const item1 = await queue.enqueue({ table: 'users', operation: 'insert', payload: { a: 1 } });
            const item2 = await queue.enqueue({ table: 'users', operation: 'insert', payload: { b: 2 } });
            expect(item1.id).not.toBe(item2.id);
        });

        it('preserves filters when provided', async () => {
            const item = await queue.enqueue({
                table: 'users',
                operation: 'update',
                payload: { full_name: 'Updated' },
                filters: { id: '123' },
            });
            expect(item.filters).toEqual({ id: '123' });
        });
    });

    describe('dequeue', () => {
        it('returns undefined for empty queue', async () => {
            const item = await queue.dequeue();
            expect(item).toBeUndefined();
        });

        it('returns items in FIFO order', async () => {
            await queue.enqueue({ table: 'a', operation: 'insert', payload: {} });
            await queue.enqueue({ table: 'b', operation: 'insert', payload: {} });

            const first = await queue.dequeue();
            const second = await queue.dequeue();

            expect(first?.table).toBe('a');
            expect(second?.table).toBe('b');
        });

        it('persists after dequeue', async () => {
            await queue.enqueue({ table: 'users', operation: 'insert', payload: {} });
            mockSetItem.mockClear();

            await queue.dequeue();
            expect(mockSetItem).toHaveBeenCalledWith('lyfe_offline_queue', '[]');
        });
    });

    describe('peek', () => {
        it('returns undefined for empty queue', async () => {
            expect(await queue.peek()).toBeUndefined();
        });

        it('returns first item without removing it', async () => {
            await queue.enqueue({ table: 'users', operation: 'insert', payload: {} });

            const peeked = await queue.peek();
            expect(peeked?.table).toBe('users');

            const size = await queue.size();
            expect(size).toBe(1);
        });
    });

    describe('getAll', () => {
        it('returns empty array for empty queue', async () => {
            expect(await queue.getAll()).toEqual([]);
        });

        it('returns all items', async () => {
            await queue.enqueue({ table: 'a', operation: 'insert', payload: {} });
            await queue.enqueue({ table: 'b', operation: 'update', payload: {} });

            const items = await queue.getAll();
            expect(items).toHaveLength(2);
            expect(items[0].table).toBe('a');
            expect(items[1].table).toBe('b');
        });

        it('returns a copy (not a reference)', async () => {
            await queue.enqueue({ table: 'users', operation: 'insert', payload: {} });
            const items = await queue.getAll();
            items.pop();
            expect(await queue.size()).toBe(1);
        });
    });

    describe('clear', () => {
        it('removes all items', async () => {
            await queue.enqueue({ table: 'a', operation: 'insert', payload: {} });
            await queue.enqueue({ table: 'b', operation: 'insert', payload: {} });

            await queue.clear();
            expect(await queue.size()).toBe(0);
            expect(await queue.getAll()).toEqual([]);
        });
    });

    describe('size', () => {
        it('returns 0 for empty queue', async () => {
            expect(await queue.size()).toBe(0);
        });

        it('returns correct count', async () => {
            await queue.enqueue({ table: 'a', operation: 'insert', payload: {} });
            await queue.enqueue({ table: 'b', operation: 'insert', payload: {} });
            expect(await queue.size()).toBe(2);
        });
    });

    describe('removeById', () => {
        it('returns false for non-existent ID', async () => {
            expect(await queue.removeById('nonexistent')).toBe(false);
        });

        it('removes the correct item and returns true', async () => {
            const item1 = await queue.enqueue({ table: 'a', operation: 'insert', payload: {} });
            await queue.enqueue({ table: 'b', operation: 'insert', payload: {} });

            const removed = await queue.removeById(item1.id);
            expect(removed).toBe(true);
            expect(await queue.size()).toBe(1);

            const remaining = await queue.getAll();
            expect(remaining[0].table).toBe('b');
        });
    });

    describe('persistence', () => {
        it('loads from AsyncStorage on first access', async () => {
            const stored: QueueItem[] = [
                {
                    id: 'abc',
                    table: 'users',
                    operation: 'insert',
                    payload: { name: 'Persisted' },
                    createdAt: '2024-01-01T00:00:00.000Z',
                },
            ];
            mockGetItem.mockResolvedValue(JSON.stringify(stored));

            const freshQueue = new OfflineQueue();
            const items = await freshQueue.getAll();

            expect(items).toHaveLength(1);
            expect(items[0].payload).toEqual({ name: 'Persisted' });
        });

        it('handles corrupted AsyncStorage gracefully', async () => {
            mockGetItem.mockResolvedValue('not valid json!!!');

            const freshQueue = new OfflineQueue();
            const items = await freshQueue.getAll();
            expect(items).toEqual([]);
        });

        it('handles AsyncStorage read failure gracefully', async () => {
            mockGetItem.mockRejectedValue(new Error('Storage read failed'));

            const freshQueue = new OfflineQueue();
            const items = await freshQueue.getAll();
            expect(items).toEqual([]);
        });
    });
});
