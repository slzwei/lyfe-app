import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'lyfe_offline_queue';
const MAX_QUEUE_SIZE = 500;

export type OfflineOperation = 'insert' | 'update' | 'upsert' | 'delete';

export interface QueueItem {
    id: string;
    userId?: string;
    table: string;
    operation: OfflineOperation;
    payload: Record<string, unknown>;
    filters?: Record<string, unknown>;
    /** For upserts: the conflict target (e.g. 'candidate_id,module_id') so replay dedups correctly. */
    onConflict?: string;
    createdAt: string;
    retryCount: number;
}

function generateId(): string {
    // Hermes ships no WebCrypto and this app installs no polyfill, so reaching
    // for the global unconditionally would make every on-device enqueue throw.
    // Ids only need to be unique within this device's queue — fall back to a
    // timestamp + Math.random id when crypto is unavailable.
    const cryptoObj = (globalThis as { crypto?: { getRandomValues?: (array: Uint8Array) => Uint8Array } }).crypto;
    if (cryptoObj?.getRandomValues) {
        const bytes = new Uint8Array(16);
        cryptoObj.getRandomValues(bytes);
        return Array.from(bytes)
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`;
}

export class OfflineQueue {
    private items: QueueItem[] = [];
    private loaded = false;

    private async load(): Promise<void> {
        if (this.loaded) return;
        try {
            const raw = await AsyncStorage.getItem(STORAGE_KEY);
            // Backfill retryCount for items persisted before this field existed
            this.items = raw
                ? (JSON.parse(raw) as QueueItem[]).map((item) => ({
                      ...item,
                      retryCount: item.retryCount ?? 0,
                  }))
                : [];
        } catch {
            this.items = [];
        }
        this.loaded = true;
    }

    private async persist(): Promise<void> {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
    }

    private dedupKey(item: Pick<QueueItem, 'table' | 'operation' | 'filters'>): string | null {
        if (item.operation === 'insert' || !item.filters) return null;
        // Sort keys for stable dedup (key order shouldn't affect identity)
        const sorted = Object.keys(item.filters)
            .sort()
            .reduce<Record<string, unknown>>((acc, k) => {
                acc[k] = item.filters![k];
                return acc;
            }, {});
        return `${item.table}:${JSON.stringify(sorted)}`;
    }

    async enqueue(item: Omit<QueueItem, 'id' | 'createdAt' | 'retryCount'>): Promise<QueueItem | null> {
        await this.load();
        if (this.items.length >= MAX_QUEUE_SIZE) {
            return null;
        }
        // Dedup: newer operation for the same record replaces the older one
        let payload = item.payload;
        const key = this.dedupKey(item);
        if (key) {
            const existingIndex = this.items.findIndex((existing) => this.dedupKey(existing) === key);
            if (existingIndex !== -1) {
                const [existing] = this.items.splice(existingIndex, 1);
                // Same-operation writes to the same record merge field-wise —
                // a queued { status } change must survive a later { notes }
                // change to the same row; replacing the whole payload would
                // silently drop the earlier field.
                if (existing.operation === item.operation && item.operation !== 'delete') {
                    payload = { ...existing.payload, ...payload };
                }
            }
        }
        const queueItem: QueueItem = {
            ...item,
            payload,
            id: generateId(),
            createdAt: new Date().toISOString(),
            retryCount: 0,
        };
        this.items.push(queueItem);
        await this.persist();
        return queueItem;
    }

    async dequeue(): Promise<QueueItem | undefined> {
        await this.load();
        const item = this.items.shift();
        if (item) await this.persist();
        return item;
    }

    async peek(): Promise<QueueItem | undefined> {
        await this.load();
        return this.items[0];
    }

    async getAll(): Promise<QueueItem[]> {
        await this.load();
        return [...this.items];
    }

    async clear(): Promise<void> {
        this.items = [];
        await this.persist();
    }

    async size(): Promise<number> {
        await this.load();
        return this.items.length;
    }

    async removeById(id: string): Promise<boolean> {
        await this.load();
        const index = this.items.findIndex((item) => item.id === id);
        if (index === -1) return false;
        this.items.splice(index, 1);
        await this.persist();
        return true;
    }

    async incrementRetry(id: string): Promise<void> {
        await this.load();
        const item = this.items.find((i) => i.id === id);
        if (item) {
            item.retryCount += 1;
            await this.persist();
        }
    }
}
