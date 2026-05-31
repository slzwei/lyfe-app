/**
 * Offline-first wiring tests.
 *
 * The engine (queue/sync/safeMutation) is unit-tested elsewhere; this file
 * verifies the *integration* that makes offline-first actually work:
 *   - lib mutations go through `queueMutation`, which enqueues into the SHARED
 *     singleton `offlineQueue` (the same one NetworkContext drains) on a
 *     network failure,
 *   - the queued item is stamped with the cached user id,
 *   - upsert `onConflict` is carried so replay dedups correctly,
 *   - non-allowlisted tables are refused (no silent drop),
 *   - online success / real DB errors do NOT queue,
 *   - `enqueueWrite` (used by idempotent check-ins) behaves the same,
 *   - `runOnlineOnly` turns a network failure into a friendly message.
 */
import { queueMutation, enqueueWrite, runOnlineOnly, offlineQueue, OFFLINE_ACTION_MESSAGE } from '@/lib/offline';
import { setCachedSession, clearCachedSession } from '@/lib/sessionCache';

const NET = () => Promise.reject(new TypeError('Network request failed'));

describe('offline-first wiring (queueMutation → shared singleton queue)', () => {
    beforeEach(async () => {
        await offlineQueue.clear();
        clearCachedSession();
    });

    it('queues an allowlisted write on network failure, stamped with the user id', async () => {
        setCachedSession({ access_token: 't', user_id: 'user-1' });
        const res = await queueMutation('leads', 'update', { status: 'contacted' }, { id: 'L1' }, NET);
        expect(res.queued).toBe(true);
        expect(res.error).toBeNull();
        const items = await offlineQueue.getAll();
        expect(items).toHaveLength(1);
        expect(items[0]).toMatchObject({
            table: 'leads',
            operation: 'update',
            payload: { status: 'contacted' },
            filters: { id: 'L1' },
            userId: 'user-1',
        });
    });

    it('carries onConflict for upserts so replay dedups correctly', async () => {
        const row = { candidate_id: 'c1', milestone_code: 'rnf', status: 'issued' };
        const res = await queueMutation(
            'candidate_milestones',
            'upsert',
            row,
            undefined,
            NET,
            'candidate_id,milestone_code',
        );
        expect(res.queued).toBe(true);
        const items = await offlineQueue.getAll();
        expect(items[0].onConflict).toBe('candidate_id,milestone_code');
    });

    it('refuses to queue a non-allowlisted table (fails clearly, no silent drop)', async () => {
        const res = await queueMutation('secret_table', 'update', { x: 1 }, { id: '1' }, NET);
        expect(res.queued).toBe(false);
        expect(res.error).toMatch(/not allowed/i);
        expect(await offlineQueue.size()).toBe(0);
    });

    it('does NOT queue on success — returns the server data', async () => {
        const res = await queueMutation('leads', 'insert', { full_name: 'A' }, undefined, () =>
            Promise.resolve({ data: { id: 'new' }, error: null }),
        );
        expect(res.queued).toBe(false);
        expect(res.data).toEqual({ id: 'new' });
        expect(await offlineQueue.size()).toBe(0);
    });

    it('does NOT queue on a real (non-network) error — surfaces it instead', async () => {
        const res = await queueMutation('leads', 'update', { status: 'x' }, { id: 'L1' }, () =>
            Promise.resolve({ data: null, error: { message: 'permission denied' } }),
        );
        expect(res.queued).toBe(false);
        expect(res.error).toBe('permission denied');
        expect(await offlineQueue.size()).toBe(0);
    });

    it('enqueueWrite stamps the user id and enforces the allowlist', async () => {
        setCachedSession({ access_token: 't', user_id: 'user-2' });
        const ok = await enqueueWrite('roadshow_attendance', 'insert', { event_id: 'e1', user_id: 'user-2' });
        expect(ok).toBe(true);
        const blocked = await enqueueWrite('secret_table', 'insert', { x: 1 });
        expect(blocked).toBe(false);
        const items = await offlineQueue.getAll();
        expect(items).toHaveLength(1);
        expect(items[0].userId).toBe('user-2');
    });

    it('runOnlineOnly converts a network error into a friendly message', async () => {
        const res = await runOnlineOnly(() => Promise.reject(new TypeError('Network request failed')));
        expect(res.offline).toBe(true);
        expect(res.error).toBe(OFFLINE_ACTION_MESSAGE);
        expect(res.data).toBeNull();
    });
});
