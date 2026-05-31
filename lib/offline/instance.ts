import { OfflineQueue } from './queue';

/**
 * App-wide singleton offline queue.
 *
 * This is the single shared queue that both sides use:
 *  - `NetworkContext` constructs its `SyncManager` against it and drains it
 *    when connectivity is restored, and surfaces `pending` to the OfflineBanner.
 *  - lib mutation functions enqueue into it (via `queueMutation` in safeQuery)
 *    when a write fails with a network error.
 *
 * Previously `NetworkContext` created its own `new OfflineQueue()` in a ref,
 * which no lib code could reach — so writes were never queued. Sharing one
 * instance is what makes the offline-first path actually work.
 */
export const offlineQueue = new OfflineQueue();
