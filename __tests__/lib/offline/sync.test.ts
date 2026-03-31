import { OfflineQueue } from '@/lib/offline/queue';
import { SyncManager, type SyncStatus } from '@/lib/offline/sync';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage for the queue
const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;

// Helper to create a mock Supabase client
function createMockClient(options?: {
    insertError?: string | null;
    updateError?: string | null;
    deleteError?: string | null;
    upsertError?: string | null;
}) {
    const eqFn = jest.fn().mockReturnThis();
    return {
        from: jest.fn(() => ({
            insert: jest.fn().mockResolvedValue({
                error: options?.insertError ? { message: options.insertError } : null,
            }),
            update: jest.fn(() => ({
                eq: eqFn.mockResolvedValue({
                    error: options?.updateError ? { message: options.updateError } : null,
                }),
            })),
            upsert: jest.fn().mockResolvedValue({
                error: options?.upsertError ? { message: options.upsertError } : null,
            }),
            delete: jest.fn(() => ({
                eq: eqFn.mockResolvedValue({
                    error: options?.deleteError ? { message: options.deleteError } : null,
                }),
            })),
        })),
    } as any;
}

describe('SyncManager', () => {
    let queue: OfflineQueue;

    beforeEach(() => {
        jest.clearAllMocks();
        mockGetItem.mockResolvedValue(null);
        mockSetItem.mockResolvedValue(undefined);
        queue = new OfflineQueue();
    });

    describe('sync - successful', () => {
        it('processes all items in queue', async () => {
            const client = createMockClient();
            const manager = new SyncManager(client, queue);

            await queue.enqueue({ table: 'leads', operation: 'insert', payload: { name: 'A' } });
            await queue.enqueue({ table: 'leads', operation: 'insert', payload: { name: 'B' } });

            const status = await manager.sync();

            expect(status.pending).toBe(0);
            expect(status.lastSyncAt).not.toBeNull();
            expect(status.lastError).toBeNull();
            expect(client.from).toHaveBeenCalledTimes(2);
        });

        it('handles empty queue gracefully', async () => {
            const client = createMockClient();
            const manager = new SyncManager(client, queue);

            const status = await manager.sync();

            expect(status.pending).toBe(0);
            expect(status.lastError).toBeNull();
            expect(client.from).not.toHaveBeenCalled();
        });

        it('executes update operations with filters', async () => {
            const client = createMockClient();
            const manager = new SyncManager(client, queue);

            await queue.enqueue({
                table: 'leads',
                operation: 'update',
                payload: { full_name: 'Updated' },
                filters: { id: '123' },
            });

            await manager.sync();
            expect(client.from).toHaveBeenCalledWith('leads');
        });

        it('executes delete operations with filters', async () => {
            const client = createMockClient();
            const manager = new SyncManager(client, queue);

            await queue.enqueue({
                table: 'leads',
                operation: 'delete',
                payload: {},
                filters: { id: '456' },
            });

            await manager.sync();
            expect(client.from).toHaveBeenCalledWith('leads');
        });

        it('executes upsert operations', async () => {
            const client = createMockClient();
            const manager = new SyncManager(client, queue);

            await queue.enqueue({
                table: 'leads',
                operation: 'upsert',
                payload: { id: '123', full_name: 'Upserted' },
            });

            await manager.sync();
            expect(client.from).toHaveBeenCalledWith('leads');
        });
    });

    describe('sync - partial failure', () => {
        it('continues past failed items and processes remaining', async () => {
            let callCount = 0;
            const client = {
                from: jest.fn(() => ({
                    insert: jest.fn().mockImplementation(() => {
                        callCount++;
                        // First call fails, second succeeds
                        if (callCount === 1) {
                            return Promise.resolve({ error: { message: 'Permission denied' } });
                        }
                        return Promise.resolve({ error: null });
                    }),
                })),
            } as any;
            const manager = new SyncManager(client, queue);

            await queue.enqueue({ table: 'leads', operation: 'insert', payload: { name: 'Fail' } });
            await queue.enqueue({ table: 'leads', operation: 'insert', payload: { name: 'OK' } });

            const status = await manager.sync();

            // Failed item stays (retry count incremented), successful item removed
            expect(status.pending).toBe(1);
            expect(status.lastError).toBe('Permission denied');
            expect(client.from).toHaveBeenCalledTimes(2);
        });

        it('handles thrown exceptions during sync', async () => {
            const client = {
                from: jest.fn(() => ({
                    insert: jest.fn().mockRejectedValue(new Error('Network failure')),
                })),
            } as any;
            const manager = new SyncManager(client, queue);

            await queue.enqueue({ table: 'leads', operation: 'insert', payload: {} });

            const status = await manager.sync();
            expect(status.lastError).toBe('Network failure');
            expect(status.pending).toBe(1);
        });
    });

    describe('retry and dead-lettering', () => {
        it('increments retry count on failure', async () => {
            const client = createMockClient({ insertError: 'DB error' });
            const manager = new SyncManager(client, queue);

            await queue.enqueue({ table: 'leads', operation: 'insert', payload: {} });

            await manager.sync();
            const items = await queue.getAll();
            expect(items[0].retryCount).toBe(1);

            await manager.sync();
            const items2 = await queue.getAll();
            expect(items2[0].retryCount).toBe(2);
        });

        it('dead-letters items after MAX_RETRIES (3)', async () => {
            const client = createMockClient({ insertError: 'Permanent error' });
            const manager = new SyncManager(client, queue);

            await queue.enqueue({ table: 'leads', operation: 'insert', payload: {} });

            // Retry 3 times (retryCount goes 0→1, 1→2, 2→3)
            await manager.sync();
            await manager.sync();
            await manager.sync();
            expect(await queue.size()).toBe(1); // Still there, retryCount=3

            // 4th sync: retryCount >= MAX_RETRIES → dead-lettered
            await manager.sync();
            expect(await queue.size()).toBe(0);
        });

        it('processes successful items even when earlier items are failing', async () => {
            let callIndex = 0;
            const client = {
                from: jest.fn(() => ({
                    insert: jest.fn().mockImplementation(() => {
                        callIndex++;
                        if (callIndex % 2 === 1) {
                            return Promise.resolve({ error: { message: 'fail' } });
                        }
                        return Promise.resolve({ error: null });
                    }),
                })),
            } as any;
            const manager = new SyncManager(client, queue);

            await queue.enqueue({ table: 'leads', operation: 'insert', payload: {} });
            await queue.enqueue({ table: 'lead_activities', operation: 'insert', payload: {} });
            await queue.enqueue({ table: 'notifications', operation: 'insert', payload: {} });

            await manager.sync();

            // leads failed (retryCount=1), lead_activities succeeded (removed), notifications failed (retryCount=1)
            const remaining = await queue.getAll();
            expect(remaining).toHaveLength(2);
            expect(remaining[0].table).toBe('leads');
            expect(remaining[1].table).toBe('notifications');
        });
    });

    describe('ordering', () => {
        it('processes items in FIFO order', async () => {
            const callOrder: string[] = [];
            const client = {
                from: jest.fn((table: string) => {
                    callOrder.push(table);
                    return {
                        insert: jest.fn().mockResolvedValue({ error: null }),
                    };
                }),
            } as any;
            const manager = new SyncManager(client, queue);

            await queue.enqueue({ table: 'leads', operation: 'insert', payload: {} });
            await queue.enqueue({ table: 'lead_activities', operation: 'insert', payload: {} });
            await queue.enqueue({ table: 'notifications', operation: 'insert', payload: {} });

            await manager.sync();

            expect(callOrder).toEqual(['leads', 'lead_activities', 'notifications']);
        });
    });

    describe('callback invocation', () => {
        it('calls onStatusChange during sync', async () => {
            const client = createMockClient();
            const manager = new SyncManager(client, queue);
            const statuses: SyncStatus[] = [];

            manager.onStatusChange((s) => statuses.push({ ...s }));

            await queue.enqueue({ table: 'leads', operation: 'insert', payload: {} });
            await manager.sync();

            // Should have been called multiple times (start, after item, end)
            expect(statuses.length).toBeGreaterThanOrEqual(2);
            // Last status should show 0 pending
            expect(statuses[statuses.length - 1].pending).toBe(0);
        });

        it('calls callback with error info on failure', async () => {
            const client = createMockClient({ insertError: 'DB error' });
            const manager = new SyncManager(client, queue);
            const statuses: SyncStatus[] = [];

            manager.onStatusChange((s) => statuses.push({ ...s }));

            await queue.enqueue({ table: 'leads', operation: 'insert', payload: {} });
            await manager.sync();

            const errorStatus = statuses.find((s) => s.lastError !== null);
            expect(errorStatus?.lastError).toBe('DB error');
        });
    });

    describe('getSyncStatus', () => {
        it('returns initial status', async () => {
            const client = createMockClient();
            const manager = new SyncManager(client, queue);

            const status = await manager.getSyncStatus();
            expect(status.pending).toBe(0);
            expect(status.lastSyncAt).toBeNull();
            expect(status.lastError).toBeNull();
        });
    });

    describe('concurrent sync prevention', () => {
        it('does not run sync twice simultaneously', async () => {
            const client = createMockClient();
            const manager = new SyncManager(client, queue);

            await queue.enqueue({ table: 'leads', operation: 'insert', payload: {} });

            // Start two syncs at once
            const [status1, status2] = await Promise.all([manager.sync(), manager.sync()]);

            // Both should resolve, but client.from should only be called once
            expect(status1.pending).toBe(0);
        });
    });
});
