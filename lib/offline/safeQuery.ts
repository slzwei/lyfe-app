import type { OfflineQueue, OfflineOperation } from './queue';
import { offlineQueue } from './instance';
import { getCachedUserId } from '../sessionCache';

/**
 * Tables allowed for offline queuing — restrict to prevent arbitrary writes
 * from a tampered AsyncStorage queue. MUST stay in sync with the identical set
 * in sync.ts. Every table here is written via a single-row insert/update/
 * upsert/delete that the SyncManager can faithfully replay (no RPCs, no edge
 * functions, no storage — those are online-only by nature).
 */
const ALLOWED_SYNC_TABLES = new Set([
    'leads',
    'lead_activities',
    'roadshow_activities',
    'roadshow_attendance',
    'roadshow_configs',
    'candidate_module_progress',
    'candidate_module_item_progress',
    'candidate_programme_enrollment',
    'candidate_activities',
    'candidate_paper_attempts',
    'candidate_milestones',
    'candidate_prep_course_bookings',
    'candidates',
    'candidate_profiles',
    'interviews',
    'events',
    'event_attendees',
    'notifications',
    'users',
]);

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

function isNetworkErrorMessage(message: string): boolean {
    const msg = message.toLowerCase();
    return (
        msg.includes('network request failed') ||
        msg.includes('failed to fetch') ||
        msg.includes('fetch failed') ||
        msg.includes('networkerror') ||
        msg.includes('the internet connection appears to be offline') ||
        // supabase-js FunctionsFetchError (and invoke timeouts): the request to
        // an edge function never received an HTTP response — always a transport
        // failure, so treat it as offline/connectivity.
        msg.includes('failed to send a request to the edge function')
    );
}

export function isNetworkError(e: unknown): boolean {
    if (e instanceof TypeError && e.message === 'Network request failed') return true;
    if (e instanceof Error) return isNetworkErrorMessage(e.message);
    return false;
}

/**
 * postgrest-js NEVER rejects on a network failure — the fetch rejection is
 * caught internally and RESOLVED as `{ data: null, error: { message:
 * 'TypeError: Network request failed', ... }, status: 0 }`. So offline
 * detection must classify resolved results, not just thrown errors.
 * `status === 0` means the request never received an HTTP response (a real
 * PostgREST error always carries status >= 400); clients that don't report a
 * status at all (storage-js, auth-js) are classified by message alone.
 * Aborted requests also resolve with status 0 but an 'AbortError: …' message,
 * which the matcher deliberately rejects — an intentional cancel must not be
 * queued for replay.
 */
export function isNetworkErrorResult(error: { message?: string } | null | undefined, status?: number): boolean {
    if (!error?.message) return false;
    if (status !== undefined && status !== 0) return false;
    return isNetworkErrorMessage(error.message);
}

export async function safeQuery<T>(
    queryFn: () => PromiseLike<{ data: T | null; error: { message: string } | null; status?: number }>,
): Promise<SafeQueryResult<T>> {
    const offlineResult: SafeQueryResult<T> = {
        data: null,
        error: 'You are offline. Please check your connection.',
        isOffline: true,
    };
    try {
        const { data, error, status } = await queryFn();
        if (error) {
            if (isNetworkErrorResult(error, status)) return offlineResult;
            return { data, error: error.message ?? String(error), isOffline: false };
        }
        return { data, error: null, isOffline: false };
    } catch (e: unknown) {
        if (isNetworkError(e)) return offlineResult;
        throw e;
    }
}

export async function safeMutation<T>(
    table: string,
    operation: OfflineOperation,
    payload: Record<string, unknown>,
    filters: Record<string, unknown> | undefined,
    queryFn: () => PromiseLike<{ data: T | null; error: { message: string } | null; status?: number }>,
    queue: OfflineQueue,
    onConflict?: string,
): Promise<SafeMutationResult<T>> {
    const enqueueOffline = async (): Promise<SafeMutationResult<T>> => {
        if (!ALLOWED_SYNC_TABLES.has(table)) {
            return { data: null, error: `Table "${table}" is not allowed for offline queuing`, queued: false };
        }
        const item = await queue.enqueue({
            table,
            operation,
            payload,
            filters,
            onConflict,
            userId: getCachedUserId() ?? undefined,
        });
        if (!item) {
            // Queue full — fail loudly rather than pretend the write is saved
            return {
                data: null,
                error: 'Offline queue is full — this change was not saved. Reconnect and try again.',
                queued: false,
            };
        }
        return { data: null, error: null, queued: true };
    };

    try {
        const { data, error, status } = await queryFn();
        if (error) {
            if (isNetworkErrorResult(error, status)) return enqueueOffline();
            return { data, error: error.message ?? String(error), queued: false };
        }
        return { data, error: null, queued: false };
    } catch (e: unknown) {
        if (isNetworkError(e)) return enqueueOffline();
        throw e;
    }
}

/**
 * Singleton-bound convenience wrapper around `safeMutation`. lib mutation
 * functions call this so they don't have to thread the shared offline queue
 * through every signature. On a network failure for an allowlisted table the
 * write is queued and `{ queued: true, error: null }` is returned — callers
 * treat that as success (their optimistic UI persists; the OfflineBanner shows
 * the pending count; the SyncManager replays on reconnect).
 */
export function queueMutation<T>(
    table: string,
    operation: OfflineOperation,
    payload: Record<string, unknown>,
    filters: Record<string, unknown> | undefined,
    queryFn: () => PromiseLike<{ data: T | null; error: { message: string } | null; status?: number }>,
    onConflict?: string,
): Promise<SafeMutationResult<T>> {
    return safeMutation(table, operation, payload, filters, queryFn, offlineQueue, onConflict);
}

/** Friendly message shown when an online-only action (RPC / edge fn / upload) is attempted offline. */
export const OFFLINE_ACTION_MESSAGE = 'This needs an internet connection. Reconnect and try again.';

/**
 * Wrapper for operations that CANNOT be queued offline (server-side RPCs, edge
 * functions, file uploads, auth). Runs the operation; if it fails purely
 * because the device is offline, resolves to a friendly, actionable message
 * instead of a raw "Network request failed" — so these features are accounted
 * for (they fail clearly) rather than throwing an opaque error.
 */
export async function runOnlineOnly<T>(
    queryFn: () => PromiseLike<T>,
): Promise<{ data: T | null; error: string | null; offline: boolean }> {
    try {
        const data = await queryFn();
        // Supabase sub-clients resolve network failures into their `{ error }`
        // envelope rather than throwing — probe the resolved value too.
        const envelope = data as { error?: { message?: string } | null; status?: number } | null;
        if (envelope && typeof envelope === 'object' && isNetworkErrorResult(envelope.error, envelope.status)) {
            return { data: null, error: OFFLINE_ACTION_MESSAGE, offline: true };
        }
        return { data, error: null, offline: false };
    } catch (e: unknown) {
        if (isNetworkError(e)) {
            return { data: null, error: OFFLINE_ACTION_MESSAGE, offline: true };
        }
        throw e;
    }
}

/**
 * Directly enqueue a write for offline sync (stamps the user id, enforces the
 * allowlist). For the rare call sites that can't use `queueMutation` because
 * they need the live error CODE on the online path — e.g. idempotent check-ins
 * that treat a unique-violation as success. Returns false if the table isn't
 * allowlisted or the queue is full (the caller should then surface a normal
 * error instead of pretending the write is saved).
 */
export async function enqueueWrite(
    table: string,
    operation: OfflineOperation,
    payload: Record<string, unknown>,
    filters?: Record<string, unknown>,
    onConflict?: string,
): Promise<boolean> {
    if (!ALLOWED_SYNC_TABLES.has(table)) return false;
    const item = await offlineQueue.enqueue({
        table,
        operation,
        payload,
        filters,
        onConflict,
        userId: getCachedUserId() ?? undefined,
    });
    return item !== null;
}
