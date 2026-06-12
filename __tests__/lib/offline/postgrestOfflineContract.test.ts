/**
 * CONTRACT regression test for audit C1 (offline write queue was dead code).
 *
 * The original bug: postgrest-js NEVER rejects on a network failure — it
 * catches the fetch rejection internally and RESOLVES `{ error, status: 0 }`.
 * Our offline detection assumed it threw, so the enqueue path was unreachable
 * and offline saves were silently lost. Unit tests missed it because their
 * fixtures were hand-written `Promise.reject` mocks the real client never
 * produces.
 *
 * This file closes that gap by driving the REAL installed
 * `@supabase/postgrest-js` (the exact package supabase-js delegates to for
 * .from() queries) through safeQuery / safeMutation / runOnlineOnly, with a
 * fetch that fails exactly like React Native's offline fetch
 * (`TypeError('Network request failed')`). If a future supabase-js upgrade
 * changes the resolve-vs-throw contract — or the resolved shape — in a way
 * our classifier misses, these tests fail BEFORE production silently drops
 * writes again. Do NOT replace the real client here with a hand-rolled mock;
 * the whole point is to pin the library's actual behavior.
 */
import { PostgrestClient } from '@supabase/postgrest-js';
import {
    safeQuery,
    safeMutation,
    runOnlineOnly,
    isNetworkErrorResult,
    OFFLINE_ACTION_MESSAGE,
} from '@/lib/offline/safeQuery';
import { OfflineQueue } from '@/lib/offline/queue';
import AsyncStorage from '@react-native-async-storage/async-storage';

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;

const REST_URL = 'http://localhost:54321/rest/v1';

/** Exactly what React Native's fetch produces with no connectivity. */
const rnOfflineFetch = (() => Promise.reject(new TypeError('Network request failed'))) as unknown as typeof fetch;

/** An aborted request (timeout / manual cancel) — must NOT be treated as offline. */
const abortingFetch = (() =>
    Promise.reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }))) as unknown as typeof fetch;

/** A real PostgREST HTTP error (RLS denial) — must surface, never queue. */
const forbiddenFetch = (() =>
    Promise.resolve({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => JSON.stringify({ message: 'permission denied', code: '42501', details: null, hint: null }),
        headers: { get: () => null },
    })) as unknown as typeof fetch;

function client(fetchImpl: typeof fetch) {
    return new PostgrestClient(REST_URL, { fetch: fetchImpl });
}

describe('postgrest-js offline contract (REAL installed client, no mocks)', () => {
    let queue: OfflineQueue;

    beforeEach(() => {
        jest.clearAllMocks();
        mockGetItem.mockResolvedValue(null);
        mockSetItem.mockResolvedValue(undefined);
        queue = new OfflineQueue();
    });

    it('pins the library behavior: network failures RESOLVE with status 0 and our classifier catches them', async () => {
        // If this await ever REJECTS, postgrest-js went back to throwing —
        // re-check isNetworkError (the thrown path) still covers the app.
        const res = await client(rnOfflineFetch).from('leads').update({ status: 'contacted' }).eq('id', 'L1');

        expect(res.status).toBe(0);
        expect(res.error).not.toBeNull();
        // The load-bearing assertion: whatever shape the installed library
        // resolves, our classifier MUST recognize it as offline.
        expect(isNetworkErrorResult(res.error, res.status)).toBe(true);
    });

    it('safeMutation queues a write that failed through the real client offline', async () => {
        const c = client(rnOfflineFetch);
        const result = await safeMutation(
            'leads',
            'update',
            { status: 'contacted' },
            { id: 'L1' },
            () => c.from('leads').update({ status: 'contacted' }).eq('id', 'L1'),
            queue,
        );

        expect(result.queued).toBe(true);
        expect(result.error).toBeNull();
        expect(await queue.size()).toBe(1);
    });

    it('safeQuery reports offline for a read that failed through the real client', async () => {
        const res = await safeQuery(() => client(rnOfflineFetch).from('leads').select('*'));

        expect(res.isOffline).toBe(true);
        expect(res.data).toBeNull();
    });

    it('runOnlineOnly returns the friendly offline message through the real client', async () => {
        const res = await runOnlineOnly(() =>
            client(rnOfflineFetch).from('leads').insert({ full_name: 'A' }).select().single(),
        );

        expect(res.offline).toBe(true);
        expect(res.error).toBe(OFFLINE_ACTION_MESSAGE);
        expect(res.data).toBeNull();
    });

    it('does NOT queue an aborted request resolved by the real client', async () => {
        const c = client(abortingFetch);
        const result = await safeMutation(
            'leads',
            'update',
            { status: 'contacted' },
            { id: 'L1' },
            () => c.from('leads').update({ status: 'contacted' }).eq('id', 'L1'),
            queue,
        );

        expect(result.queued).toBe(false);
        expect(result.error).toMatch(/abort/i);
        expect(await queue.size()).toBe(0);
    });

    it('does NOT queue a real PostgREST HTTP error (403) resolved by the real client', async () => {
        const c = client(forbiddenFetch);
        const result = await safeMutation(
            'leads',
            'update',
            { status: 'contacted' },
            { id: 'L1' },
            () => c.from('leads').update({ status: 'contacted' }).eq('id', 'L1'),
            queue,
        );

        expect(result.queued).toBe(false);
        expect(result.error).toBe('permission denied');
        expect(await queue.size()).toBe(0);
    });
});
