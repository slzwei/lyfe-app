/**
 * Access-scope tests for lib/recruitment/liveApplicants.
 *
 * This is the security-critical surface: it decides which candidates a staff
 * member may see "live". Everything must fail CLOSED on error and never grant
 * global visibility to a non-privileged role.
 */
import { fetchLiveScopeMap, resolveLiveScope } from '@/lib/recruitment/liveApplicants';

// Per-table canned results for a thenable query-builder mock.
const mockResults: Record<string, { data: unknown; error: unknown }> = {};

jest.mock('@/lib/supabase', () => {
    const makeBuilder = (table: string) => {
        const b: Record<string, unknown> = {
            select: () => b,
            eq: () => b,
            in: () => b,
            is: () => b,
            not: () => b,
            // Thenable so `await builder` resolves the canned result for `table`.
            then: (resolve: (v: unknown) => void) => resolve(mockResults[table] ?? { data: [], error: null }),
        };
        return b;
    };
    return { supabase: { from: jest.fn((t: string) => makeBuilder(t)) } };
});

beforeEach(() => {
    for (const k of Object.keys(mockResults)) delete mockResults[k];
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
