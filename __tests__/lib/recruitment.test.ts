/**
 * Tests for lib/recruitment.ts — Candidate & Interview service functions
 */
import { supabase } from '@/lib/supabase';

import {
    fetchCandidates,
    fetchCandidate,
    createCandidate,
    updateCandidateStatus,
    addCandidateActivity,
    scheduleInterview,
    updateInterview,
    deleteInterview,
    syncAgentToMKTR,
    fetchCandidateDocuments,
    uploadCandidateDocument,
    deleteCandidateDocument,
    fetchPAManagerIds,
    fetchPAManagers,
    fetchPACandidateCount,
    fetchPAInterviewCount,
} from '@/lib/recruitment';

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

    it('defaults manager name to Unknown when not found', async () => {
        const candidatesChain = mockSupa.__getChain('candidates');
        mockResolve(candidatesChain, { data: [{ ...CANDIDATE_ROW, assigned_manager_id: 'unknown-mgr' }], error: null });

        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, { data: [], error: null });

        const interviewsChain = mockSupa.__getChain('interviews');
        mockResolve(interviewsChain, { data: [], error: null });

        const result = await fetchCandidates('unknown-mgr', false);
        expect(result.data[0].assigned_manager_name).toBe('Unknown');
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
    it('creates candidate with generated invite token', async () => {
        const candidatesChain = mockSupa.__getChain('candidates');
        mockResolve(candidatesChain, {
            data: { ...CANDIDATE_ROW, id: 'new-cand', invite_token: 'inv_test' },
            error: null,
        });

        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, { data: { full_name: 'Manager Alice' }, error: null });

        const result = await createCandidate(
            { name: 'Jane Smith', phone: '+6598765432', email: null, notes: null },
            'mgr-1',
        );

        expect(result.error).toBeNull();
        expect(result.data?.id).toBe('new-cand');
        expect(result.inviteToken).toBeTruthy();
        expect(result.inviteToken!.length).toBeGreaterThan(20);
    });

    it('returns error on insert failure', async () => {
        const chain = mockSupa.__getChain('candidates');
        mockResolve(chain, { data: null, error: { message: 'Duplicate phone' } });

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

// ── syncAgentToMKTR ──

describe('syncAgentToMKTR', () => {
    it('returns error when no email', async () => {
        const result = await syncAgentToMKTR({ email: null, name: 'Jane', phone: '+65123' });
        expect(result.success).toBe(false);
        expect(result.error).toBe('No email address');
    });

    it('returns error when no session', async () => {
        mockSupa.auth.getSession.mockResolvedValue({ data: { session: null } });

        const result = await syncAgentToMKTR({ email: 'jane@example.com', name: 'Jane', phone: '+65123' });
        expect(result.success).toBe(false);
        expect(result.error).toBe('No active session');

        // Restore
        mockSupa.auth.getSession.mockResolvedValue({ data: { session: { access_token: 'mock-token' } } });
    });

    it('calls edge function and returns success', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ success: true }),
        });

        const result = await syncAgentToMKTR({ email: 'jane@example.com', name: 'Jane', phone: '+65123' });
        expect(result.success).toBe(true);
        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining('/functions/v1/sync-agent-to-mktr'),
            expect.objectContaining({ method: 'POST' }),
        );
    });

    it('returns error on HTTP failure', async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ error: 'Internal error' }),
        });

        const result = await syncAgentToMKTR({ email: 'jane@example.com', name: 'Jane', phone: '+65123' });
        expect(result.success).toBe(false);
        expect(result.error).toBe('Internal error');
    });

    it('handles fetch exception gracefully', async () => {
        mockFetch.mockRejectedValue(new Error('Network down'));

        const result = await syncAgentToMKTR({ email: 'jane@example.com', name: 'Jane', phone: '+65123' });
        expect(result.success).toBe(false);
        expect(result.error).toBe('Network down');
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
