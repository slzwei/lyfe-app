import type { OfflineQueue, OfflineOperation } from './queue';

export interface SafeQueryResult<T> {
    data: T | null;
    error: string | null;
    isOffline: boolean;
}

export interface SafeMutationResult<T> {
    data: T | null;
    error: string | null;
    queued: boolean;
}

function isNetworkError(e: unknown): boolean {
    if (e instanceof TypeError && e.message === 'Network request failed') return true;
    if (e instanceof Error) {
        const msg = e.message.toLowerCase();
        return (
            msg.includes('network request failed') ||
            msg.includes('failed to fetch') ||
            msg.includes('networkerror') ||
            msg.includes('the internet connection appears to be offline')
        );
    }
    return false;
}

export async function safeQuery<T>(
    queryFn: () => Promise<{ data: T | null; error: { message: string } | null }>,
): Promise<SafeQueryResult<T>> {
    try {
        const { data, error } = await queryFn();
        if (error) {
            return { data, error: error.message ?? String(error), isOffline: false };
        }
        return { data, error: null, isOffline: false };
    } catch (e: unknown) {
        if (isNetworkError(e)) {
            return {
                data: null,
                error: 'You are offline. Please check your connection.',
                isOffline: true,
            };
        }
        throw e;
    }
}

export async function safeMutation<T>(
    table: string,
    operation: OfflineOperation,
    payload: Record<string, unknown>,
    filters: Record<string, unknown> | undefined,
    queryFn: () => Promise<{ data: T | null; error: { message: string } | null }>,
    queue: OfflineQueue,
): Promise<SafeMutationResult<T>> {
    try {
        const { data, error } = await queryFn();
        if (error) {
            return { data, error: error.message ?? String(error), queued: false };
        }
        return { data, error: null, queued: false };
    } catch (e: unknown) {
        if (isNetworkError(e)) {
            await queue.enqueue({ table, operation, payload, filters });
            return { data: null, error: null, queued: true };
        }
        throw e;
    }
}
