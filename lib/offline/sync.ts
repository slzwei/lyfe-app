import type { SupabaseClient } from '@supabase/supabase-js';
import type { OfflineQueue, QueueItem } from './queue';

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
            let query;
            const { table, operation, payload, filters } = item;

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

            const { error } = await query;
            return { error: error ? error.message : null };
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
            while (true) {
                const item = await this.queue.peek();
                if (!item) break;

                const { error } = await this.executeItem(item);

                if (error) {
                    this.lastError = error;
                    await this.emitStatus();
                    break;
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
