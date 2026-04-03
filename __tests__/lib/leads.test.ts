/**
 * Tests for lib/leads.ts — Lead & Activity service functions
 */
import { supabase } from '@/lib/supabase';

import {
    fetchLeads,
    fetchLead,
    createLead,
    updateLeadStatus,
    fetchLeadActivities,
    addLeadNote,
    addLeadActivity,
    reassignLead,
    fetchTeamAgents,
    fetchLeadStats,
    fetchRecentActivities,
    fetchManagerDashboardStats,
    assignLead,
    getTeamLeadSummary,
} from '@/lib/leads';

jest.mock('@/lib/supabase');

const mockSupa = supabase as any;

function mockResolve(chain: any, value: any) {
    chain.__resolveWith(value);
}

// ── Fixtures ──

const LEAD = {
    id: 'lead-1',
    full_name: 'John Doe',
    phone: '+6591234567',
    email: 'john@example.com',
    source: 'referral',
    product_interest: 'life_insurance',
    status: 'new',
    assigned_to: 'agent-1',
    created_by: 'agent-1',
    notes: 'Initial contact',
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-05T00:00:00Z',
};

const ACTIVITY = {
    id: 'act-1',
    lead_id: 'lead-1',
    user_id: 'agent-1',
    type: 'note',
    description: 'Called and left voicemail',
    metadata: {},
    created_at: '2026-03-05T10:00:00Z',
    actor: { full_name: 'Agent Alice' },
};

beforeEach(() => {
    mockSupa.__resetChains();
    jest.clearAllMocks();
});

// ── fetchLeads ──

describe('fetchLeads', () => {
    it('returns leads for agent (filtered by assigned_to)', async () => {
        const chain = mockSupa.__getChain('leads');
        mockResolve(chain, { data: [LEAD], error: null });

        const result = await fetchLeads('agent-1', false);
        expect(result.data).toHaveLength(1);
        expect(result.error).toBeNull();
    });

    it('returns leads for manager (no assigned_to filter)', async () => {
        const chain = mockSupa.__getChain('leads');
        mockResolve(chain, { data: [LEAD, { ...LEAD, id: 'lead-2', assigned_to: 'agent-2' }], error: null });

        const result = await fetchLeads('mgr-1', true);
        expect(result.data).toHaveLength(2);
    });

    it('returns error on failure', async () => {
        const chain = mockSupa.__getChain('leads');
        mockResolve(chain, { data: null, error: { message: 'DB error', code: 'PGRST000' } });

        const result = await fetchLeads('agent-1', false);
        expect(result.error).toBeTruthy();
        expect(result.data).toEqual([]);
    });

    it('returns hasMore=false when page not provided (backward compat)', async () => {
        const chain = mockSupa.__getChain('leads');
        mockResolve(chain, { data: [LEAD], error: null });

        const result = await fetchLeads('agent-1', false);
        expect(result.hasMore).toBe(false);
        expect(result.data).toHaveLength(1);
    });

    it('returns hasMore=true when more data exists with pagination', async () => {
        const leads = Array.from({ length: 3 }, (_, i) => ({ ...LEAD, id: `lead-${i}` }));
        const chain = mockSupa.__getChain('leads');
        mockResolve(chain, { data: leads, error: null });

        const result = await fetchLeads('agent-1', false, 0, 2);
        expect(result.hasMore).toBe(true);
        expect(result.data).toHaveLength(2);
    });

    it('returns hasMore=false on last page', async () => {
        const chain = mockSupa.__getChain('leads');
        mockResolve(chain, { data: [LEAD], error: null });

        const result = await fetchLeads('agent-1', false, 1, 2);
        expect(result.hasMore).toBe(false);
        expect(result.data).toHaveLength(1);
    });
});

// ── fetchLead ──

describe('fetchLead', () => {
    it('returns single lead', async () => {
        const chain = mockSupa.__getChain('leads');
        mockResolve(chain, { data: LEAD, error: null });

        const result = await fetchLead('lead-1');
        expect(result.data?.full_name).toBe('John Doe');
        expect(result.error).toBeNull();
    });

    it('returns error when not found', async () => {
        const chain = mockSupa.__getChain('leads');
        mockResolve(chain, { data: null, error: { message: 'Not found', code: 'PGRST116' } });

        const result = await fetchLead('bad-id');
        expect(result.error).toBeTruthy();
    });
});

// ── createLead ──

describe('createLead', () => {
    it('creates lead and logs created activity', async () => {
        const leadsChain = mockSupa.__getChain('leads');
        mockResolve(leadsChain, { data: { ...LEAD, id: 'new-lead' }, error: null });

        const activitiesChain = mockSupa.__getChain('lead_activities');
        mockResolve(activitiesChain, { error: null });

        const result = await createLead(
            {
                full_name: 'John Doe',
                phone: '+65123',
                email: null,
                source: 'referral',
                product_interest: 'life' as const,
                notes: null,
            },
            'agent-1',
        );

        expect(result.data?.id).toBe('new-lead');
        expect(result.error).toBeNull();
        // Verify lead_activities was called
        expect(mockSupa.from).toHaveBeenCalledWith('lead_activities');
    });

    it('returns error when full_name is empty', async () => {
        const result = await createLead(
            {
                full_name: '  ',
                phone: '+65123',
                email: null,
                source: 'referral',
                product_interest: 'life' as const,
                notes: null,
            },
            'agent-1',
        );
        expect(result.error).toBe('full_name is required');
    });

    it('returns error when source is empty', async () => {
        const result = await createLead(
            {
                full_name: 'John',
                phone: '+65123',
                email: null,
                source: '' as any,
                product_interest: 'life' as const,
                notes: null,
            },
            'agent-1',
        );
        expect(result.error).toBe('source is required');
    });

    it('returns error for invalid phone format', async () => {
        const result = await createLead(
            {
                full_name: 'John',
                phone: 'abc',
                email: null,
                source: 'referral',
                product_interest: 'life' as const,
                notes: null,
            },
            'agent-1',
        );
        expect(result.error).toBe('Invalid phone format');
    });

    it('returns error for invalid email format', async () => {
        const result = await createLead(
            {
                full_name: 'John',
                phone: '+65123456',
                email: 'bad-email',
                source: 'referral',
                product_interest: 'life' as const,
                notes: null,
            },
            'agent-1',
        );
        expect(result.error).toBe('Invalid email format');
    });

    it('returns error when insert fails', async () => {
        const chain = mockSupa.__getChain('leads');
        mockResolve(chain, { data: null, error: { message: 'Duplicate phone' } });

        const result = await createLead(
            {
                full_name: 'John',
                phone: '+65123',
                email: null,
                source: 'referral',
                product_interest: 'life' as const,
                notes: null,
            },
            'agent-1',
        );

        expect(result.error).toBe('Duplicate phone');
        expect(result.data).toBeNull();
    });
});

// ── updateLeadStatus ──

describe('updateLeadStatus', () => {
    it('updates status and logs activity', async () => {
        const leadsChain = mockSupa.__getChain('leads');
        mockResolve(leadsChain, { error: null });

        const activitiesChain = mockSupa.__getChain('lead_activities');
        mockResolve(activitiesChain, { error: null });

        const result = await updateLeadStatus('lead-1', 'contacted', 'new', 'agent-1');
        expect(result.error).toBeNull();
        expect(mockSupa.from).toHaveBeenCalledWith('lead_activities');
    });

    it('returns error when update fails', async () => {
        const chain = mockSupa.__getChain('leads');
        mockResolve(chain, { error: { message: 'Invalid status' } });

        const result = await updateLeadStatus('lead-1', 'contacted', 'new', 'agent-1');
        expect(result.error).toBe('Invalid status');
    });
});

// ── fetchLeadActivities ──

describe('fetchLeadActivities', () => {
    it('returns activities with actor names', async () => {
        const chain = mockSupa.__getChain('lead_activities');
        mockResolve(chain, { data: [ACTIVITY], error: null });

        const result = await fetchLeadActivities('lead-1');
        expect(result.data).toHaveLength(1);
        expect(result.data[0].actor_name).toBe('Agent Alice');
    });

    it('handles missing actor gracefully', async () => {
        const chain = mockSupa.__getChain('lead_activities');
        mockResolve(chain, { data: [{ ...ACTIVITY, actor: null }], error: null });

        const result = await fetchLeadActivities('lead-1');
        expect(result.data[0].actor_name).toBeUndefined();
    });

    it('returns hasMore=false when page not provided (backward compat)', async () => {
        const chain = mockSupa.__getChain('lead_activities');
        mockResolve(chain, { data: [ACTIVITY], error: null });

        const result = await fetchLeadActivities('lead-1');
        expect(result.hasMore).toBe(false);
    });

    it('returns hasMore=true when more data exists with pagination', async () => {
        const activities = Array.from({ length: 3 }, (_, i) => ({ ...ACTIVITY, id: `act-${i}` }));
        const chain = mockSupa.__getChain('lead_activities');
        mockResolve(chain, { data: activities, error: null });

        const result = await fetchLeadActivities('lead-1', 0, 2);
        expect(result.hasMore).toBe(true);
        expect(result.data).toHaveLength(2);
    });

    it('returns hasMore=false on last page', async () => {
        const chain = mockSupa.__getChain('lead_activities');
        mockResolve(chain, { data: [ACTIVITY], error: null });

        const result = await fetchLeadActivities('lead-1', 1, 2);
        expect(result.hasMore).toBe(false);
        expect(result.data).toHaveLength(1);
    });
});

// ── addLeadNote ──

describe('addLeadNote', () => {
    it('bumps updated_at and inserts note activity', async () => {
        const leadsChain = mockSupa.__getChain('leads');
        mockResolve(leadsChain, { error: null });

        const activitiesChain = mockSupa.__getChain('lead_activities');
        mockResolve(activitiesChain, { data: { id: 'act-new', type: 'note', description: 'Test note' }, error: null });

        const result = await addLeadNote('lead-1', 'Test note', 'agent-1');
        expect(result.error).toBeNull();
        expect(result.data).toBeTruthy();
    });
});

// ── addLeadActivity ──

describe('addLeadActivity', () => {
    it('inserts generic activity and bumps updated_at', async () => {
        const leadsChain = mockSupa.__getChain('leads');
        mockResolve(leadsChain, { error: null });

        const activitiesChain = mockSupa.__getChain('lead_activities');
        mockResolve(activitiesChain, {
            data: { id: 'act-new', type: 'call', description: 'Discussed policy', metadata: { duration: '5min' } },
            error: null,
        });

        const result = await addLeadActivity('lead-1', 'agent-1', 'call', 'Discussed policy', { duration: '5min' });
        expect(result.error).toBeNull();
        expect(result.data?.type).toBe('call');
    });
});

// ── reassignLead ──

describe('reassignLead', () => {
    it('updates assigned_to and logs reassignment', async () => {
        const leadsChain = mockSupa.__getChain('leads');
        mockResolve(leadsChain, { error: null });

        const activitiesChain = mockSupa.__getChain('lead_activities');
        mockResolve(activitiesChain, { error: null });

        const result = await reassignLead('lead-1', 'agent-2', 'agent-1', 'Alice', 'Bob', 'mgr-1');

        expect(result.error).toBeNull();
        expect(mockSupa.from).toHaveBeenCalledWith('lead_activities');
    });

    it('returns error when update fails', async () => {
        const chain = mockSupa.__getChain('leads');
        mockResolve(chain, { error: { message: 'Permission denied' } });

        const result = await reassignLead('lead-1', 'agent-2', 'agent-1', 'A', 'B', 'mgr-1');
        expect(result.error).toBe('Permission denied');
    });
});

// ── fetchTeamAgents ──

describe('fetchTeamAgents', () => {
    it('returns agents reporting to manager', async () => {
        const chain = mockSupa.__getChain('users');
        mockResolve(chain, {
            data: [
                { id: 'a1', full_name: 'Agent 1' },
                { id: 'a2', full_name: 'Agent 2' },
            ],
            error: null,
        });

        const result = await fetchTeamAgents('mgr-1');
        expect(result.data).toHaveLength(2);
        expect(result.error).toBeNull();
    });
});

// ── fetchLeadStats (RPC-based) ──

describe('fetchLeadStats', () => {
    it('parses RPC result into LeadPipelineStats shape', async () => {
        mockSupa.rpc.mockResolvedValueOnce({
            data: {
                totalLeads: 5,
                newThisWeek: 1,
                conversionRate: 50,
                activeFollowUps: 2,
                pipeline: [
                    { status: 'new', count: 1 },
                    { status: 'contacted', count: 1 },
                    { status: 'qualified', count: 1 },
                    { status: 'proposed', count: 0 },
                    { status: 'won', count: 1 },
                    { status: 'lost', count: 1 },
                ],
            },
            error: null,
        });

        const result = await fetchLeadStats('agent-1', false);

        expect(mockSupa.rpc).toHaveBeenCalledWith('get_lead_pipeline_stats', {
            p_user_id: 'agent-1',
            p_is_manager: false,
        });
        expect(result.data.totalLeads).toBe(5);
        expect(result.data.newThisWeek).toBe(1);
        expect(result.data.conversionRate).toBe(50);
        expect(result.data.activeFollowUps).toBe(2);
        expect(result.data.pipeline).toHaveLength(6);
        expect(result.data.pipeline.find((p) => p.status === 'new')?.count).toBe(1);
        expect(result.data.pipeline.find((p) => p.status === 'proposed')?.count).toBe(0);
    });

    it('passes isManager flag to RPC', async () => {
        mockSupa.rpc.mockResolvedValueOnce({
            data: {
                totalLeads: 0,
                newThisWeek: 0,
                conversionRate: 0,
                activeFollowUps: 0,
                pipeline: [],
            },
            error: null,
        });

        await fetchLeadStats('manager-1', true);

        expect(mockSupa.rpc).toHaveBeenCalledWith('get_lead_pipeline_stats', {
            p_user_id: 'manager-1',
            p_is_manager: true,
        });
    });

    it('returns zeros when RPC returns null data', async () => {
        mockSupa.rpc.mockResolvedValueOnce({ data: null, error: null });

        const result = await fetchLeadStats('agent-1', false);
        expect(result.data.totalLeads).toBe(0);
        expect(result.data.conversionRate).toBe(0);
        expect(result.data.activeFollowUps).toBe(0);
        expect(result.data.pipeline).toEqual([]);
    });

    it('returns error with zeroed stats on RPC failure', async () => {
        mockSupa.rpc.mockResolvedValueOnce({ data: null, error: { message: 'Timeout' } });

        const result = await fetchLeadStats('agent-1', false);
        expect(result.error).toBe('Timeout');
        expect(result.data.totalLeads).toBe(0);
    });
});

// ── fetchRecentActivities ──

describe('fetchRecentActivities', () => {
    it('returns activities with lead names for manager', async () => {
        // Mock users chain (fetch agents under manager)
        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, { data: [{ id: 'agent-1' }], error: null });

        // Mock leads chain (fetch team lead IDs)
        const leadsChain = mockSupa.__getChain('leads');
        mockResolve(leadsChain, { data: [{ id: 'lead-1' }], error: null });

        // Mock lead_activities chain
        const chain = mockSupa.__getChain('lead_activities');
        mockResolve(chain, {
            data: [
                {
                    id: 'act-1',
                    lead_id: 'lead-1',
                    user_id: 'agent-1',
                    type: 'note',
                    description: 'Test',
                    metadata: {},
                    created_at: '2026-03-08T10:00:00Z',
                    leads: { full_name: 'John Doe' },
                },
            ],
            error: null,
        });

        const result = await fetchRecentActivities('mgr-1', true, 5);
        expect(result.data).toHaveLength(1);
        expect(result.data[0].lead_name).toBe('John Doe');
    });

    it('filters to own leads for agent', async () => {
        // Mock leads chain (fetch agent's own lead IDs)
        const leadsChain = mockSupa.__getChain('leads');
        mockResolve(leadsChain, { data: [{ id: 'l1' }], error: null });

        // Mock lead_activities chain (only activities for own leads returned)
        const chain = mockSupa.__getChain('lead_activities');
        mockResolve(chain, {
            data: [
                {
                    id: 'a1',
                    lead_id: 'l1',
                    user_id: 'agent-1',
                    type: 'note',
                    description: '',
                    metadata: {},
                    created_at: '2026-03-08T10:00:00Z',
                    leads: { full_name: 'Mine' },
                },
            ],
            error: null,
        });

        const result = await fetchRecentActivities('agent-1', false, 5);
        expect(result.data).toHaveLength(1);
        expect(result.data[0].lead_name).toBe('Mine');
    });
});

// ── fetchManagerDashboardStats ──

describe('fetchManagerDashboardStats', () => {
    it('returns candidate and agent counts', async () => {
        const candidatesChain = mockSupa.__getChain('candidates');
        mockResolve(candidatesChain, { count: 12 });

        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, { count: 5 });

        const result = await fetchManagerDashboardStats('mgr-1', 'manager');
        expect(result.data.activeCandidates).toBe(12);
        expect(result.data.agentsManaged).toBe(5);
    });

    it('defaults to 0 when counts are null', async () => {
        const candidatesChain = mockSupa.__getChain('candidates');
        mockResolve(candidatesChain, { count: null });

        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, { count: null });

        const result = await fetchManagerDashboardStats('dir-1', 'director');
        expect(result.data.activeCandidates).toBe(0);
        expect(result.data.agentsManaged).toBe(0);
    });
});

// ── assignLead ──

describe('assignLead', () => {
    it('assigns lead to agent and logs activity', async () => {
        const leadsChain = mockSupa.__getChain('leads');
        mockResolve(leadsChain, { data: { assigned_to: 'agent-1' }, error: null });

        const activitiesChain = mockSupa.__getChain('lead_activities');
        mockResolve(activitiesChain, { error: null });

        const result = await assignLead('lead-1', 'agent-2', 'mgr-1');
        expect(result.error).toBeNull();
        expect(mockSupa.from).toHaveBeenCalledWith('lead_activities');
    });

    it('returns error when fetch fails', async () => {
        const chain = mockSupa.__getChain('leads');
        mockResolve(chain, { data: null, error: { message: 'Not found', code: 'PGRST116' } });

        const result = await assignLead('bad-id', 'agent-1', 'mgr-1');
        expect(result.error).toBeTruthy();
    });

    it('returns error when update fails', async () => {
        const chain = mockSupa.__getChain('leads');
        // First call returns existing data, second call returns update error
        // Since proxy mock resolves the same for all calls on same chain,
        // we simulate the update error case
        mockResolve(chain, { error: { message: 'Update failed' } });

        const result = await assignLead('lead-1', 'agent-2', 'mgr-1');
        expect(result.error).toBe('Update failed');
    });
});

// ── getTeamLeadSummary ──

describe('getTeamLeadSummary', () => {
    it('returns lead counts by stage and recent activities', async () => {
        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, {
            data: [{ id: 'agent-1' }, { id: 'agent-2' }],
            error: null,
        });

        const leadsChain = mockSupa.__getChain('leads');
        mockResolve(leadsChain, {
            data: [
                { id: 'l1', status: 'new', full_name: 'Lead One' },
                { id: 'l2', status: 'contacted', full_name: 'Lead Two' },
                { id: 'l3', status: 'new', full_name: 'Lead Three' },
            ],
            error: null,
        });

        const activitiesChain = mockSupa.__getChain('lead_activities');
        mockResolve(activitiesChain, {
            data: [
                { lead_id: 'l1', type: 'call', created_at: '2026-03-08T10:00:00Z' },
                { lead_id: 'l2', type: 'note', created_at: '2026-03-07T10:00:00Z' },
            ],
            error: null,
        });

        const result = await getTeamLeadSummary('mgr-1');
        expect(result.error).toBeNull();
        expect(result.data.totalLeads).toBe(3);
        expect(result.data.byStage.find((s) => s.stage === 'new')?.count).toBe(2);
        expect(result.data.byStage.find((s) => s.stage === 'contacted')?.count).toBe(1);
        expect(result.data.recentActivity).toHaveLength(2);
        expect(result.data.recentActivity[0].lead_name).toBe('Lead One');
    });

    it('returns empty result when no agents found', async () => {
        const chain = mockSupa.__getChain('users');
        mockResolve(chain, { data: [], error: null });

        const result = await getTeamLeadSummary('mgr-1');
        expect(result.error).toBeNull();
        expect(result.data.totalLeads).toBe(0);
        expect(result.data.byStage).toEqual([]);
    });

    it('returns error when agents query fails', async () => {
        const chain = mockSupa.__getChain('users');
        mockResolve(chain, { data: null, error: { message: 'Permission denied' } });

        const result = await getTeamLeadSummary('mgr-1');
        expect(result.error).toBe('Permission denied');
    });
});
