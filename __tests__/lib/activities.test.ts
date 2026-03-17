/**
 * Tests for lib/activities.ts — Activity tracking service functions
 */
import { supabase } from '@/lib/supabase';

import { getAgentActivitySummary, getTeamActivitySummaries } from '@/lib/activities';

jest.mock('@/lib/supabase');

const mockSupa = supabase as any;

function mockResolve(chain: any, value: any) {
    chain.__resolveWith(value);
}

// ── Fixtures ──

const ACTIVITY = {
    id: 'act-1',
    lead_id: 'lead-1',
    user_id: 'agent-1',
    type: 'call',
    description: 'Discussed policy options',
    metadata: { duration: '10min' },
    created_at: '2026-03-05T10:00:00Z',
};

beforeEach(() => {
    mockSupa.__resetChains();
    jest.clearAllMocks();
});

// ── getAgentActivitySummary ──

describe('getAgentActivitySummary', () => {
    it('returns activity counts grouped by type', async () => {
        const chain = mockSupa.__getChain('lead_activities');
        mockResolve(chain, {
            data: [{ type: 'call' }, { type: 'call' }, { type: 'meeting' }, { type: 'note' }, { type: 'call' }],
            error: null,
        });

        const dateRange = { start: '2026-03-01', end: '2026-03-08' };
        const result = await getAgentActivitySummary('agent-1', dateRange);

        expect(result.error).toBeNull();
        expect(result.data.totalActivities).toBe(5);
        expect(result.data.agentId).toBe('agent-1');
        expect(result.data.dateRange).toEqual(dateRange);

        const callCount = result.data.byType.find((t) => t.type === 'call');
        expect(callCount?.count).toBe(3);

        const meetingCount = result.data.byType.find((t) => t.type === 'meeting');
        expect(meetingCount?.count).toBe(1);
    });

    it('returns empty summary when no activities', async () => {
        const chain = mockSupa.__getChain('lead_activities');
        mockResolve(chain, { data: [], error: null });

        const dateRange = { start: '2026-03-01', end: '2026-03-08' };
        const result = await getAgentActivitySummary('agent-1', dateRange);

        expect(result.error).toBeNull();
        expect(result.data.totalActivities).toBe(0);
        expect(result.data.byType).toEqual([]);
    });

    it('returns error on failure', async () => {
        const chain = mockSupa.__getChain('lead_activities');
        mockResolve(chain, { data: null, error: { message: 'Timeout' } });

        const dateRange = { start: '2026-03-01', end: '2026-03-08' };
        const result = await getAgentActivitySummary('agent-1', dateRange);

        expect(result.error).toBe('Timeout');
        expect(result.data.totalActivities).toBe(0);
    });

    it('returns error when date range is invalid (start > end)', async () => {
        const dateRange = { start: '2026-03-10', end: '2026-03-01' };
        const result = await getAgentActivitySummary('agent-1', dateRange);

        expect(result.error).toBe('Invalid date range: start must be before or equal to end');
        expect(result.data.totalActivities).toBe(0);
    });

    it('accepts same start and end date', async () => {
        const chain = mockSupa.__getChain('lead_activities');
        mockResolve(chain, { data: [{ type: 'call' }], error: null });

        const dateRange = { start: '2026-03-05', end: '2026-03-05' };
        const result = await getAgentActivitySummary('agent-1', dateRange);

        expect(result.error).toBeNull();
        expect(result.data.totalActivities).toBe(1);
    });
});

// ── getTeamActivitySummaries (batch) ──

describe('getTeamActivitySummaries', () => {
    it('aggregates activities for multiple agents in a single query', async () => {
        const chain = mockSupa.__getChain('lead_activities');
        mockResolve(chain, {
            data: [
                { user_id: 'agent-1', type: 'call' },
                { user_id: 'agent-1', type: 'call' },
                { user_id: 'agent-1', type: 'meeting' },
                { user_id: 'agent-2', type: 'note' },
                { user_id: 'agent-2', type: 'email' },
                { user_id: 'agent-2', type: 'email' },
            ],
            error: null,
        });

        const dateRange = { start: '2026-03-01', end: '2026-03-08' };
        const result = await getTeamActivitySummaries(['agent-1', 'agent-2'], dateRange);

        expect(result.error).toBeNull();
        expect(result.data).toHaveLength(2);

        // Agent 1: 3 total (2 calls + 1 meeting)
        const agent1 = result.data.find((s) => s.agentId === 'agent-1')!;
        expect(agent1.totalActivities).toBe(3);
        expect(agent1.byType.find((t) => t.type === 'call')?.count).toBe(2);
        expect(agent1.byType.find((t) => t.type === 'meeting')?.count).toBe(1);

        // Agent 2: 3 total (1 note + 2 emails)
        const agent2 = result.data.find((s) => s.agentId === 'agent-2')!;
        expect(agent2.totalActivities).toBe(3);
        expect(agent2.byType.find((t) => t.type === 'note')?.count).toBe(1);
        expect(agent2.byType.find((t) => t.type === 'email')?.count).toBe(2);
    });

    it('returns empty summaries for agents with no activities', async () => {
        const chain = mockSupa.__getChain('lead_activities');
        mockResolve(chain, {
            data: [{ user_id: 'agent-1', type: 'call' }],
            error: null,
        });

        const dateRange = { start: '2026-03-01', end: '2026-03-08' };
        const result = await getTeamActivitySummaries(['agent-1', 'agent-2'], dateRange);

        expect(result.error).toBeNull();
        expect(result.data).toHaveLength(2);

        const agent2 = result.data.find((s) => s.agentId === 'agent-2')!;
        expect(agent2.totalActivities).toBe(0);
        expect(agent2.byType).toEqual([]);
    });

    it('returns empty array for empty agentIds', async () => {
        const dateRange = { start: '2026-03-01', end: '2026-03-08' };
        const result = await getTeamActivitySummaries([], dateRange);

        expect(result.error).toBeNull();
        expect(result.data).toEqual([]);
    });

    it('returns error on DB failure', async () => {
        const chain = mockSupa.__getChain('lead_activities');
        mockResolve(chain, { data: null, error: { message: 'Connection failed' } });

        const dateRange = { start: '2026-03-01', end: '2026-03-08' };
        const result = await getTeamActivitySummaries(['agent-1'], dateRange);

        expect(result.error).toBe('Connection failed');
        expect(result.data).toEqual([]);
    });

    it('returns error when date range is invalid', async () => {
        const dateRange = { start: '2026-03-10', end: '2026-03-01' };
        const result = await getTeamActivitySummaries(['agent-1'], dateRange);

        expect(result.error).toBe('Invalid date range: start must be before or equal to end');
        expect(result.data).toEqual([]);
    });

    it('preserves input agent order', async () => {
        const chain = mockSupa.__getChain('lead_activities');
        mockResolve(chain, {
            data: [
                { user_id: 'agent-3', type: 'call' },
                { user_id: 'agent-1', type: 'note' },
            ],
            error: null,
        });

        const dateRange = { start: '2026-03-01', end: '2026-03-08' };
        const result = await getTeamActivitySummaries(['agent-1', 'agent-2', 'agent-3'], dateRange);

        expect(result.data[0].agentId).toBe('agent-1');
        expect(result.data[1].agentId).toBe('agent-2');
        expect(result.data[2].agentId).toBe('agent-3');
    });
});
