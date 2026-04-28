import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useDashboard, formatActivities } from '@/hooks/useDashboard';
import type { LeadActivity } from '@/types/lead';

// ── Mock setup ──────────────────────────────────────────────
jest.mock('@/lib/supabase');

const mockFetchLeadStats = jest.fn();
const mockFetchRecentActivities = jest.fn();
const mockFetchManagerDashboardStats = jest.fn();

jest.mock('@/lib/leads', () => ({
    fetchLeadStats: (...args: any[]) => mockFetchLeadStats(...args),
    fetchRecentActivities: (...args: any[]) => mockFetchRecentActivities(...args),
    fetchManagerDashboardStats: (...args: any[]) => mockFetchManagerDashboardStats(...args),
}));

const mockFetchUpcomingEvents = jest.fn();

jest.mock('@/lib/events', () => ({
    fetchUpcomingEvents: (...args: any[]) => mockFetchUpcomingEvents(...args),
}));

const mockFetchCandidateRoadmap = jest.fn();
const mockGetCandidateIdForUser = jest.fn();

jest.mock('@/lib/roadmap', () => ({
    fetchCandidateRoadmap: (...args: any[]) => mockFetchCandidateRoadmap(...args),
    getCandidateIdForUser: (...args: any[]) => mockGetCandidateIdForUser(...args),
}));

const mockFetchPAManagerIds = jest.fn();
const mockFetchPACandidateCount = jest.fn();
const mockFetchPAInterviewCount = jest.fn();

jest.mock('@/lib/recruitment', () => ({
    fetchPAManagerIds: (...args: any[]) => mockFetchPAManagerIds(...args),
    fetchPACandidateCount: (...args: any[]) => mockFetchPACandidateCount(...args),
    fetchPAInterviewCount: (...args: any[]) => mockFetchPAInterviewCount(...args),
}));

jest.mock('@/lib/dateTime', () => ({
    timeAgo: (dateStr: string) => '5m ago',
}));

// ── Helpers & fixtures ──────────────────────────────────────

const defaultStats = {
    totalLeads: 10,
    newThisWeek: 3,
    conversionRate: 25,
    activeFollowUps: 4,
    pipeline: [
        { status: 'new', count: 3 },
        { status: 'contacted', count: 2 },
    ],
};

const defaultActivities: (LeadActivity & { lead_name?: string })[] = [
    {
        id: 'a1',
        lead_id: 'l1',
        user_id: 'u1',
        type: 'created',
        description: null,
        metadata: {},
        created_at: '2026-03-17T10:00:00Z',
        lead_name: 'Alice',
    },
    {
        id: 'a2',
        lead_id: 'l2',
        user_id: 'u1',
        type: 'status_change',
        description: '',
        metadata: { from_status: 'new', to_status: 'contacted' },
        created_at: '2026-03-17T09:30:00Z',
        lead_name: 'Bob',
    },
];

const defaultManagerStats = { activeCandidates: 5, agentsManaged: 3 };

const defaultEvents = [
    { id: 'ev1', title: 'Team Meeting', event_date: '2026-03-20', start_time: '10:00' },
    { id: 'ev2', title: 'Training', event_date: '2026-03-21', start_time: '14:00' },
];

const defaultRoadmap = [
    { id: 'prog1', name: 'SeedLYFE', modules: [], completedCount: 2, totalCount: 5, percentage: 40, isLocked: false },
];

function setupAgentMocks() {
    mockFetchLeadStats.mockResolvedValue({ data: defaultStats, error: null });
    mockFetchRecentActivities.mockResolvedValue({ data: defaultActivities, error: null });
    mockFetchManagerDashboardStats.mockResolvedValue({ data: null, error: null });
    mockFetchUpcomingEvents.mockResolvedValue({ data: defaultEvents });
}

function setupManagerMocks() {
    mockFetchLeadStats.mockResolvedValue({ data: defaultStats, error: null });
    mockFetchRecentActivities.mockResolvedValue({ data: defaultActivities, error: null });
    mockFetchManagerDashboardStats.mockResolvedValue({ data: defaultManagerStats, error: null });
    mockFetchUpcomingEvents.mockResolvedValue({ data: defaultEvents });
}

function setupCandidateMocks() {
    mockGetCandidateIdForUser.mockResolvedValue('cand1-candidate-id');
    mockFetchCandidateRoadmap.mockResolvedValue({ data: defaultRoadmap });
    mockFetchUpcomingEvents.mockResolvedValue({ data: defaultEvents });
}

function setupPAMocks() {
    mockFetchPAManagerIds.mockResolvedValue(['mgr1', 'mgr2']);
    mockFetchPACandidateCount.mockResolvedValue(12);
    mockFetchPAInterviewCount.mockResolvedValue(3);
    mockFetchUpcomingEvents.mockResolvedValue({ data: defaultEvents });
}

// ── Tests ───────────────────────────────────────────────────

describe('formatActivities', () => {
    it('formats a "created" activity with default detail', () => {
        const input: (LeadActivity & { lead_name?: string })[] = [
            {
                id: '1',
                lead_id: 'l1',
                user_id: 'u1',
                type: 'created',
                description: null,
                metadata: {},
                created_at: '2026-03-17T08:00:00Z',
                lead_name: 'Alice',
            },
        ];
        const result = formatActivities(input);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            id: '1',
            type: 'created',
            leadName: 'Alice',
            detail: 'Lead created',
            time: '5m ago',
            icon: 'add-circle',
        });
    });

    it('formats a "created" activity with a custom description', () => {
        const input: (LeadActivity & { lead_name?: string })[] = [
            {
                id: '1',
                lead_id: 'l1',
                user_id: 'u1',
                type: 'created',
                description: 'Imported from CSV',
                metadata: {},
                created_at: '2026-03-17T08:00:00Z',
                lead_name: 'Bob',
            },
        ];
        const result = formatActivities(input);
        expect(result[0].detail).toBe('Imported from CSV');
    });

    it('formats a "status_change" activity with from/to', () => {
        const input: (LeadActivity & { lead_name?: string })[] = [
            {
                id: '2',
                lead_id: 'l2',
                user_id: 'u1',
                type: 'status_change',
                description: '',
                metadata: { from_status: 'new', to_status: 'contacted' },
                created_at: '2026-03-17T09:00:00Z',
                lead_name: 'Charlie',
            },
        ];
        const result = formatActivities(input);
        expect(result[0].detail).toBe('New \u2192 Contacted');
        expect(result[0].icon).toBe('swap-horizontal');
    });

    it('handles status_change with missing metadata fields', () => {
        const input: (LeadActivity & { lead_name?: string })[] = [
            {
                id: '3',
                lead_id: 'l3',
                user_id: 'u1',
                type: 'status_change',
                description: null,
                metadata: {},
                created_at: '2026-03-17T09:00:00Z',
            },
        ];
        const result = formatActivities(input);
        expect(result[0].detail).toBe('? \u2192 ?');
        expect(result[0].leadName).toBe('Unknown');
    });

    it('formats a "note" activity, truncating long descriptions', () => {
        const longDesc = 'A'.repeat(60);
        const input: (LeadActivity & { lead_name?: string })[] = [
            {
                id: '4',
                lead_id: 'l4',
                user_id: 'u1',
                type: 'note',
                description: longDesc,
                metadata: {},
                created_at: '2026-03-17T10:00:00Z',
                lead_name: 'Dave',
            },
        ];
        const result = formatActivities(input);
        expect(result[0].detail).toBe(`Note: ${'A'.repeat(40)}...`);
    });

    it('formats a "note" activity with short description (no truncation)', () => {
        const input: (LeadActivity & { lead_name?: string })[] = [
            {
                id: '5',
                lead_id: 'l5',
                user_id: 'u1',
                type: 'note',
                description: 'Quick follow-up call',
                metadata: {},
                created_at: '2026-03-17T10:00:00Z',
                lead_name: 'Eve',
            },
        ];
        const result = formatActivities(input);
        expect(result[0].detail).toBe('Note: Quick follow-up call');
    });

    it('formats a "note" activity with no description', () => {
        const input: (LeadActivity & { lead_name?: string })[] = [
            {
                id: '6',
                lead_id: 'l6',
                user_id: 'u1',
                type: 'note',
                description: null,
                metadata: {},
                created_at: '2026-03-17T10:00:00Z',
            },
        ];
        const result = formatActivities(input);
        expect(result[0].detail).toBe('Added a note');
    });

    it('falls back to description for other activity types', () => {
        const input: (LeadActivity & { lead_name?: string })[] = [
            {
                id: '7',
                lead_id: 'l7',
                user_id: 'u1',
                type: 'call',
                description: 'Called about renewal',
                metadata: {},
                created_at: '2026-03-17T11:00:00Z',
                lead_name: 'Frank',
            },
        ];
        const result = formatActivities(input);
        expect(result[0].detail).toBe('Called about renewal');
        expect(result[0].icon).toBe('call');
    });

    it('uses "ellipse" icon for unknown activity types', () => {
        const input: (LeadActivity & { lead_name?: string })[] = [
            {
                id: '8',
                lead_id: 'l8',
                user_id: 'u1',
                type: 'unknown_type' as any,
                description: 'Something',
                metadata: {},
                created_at: '2026-03-17T12:00:00Z',
            },
        ];
        const result = formatActivities(input);
        expect(result[0].icon).toBe('ellipse');
    });

    it('handles an empty activities array', () => {
        expect(formatActivities([])).toEqual([]);
    });

    it('formats multiple activities preserving order', () => {
        const input: (LeadActivity & { lead_name?: string })[] = [
            {
                id: 'x1',
                lead_id: 'l1',
                user_id: 'u1',
                type: 'created',
                description: null,
                metadata: {},
                created_at: '2026-03-17T10:00:00Z',
                lead_name: 'First',
            },
            {
                id: 'x2',
                lead_id: 'l2',
                user_id: 'u1',
                type: 'call',
                description: 'Checked in',
                metadata: {},
                created_at: '2026-03-17T09:00:00Z',
                lead_name: 'Second',
            },
        ];
        const result = formatActivities(input);
        expect(result).toHaveLength(2);
        expect(result[0].leadName).toBe('First');
        expect(result[1].leadName).toBe('Second');
    });
});

describe('useDashboard', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ── Agent role ──────────────────────────────────────────

    describe('agent role', () => {
        const agentParams = { userId: 'agent1', role: 'agent', isManagerView: false, isAdminRole: false };

        it('loads lead stats, activities, and events on mount', async () => {
            setupAgentMocks();
            const { result } = renderHook(() => useDashboard(agentParams));

            expect(result.current.isLoading).toBe(true);

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(mockFetchLeadStats).toHaveBeenCalledWith('agent1', false);
            expect(mockFetchRecentActivities).toHaveBeenCalledWith('agent1', false, 5);
            expect(mockFetchUpcomingEvents).toHaveBeenCalledWith('agent1', 5);
            expect(result.current.stats).toEqual(defaultStats);
            expect(result.current.recentActivities).toEqual(defaultActivities);
            expect(result.current.agentEvents).toEqual(defaultEvents);
            expect(result.current.error).toBeNull();
        });

        it('does not fetch manager dashboard stats for agents', async () => {
            setupAgentMocks();
            const { result } = renderHook(() => useDashboard(agentParams));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(mockFetchManagerDashboardStats).not.toHaveBeenCalled();
            expect(result.current.managerStats).toBeNull();
        });

        it('builds displayActivities from recent activities', async () => {
            setupAgentMocks();
            const { result } = renderHook(() => useDashboard(agentParams));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.displayActivities).toHaveLength(2);
            expect(result.current.displayActivities[0]).toMatchObject({
                id: 'a1',
                type: 'created',
                leadName: 'Alice',
                detail: 'Lead created',
            });
            expect(result.current.displayActivities[1]).toMatchObject({
                id: 'a2',
                type: 'status_change',
                leadName: 'Bob',
                detail: 'New \u2192 Contacted',
            });
        });

        it('returns empty displayActivities when no activities exist', async () => {
            mockFetchLeadStats.mockResolvedValue({ data: defaultStats, error: null });
            mockFetchRecentActivities.mockResolvedValue({ data: [], error: null });
            mockFetchUpcomingEvents.mockResolvedValue({ data: [] });

            const { result } = renderHook(() => useDashboard(agentParams));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.displayActivities).toEqual([]);
        });
    });

    // ── Manager role ────────────────────────────────────────

    describe('manager role', () => {
        const managerParams = { userId: 'mgr1', role: 'manager', isManagerView: true, isAdminRole: false };

        it('loads stats with isManager=true and fetches managerStats', async () => {
            setupManagerMocks();
            const { result } = renderHook(() => useDashboard(managerParams));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(mockFetchLeadStats).toHaveBeenCalledWith('mgr1', true);
            expect(mockFetchRecentActivities).toHaveBeenCalledWith('mgr1', true, 5);
            expect(mockFetchManagerDashboardStats).toHaveBeenCalledWith('mgr1', 'manager');
            expect(result.current.managerStats).toEqual(defaultManagerStats);
        });

        it('fetches upcoming events for manager view (shown on home)', async () => {
            setupManagerMocks();
            const { result } = renderHook(() => useDashboard(managerParams));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(mockFetchUpcomingEvents).toHaveBeenCalledWith('mgr1', 5);
            expect(result.current.agentEvents).toEqual(defaultEvents);
        });
    });

    // ── Admin role ──────────────────────────────────────────

    describe('admin role', () => {
        const adminParams = { userId: 'admin1', role: 'admin', isManagerView: false, isAdminRole: true };

        it('treats admin as manager-like for stats fetching', async () => {
            setupManagerMocks();
            const { result } = renderHook(() => useDashboard(adminParams));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            // isManagerLike = isManagerView || isAdminRole → true
            expect(mockFetchLeadStats).toHaveBeenCalledWith('admin1', true);
            expect(mockFetchRecentActivities).toHaveBeenCalledWith('admin1', true, 5);
            expect(mockFetchManagerDashboardStats).toHaveBeenCalledWith('admin1', 'admin');
        });
    });

    // ── Candidate role ──────────────────────────────────────

    describe('candidate role', () => {
        const candidateParams = { userId: 'cand1', role: 'candidate', isManagerView: false, isAdminRole: false };

        it('loads roadmap and events for candidates', async () => {
            setupCandidateMocks();
            const { result } = renderHook(() => useDashboard(candidateParams));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(mockGetCandidateIdForUser).toHaveBeenCalledWith('cand1');
            expect(mockFetchCandidateRoadmap).toHaveBeenCalledWith('cand1-candidate-id');
            expect(mockFetchUpcomingEvents).toHaveBeenCalledWith('cand1', 3);
            expect(result.current.candidateRoadmap).toEqual(defaultRoadmap);
            expect(result.current.candidateEvents).toEqual(defaultEvents);
        });

        it('does not call lead or manager stats APIs for candidates', async () => {
            setupCandidateMocks();
            const { result } = renderHook(() => useDashboard(candidateParams));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(mockFetchLeadStats).not.toHaveBeenCalled();
            expect(mockFetchRecentActivities).not.toHaveBeenCalled();
            expect(mockFetchManagerDashboardStats).not.toHaveBeenCalled();
        });

        it('handles null roadmap data gracefully', async () => {
            mockGetCandidateIdForUser.mockResolvedValue('cand1-candidate-id');
            mockFetchCandidateRoadmap.mockResolvedValue({ data: null });
            mockFetchUpcomingEvents.mockResolvedValue({ data: [] });

            const { result } = renderHook(() => useDashboard(candidateParams));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            // candidateRoadmap stays at initial empty array since data is null
            expect(result.current.candidateRoadmap).toEqual([]);
            expect(result.current.error).toBeNull();
        });
    });

    // ── PA role ─────────────────────────────────────────────

    describe('PA role', () => {
        const paParams = { userId: 'pa1', role: 'pa', isManagerView: false, isAdminRole: false };

        it('loads PA stats (manager IDs, candidate count, interview count, events)', async () => {
            setupPAMocks();
            const { result } = renderHook(() => useDashboard(paParams));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(mockFetchPAManagerIds).toHaveBeenCalledWith('pa1');
            expect(mockFetchPACandidateCount).toHaveBeenCalledWith(['mgr1', 'mgr2']);
            expect(mockFetchPAInterviewCount).toHaveBeenCalledWith(['mgr1', 'mgr2']);
            expect(mockFetchUpcomingEvents).toHaveBeenCalledWith('pa1', 5);
            expect(result.current.paStats).toEqual({
                candidateCount: 12,
                interviewCount: 3,
                events: defaultEvents,
            });
        });

        it('does not call lead or manager stats APIs for PA', async () => {
            setupPAMocks();
            const { result } = renderHook(() => useDashboard(paParams));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(mockFetchLeadStats).not.toHaveBeenCalled();
            expect(mockFetchRecentActivities).not.toHaveBeenCalled();
            expect(mockFetchManagerDashboardStats).not.toHaveBeenCalled();
        });

        it('defaults counts to 0 when fetchPACandidateCount returns null', async () => {
            mockFetchPAManagerIds.mockResolvedValue([]);
            mockFetchPACandidateCount.mockResolvedValue(null);
            mockFetchPAInterviewCount.mockResolvedValue(null);
            mockFetchUpcomingEvents.mockResolvedValue({ data: [] });

            const { result } = renderHook(() => useDashboard(paParams));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.paStats.candidateCount).toBe(0);
            expect(result.current.paStats.interviewCount).toBe(0);
        });
    });

    // ── No userId ───────────────────────────────────────────

    describe('no userId', () => {
        it('does not load data when userId is undefined', async () => {
            const { result } = renderHook(() =>
                useDashboard({ userId: undefined, role: 'agent', isManagerView: false, isAdminRole: false }),
            );

            // Give it a tick to ensure the effect ran
            await act(async () => {});

            expect(mockFetchLeadStats).not.toHaveBeenCalled();
            expect(mockFetchUpcomingEvents).not.toHaveBeenCalled();
            expect(mockFetchCandidateRoadmap).not.toHaveBeenCalled();
            expect(mockFetchPAManagerIds).not.toHaveBeenCalled();
            // isLoading remains true because finally block never ran
            expect(result.current.isLoading).toBe(true);
        });
    });

    // ── Error handling ──────────────────────────────────────

    describe('error handling', () => {
        const agentParams = { userId: 'agent1', role: 'agent', isManagerView: false, isAdminRole: false };

        it('sets error when fetchLeadStats returns an error', async () => {
            mockFetchLeadStats.mockResolvedValue({ data: null, error: 'DB connection failed' });
            mockFetchRecentActivities.mockResolvedValue({ data: [], error: null });
            mockFetchUpcomingEvents.mockResolvedValue({ data: [] });

            const { result } = renderHook(() => useDashboard(agentParams));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.error).toBe('Failed to load dashboard data');
        });

        it('sets error on thrown exception', async () => {
            mockFetchLeadStats.mockRejectedValue(new Error('Network error'));

            const { result } = renderHook(() => useDashboard(agentParams));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.error).toBe('Failed to load dashboard data');
        });

        it('clears error on subsequent successful load', async () => {
            mockFetchLeadStats.mockRejectedValueOnce(new Error('fail'));

            const { result } = renderHook(() => useDashboard(agentParams));

            await waitFor(() => {
                expect(result.current.error).toBe('Failed to load dashboard data');
            });

            // Setup success mocks for refresh
            setupAgentMocks();

            await act(async () => {
                await result.current.onRefresh();
            });

            expect(result.current.error).toBeNull();
        });

        it('sets error when candidate roadmap fetch throws', async () => {
            mockFetchCandidateRoadmap.mockRejectedValue(new Error('Roadmap failed'));
            mockFetchUpcomingEvents.mockResolvedValue({ data: [] });

            const candidateParams = { userId: 'cand1', role: 'candidate', isManagerView: false, isAdminRole: false };
            const { result } = renderHook(() => useDashboard(candidateParams));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.error).toBe('Failed to load dashboard data');
        });

        it('sets error when PA fetch throws', async () => {
            mockFetchPAManagerIds.mockRejectedValue(new Error('PA fetch failed'));

            const paParams = { userId: 'pa1', role: 'pa', isManagerView: false, isAdminRole: false };
            const { result } = renderHook(() => useDashboard(paParams));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.error).toBe('Failed to load dashboard data');
        });
    });

    // ── onRefresh ───────────────────────────────────────────

    describe('onRefresh', () => {
        const agentParams = { userId: 'agent1', role: 'agent', isManagerView: false, isAdminRole: false };

        it('sets refreshing to true during refresh and false after', async () => {
            setupAgentMocks();
            const { result } = renderHook(() => useDashboard(agentParams));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.refreshing).toBe(false);

            // Reset mocks for refresh
            jest.clearAllMocks();
            setupAgentMocks();

            let refreshPromise: Promise<void>;
            act(() => {
                refreshPromise = result.current.onRefresh();
            });

            // refreshing should be true during the async operation
            expect(result.current.refreshing).toBe(true);

            await act(async () => {
                await refreshPromise!;
            });

            expect(result.current.refreshing).toBe(false);
        });

        it('re-fetches all data on refresh', async () => {
            setupAgentMocks();
            const { result } = renderHook(() => useDashboard(agentParams));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            jest.clearAllMocks();

            const updatedStats = { ...defaultStats, totalLeads: 20 };
            mockFetchLeadStats.mockResolvedValue({ data: updatedStats, error: null });
            mockFetchRecentActivities.mockResolvedValue({ data: [], error: null });
            mockFetchUpcomingEvents.mockResolvedValue({ data: [] });

            await act(async () => {
                await result.current.onRefresh();
            });

            expect(mockFetchLeadStats).toHaveBeenCalledTimes(1);
            expect(result.current.stats).toEqual(updatedStats);
        });
    });

    // ── setError ────────────────────────────────────────────

    describe('setError', () => {
        it('allows external error setting via setError', async () => {
            setupAgentMocks();
            const agentParams = { userId: 'agent1', role: 'agent', isManagerView: false, isAdminRole: false };
            const { result } = renderHook(() => useDashboard(agentParams));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            act(() => {
                result.current.setError('Custom error message');
            });

            expect(result.current.error).toBe('Custom error message');
        });
    });

    // ── loadDashboardData direct invocation ─────────────────

    describe('loadDashboardData', () => {
        it('is exposed and can be called directly for manual reload', async () => {
            setupAgentMocks();
            const agentParams = { userId: 'agent1', role: 'agent', isManagerView: false, isAdminRole: false };
            const { result } = renderHook(() => useDashboard(agentParams));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            jest.clearAllMocks();
            setupAgentMocks();

            await act(async () => {
                await result.current.loadDashboardData();
            });

            expect(mockFetchLeadStats).toHaveBeenCalledTimes(1);
        });
    });

    // ── Data does not update when response has no data ──────

    describe('null/missing data handling', () => {
        it('does not update stats when fetchLeadStats returns null data', async () => {
            mockFetchLeadStats.mockResolvedValue({ data: null, error: null });
            mockFetchRecentActivities.mockResolvedValue({ data: null, error: null });
            mockFetchManagerDashboardStats.mockResolvedValue({ data: null, error: null });
            mockFetchUpcomingEvents.mockResolvedValue({ data: null });

            const agentParams = { userId: 'agent1', role: 'agent', isManagerView: false, isAdminRole: false };
            const { result } = renderHook(() => useDashboard(agentParams));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            // stats stays null (initial state) because data was null
            expect(result.current.stats).toBeNull();
            expect(result.current.recentActivities).toEqual([]);
        });
    });
});
