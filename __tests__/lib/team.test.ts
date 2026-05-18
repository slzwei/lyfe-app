/**
 * Tests for lib/team.ts — Team member service functions
 */
import { supabase } from '@/lib/supabase';

import {
    fetchTeamMembers,
    fetchTeamMember,
    fetchReassignableManagers,
    getTeamPerformance,
    fetchManagerOverview,
} from '@/lib/team';

jest.mock('@/lib/supabase');

const mockSupa = supabase as any;

function mockResolve(chain: any, value: any) {
    chain.__resolveWith(value);
}

/** Helper for the new get_team_lead_stats RPC. Takes the legacy
 * per-row leads array (from the original test fixtures) and returns
 * the pre-aggregated shape the RPC produces. Keeps existing tests
 * intent-preserving without restructuring fixtures. */
function rpcStatsFromLeads(
    leads: { assigned_to: string; status: string; updated_at?: string | null }[],
    staleDays = 7,
) {
    const staleCutoff = Date.now() - staleDays * 86400000;
    const map: Record<
        string,
        {
            user_id: string;
            total_count: number;
            open_count: number;
            stale_count: number;
            won_count: number;
            last_updated_at: string | null;
        }
    > = {};
    for (const l of leads) {
        const m = (map[l.assigned_to] ||= {
            user_id: l.assigned_to,
            total_count: 0,
            open_count: 0,
            stale_count: 0,
            won_count: 0,
            last_updated_at: null,
        });
        m.total_count++;
        if (l.status === 'won') m.won_count++;
        if (l.status !== 'won' && l.status !== 'lost') {
            m.open_count++;
            if (l.updated_at && new Date(l.updated_at).getTime() < staleCutoff) m.stale_count++;
        }
        if (
            l.updated_at &&
            (!m.last_updated_at || new Date(l.updated_at).getTime() > new Date(m.last_updated_at).getTime())
        ) {
            m.last_updated_at = l.updated_at;
        }
    }
    return Object.values(map);
}

function mockTeamStatsRpc(leads: { assigned_to: string; status: string; updated_at?: string | null }[]) {
    mockSupa.rpc.mockImplementation((name: string) => {
        if (name === 'get_team_lead_stats') {
            return Promise.resolve({ data: rpcStatsFromLeads(leads), error: null });
        }
        return Promise.resolve({ data: null, error: null });
    });
}

// ── Fixtures ──

const USER_AGENT = {
    id: 'agent-1',
    full_name: 'Agent Alice',
    role: 'agent',
    phone: '+6591111111',
    email: 'alice@example.com',
    avatar_url: 'https://avatar.com/alice.jpg',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
};

const USER_AGENT_2 = {
    id: 'agent-2',
    full_name: 'Agent Bob',
    role: 'agent',
    phone: '+6592222222',
    email: null,
    avatar_url: null,
    is_active: true,
    created_at: '2026-02-01T00:00:00Z',
};

beforeEach(() => {
    mockSupa.__resetChains();
    jest.clearAllMocks();
});

// ── fetchTeamMembers ──

describe('fetchTeamMembers', () => {
    it('returns members with aggregated lead stats', async () => {
        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, { data: [USER_AGENT, USER_AGENT_2], error: null });

        // get_team_lead_stats now returns pre-aggregated rows. Helper computes
        // the same aggregation server-side would, from the same fixture leads.
        mockTeamStatsRpc([
            { assigned_to: 'agent-1', status: 'won' },
            { assigned_to: 'agent-1', status: 'new' },
            { assigned_to: 'agent-1', status: 'lost' },
            { assigned_to: 'agent-2', status: 'new' },
        ]);

        const result = await fetchTeamMembers('mgr-1', 'manager');
        expect(result.error).toBeNull();
        expect(result.data).toHaveLength(2);

        const alice = result.data.find((m) => m.id === 'agent-1')!;
        expect(alice.name).toBe('Agent Alice');
        expect(alice.leadsCount).toBe(3);
        expect(alice.wonCount).toBe(1);
        expect(alice.conversionRate).toBe(33); // Math.round(1/3 * 100)

        const bob = result.data.find((m) => m.id === 'agent-2')!;
        expect(bob.leadsCount).toBe(1);
        expect(bob.wonCount).toBe(0);
        expect(bob.conversionRate).toBe(0);
    });

    it('returns empty when no users found', async () => {
        const chain = mockSupa.__getChain('users');
        mockResolve(chain, { data: [], error: null });

        const result = await fetchTeamMembers('mgr-1', 'manager');
        expect(result.data).toEqual([]);
        expect(result.error).toBeNull();
    });

    it('can scope team members to test-data rows for test accounts', async () => {
        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, { data: [USER_AGENT], error: null });
        mockTeamStatsRpc([]);

        const result = await fetchTeamMembers('mgr-1', 'manager', true);

        expect(result.error).toBeNull();
        expect(result.data).toHaveLength(1);
        expect(usersChain.__calls).toContainEqual({ method: 'eq', args: ['is_test_data', true] });
        expect(usersChain.__calls).not.toContainEqual({ method: 'eq', args: ['is_test_data', false] });
    });

    it('returns error on query failure', async () => {
        const chain = mockSupa.__getChain('users');
        mockResolve(chain, { data: null, error: { message: 'DB error' } });

        const result = await fetchTeamMembers('mgr-1', 'manager');
        expect(result.error).toBe('DB error');
        expect(result.data).toEqual([]);
    });

    it('handles members with no leads', async () => {
        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, { data: [USER_AGENT], error: null });

        mockTeamStatsRpc([]);

        const result = await fetchTeamMembers('mgr-1', 'director');
        expect(result.data[0].leadsCount).toBe(0);
        expect(result.data[0].conversionRate).toBe(0);
    });

    it('defaults is_active to true when null', async () => {
        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, { data: [{ ...USER_AGENT, is_active: null }], error: null });

        mockTeamStatsRpc([]);

        const result = await fetchTeamMembers('mgr-1', 'manager');
        expect(result.data[0].isActive).toBe(true);
    });

    it('director: scopes to own managers + those managers agents', async () => {
        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, { data: [USER_AGENT], error: null });

        mockTeamStatsRpc([]);

        const result = await fetchTeamMembers('dir-1', 'director');
        expect(result.error).toBeNull();
        expect(result.data.length).toBeGreaterThan(0);

        const calls = usersChain.__calls;
        // Pre-query 1: managers reporting to director
        expect(calls).toContainEqual({ method: 'eq', args: ['reports_to', 'dir-1'] });
        expect(calls).toContainEqual({ method: 'eq', args: ['role', 'manager'] });
        // Pre-query 2: agents reporting to those managers
        expect(calls.some((c: { method: string }) => c.method === 'in')).toBe(true);
    });

    it('director: returns empty when no managers report to them', async () => {
        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, { data: [], error: null });

        const result = await fetchTeamMembers('dir-1', 'director');
        expect(result.data).toEqual([]);
        expect(result.error).toBeNull();
    });

    it('director: propagates error from manager-lookup query', async () => {
        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, { data: null, error: { message: 'RLS denied' } });

        const result = await fetchTeamMembers('dir-1', 'director');
        expect(result.error).toBe('RLS denied');
        expect(result.data).toEqual([]);
    });

    it('manager rows include outstanding-candidate and team-size counts; agents do not', async () => {
        const USER_MANAGER = {
            id: 'mgr-1',
            full_name: 'Manager Mei',
            role: 'manager',
            phone: '+6593333333',
            email: 'mei@example.com',
            avatar_url: null,
            is_active: true,
            created_at: '2025-12-01T00:00:00Z',
        };

        const usersChain = mockSupa.__getChain('users');
        // Final users fetch returns one manager + one agent. The manager-stats
        // query also hits 'users', but the chain is shared and only the last
        // resolution sticks — that's fine because we don't assert on agentRows
        // here, just on the final aggregation paths exercised by the candidates fetch.
        mockResolve(usersChain, { data: [USER_MANAGER, USER_AGENT], error: null });

        mockTeamStatsRpc([]);

        const candidatesChain = mockSupa.__getChain('candidates');
        mockResolve(candidatesChain, {
            data: [
                { assigned_manager_id: 'mgr-1', status: 'applied' }, // outstanding
                { assigned_manager_id: 'mgr-1', status: 'interviewed' }, // outstanding
                { assigned_manager_id: 'mgr-1', status: 'licensed' }, // terminal — excluded
                { assigned_manager_id: 'mgr-1', status: 'rejected' }, // terminal — excluded
            ],
            error: null,
        });

        const result = await fetchTeamMembers('dir-1', 'director');
        expect(result.error).toBeNull();

        const mgr = result.data.find((m) => m.id === 'mgr-1')!;
        expect(mgr.outstandingCandidatesCount).toBe(2);
        // teamSize comes from the shared 'users' chain which last resolved with
        // [manager + agent]; the agent has reports_to undefined in the fixture,
        // so it's filtered out by the row.reports_to guard. Expect 0.
        expect(mgr.teamSize).toBe(0);

        const agent = result.data.find((m) => m.id === 'agent-1')!;
        expect(agent.outstandingCandidatesCount).toBeUndefined();
        expect(agent.teamSize).toBeUndefined();
    });
});

// ── fetchTeamMember ──

describe('fetchTeamMember', () => {
    it('returns member with leads and computed stats', async () => {
        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, { data: USER_AGENT, error: null });

        const leadsChain = mockSupa.__getChain('leads');
        mockResolve(leadsChain, {
            data: [
                { id: 'l1', status: 'won', assigned_to: 'agent-1', full_name: 'Lead 1', updated_at: '2026-03-05' },
                { id: 'l2', status: 'new', assigned_to: 'agent-1', full_name: 'Lead 2', updated_at: '2026-03-01' },
            ],
            error: null,
        });

        const result = await fetchTeamMember('agent-1');
        expect(result.error).toBeNull();
        expect(result.member?.name).toBe('Agent Alice');
        expect(result.member?.leadsCount).toBe(2);
        expect(result.member?.wonCount).toBe(1);
        expect(result.member?.conversionRate).toBe(50); // 1/2 * 100
        expect(result.leads).toHaveLength(2);
    });

    it('returns error when user not found', async () => {
        const chain = mockSupa.__getChain('users');
        mockResolve(chain, { data: null, error: { message: 'Not found' } });

        const result = await fetchTeamMember('bad-id');
        expect(result.error).toBe('Not found');
        expect(result.member).toBeNull();
        expect(result.leads).toEqual([]);
    });

    it('returns error when leads query fails', async () => {
        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, { data: USER_AGENT, error: null });

        const leadsChain = mockSupa.__getChain('leads');
        mockResolve(leadsChain, { data: null, error: { message: 'Leads error' } });

        const result = await fetchTeamMember('agent-1');
        expect(result.error).toBe('Leads error');
    });

    it('handles zero leads correctly', async () => {
        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, { data: USER_AGENT, error: null });

        const leadsChain = mockSupa.__getChain('leads');
        mockResolve(leadsChain, { data: [], error: null });

        const result = await fetchTeamMember('agent-1');
        expect(result.member?.leadsCount).toBe(0);
        expect(result.member?.conversionRate).toBe(0);
        expect(result.leads).toEqual([]);
    });
});

// ── fetchReassignableManagers ──

describe('fetchReassignableManagers', () => {
    it('can scope manager picker results to test-data rows', async () => {
        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, {
            data: [{ id: 'mgr-2', full_name: 'Manager Two', role: 'manager' }],
            error: null,
        });

        const result = await fetchReassignableManagers(null, null, true);

        expect(result.error).toBeNull();
        expect(result.data).toEqual([{ id: 'mgr-2', fullName: 'Manager Two', role: 'manager' }]);
        expect(usersChain.__calls).toContainEqual({ method: 'eq', args: ['is_test_data', true] });
        expect(usersChain.__calls).not.toContainEqual({ method: 'eq', args: ['is_test_data', false] });
    });
});

// ── getTeamPerformance ──

describe('getTeamPerformance', () => {
    it('returns performance metrics per agent', async () => {
        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, {
            data: [
                { id: 'agent-1', full_name: 'Agent Alice' },
                { id: 'agent-2', full_name: 'Agent Bob' },
            ],
            error: null,
        });

        const leadsChain = mockSupa.__getChain('leads');
        mockResolve(leadsChain, {
            data: [
                { assigned_to: 'agent-1', status: 'won' },
                { assigned_to: 'agent-1', status: 'lost' },
                { assigned_to: 'agent-2', status: 'won' },
            ],
            error: null,
        });

        const activitiesChain = mockSupa.__getChain('lead_activities');
        mockResolve(activitiesChain, {
            data: [{ user_id: 'agent-1' }, { user_id: 'agent-1' }, { user_id: 'agent-1' }, { user_id: 'agent-2' }],
            error: null,
        });

        const dateRange = { start: '2026-03-01', end: '2026-03-08' };
        const result = await getTeamPerformance('mgr-1', dateRange);

        expect(result.error).toBeNull();
        expect(result.data.totalClosed).toBe(3);
        expect(result.data.totalActivities).toBe(4);

        const alice = result.data.agents.find((a) => a.agentId === 'agent-1')!;
        expect(alice.leadsClosed).toBe(2);
        expect(alice.leadsWon).toBe(1);
        expect(alice.leadsLost).toBe(1);
        expect(alice.activitiesLogged).toBe(3);

        const bob = result.data.agents.find((a) => a.agentId === 'agent-2')!;
        expect(bob.leadsClosed).toBe(1);
        expect(bob.leadsWon).toBe(1);
        expect(bob.activitiesLogged).toBe(1);
    });

    it('can scope analytics agents to test-data rows', async () => {
        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, { data: [{ id: 'agent-1', full_name: 'Agent Alice' }], error: null });

        const leadsChain = mockSupa.__getChain('leads');
        mockResolve(leadsChain, { data: [], error: null });

        const activitiesChain = mockSupa.__getChain('lead_activities');
        mockResolve(activitiesChain, { data: [], error: null });

        const result = await getTeamPerformance('mgr-1', { start: '2026-03-01', end: '2026-03-08' }, true);

        expect(result.error).toBeNull();
        expect(usersChain.__calls).toContainEqual({ method: 'eq', args: ['is_test_data', true] });
        expect(usersChain.__calls).not.toContainEqual({ method: 'eq', args: ['is_test_data', false] });
    });

    it('returns empty result when no agents', async () => {
        const chain = mockSupa.__getChain('users');
        mockResolve(chain, { data: [], error: null });

        const dateRange = { start: '2026-03-01', end: '2026-03-08' };
        const result = await getTeamPerformance('mgr-1', dateRange);

        expect(result.error).toBeNull();
        expect(result.data.agents).toEqual([]);
        expect(result.data.totalClosed).toBe(0);
    });

    it('returns error when agents query fails', async () => {
        const chain = mockSupa.__getChain('users');
        mockResolve(chain, { data: null, error: { message: 'Permission denied' } });

        const dateRange = { start: '2026-03-01', end: '2026-03-08' };
        const result = await getTeamPerformance('mgr-1', dateRange);

        expect(result.error).toBe('Permission denied');
    });

    it('returns error when date range is invalid (start > end)', async () => {
        const dateRange = { start: '2026-03-10', end: '2026-03-01' };
        const result = await getTeamPerformance('mgr-1', dateRange);

        expect(result.error).toBe('Invalid date range: start must be before or equal to end');
        expect(result.data.agents).toEqual([]);
    });
});

// ── fetchManagerOverview ──

describe('fetchManagerOverview', () => {
    const NOW = new Date('2026-04-26T00:00:00Z');

    const MANAGER_ROW = {
        id: 'mgr-1',
        full_name: 'Manager Mei',
        role: 'manager',
        phone: '+6593333333',
        email: 'mei@example.com',
        avatar_url: null,
        is_active: true,
        created_at: '2025-10-01T00:00:00Z',
        reports_to: null,
    };

    it('aggregates outstanding candidate pipeline by stage and excludes terminal statuses', async () => {
        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, { data: MANAGER_ROW, error: null });

        const candidatesChain = mockSupa.__getChain('candidates');
        mockResolve(candidatesChain, {
            data: [
                {
                    id: 'c1',
                    name: 'Cand A',
                    status: 'applied',
                    stage_entered_at: '2026-04-20T00:00:00Z',
                    updated_at: '2026-04-20T00:00:00Z',
                    converted_to_agent_at: null,
                },
                {
                    id: 'c2',
                    name: 'Cand B',
                    status: 'interviewed',
                    stage_entered_at: '2026-04-10T00:00:00Z',
                    updated_at: '2026-04-15T00:00:00Z',
                    converted_to_agent_at: null,
                },
                {
                    id: 'c3',
                    name: 'Cand C',
                    status: 'licensed',
                    stage_entered_at: '2026-04-22T00:00:00Z',
                    updated_at: '2026-04-22T00:00:00Z',
                    converted_to_agent_at: '2026-04-22T00:00:00Z',
                },
                {
                    id: 'c4',
                    name: 'Cand D',
                    status: 'rejected',
                    stage_entered_at: null,
                    updated_at: '2026-04-01T00:00:00Z',
                    converted_to_agent_at: null,
                },
            ],
            error: null,
        });

        const result = await fetchManagerOverview('mgr-1', 30, NOW);
        expect(result.error).toBeNull();
        expect(result.data).not.toBeNull();

        const pipeline = result.data!.candidatePipeline;
        expect(pipeline.outstandingTotal).toBe(2);
        expect(pipeline.byStage).toEqual({ applied: 1, interviewed: 1 });
    });

    it('can scope manager roster agents to test-data rows', async () => {
        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, { data: MANAGER_ROW, error: null });

        const candidatesChain = mockSupa.__getChain('candidates');
        mockResolve(candidatesChain, { data: [], error: null });

        const leadsChain = mockSupa.__getChain('leads');
        mockResolve(leadsChain, { data: [], error: null });

        const activitiesChain = mockSupa.__getChain('lead_activities');
        mockResolve(activitiesChain, { data: [], error: null });

        const result = await fetchManagerOverview('mgr-1', 30, NOW, true);

        expect(result.error).toBeNull();
        expect(usersChain.__calls).toContainEqual({ method: 'eq', args: ['is_test_data', true] });
        expect(usersChain.__calls).not.toContainEqual({ method: 'eq', args: ['is_test_data', false] });
    });

    it('sorts recently-updated candidates by oldest stage_entered_at first', async () => {
        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, { data: MANAGER_ROW, error: null });

        const candidatesChain = mockSupa.__getChain('candidates');
        mockResolve(candidatesChain, {
            data: [
                {
                    id: 'recent',
                    name: 'Recent',
                    status: 'applied',
                    stage_entered_at: '2026-04-25T00:00:00Z', // 1 day ago
                    updated_at: '2026-04-25T00:00:00Z',
                    converted_to_agent_at: null,
                },
                {
                    id: 'oldest',
                    name: 'Oldest',
                    status: 'interviewed',
                    stage_entered_at: '2026-04-01T00:00:00Z', // 25 days ago
                    updated_at: '2026-04-01T00:00:00Z',
                    converted_to_agent_at: null,
                },
                {
                    id: 'mid',
                    name: 'Mid',
                    status: 'approved',
                    stage_entered_at: '2026-04-15T00:00:00Z', // 11 days ago
                    updated_at: '2026-04-15T00:00:00Z',
                    converted_to_agent_at: null,
                },
            ],
            error: null,
        });

        const result = await fetchManagerOverview('mgr-1', 30, NOW);
        const ordered = result.data!.candidatePipeline.recentlyUpdated.map((r) => r.id);
        expect(ordered).toEqual(['oldest', 'mid', 'recent']);
        expect(result.data!.candidatePipeline.recentlyUpdated[0].daysSinceLastUpdate).toBe(25);
        expect(result.data!.candidatePipeline.recentlyUpdated[2].daysSinceLastUpdate).toBe(1);
    });

    it('falls back to updated_at when stage_entered_at is missing', async () => {
        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, { data: MANAGER_ROW, error: null });

        const candidatesChain = mockSupa.__getChain('candidates');
        mockResolve(candidatesChain, {
            data: [
                {
                    id: 'x',
                    name: 'X',
                    status: 'applied',
                    stage_entered_at: null,
                    updated_at: '2026-04-20T00:00:00Z', // 6 days ago
                    converted_to_agent_at: null,
                },
            ],
            error: null,
        });

        const result = await fetchManagerOverview('mgr-1', 30, NOW);
        expect(result.data!.candidatePipeline.recentlyUpdated[0].daysSinceLastUpdate).toBe(6);
    });

    it('returns error when manager not found', async () => {
        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, { data: null, error: { message: 'Not found' } });

        const result = await fetchManagerOverview('bad-id', 30, NOW);
        expect(result.error).toBe('Not found');
        expect(result.data).toBeNull();
    });

    it('returns error when candidates query fails', async () => {
        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, { data: MANAGER_ROW, error: null });

        const candidatesChain = mockSupa.__getChain('candidates');
        mockResolve(candidatesChain, { data: null, error: { message: 'RLS denied' } });

        const result = await fetchManagerOverview('mgr-1', 30, NOW);
        expect(result.error).toBe('RLS denied');
        expect(result.data).toBeNull();
    });

    it('returns zero-state outputs when manager has no candidates', async () => {
        const usersChain = mockSupa.__getChain('users');
        mockResolve(usersChain, { data: MANAGER_ROW, error: null });

        const candidatesChain = mockSupa.__getChain('candidates');
        mockResolve(candidatesChain, { data: [], error: null });

        const result = await fetchManagerOverview('mgr-1', 30, NOW);
        expect(result.error).toBeNull();
        expect(result.data!.candidatePipeline.outstandingTotal).toBe(0);
        expect(result.data!.candidatePipeline.byStage).toEqual({});
        expect(result.data!.candidatePipeline.recentlyUpdated).toEqual([]);
        expect(result.data!.manager.id).toBe('mgr-1');
        expect(result.data!.manager.role).toBe('manager');
    });
});
