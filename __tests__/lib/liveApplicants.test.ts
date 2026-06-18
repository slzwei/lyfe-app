/**
 * Access-scope tests for lib/recruitment/liveApplicants.
 *
 * This is the security-critical surface: it decides which candidates a staff
 * member may see "live". Everything must fail CLOSED on error and never grant
 * global visibility to a non-privileged role.
 */
import {
    fetchLiveProgress,
    fetchLiveScopeMap,
    fetchTodaysOnboarded,
    fetchTodaysOnboarding,
    resolveLiveScope,
} from '@/lib/recruitment/liveApplicants';

// Per-table canned results for a thenable query-builder mock.
const mockResults: Record<string, { data: unknown; error: unknown }> = {};
// Canned result for supabase.rpc (the v2 progress RPC).
const mockRpc: { value: { data: unknown; error: unknown } } = { value: { data: [], error: null } };

jest.mock('@/lib/supabase', () => {
    const makeBuilder = (table: string) => {
        const b: Record<string, unknown> = {
            select: () => b,
            eq: () => b,
            in: () => b,
            is: () => b,
            not: () => b,
            gte: () => b,
            // Thenable so `await builder` resolves the canned result for `table`.
            then: (resolve: (v: unknown) => void) => resolve(mockResults[table] ?? { data: [], error: null }),
        };
        return b;
    };
    return {
        supabase: {
            from: jest.fn((t: string) => makeBuilder(t)),
            rpc: jest.fn((_fn: string, _args: unknown) => Promise.resolve(mockRpc.value)),
        },
    };
});

beforeEach(() => {
    for (const k of Object.keys(mockResults)) delete mockResults[k];
    mockRpc.value = { data: [], error: null };
});

describe('resolveLiveScope', () => {
    it('admin and ro see everything (global)', async () => {
        expect(await resolveLiveScope('u1', 'admin')).toEqual({ all: true });
        expect(await resolveLiveScope('u1', 'ro')).toEqual({ all: true });
    });

    it('a manager sees only candidates assigned to themselves', async () => {
        expect(await resolveLiveScope('mgr1', 'manager')).toEqual({
            all: false,
            managerIds: new Set(['mgr1']),
        });
    });

    it('a director sees self + their direct-report managers', async () => {
        mockResults.users = { data: [{ id: 'mgrA' }, { id: 'mgrB' }], error: null };
        expect(await resolveLiveScope('dir1', 'director')).toEqual({
            all: false,
            managerIds: new Set(['dir1', 'mgrA', 'mgrB']),
        });
    });

    it('a director fails closed to self-only when the reports lookup errors', async () => {
        mockResults.users = { data: null, error: { message: 'boom' } };
        expect(await resolveLiveScope('dir1', 'director')).toEqual({
            all: false,
            managerIds: new Set(['dir1']),
        });
    });

    it('an unrecognised role never gets global visibility', async () => {
        expect(await resolveLiveScope('x1', 'agent')).toEqual({
            all: false,
            managerIds: new Set(['x1']),
        });
    });
});

describe('fetchLiveScopeMap', () => {
    const candidate = (id: string, name: string | null, mgr: string) => ({
        id,
        name,
        assigned_manager_id: mgr,
        status: 'applied',
        archived_at: null,
    });

    it('keys authorized candidates by their auth user_id', async () => {
        mockResults.candidates = {
            data: [candidate('c1', 'Jolene Tan', 'mgr1'), candidate('c2', 'Marcus Lim', 'mgr1')],
            error: null,
        };
        mockResults.candidate_profiles = {
            data: [
                { user_id: 'auth-1', candidate_id: 'c1' },
                { user_id: 'auth-2', candidate_id: 'c2' },
            ],
            error: null,
        };
        const map = await fetchLiveScopeMap({ all: false, managerIds: new Set(['mgr1']) });
        expect(map.size).toBe(2);
        expect(map.get('auth-1')).toEqual({ userId: 'auth-1', candidateId: 'c1', name: 'Jolene Tan' });
        expect(map.get('auth-2')?.candidateId).toBe('c2');
    });

    it('returns empty for an empty manager scope without querying', async () => {
        const { supabase } = jest.requireMock('@/lib/supabase') as { supabase: { from: jest.Mock } };
        supabase.from.mockClear();
        const map = await fetchLiveScopeMap({ all: false, managerIds: new Set() });
        expect(map.size).toBe(0);
        expect(supabase.from).not.toHaveBeenCalled();
    });

    it('fails closed (empty) when the candidates query errors', async () => {
        mockResults.candidates = { data: null, error: { message: 'rls denied' } };
        const map = await fetchLiveScopeMap({ all: true });
        expect(map.size).toBe(0);
    });

    it('fails closed (empty) when the profiles query errors', async () => {
        mockResults.candidates = { data: [candidate('c1', 'A', 'm')], error: null };
        mockResults.candidate_profiles = { data: null, error: { message: 'boom' } };
        const map = await fetchLiveScopeMap({ all: true });
        expect(map.size).toBe(0);
    });

    it('defaults a null name to "Applicant" and skips rows with no user_id', async () => {
        mockResults.candidates = {
            data: [candidate('c1', null, 'm'), candidate('c2', 'B', 'm')],
            error: null,
        };
        mockResults.candidate_profiles = {
            data: [
                { user_id: 'a1', candidate_id: 'c1' },
                { user_id: null, candidate_id: 'c2' },
            ],
            error: null,
        };
        const map = await fetchLiveScopeMap({ all: true });
        expect(map.get('a1')?.name).toBe('Applicant');
        expect(map.size).toBe(1);
    });
});

describe('fetchLiveProgress', () => {
    it('returns empty without calling the RPC for no user ids', async () => {
        const { supabase } = jest.requireMock('@/lib/supabase') as { supabase: { rpc: jest.Mock } };
        supabase.rpc.mockClear();
        const map = await fetchLiveProgress([]);
        expect(map.size).toBe(0);
        expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it('maps RPC rows into a per-user progress map', async () => {
        mockRpc.value = {
            data: [
                {
                    user_id: 'a1',
                    onboarding_step: 6,
                    profile_completed: true,
                    quiz_answered: 24,
                    quiz_completed: false,
                },
                {
                    user_id: 'a2',
                    onboarding_step: 3,
                    profile_completed: false,
                    quiz_answered: 0,
                    quiz_completed: false,
                },
            ],
            error: null,
        };
        const map = await fetchLiveProgress(['a1', 'a2']);
        expect(map.get('a1')).toEqual({
            onboardingStep: 6,
            profileCompleted: true,
            quizAnswered: 24,
            quizCompleted: false,
        });
        expect(map.get('a2')?.quizAnswered).toBe(0);
    });

    it('passes the user ids to the RPC as p_user_ids', async () => {
        const { supabase } = jest.requireMock('@/lib/supabase') as { supabase: { rpc: jest.Mock } };
        supabase.rpc.mockClear();
        await fetchLiveProgress(['x', 'y']);
        expect(supabase.rpc).toHaveBeenCalledWith('get_candidates_live_progress', { p_user_ids: ['x', 'y'] });
    });

    it('fails soft (empty map) on RPC error', async () => {
        mockRpc.value = { data: null, error: { message: 'denied' } };
        const map = await fetchLiveProgress(['a1']);
        expect(map.size).toBe(0);
    });

    it('coerces null fields to safe defaults', async () => {
        mockRpc.value = {
            data: [
                {
                    user_id: 'a1',
                    onboarding_step: null,
                    profile_completed: null,
                    quiz_answered: null,
                    quiz_completed: null,
                },
            ],
            error: null,
        };
        const map = await fetchLiveProgress(['a1']);
        expect(map.get('a1')).toEqual({
            onboardingStep: 1,
            profileCompleted: false,
            quizAnswered: 0,
            quizCompleted: false,
        });
    });
});

describe('fetchTodaysOnboarded', () => {
    it("returns today's candidates who finished the quiz (and skips unfinished)", async () => {
        mockResults.candidates = {
            data: [
                { id: 'c1', name: 'Aisha Rahman', created_at: '2026-06-17T01:00:00Z', archived_at: null },
                { id: 'c2', name: 'Ben Tan', created_at: '2026-06-17T02:00:00Z', archived_at: null },
            ],
            error: null,
        };
        mockResults.candidate_profiles = {
            data: [
                { user_id: 'u1', candidate_id: 'c1' },
                { user_id: 'u2', candidate_id: 'c2' },
            ],
            error: null,
        };
        mockRpc.value = {
            data: [
                { user_id: 'u1', onboarding_step: 6, profile_completed: true, quiz_answered: 36, quiz_completed: true },
                { user_id: 'u2', onboarding_step: 6, profile_completed: true, quiz_answered: 9, quiz_completed: false },
            ],
            error: null,
        };
        const res = await fetchTodaysOnboarded();
        expect(res).toEqual([{ userId: 'u1', candidateId: 'c1', name: 'Aisha Rahman' }]);
    });

    it('returns [] when nobody was invited today', async () => {
        mockResults.candidates = { data: [], error: null };
        expect(await fetchTodaysOnboarded()).toHaveLength(0);
    });

    it('fails soft ([]) when the candidates query errors', async () => {
        mockResults.candidates = { data: null, error: { message: 'rls' } };
        expect(await fetchTodaysOnboarded()).toHaveLength(0);
    });
});

describe('fetchTodaysOnboarding', () => {
    it('splits today into completed (quiz done) and in-progress (started, not done)', async () => {
        mockResults.candidates = {
            data: [
                { id: 'c1', name: 'Aisha Rahman', created_at: '2026-06-17T01:00:00Z', archived_at: null },
                { id: 'c2', name: 'Ben Tan', created_at: '2026-06-17T02:00:00Z', archived_at: null },
                { id: 'c3', name: 'Chong Wei', created_at: '2026-06-17T03:00:00Z', archived_at: null },
                { id: 'c4', name: 'Devi Menon', created_at: '2026-06-17T04:00:00Z', archived_at: null },
            ],
            error: null,
        };
        mockResults.candidate_profiles = {
            data: [
                { user_id: 'u1', candidate_id: 'c1' }, // quiz done       → completed
                { user_id: 'u2', candidate_id: 'c2' }, // mid-form        → in-progress (form)
                { user_id: 'u3', candidate_id: 'c3' }, // mid-quiz        → in-progress (quiz)
                { user_id: 'u4', candidate_id: 'c4' }, // untouched step 1 → excluded
            ],
            error: null,
        };
        mockRpc.value = {
            data: [
                { user_id: 'u1', onboarding_step: 6, profile_completed: true, quiz_answered: 36, quiz_completed: true },
                {
                    user_id: 'u2',
                    onboarding_step: 3,
                    profile_completed: false,
                    quiz_answered: 0,
                    quiz_completed: false,
                },
                {
                    user_id: 'u3',
                    onboarding_step: 6,
                    profile_completed: true,
                    quiz_answered: 12,
                    quiz_completed: false,
                },
                {
                    user_id: 'u4',
                    onboarding_step: 1,
                    profile_completed: false,
                    quiz_answered: 0,
                    quiz_completed: false,
                },
            ],
            error: null,
        };

        const { inProgress, completed } = await fetchTodaysOnboarding();

        expect(completed).toEqual([{ userId: 'u1', candidateId: 'c1', name: 'Aisha Rahman' }]);
        // u3 (quiz) sorts ahead of u2 (form); u4 excluded as untouched.
        expect(inProgress.map((a) => ({ userId: a.userId, state: a.state }))).toEqual([
            { userId: 'u3', state: 'quiz' },
            { userId: 'u2', state: 'form' },
        ]);
        // Last-known counts ride along so the card can draw a real phase bar offline.
        expect(inProgress.find((a) => a.userId === 'u2')?.progress.onboardingStep).toBe(3);
        expect(inProgress.find((a) => a.userId === 'u3')?.progress.quizAnswered).toBe(12);
    });

    it('treats a finished-form / not-yet-answered candidate as on the quiz', async () => {
        mockResults.candidates = {
            data: [{ id: 'c1', name: 'Priya Selvaraj', created_at: '2026-06-17T01:00:00Z', archived_at: null }],
            error: null,
        };
        mockResults.candidate_profiles = { data: [{ user_id: 'u1', candidate_id: 'c1' }], error: null };
        mockRpc.value = {
            data: [
                { user_id: 'u1', onboarding_step: 6, profile_completed: true, quiz_answered: 0, quiz_completed: false },
            ],
            error: null,
        };
        const { inProgress } = await fetchTodaysOnboarding();
        expect(inProgress).toHaveLength(1);
        expect(inProgress[0].state).toBe('quiz');
    });

    it('fails soft (empty buckets) when the candidates query errors', async () => {
        mockResults.candidates = { data: null, error: { message: 'rls' } };
        expect(await fetchTodaysOnboarding()).toEqual({ inProgress: [], completed: [] });
    });
});
