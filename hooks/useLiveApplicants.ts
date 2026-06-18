import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    fetchLiveProgress,
    fetchLiveScopeMap,
    fetchTodaysOnboarding,
    LIVE_PROGRESS_CHANNEL,
    LIVE_PROGRESS_EVENT,
    resolveLiveScope,
    type LiveProgress,
    type LiveProgressPayload,
    type LiveState,
    type ScopeCandidate,
    type TodayCandidate,
} from '@/lib/recruitment/liveApplicants';

/** A live phase (never 'signed-out' — that removes the applicant). */
export type LivePhase = Exclude<LiveState, 'signed-out'>;

export interface LiveApplicant {
    userId: string;
    candidateId: string;
    name: string;
    state: LivePhase;
    /** Precise counts (v2). Undefined until the progress RPC resolves. */
    progress?: LiveProgress;
}

/** Drop a live applicant after this long with no further event (tab closed, idle). */
const STALE_MS = 180_000;
/** Bound how often an unknown userId can trigger a scope refetch (public channel). */
const SCOPE_REFRESH_THROTTLE_MS = 20_000;
/** Coalesce per-answer bursts into one progress fetch. */
const PROGRESS_DEBOUNCE_MS = 400;
/** Cap pending unresolved events so channel spam can't grow memory. */
const MAX_PENDING = 50;

const PHASE_ORDER: Record<LivePhase, number> = { 'viewing-results': 0, quiz: 1, form: 2 };

/**
 * Subscribes to lyfe-sg's `candidate-progress` broadcast and surfaces only the
 * live applicants the current staff member is authorized to see (see
 * lib/recruitment/liveApplicants — access scope + RLS). Ephemeral by design:
 * an applicant appears on their first event and is dropped on sign-out or after
 * STALE_MS of silence. Intended to be mounted only behind the privileged
 * dashboard gate, so non-privileged users never open the subscription.
 */
export function useLiveApplicants(): {
    applicants: LiveApplicant[];
    /** Today's started-but-unfinished candidates (DB-backed; persists without a live tick). */
    inProgressToday: LiveApplicant[];
    todaysOnboarded: TodayCandidate[];
    connected: boolean;
} {
    const { user } = useAuth();
    const userId = user?.id;
    const role = user?.role;

    const [states, setStates] = useState<Record<string, LivePhase>>({});
    const [connected, setConnected] = useState(false);
    const [progress, setProgress] = useState<Record<string, LiveProgress>>({});
    const [todaysOnboarded, setTodaysOnboarded] = useState<TodayCandidate[]>([]);
    const [inProgressToday, setInProgressToday] = useState<LiveApplicant[]>([]);
    // Bumped on every accepted broadcast event so the progress RPC re-runs even
    // when the phase string is unchanged (each quiz answer re-broadcasts "quiz").
    const [progressTick, setProgressTick] = useState(0);

    const scopeMapRef = useRef<Map<string, ScopeCandidate>>(new Map());
    const pendingRef = useRef<Map<string, LiveState>>(new Map());
    const staleTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    const lastScopeFetchRef = useRef(0);
    const retryCountRef = useRef(0);
    const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    useEffect(() => {
        if (!userId || !role) return;
        let cancelled = false;
        let channel: ReturnType<typeof supabase.channel> | null = null;
        // Capture the stable ref Maps once so the cleanup closure references the
        // same instances (satisfies react-hooks/exhaustive-deps for ref cleanup).
        const timers = staleTimers.current;
        const pending = pendingRef.current;

        const clearStale = (uid: string) => {
            const t = timers.get(uid);
            if (t) clearTimeout(t);
            timers.delete(uid);
        };

        const remove = (uid: string) => {
            clearStale(uid);
            setStates((prev) => {
                if (!(uid in prev)) return prev;
                const next = { ...prev };
                delete next[uid];
                return next;
            });
        };

        const scheduleStale = (uid: string) => {
            clearStale(uid);
            timers.set(
                uid,
                setTimeout(() => remove(uid), STALE_MS),
            );
        };

        const applyState = (uid: string, state: LiveState) => {
            if (state === 'signed-out') {
                remove(uid);
                return;
            }
            setStates((prev) => (prev[uid] === state ? prev : { ...prev, [uid]: state }));
            scheduleStale(uid);
            // Refetch counts on every answer, not just on phase changes — otherwise
            // quiz_answered freezes at its first value (0) for the whole quiz.
            setProgressTick((n) => n + 1);
        };

        // Apply any events that arrived before their candidate was in scope.
        const drainPending = () => {
            for (const [uid, state] of pending) {
                if (scopeMapRef.current.has(uid)) {
                    applyState(uid, state);
                    pending.delete(uid);
                }
            }
        };

        const refreshScope = async (force = false) => {
            const now = Date.now();
            if (!force && now - lastScopeFetchRef.current < SCOPE_REFRESH_THROTTLE_MS) return;
            lastScopeFetchRef.current = now;
            const scope = await resolveLiveScope(userId, role);
            if (cancelled) return;
            scopeMapRef.current = await fetchLiveScopeMap(scope);
            if (cancelled) return;
            // Prune live states no longer in scope, then apply any pending events.
            setStates((prev) => {
                let changed = false;
                const next: Record<string, LivePhase> = {};
                for (const [uid, st] of Object.entries(prev)) {
                    if (scopeMapRef.current.has(uid)) next[uid] = st;
                    else changed = true;
                }
                return changed ? next : prev;
            });
            drainPending();
        };

        const handlePayload = (payload: LiveProgressPayload | undefined) => {
            const uid = payload?.userId;
            const state = payload?.state;
            if (!uid || !state) return;
            if (scopeMapRef.current.has(uid)) {
                applyState(uid, state);
                return;
            }
            // Unknown user — maybe a brand-new applicant. Stash (capped) and
            // trigger a throttled refetch; drainPending() applies it if authorized.
            if (state !== 'signed-out' && pending.size < MAX_PENDING) {
                pending.set(uid, state);
            }
            void refreshScope();
        };

        const subscribe = () => {
            channel = supabase
                .channel(LIVE_PROGRESS_CHANNEL)
                .on('broadcast', { event: LIVE_PROGRESS_EVENT }, (msg) =>
                    handlePayload(msg.payload as LiveProgressPayload),
                )
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        retryCountRef.current = 0;
                        setConnected(true);
                        void refreshScope(); // reconcile on (re)connect — broadcast has no replay
                    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                        setConnected(false);
                        const delay = Math.min(1000 * 2 ** retryCountRef.current, 30000);
                        retryCountRef.current++;
                        if (__DEV__) console.warn(`[useLiveApplicants] ${status}, reconnecting in ${delay}ms`);
                        const errored = channel;
                        retryTimeoutRef.current = setTimeout(() => {
                            if (errored) supabase.removeChannel(errored);
                            subscribe();
                        }, delay);
                    } else if (status === 'CLOSED') {
                        setConnected(false);
                    }
                });
        };

        void refreshScope(true);
        subscribe();

        return () => {
            cancelled = true;
            clearTimeout(retryTimeoutRef.current);
            timers.forEach((t) => clearTimeout(t));
            timers.clear();
            pending.clear();
            if (channel) supabase.removeChannel(channel);
        };
    }, [userId, role]);

    // v2: fetch precise counts for the current live applicants (debounced).
    // Keyed on `states` (the live user_id set); coalesces per-answer bursts into
    // one RPC call. Fails soft — leaves the coarse phase bar in place on error.
    useEffect(() => {
        const liveIds = Object.keys(states);
        if (liveIds.length === 0) {
            setProgress((prev) => (Object.keys(prev).length === 0 ? prev : {}));
            return;
        }
        let cancelled = false;
        const t = setTimeout(async () => {
            const fresh = await fetchLiveProgress(liveIds);
            if (cancelled) return;
            setProgress((prev) => {
                const next: Record<string, LiveProgress> = {};
                for (const id of liveIds) {
                    const v = fresh.get(id) ?? prev[id]; // keep last-known if a refetch missed one
                    if (v) next[id] = v;
                }
                return next;
            });
        }, PROGRESS_DEBOUNCE_MS);
        return () => {
            cancelled = true;
            clearTimeout(t);
        };
    }, [states, progressTick]);

    // Today's onboarding cohort (DB-backed, persistent — not ephemeral): both the
    // in-progress and the finished candidates invited today. This is what makes
    // the card survive a cold open / missed broadcast — a candidate mid-form/quiz
    // shows from the DB even if no live tick is arriving. Refreshed on mount, on
    // each live-phase change (a tick may have just moved someone in/out of these
    // sets), and on a 45s heartbeat.
    useEffect(() => {
        if (!userId || !role) return;
        let cancelled = false;
        const load = async () => {
            const { inProgress, completed } = await fetchTodaysOnboarding();
            if (cancelled) return;
            setInProgressToday(inProgress);
            setTodaysOnboarded(completed);
        };
        void load();
        const iv = setInterval(() => void load(), 45_000);
        return () => {
            cancelled = true;
            clearInterval(iv);
        };
    }, [userId, role, states]);

    const applicants = useMemo<LiveApplicant[]>(() => {
        const list: LiveApplicant[] = [];
        for (const [uid, state] of Object.entries(states)) {
            const candidate = scopeMapRef.current.get(uid);
            if (!candidate) continue;
            list.push({
                userId: uid,
                candidateId: candidate.candidateId,
                name: candidate.name,
                state,
                progress: progress[uid],
            });
        }
        list.sort((a, b) => {
            const pa = PHASE_ORDER[a.state] ?? 9;
            const pb = PHASE_ORDER[b.state] ?? 9;
            if (pa !== pb) return pa - pb;
            return a.name.localeCompare(b.name);
        });
        return list;
    }, [states, progress]);

    return { applicants, inProgressToday, todaysOnboarded, connected };
}
