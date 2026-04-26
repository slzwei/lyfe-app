/**
 * Tests for lib/recruitment.ts — Candidate & Interview service functions
 */
import { supabase } from '@/lib/supabase';

import {
    fetchCandidates,
    fetchCandidate,
    createCandidate,
    updateCandidateStatus,
    rejectCandidate,
    activateAgent,
    addCandidateActivity,
    fetchAssignableManagers,
    reassignCandidate,
    scheduleInterview,
    updateInterview,
    deleteInterview,
    fetchCandidateDocuments,
    uploadCandidateDocument,
    deleteCandidateDocument,
    fetchPAManagerIds,
    fetchPAManagers,
    fetchPACandidateCount,
    fetchPAInterviewCount,
} from '@/lib/recruitment';
import { uploadCandidateResume, fetchCandidateStatusCounts } from '@/lib/recruitment/candidates';

jest.mock('@/lib/supabase');

// Mock global fetch for syncAgentToMKTR and file uploads
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

const mockSupa = supabase as any;

function mockResolve(chain: any, value: any) {
    chain.__resolveWith(value);
}

// ── Fixtures ──

const CANDIDATE_ROW = {
    id: 'cand-1',
    name: 'Jane Smith',
    phone: '+6598765432',
    email: 'jane@example.com',
    status: 'applied',
    assigned_manager_id: 'mgr-1',
    created_by_id: 'mgr-1',
    invite_token: 'inv_abc123',
    notes: 'Promising candidate',
    resume_url: null,
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-05T00:00:00Z',
};

const INTERVIEW_ROW = {
    id: 'iv-1',
    candidate_id: 'cand-1',
    manager_id: 'mgr-1',
    scheduled_by_id: 'mgr-1',
    round_number: 1,
    type: 'zoom',
    datetime: '2026-03-20T14:00:00Z',
    location: null,
    zoom_link: 'https://zoom.us/123',
    notes: null,
    status: 'scheduled',
};

beforeEach(() => {
    mockSupa.__resetChains();
    jest.clearAllMocks();
    mockFetch.mockReset();
});

// ── fetchCandidates ──

describe('fetchCandidates', () => {
    it('returns candidates with manager names and interviews', async () => {
        const candidatesChain = mockSupa.__getChain('candidates');
        mockResolve(candidatesChain, { data: [CANDIDATE_ROW], error: null });

        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, { data: [{ id: 'mgr-1', full_name: 'Manager Alice' }], error: null });

        const interviewsChain = mockSupa.__getChain('interviews');
        mockResolve(interviewsChain, { data: [INTERVIEW_ROW], error: null });

        const result = await fetchCandidates('mgr-1', true);
        expect(result.error).toBeNull();
        expect(result.data).toHaveLength(1);
        expect(result.data[0].assigned_manager_name).toBe('Manager Alice');
        expect(result.data[0].interviews).toHaveLength(1);
    });

    it('handles empty candidates list', async () => {
        const chain = mockSupa.__getChain('candidates');
        mockResolve(chain, { data: [], error: null });

        const result = await fetchCandidates('mgr-1', true);
        expect(result.data).toEqual([]);
    });

    it('returns error on query failure', async () => {
        const chain = mockSupa.__getChain('candidates');
        mockResolve(chain, { data: null, error: { message: 'Query timeout' } });

        const result = await fetchCandidates('mgr-1', false);
        expect(result.error).toBe('Query timeout');
        expect(result.data).toEqual([]);
    });

    it('returns hasMore=false when page not provided (backward compat)', async () => {
        const candidatesChain = mockSupa.__getChain('candidates');
        mockResolve(candidatesChain, { data: [CANDIDATE_ROW], error: null });

        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, { data: [{ id: 'mgr-1', full_name: 'Manager Alice' }], error: null });

        const interviewsChain = mockSupa.__getChain('interviews');
        mockResolve(interviewsChain, { data: [], error: null });

        const result = await fetchCandidates('mgr-1', true);
        expect(result.hasMore).toBe(false);
        expect(result.data).toHaveLength(1);
    });

    it('returns hasMore=true when more data exists with pagination', async () => {
        const rows = Array.from({ length: 3 }, (_, i) => ({
            ...CANDIDATE_ROW,
            id: `cand-${i}`,
            assigned_manager_id: 'mgr-1',
        }));
        const candidatesChain = mockSupa.__getChain('candidates');
        mockResolve(candidatesChain, { data: rows, error: null });

        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, { data: [{ id: 'mgr-1', full_name: 'Manager Alice' }], error: null });

        const interviewsChain = mockSupa.__getChain('interviews');
        mockResolve(interviewsChain, { data: [], error: null });

        const result = await fetchCandidates('mgr-1', true, 0, 2);
        expect(result.hasMore).toBe(true);
        expect(result.data).toHaveLength(2);
    });

    it('returns hasMore=false on last page', async () => {
        const rows = [{ ...CANDIDATE_ROW, id: 'cand-0', assigned_manager_id: 'mgr-1' }];
        const candidatesChain = mockSupa.__getChain('candidates');
        mockResolve(candidatesChain, { data: rows, error: null });

        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, { data: [{ id: 'mgr-1', full_name: 'Manager Alice' }], error: null });

        const interviewsChain = mockSupa.__getChain('interviews');
        mockResolve(interviewsChain, { data: [], error: null });

        const result = await fetchCandidates('mgr-1', true, 1, 2);
        expect(result.hasMore).toBe(false);
        expect(result.data).toHaveLength(1);
    });

    it('defaults manager name to unavailable when not found', async () => {
        const candidatesChain = mockSupa.__getChain('candidates');
        mockResolve(candidatesChain, { data: [{ ...CANDIDATE_ROW, assigned_manager_id: 'unknown-mgr' }], error: null });

        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, { data: [], error: null });

        const interviewsChain = mockSupa.__getChain('interviews');
        mockResolve(interviewsChain, { data: [], error: null });

        const result = await fetchCandidates('unknown-mgr', false);
        expect(result.data[0].assigned_manager_name).toBe('Manager unavailable');
    });

    it('filters unassigned candidates out of the bulk manager lookup', async () => {
        const candidatesChain = mockSupa.__getChain('candidates');
        mockResolve(candidatesChain, {
            data: [CANDIDATE_ROW, { ...CANDIDATE_ROW, id: 'cand-2', assigned_manager_id: null }],
            error: null,
        });

        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, { data: [{ id: 'mgr-1', full_name: 'Manager Alice' }], error: null });

        const interviewsChain = mockSupa.__getChain('interviews');
        mockResolve(interviewsChain, { data: [], error: null });

        const result = await fetchCandidates('mgr-1', true);

        expect(usersChain.__calls).toContainEqual({ method: 'in', args: ['id', ['mgr-1']] });
        expect(result.data[0].assigned_manager_name).toBe('Manager Alice');
        expect(result.data[1].assigned_manager_name).toBe('');
    });
});

// ── fetchCandidate ──

describe('fetchCandidate', () => {
    it('returns single candidate with manager name and interviews', async () => {
        const candidatesChain = mockSupa.__getChain('candidates');
        mockResolve(candidatesChain, { data: CANDIDATE_ROW, error: null });

        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, { data: { full_name: 'Manager Alice' }, error: null });

        const interviewsChain = mockSupa.__getChain('interviews');
        mockResolve(interviewsChain, { data: [INTERVIEW_ROW], error: null });

        const result = await fetchCandidate('cand-1');
        expect(result.data?.name).toBe('Jane Smith');
        expect(result.data?.assigned_manager_name).toBe('Manager Alice');
        expect(result.data?.interviews).toHaveLength(1);
    });

    it('returns error when not found', async () => {
        const chain = mockSupa.__getChain('candidates');
        mockResolve(chain, { data: null, error: { message: 'Not found' } });

        const result = await fetchCandidate('bad-id');
        expect(result.error).toBe('Not found');
        expect(result.data).toBeNull();
    });
});

// ── createCandidate ──

describe('createCandidate', () => {
    beforeEach(() => {
        // Mock auth session for edge function call
        mockSupa.auth = {
            getSession: jest.fn().mockResolvedValue({
                data: { session: { access_token: 'test-token' } },
            }),
        };
    });

    it('creates candidate via edge function', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                candidate: { ...CANDIDATE_ROW, id: 'new-cand', invite_token: 'inv_test' },
                invite_token: 'inv_test',
                invite_url: 'https://lyfe.sg/candidate/login?token=inv_test',
            }),
        });

        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, { data: { full_name: 'Manager Alice' }, error: null });

        const result = await createCandidate(
            { name: 'Jane Smith', phone: '+6598765432', email: null, notes: null },
            'mgr-1',
        );

        expect(result.error).toBeNull();
        expect(result.data?.id).toBe('new-cand');
        expect(result.inviteToken).toBe('inv_test');
    });

    it('returns error on edge function failure', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            json: async () => ({ error: 'Duplicate phone' }),
        });

        const result = await createCandidate({ name: 'Jane', phone: '+65123', email: null, notes: null }, 'mgr-1');

        expect(result.error).toBe('Duplicate phone');
        expect(result.data).toBeNull();
        expect(result.inviteToken).toBeNull();
    });
});

// ── updateCandidateStatus ──

describe('updateCandidateStatus', () => {
    it('updates status successfully', async () => {
        const chain = mockSupa.__getChain('candidates');
        mockResolve(chain, { error: null });

        const result = await updateCandidateStatus('cand-1', 'interview_scheduled');
        expect(result.error).toBeNull();
    });

    it('returns error on failure', async () => {
        const chain = mockSupa.__getChain('candidates');
        mockResolve(chain, { error: { message: 'Invalid status' } });

        const result = await updateCandidateStatus('cand-1', 'invalid' as any);
        expect(result.error).toBe('Invalid status');
    });

    it('refuses active_agent — must go through activate-agent edge function', async () => {
        const result = await updateCandidateStatus('cand-1', 'active_agent');
        expect(result.error).toMatch(/activate/i);
        // Guard should fire before any DB call.
        expect(mockSupa.from).not.toHaveBeenCalled();
    });

    it('delegates licensed to the papers+RNF readiness guard', async () => {
        // Not ready — no paper completions exist.
        mockSupa.__getChain('candidate_paper_completions').__resolveWith({ data: [], error: null });
        mockSupa.__getChain('candidate_milestones').__resolveWith({ data: [], error: null });

        const result = await updateCandidateStatus('cand-1', 'licensed');

        expect(result.error).toMatch(/paper/i);
        // No UPDATE on candidates should have happened.
        expect(mockSupa.from).not.toHaveBeenCalledWith('candidates');
    });

    it('refuses rejected — must go through rejectCandidate with a reason', async () => {
        const result = await updateCandidateStatus('cand-1', 'rejected');
        expect(result.error).toMatch(/reason/i);
        expect(mockSupa.from).not.toHaveBeenCalled();
    });
});

// ── rejectCandidate ──

describe('rejectCandidate', () => {
    it('rejects with trimmed reason + by user', async () => {
        const chain = mockSupa.__getChain('candidates');
        mockResolve(chain, { error: null });

        const result = await rejectCandidate('cand-1', '  not interested  ', 'user-1');

        expect(result.error).toBeNull();
        expect(chain.update).toHaveBeenCalledWith({
            status: 'rejected',
            rejected_reason: 'not interested',
            rejected_by_user_id: 'user-1',
        });
    });

    it('requires a non-empty reason', async () => {
        const result = await rejectCandidate('cand-1', '   ', 'user-1');
        expect(result.error).toMatch(/reason/i);
        expect(mockSupa.from).not.toHaveBeenCalled();
    });

    it('requires an authenticated user', async () => {
        const result = await rejectCandidate('cand-1', 'no longer available', '');
        expect(result.error).toMatch(/auth/i);
        expect(mockSupa.from).not.toHaveBeenCalled();
    });

    it('surfaces DB error', async () => {
        const chain = mockSupa.__getChain('candidates');
        mockResolve(chain, { error: { message: 'RLS denied' } });

        const result = await rejectCandidate('cand-1', 'reason', 'user-1');
        expect(result.error).toBe('RLS denied');
    });
});

// ── activateAgent ──

describe('activateAgent', () => {
    beforeEach(() => {
        mockFetch.mockReset();
        mockSupa.auth = {
            getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } }),
        };
    });

    it('returns error when not authenticated', async () => {
        mockSupa.auth.getSession.mockResolvedValue({ data: { session: null } });
        const result = await activateAgent('cand-1');
        expect(result.error).toMatch(/auth/i);
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('calls activate-agent edge function with candidate_id + bearer', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ ok: true, user_id: 'u1', candidate_id: 'cand-1', app_metadata_updated: true }),
        });
        const result = await activateAgent('cand-1');
        expect(result.error).toBeNull();
        expect(result.userId).toBe('u1');
        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining('/functions/v1/activate-agent'),
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({ Authorization: 'Bearer tok' }),
                body: JSON.stringify({ candidate_id: 'cand-1' }),
            }),
        );
    });

    it('surfaces server error on !ok response', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 409,
            json: async () => ({ error: 'BDM Interview must be completed' }),
        });
        const result = await activateAgent('cand-1');
        expect(result.error).toBe('BDM Interview must be completed');
    });

    it('returns warning when DB flipped but app_metadata update failed', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({
                ok: true,
                user_id: 'u1',
                candidate_id: 'cand-1',
                app_metadata_updated: false,
                warning: 'The user may need to sign out and back in.',
            }),
        });
        const result = await activateAgent('cand-1');
        expect(result.error).toBeNull();
        expect(result.warning).toMatch(/sign out/i);
    });

    it('handles fetch rejection', async () => {
        mockFetch.mockRejectedValueOnce(new Error('network down'));
        const result = await activateAgent('cand-1');
        expect(result.error).toBe('network down');
    });
});

// ── addCandidateActivity ──

describe('addCandidateActivity', () => {
    it('inserts activity', async () => {
        const chain = mockSupa.__getChain('candidate_activities');
        mockResolve(chain, { error: null });

        const result = await addCandidateActivity('cand-1', 'mgr-1', 'call', 'interested', 'Follow up next week');
        expect(result.error).toBeNull();
    });
});

// ── scheduleInterview ──

describe('scheduleInterview', () => {
    it('creates interview with zoom link', async () => {
        const chain = mockSupa.__getChain('interviews');
        mockResolve(chain, { data: INTERVIEW_ROW, error: null });

        const result = await scheduleInterview({
            candidateId: 'cand-1',
            managerId: 'mgr-1',
            scheduledById: 'mgr-1',
            roundNumber: 1,
            type: 'zoom',
            datetime: '2026-03-20T14:00:00Z',
            location: null,
            zoomLink: 'https://zoom.us/123',
            notes: null,
        });

        expect(result.error).toBeNull();
        expect(result.data?.type).toBe('zoom');
    });

    it('creates in-person interview', async () => {
        const chain = mockSupa.__getChain('interviews');
        mockResolve(chain, { data: { ...INTERVIEW_ROW, type: 'in_person', location: 'Office' }, error: null });

        const result = await scheduleInterview({
            candidateId: 'cand-1',
            managerId: 'mgr-1',
            scheduledById: 'mgr-1',
            roundNumber: 1,
            type: 'in_person',
            datetime: '2026-03-20T14:00:00Z',
            location: 'Office',
            zoomLink: null,
            notes: null,
        });

        expect(result.data?.type).toBe('in_person');
    });
});

// ── updateInterview ──

describe('updateInterview', () => {
    it('updates interview fields', async () => {
        const chain = mockSupa.__getChain('interviews');
        mockResolve(chain, { data: { ...INTERVIEW_ROW, status: 'completed' }, error: null });

        const result = await updateInterview('iv-1', {
            type: 'zoom',
            datetime: '2026-03-20T14:00:00Z',
            location: null,
            zoomLink: 'https://zoom.us/456',
            notes: 'Went well',
            status: 'completed',
        });

        expect(result.data?.status).toBe('completed');
    });
});

// ── deleteInterview ──

describe('deleteInterview', () => {
    it('deletes successfully', async () => {
        const chain = mockSupa.__getChain('interviews');
        mockResolve(chain, { error: null });

        const result = await deleteInterview('iv-1');
        expect(result.error).toBeNull();
    });
});

// ── Candidate Documents ──

describe('fetchCandidateDocuments', () => {
    it('returns documents for candidate', async () => {
        const chain = mockSupa.__getChain('candidate_documents');
        mockResolve(chain, {
            data: [{ id: 'doc-1', candidate_id: 'cand-1', label: 'ID', file_url: 'https://...', file_name: 'id.pdf' }],
            error: null,
        });

        const result = await fetchCandidateDocuments('cand-1');
        expect(result.data).toHaveLength(1);
    });
});

describe('deleteCandidateDocument', () => {
    it('deletes document', async () => {
        const chain = mockSupa.__getChain('candidate_documents');
        mockResolve(chain, { error: null });

        const result = await deleteCandidateDocument('doc-1');
        expect(result.error).toBeNull();
    });
});

// ── PA Helper Queries ──

describe('fetchPAManagerIds', () => {
    it('returns manager IDs for PA', async () => {
        const chain = mockSupa.__getChain('pa_manager_assignments');
        mockResolve(chain, { data: [{ manager_id: 'mgr-1' }, { manager_id: 'mgr-2' }], error: null });

        const result = await fetchPAManagerIds('pa-1');
        expect(result).toEqual(['mgr-1', 'mgr-2']);
    });

    it('returns empty array when no assignments', async () => {
        const chain = mockSupa.__getChain('pa_manager_assignments');
        mockResolve(chain, { data: [], error: null });

        const result = await fetchPAManagerIds('pa-1');
        expect(result).toEqual([]);
    });
});

describe('fetchPAManagers', () => {
    it('returns manager objects', async () => {
        const chain = mockSupa.__getChain('pa_manager_assignments');
        mockResolve(chain, {
            data: [{ manager: { id: 'mgr-1', full_name: 'Alice', role: 'manager' } }],
            error: null,
        });

        const result = await fetchPAManagers('pa-1');
        expect(result).toHaveLength(1);
        expect(result[0].full_name).toBe('Alice');
    });
});

describe('fetchPACandidateCount', () => {
    it('returns count for manager IDs', async () => {
        const chain = mockSupa.__getChain('candidates');
        mockResolve(chain, { count: 8 });

        const result = await fetchPACandidateCount(['mgr-1', 'mgr-2']);
        expect(result).toBe(8);
    });

    it('returns 0 for empty manager list', async () => {
        const result = await fetchPACandidateCount([]);
        expect(result).toBe(0);
    });
});

describe('fetchPAInterviewCount', () => {
    it('returns count of interview_scheduled candidates', async () => {
        const chain = mockSupa.__getChain('candidates');
        mockResolve(chain, { count: 3 });

        const result = await fetchPAInterviewCount(['mgr-1']);
        expect(result).toBe(3);
    });

    it('returns 0 for empty manager list', async () => {
        const result = await fetchPAInterviewCount([]);
        expect(result).toBe(0);
    });
});

// ── fetchAssignableManagers ──

describe('fetchAssignableManagers', () => {
    it('returns managers for PA via pa_manager_assignments', async () => {
        const assignmentsChain = mockSupa.__getChain('pa_manager_assignments');
        mockResolve(assignmentsChain, { data: [{ manager_id: 'mgr-1' }, { manager_id: 'mgr-2' }], error: null });

        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, {
            data: [
                { id: 'mgr-1', full_name: 'Alice', role: 'manager' },
                { id: 'mgr-2', full_name: 'Bob', role: 'director' },
            ],
            error: null,
        });

        const result = await fetchAssignableManagers('pa-1', 'pa');
        expect(result.error).toBeNull();
        expect(result.data).toHaveLength(2);
        expect(result.data[0].full_name).toBe('Alice');
    });

    it('returns empty for PA with no assignments', async () => {
        const chain = mockSupa.__getChain('pa_manager_assignments');
        mockResolve(chain, { data: [], error: null });

        const result = await fetchAssignableManagers('pa-1', 'pa');
        expect(result.data).toEqual([]);
    });

    it('returns error on PA assignment query failure', async () => {
        const chain = mockSupa.__getChain('pa_manager_assignments');
        mockResolve(chain, { data: null, error: { message: 'Query failed' } });

        const result = await fetchAssignableManagers('pa-1', 'pa');
        expect(result.data).toEqual([]);
        expect(result.error).toBe('Query failed');
    });

    it('returns all active managers/directors (excluding self) for manager+ roles', async () => {
        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, {
            data: [{ id: 'mgr-2', full_name: 'Alice', role: 'manager' }],
            error: null,
        });

        const result = await fetchAssignableManagers('mgr-1', 'manager');
        expect(result.error).toBeNull();
        expect(result.data).toHaveLength(1);
    });

    it('returns error on manager query failure', async () => {
        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, { data: null, error: { message: 'DB error' } });

        const result = await fetchAssignableManagers('mgr-1', 'admin');
        expect(result.error).toBe('DB error');
    });

    it('excludes the current owner when excludeManagerId is passed (manager role)', async () => {
        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, {
            data: [
                { id: 'mgr-2', full_name: 'Alice', role: 'manager' },
                { id: 'mgr-3', full_name: 'Bob', role: 'director' },
            ],
            error: null,
        });

        const result = await fetchAssignableManagers('mgr-1', 'admin', 'mgr-2');
        expect(result.error).toBeNull();
        expect(result.data).toHaveLength(1);
        expect(result.data[0].id).toBe('mgr-3');
    });

    it('excludes the current owner when excludeManagerId is passed (PA role)', async () => {
        const assignmentsChain = mockSupa.__getChain('pa_manager_assignments');
        mockResolve(assignmentsChain, { data: [{ manager_id: 'mgr-1' }, { manager_id: 'mgr-2' }], error: null });

        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, {
            data: [
                { id: 'mgr-1', full_name: 'Alice', role: 'manager' },
                { id: 'mgr-2', full_name: 'Bob', role: 'director' },
            ],
            error: null,
        });

        const result = await fetchAssignableManagers('pa-1', 'pa', 'mgr-1');
        expect(result.error).toBeNull();
        expect(result.data).toHaveLength(1);
        expect(result.data[0].id).toBe('mgr-2');
    });
});

// ── reassignCandidate ──

describe('reassignCandidate', () => {
    it('reassigns candidate and logs activity', async () => {
        const candidatesChain = mockSupa.__getChain('candidates');
        mockResolve(candidatesChain, { data: { assigned_manager_id: 'mgr-1' }, error: null });

        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, {
            data: [
                { id: 'mgr-1', full_name: 'Old Manager', role: 'manager', is_active: true },
                { id: 'mgr-2', full_name: 'New Manager', role: 'manager', is_active: true },
            ],
            error: null,
        });

        const activitiesChain = mockSupa.__getChain('candidate_activities');
        mockResolve(activitiesChain, { error: null });

        const result = await reassignCandidate('cand-1', 'mgr-2', 'admin-1');
        expect(result.error).toBeNull();
    });

    it('returns error on update failure', async () => {
        // Last candidates resolve wins — update surfaces as failure
        const candidatesChain = mockSupa.__getChain('candidates');
        mockResolve(candidatesChain, { error: { message: 'Update failed' } });

        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, {
            data: [{ id: 'mgr-2', full_name: 'New Manager', role: 'manager', is_active: true }],
            error: null,
        });

        const result = await reassignCandidate('cand-1', 'mgr-2', 'admin-1');
        expect(result.error).toBe('Update failed');
    });

    it('rejects reassignment to an admin (violates hold_agents rule)', async () => {
        const candidatesChain = mockSupa.__getChain('candidates');
        mockResolve(candidatesChain, { data: { assigned_manager_id: 'mgr-1' }, error: null });

        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, {
            data: [{ id: 'admin-2', full_name: 'Some Admin', role: 'admin', is_active: true }],
            error: null,
        });

        const result = await reassignCandidate('cand-1', 'admin-2', 'admin-1');
        expect(result.error).toBe('Target user is not a manager or director');
    });

    it('rejects reassignment to an inactive manager', async () => {
        const candidatesChain = mockSupa.__getChain('candidates');
        mockResolve(candidatesChain, { data: { assigned_manager_id: 'mgr-1' }, error: null });

        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, {
            data: [{ id: 'mgr-2', full_name: 'Inactive Mgr', role: 'manager', is_active: false }],
            error: null,
        });

        const result = await reassignCandidate('cand-1', 'mgr-2', 'admin-1');
        expect(result.error).toBe('Target manager not found or inactive');
    });
});

// ── uploadCandidateResume ──

describe('uploadCandidateResume', () => {
    it('rejects non-PDF files', async () => {
        const result = await uploadCandidateResume('cand-1', 'file:///doc.docx', 'doc.docx');
        expect(result.error).toBe('Only PDF files are allowed.');
        expect(result.url).toBeNull();
    });

    it('rejects files over 10 MB', async () => {
        const bigBuffer = new ArrayBuffer(11 * 1024 * 1024);
        mockFetch.mockResolvedValueOnce({
            arrayBuffer: () => Promise.resolve(bigBuffer),
        });

        const result = await uploadCandidateResume('cand-1', 'file:///big.pdf', 'big.pdf');
        expect(result.error).toBe('File must be under 10 MB.');
    });

    it('uploads PDF and returns signed URL', async () => {
        const smallBuffer = new ArrayBuffer(1024);
        mockFetch.mockResolvedValueOnce({
            arrayBuffer: () => Promise.resolve(smallBuffer),
        });

        mockSupa.storage = {
            from: jest.fn().mockReturnValue({
                upload: jest.fn().mockResolvedValue({ error: null }),
                createSignedUrl: jest.fn().mockResolvedValue({
                    data: { signedUrl: 'https://signed-url.com/resume.pdf' },
                    error: null,
                }),
            }),
        };

        const candidatesChain = mockSupa.__getChain('candidates');
        mockResolve(candidatesChain, { data: [{ id: 'cand-1' }], error: null });

        const result = await uploadCandidateResume('cand-1', 'file:///resume.pdf', 'resume.pdf');
        expect(result.error).toBeNull();
        expect(result.url).toBe('https://signed-url.com/resume.pdf');
    });

    it('returns error on upload failure', async () => {
        const smallBuffer = new ArrayBuffer(1024);
        mockFetch.mockResolvedValueOnce({
            arrayBuffer: () => Promise.resolve(smallBuffer),
        });

        mockSupa.storage = {
            from: jest.fn().mockReturnValue({
                upload: jest.fn().mockResolvedValue({ error: { message: 'Storage error' } }),
            }),
        };

        const result = await uploadCandidateResume('cand-1', 'file:///resume.pdf', 'resume.pdf');
        expect(result.error).toBe('Storage error');
    });

    it('returns error when signed URL generation fails', async () => {
        const smallBuffer = new ArrayBuffer(1024);
        mockFetch.mockResolvedValueOnce({
            arrayBuffer: () => Promise.resolve(smallBuffer),
        });

        mockSupa.storage = {
            from: jest.fn().mockReturnValue({
                upload: jest.fn().mockResolvedValue({ error: null }),
                createSignedUrl: jest.fn().mockResolvedValue({ data: null, error: { message: 'Sign error' } }),
            }),
        };

        const result = await uploadCandidateResume('cand-1', 'file:///resume.pdf', 'resume.pdf');
        expect(result.error).toBe('Sign error');
    });

    it('returns error when DB update is denied', async () => {
        const smallBuffer = new ArrayBuffer(1024);
        mockFetch.mockResolvedValueOnce({
            arrayBuffer: () => Promise.resolve(smallBuffer),
        });

        mockSupa.storage = {
            from: jest.fn().mockReturnValue({
                upload: jest.fn().mockResolvedValue({ error: null }),
                createSignedUrl: jest.fn().mockResolvedValue({
                    data: { signedUrl: 'https://signed-url.com/resume.pdf' },
                    error: null,
                }),
            }),
        };

        const candidatesChain = mockSupa.__getChain('candidates');
        mockResolve(candidatesChain, { data: [], error: null });

        const result = await uploadCandidateResume('cand-1', 'file:///resume.pdf', 'resume.pdf');
        expect(result.error).toBe('Permission denied: could not save resume URL');
    });
});

// ── fetchCandidateStatusCounts ──

describe('fetchCandidateStatusCounts', () => {
    it('returns status counts for manager', async () => {
        const chain = mockSupa.__getChain('candidates');
        mockResolve(chain, {
            data: [{ status: 'applied' }, { status: 'applied' }, { status: 'active_agent' }],
            error: null,
        });

        const result = await fetchCandidateStatusCounts('mgr-1');
        expect(result.error).toBeNull();
        expect(result.data).toHaveLength(3);
    });

    it('returns error on failure', async () => {
        const chain = mockSupa.__getChain('candidates');
        mockResolve(chain, { data: null, error: { message: 'DB error' } });

        const result = await fetchCandidateStatusCounts('mgr-1');
        expect(result.error).toBe('DB error');
        expect(result.data).toEqual([]);
    });
});
