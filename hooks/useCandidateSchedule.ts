/**
 * useCandidateSchedule — the current candidate's upcoming personal agenda.
 *
 * Wraps fetchMyCandidateSchedule (the get_my_candidate_schedule RPC). Only the
 * signed-in candidate ever sees rows; staff callers get an empty list from the
 * RPC, so `enabled` is just an optimisation to skip the round-trip for non-
 * candidates on the shared home screen.
 */
import { useCallback, useEffect, useState } from 'react';
import { fetchMyCandidateSchedule, type CandidateScheduleItem } from '@/lib/recruitment/schedule';

interface Options {
    /** Skip fetching entirely (e.g. viewer is not a candidate). Default true. */
    enabled?: boolean;
    /** Cap rows for the home card; null = full agenda. Default null. */
    limit?: number | null;
    /** Include past items too. Default false (upcoming only). */
    includePast?: boolean;
}

interface Result {
    items: CandidateScheduleItem[];
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

export function useCandidateSchedule(opts?: Options): Result {
    const enabled = opts?.enabled ?? true;
    const limit = opts?.limit ?? null;
    const includePast = opts?.includePast ?? false;

    const [items, setItems] = useState<CandidateScheduleItem[]>([]);
    const [isLoading, setIsLoading] = useState(enabled);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!enabled) {
            setItems([]);
            setError(null);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        const { data, error: err } = await fetchMyCandidateSchedule({ limit, includePast });
        setItems(data);
        setError(err);
        setIsLoading(false);
    }, [enabled, limit, includePast]);

    useEffect(() => {
        load();
    }, [load]);

    return { items, isLoading, error, refresh: load };
}
