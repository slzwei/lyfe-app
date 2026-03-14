import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'lyfe_offline_queue';

export type OfflineOperation = 'insert' | 'update' | 'upsert' | 'delete';

export interface QueueItem {
    id: string;
    table: string;
    operation: OfflineOperation;
    payload: Record<string, unknown>;
    filters?: Record<string, unknown>;
    createdAt: string;
}

function generateId(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

export class OfflineQueue {
    private items: QueueItem[] = [];
    private loaded = false;

    private async load(): Promise<void> {
        if (this.loaded) return;
        try {
            const raw = await AsyncStorage.getItem(STORAGE_KEY);
            this.items = raw ? JSON.parse(raw) : [];
        } catch {
            this.items = [];
        }
        this.loaded = true;
    }

    private async persist(): Promise<void> {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
    }

    async enqueue(
        item: Omit<QueueItem, 'id' | 'createdAt'>,
    ): Promise<QueueItem> {
        await this.load();
        const queueItem: QueueItem = {
            ...item,
            id: generateId(),
            createdAt: new Date().toISOString(),
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
}
