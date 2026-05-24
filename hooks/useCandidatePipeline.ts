/**
 * useCandidatePipeline — shared fetch/state for the pipeline-sorted candidate list.
 *
 * Extracted so both the Candidates tab (list view) and the Home tab (condensed
 * mini-sections) can drive off the same data without duplicating fetch logic,
 * realtime subscriptions, or error handling. Each consumer decides its own
 * rendering (card list vs 2-row preview).
 *
 * Returns:
 *   - rows:     candidates with computed NextStep attached
 *   - counts:   number of candidates per urgency bucket
 *   - isLoading / isRefreshing / error
 *   - refresh:  manual refetch (for pull-to-refresh)
 *
 * Realtime: subscribes to candidate-table changes via useCandidateRealtime.
 * Any DB-side change re-triggers the bulk fetch automatically.
 */
import { useAuth } from '@/contexts/AuthContext';
import { useCandidateRealtime } from '@/hooks/useCandidateRealtime';
import { pipelineAnalytics } from '@/lib/analytics';
import { type CandidateArchiveMode } from '@/lib/recruitment/candidates';
import { fetchPipelineSnapshot, type PipelineSnapshot } from '@/lib/recruitment/pipelineFetch';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

export interface UseCandidatePipelineOptions {
    /** Pass-through for the manager-scoped fetch variant. */
    isManagerView?: boolean;
    /** If false, skips fetching altogether (for roles that shouldn't see the pipeline). */
    enabled?: boolean;
    /**
     * Optional manager IDs to scope the fetch to (for PAs bound via
     * pa_manager_assignments). When supplied, overrides the manager/self default
     * in fetchCandidates.
     */
    managerScope?: string[];
    /** Archive scope for the fetch. Defaults to 'active' (excludes archived). */
    archiveMode?: CandidateArchiveMode;
}

export interface UseCandidatePipelineResult {
    rows: PipelineSnapshot['rows'];
    counts: PipelineSnapshot['counts'];
    isLoading: boolean;
    isRefreshing: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

const EMPTY_COUNTS: PipelineSnapshot['counts'] = {
    'at-risk': 0,
    'this-week': 0,
    ready: 0,
    'on-track': 0,
    hidden: 0,
};

export function useCandidatePipeline({
    isManagerView = false,
    enabled = true,
    managerScope,
    archiveMode = 'active',
}: UseCandidatePipelineOptions = {}): UseCandidatePipelineResult {
    const { user } = useAuth();
    const [rows, setRows] = useState<PipelineSnapshot['rows']>([]);
    const [counts, setCounts] = useState<PipelineSnapshot['counts']>(EMPTY_COUNTS);
    const [isLoading, setIsLoading] = useState(enabled);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Memoize the scope by joining IDs so callers can pass a fresh array each
    // render without thrashing the load callback's dependency list.
    const managerScopeKey = managerScope?.slice().sort().join(',');

    const load = useCallback(async () => {
        if (!enabled || !user?.id) {
            setIsLoading(false);
            return;
        }
        setError(null);
        const t0 = Date.now();
        const snap = await fetchPipelineSnapshot(user.id, isManagerView, new Date(), managerScope, archiveMode);
        if (snap.error) setError(snap.error);
        setRows(snap.rows);
        setCounts(snap.counts);
        setIsLoading(false);
        pipelineAnalytics.snapshotLoaded(snap.counts, Date.now() - t0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, isManagerView, enabled, managerScopeKey, archiveMode]);

    useFocusEffect(
        useCallback(() => {
            // Defer to next tick so synchronous setState calls in `load`
            // (setError(null), setIsLoading(false)) never fire during render.
            // The jest mock for useFocusEffect calls the callback synchronously,
            // and setState-during-render trips React's "too many re-renders" guard.
            const id = setTimeout(load, 0);
            return () => clearTimeout(id);
        }, [load]),
    );

    // Realtime — re-fetch on any candidate-pipeline DB change.
    useCandidateRealtime(load);

    const refresh = useCallback(async () => {
        if (!enabled) return;
        setIsRefreshing(true);
        await load();
        setIsRefreshing(false);
    }, [load, enabled]);

    return { rows, counts, isLoading, isRefreshing, error, refresh };
}
