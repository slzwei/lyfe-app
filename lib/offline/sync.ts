import type { SupabaseClient } from '@supabase/supabase-js';
import type { OfflineQueue, QueueItem } from './queue';
import { captureError } from '../sentry';

const MAX_RETRIES = 3;
const EXECUTE_TIMEOUT_MS = 10_000;

/** Tables allowed for sync — must match ALLOWED_SYNC_TABLES in safeQuery.ts */
const ALLOWED_SYNC_TABLES = new Set([
    'leads',
    'lead_activities',
    'roadshow_activities',
    'roadshow_attendance',
    'candidate_module_progress',
    'candidate_module_item_progress',
    'notifications',
]);

/** Operations allowed for sync — must match OfflineOperation type in queue.ts */
const ALLOWED_OPERATIONS = new Set(['insert', 'update', 'upsert', 'delete']);

export interface SyncStatus {
    pending: number;
    lastSyncAt: string | null;
    lastError: string | null;
}

export type SyncCallback = (status: SyncStatus) => void;

export class SyncManager {
    private client: SupabaseClient;
    private queue: OfflineQueue;
    private lastSyncAt: string | null = null;
    private lastError: string | null = null;
    private syncing = false;
    private callback: SyncCallback | null = null;

    constructor(client: SupabaseClient, queue: OfflineQueue) {
        this.client = client;
        this.queue = queue;
    }

    onStatusChange(callback: SyncCallback): void {
        this.callback = callback;
    }

    private async emitStatus(): Promise<void> {
        if (!this.callback) return;
        this.callback(await this.getSyncStatus());
    }

    async getSyncStatus(): Promise<SyncStatus> {
        return {
            pending: await this.queue.size(),
            lastSyncAt: this.lastSyncAt,
            lastError: this.lastError,
        };
    }

    private async executeItem(item: QueueItem): Promise<{ error: string | null }> {
        try {
            const { table, operation, payload, filters } = item;

            if (!ALLOWED_SYNC_TABLES.has(table)) {
                return { error: `Blocked: table "${table}" is not in the sync allowlist` };
            }

            if (!ALLOWED_OPERATIONS.has(operation)) {
                return { error: `Blocked: operation "${operation}" is not allowed` };
            }

            let query;

            switch (operation) {
                case 'insert':
                    query = this.client.from(table).insert(payload);
                    break;
                case 'update': {
                    query = this.client.from(table).update(payload);
                    if (filters) {
                        for (const [key, value] of Object.entries(filters)) {
                            query = query.eq(key, value as string | number);
                        }
                    }
                    break;
                }
                case 'upsert':
                    query = this.client.from(table).upsert(payload);
                    break;
                case 'delete': {
                    query = this.client.from(table).delete();
                    if (filters) {
                        for (const [key, value] of Object.entries(filters)) {
                            query = query.eq(key, value as string | number);
                        }
                    }
                    break;
                }
                default:
                    return { error: `Unknown operation: ${operation}` };
            }

            const result = await Promise.race([
                query,
                new Promise<{ error: { message: string } }>((resolve) =>
                    setTimeout(() => resolve({ error: { message: 'Sync query timed out' } }), EXECUTE_TIMEOUT_MS),
                ),
            ]);
            return { error: result.error ? result.error.message : null };
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Unknown error during sync';
            return { error: message };
        }
    }

    async sync(): Promise<SyncStatus> {
        if (this.syncing) return this.getSyncStatus();
        this.syncing = true;
        this.lastError = null;
        await this.emitStatus();

        try {
            // Resolve current user to discard items from a previous session
            let currentUserId: string | undefined;
            try {
                const {
                    data: { session },
                } = await this.client.auth.getSession();
                currentUserId = session?.user?.id;
            } catch {
                // Auth not available (e.g. in tests) — skip ownership check
            }

            // Snapshot the queue to avoid peek/remove races
            const items = await this.queue.getAll();

            for (const item of items) {
                // Discard items queued by a different user
                if (item.userId && currentUserId && item.userId !== currentUserId) {
                    await this.queue.removeById(item.id);
                    await this.emitStatus();
                    continue;
                }
                // Dead-letter items that exceeded max retries
                if (item.retryCount >= MAX_RETRIES) {
                    captureError(new Error(`Offline sync item dead-lettered after ${MAX_RETRIES} retries`), {
                        table: item.table,
                        operation: item.operation,
                        queueItemId: item.id,
                    });
                    await this.queue.removeById(item.id);
                    await this.emitStatus();
                    continue;
                }

                const { error } = await this.executeItem(item);

                if (error) {
                    this.lastError = error;
                    await this.queue.incrementRetry(item.id);
                    await this.emitStatus();
                    // Continue processing remaining items instead of blocking
                    continue;
                }

                await this.queue.removeById(item.id);
                await this.emitStatus();
            }

            this.lastSyncAt = new Date().toISOString();
        } finally {
            this.syncing = false;
        }

        await this.emitStatus();
        return this.getSyncStatus();
    }
}
