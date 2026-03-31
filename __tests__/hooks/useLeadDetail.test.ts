import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useLeadDetail } from '@/hooks/useLeadDetail';
import type { Lead, LeadActivity } from '@/types/lead';

jest.mock('@/lib/supabase');

// ---------------------------------------------------------------------------
// Mock lib/leads
// ---------------------------------------------------------------------------

const mockFetchLead = jest.fn();
const mockFetchLeadActivities = jest.fn();
const mockUpdateLeadStatus = jest.fn();
const mockAddLeadNote = jest.fn();
const mockAddLeadActivity = jest.fn();
const mockFetchTeamAgents = jest.fn();
const mockReassignLead = jest.fn();

jest.mock('@/lib/leads', () => ({
    fetchLead: (...args: any[]) => mockFetchLead(...args),
    fetchLeadActivities: (...args: any[]) => mockFetchLeadActivities(...args),
    updateLeadStatus: (...args: any[]) => mockUpdateLeadStatus(...args),
    addLeadNote: (...args: any[]) => mockAddLeadNote(...args),
    addLeadActivity: (...args: any[]) => mockAddLeadActivity(...args),
    fetchTeamAgents: (...args: any[]) => mockFetchTeamAgents(...args),
    reassignLead: (...args: any[]) => mockReassignLead(...args),
}));

// ---------------------------------------------------------------------------
// Mock useSubmitGuard — pass-through guard (calls fn immediately)
// ---------------------------------------------------------------------------

jest.mock('@/hooks/useSubmitGuard', () => ({
    useSubmitGuard: () => ({
        isSubmitting: false,
        guard: async (fn: () => Promise<any>) => fn(),
    }),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const LEAD: Lead = {
    id: 'lead-1',
    assigned_to: 'agent-1',
    created_by: 'user-1',
    full_name: 'John Doe',
    phone: '+6591234567',
    email: 'john@example.com',
    source: 'referral',
    source_name: null,
    external_id: null,
    status: 'new',
    product_interest: 'life',
    notes: null,
    recording_url: null,
    transcript: null,
    updated_at: '2026-03-01T00:00:00Z',
    created_at: '2026-03-01T00:00:00Z',
};

const ACTIVITIES: LeadActivity[] = [
    {
        id: 'a1',
        lead_id: 'lead-1',
        user_id: 'user-1',
        type: 'created',
        description: null,
        metadata: {},
        created_at: '2026-03-01T00:00:00Z',
    },
];

const defaultParams = {
    leadId: 'lead-1',
    userId: 'user-1',
    userRole: 'manager',
    fullName: 'Test User',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupSuccessfulLoad(lead: Lead = LEAD, activities: LeadActivity[] = ACTIVITIES) {
    mockFetchLead.mockResolvedValue({ data: lead, error: null });
    mockFetchLeadActivities.mockResolvedValue({ data: activities, error: null });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useLeadDetail', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // -----------------------------------------------------------------------
    // Loading states
    // -----------------------------------------------------------------------

    describe('loading states', () => {
        it('starts in loading state', () => {
            mockFetchLead.mockReturnValue(new Promise(() => {})); // never resolves
            mockFetchLeadActivities.mockReturnValue(new Promise(() => {}));

            const { result } = renderHook(() => useLeadDetail(defaultParams));

            expect(result.current.isLoading).toBe(true);
            expect(result.current.lead).toBeNull();
            expect(result.current.activities).toEqual([]);
            expect(result.current.error).toBeNull();
        });

        it('sets isLoading to false after data loads', async () => {
            setupSuccessfulLoad();

            const { result } = renderHook(() => useLeadDetail(defaultParams));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });
        });

        it('does not fetch when leadId is undefined', async () => {
            const { result } = renderHook(() =>
                useLeadDetail({ leadId: undefined, userId: 'user-1', userRole: 'manager', fullName: 'Test' }),
            );

            // loadData exits early — isLoading stays true (never set to false)
            expect(mockFetchLead).not.toHaveBeenCalled();
            expect(mockFetchLeadActivities).not.toHaveBeenCalled();
            expect(result.current.lead).toBeNull();
        });
    });

    // -----------------------------------------------------------------------
    // Successful data loading
    // -----------------------------------------------------------------------

    describe('data loading', () => {
        it('populates lead and activities on success', async () => {
            setupSuccessfulLoad();

            const { result } = renderHook(() => useLeadDetail(defaultParams));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.lead).toEqual(LEAD);
            expect(result.current.activities).toEqual(ACTIVITIES);
            expect(result.current.currentStatus).toBe('new');
            expect(result.current.error).toBeNull();
        });

        it('sets currentStatus from the loaded lead', async () => {
            const qualifiedLead = { ...LEAD, status: 'qualified' as const };
            setupSuccessfulLoad(qualifiedLead);

            const { result } = renderHook(() => useLeadDetail(defaultParams));

            await waitFor(() => {
                expect(result.current.currentStatus).toBe('qualified');
            });
        });

        it('calls fetchLead and fetchLeadActivities in parallel', async () => {
            setupSuccessfulLoad();

            renderHook(() => useLeadDetail(defaultParams));

            await waitFor(() => {
                expect(mockFetchLead).toHaveBeenCalledWith('lead-1');
                expect(mockFetchLeadActivities).toHaveBeenCalledWith('lead-1');
            });
        });
    });

    // -----------------------------------------------------------------------
    // Error handling
    // -----------------------------------------------------------------------

    describe('error handling', () => {
        it('sets error when fetchLead returns an error', async () => {
            mockFetchLead.mockResolvedValue({ data: null, error: 'Not found' });
            mockFetchLeadActivities.mockResolvedValue({ data: [], error: null });

            const { result } = renderHook(() => useLeadDetail(defaultParams));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.error).toBe('Failed to load lead details');
        });

        it('sets error when fetchLead throws an exception', async () => {
            mockFetchLead.mockRejectedValue(new Error('Network error'));
            mockFetchLeadActivities.mockResolvedValue({ data: [], error: null });

            const { result } = renderHook(() => useLeadDetail(defaultParams));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.error).toBe('Failed to load lead details');
        });

        it('clears error on reload', async () => {
            mockFetchLead.mockResolvedValue({ data: null, error: 'fail' });
            mockFetchLeadActivities.mockResolvedValue({ data: [], error: null });

            const { result } = renderHook(() => useLeadDetail(defaultParams));

            await waitFor(() => {
                expect(result.current.error).toBe('Failed to load lead details');
            });

            // Now succeed
            setupSuccessfulLoad();

            await act(async () => {
                await result.current.loadData();
            });

            expect(result.current.error).toBeNull();
            expect(result.current.lead).toEqual(LEAD);
        });
    });

    // -----------------------------------------------------------------------
    // handleChangeStatus — optimistic update + rollback
    // -----------------------------------------------------------------------

    describe('handleChangeStatus', () => {
        it('optimistically updates status and refreshes activities on success', async () => {
            setupSuccessfulLoad();

            const { result } = renderHook(() => useLeadDetail(defaultParams));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            const updatedActivities: LeadActivity[] = [
                {
                    id: 'a2',
                    lead_id: 'lead-1',
                    user_id: 'user-1',
                    type: 'status_change',
                    description: null,
                    metadata: { from: 'new', to: 'contacted' },
                    created_at: '2026-03-02T00:00:00Z',
                },
                ...ACTIVITIES,
            ];

            mockUpdateLeadStatus.mockResolvedValue({ error: null });
            mockFetchLeadActivities.mockResolvedValue({ data: updatedActivities, error: null });

            await act(async () => {
                await result.current.handleChangeStatus('contacted');
            });

            expect(result.current.currentStatus).toBe('contacted');
            expect(mockUpdateLeadStatus).toHaveBeenCalledWith('lead-1', 'contacted', 'new', 'user-1');
            expect(result.current.activities).toEqual(updatedActivities);
            expect(result.current.error).toBeNull();
        });

        it('rolls back status on failure and sets error', async () => {
            setupSuccessfulLoad();

            const { result } = renderHook(() => useLeadDetail(defaultParams));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            mockUpdateLeadStatus.mockResolvedValue({ error: 'Server error' });

            await act(async () => {
                await result.current.handleChangeStatus('contacted');
            });

            expect(result.current.currentStatus).toBe('new'); // rolled back
            expect(result.current.error).toBe('Failed to update status');
        });

        it('no-ops when new status equals current status', async () => {
            setupSuccessfulLoad();

            const { result } = renderHook(() => useLeadDetail(defaultParams));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            await act(async () => {
                await result.current.handleChangeStatus('new'); // same as current
            });

            expect(mockUpdateLeadStatus).not.toHaveBeenCalled();
        });

        it('no-ops when lead is not loaded', async () => {
            mockFetchLead.mockResolvedValue({ data: null, error: null });
            mockFetchLeadActivities.mockResolvedValue({ data: [], error: null });

            const { result } = renderHook(() => useLeadDetail(defaultParams));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            await act(async () => {
                await result.current.handleChangeStatus('contacted');
            });

            expect(mockUpdateLeadStatus).not.toHaveBeenCalled();
        });

        it('no-ops when userId is undefined', async () => {
            setupSuccessfulLoad();

            const { result } = renderHook(() =>
                useLeadDetail({ leadId: 'lead-1', userId: undefined, userRole: 'manager', fullName: 'Test' }),
            );

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            await act(async () => {
                await result.current.handleChangeStatus('contacted');
            });

            expect(mockUpdateLeadStatus).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // handleAddNote
    // -----------------------------------------------------------------------

    describe('handleAddNote', () => {
        it('adds note to activities on success', async () => {
            setupSuccessfulLoad();

            const { result } = renderHook(() => useLeadDetail(defaultParams));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            const noteActivity: LeadActivity = {
                id: 'a_note',
                lead_id: 'lead-1',
                user_id: 'user-1',
                type: 'note',
                description: 'Test note',
                metadata: {},
                created_at: '2026-03-02T00:00:00Z',
            };

            mockAddLeadNote.mockResolvedValue({ data: noteActivity, error: null });

            // Set the note text
            act(() => {
                result.current.setNoteText('Test note');
            });

            await act(async () => {
                await result.current.handleAddNote();
            });

            expect(mockAddLeadNote).toHaveBeenCalledWith('lead-1', 'Test note', 'user-1');
            expect(result.current.activities[0]).toEqual(noteActivity);
            expect(result.current.noteText).toBe('');
            expect(result.current.showNoteInput).toBe(false);
        });

        it('sets error when addLeadNote fails', async () => {
            setupSuccessfulLoad();

            const { result } = renderHook(() => useLeadDetail(defaultParams));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            mockAddLeadNote.mockResolvedValue({ data: null, error: 'DB error' });

            act(() => {
                result.current.setNoteText('Failing note');
            });

            await act(async () => {
                await result.current.handleAddNote();
            });

            expect(result.current.error).toBe('Failed to add note');
        });

        it('does not call addLeadNote when note text is empty', async () => {
            setupSuccessfulLoad();

            const { result } = renderHook(() => useLeadDetail(defaultParams));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            // Leave noteText as default ('')
            await act(async () => {
                await result.current.handleAddNote();
            });

            expect(mockAddLeadNote).not.toHaveBeenCalled();
        });

        it('does not call addLeadNote when note text is whitespace only', async () => {
            setupSuccessfulLoad();

            const { result } = renderHook(() => useLeadDetail(defaultParams));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            act(() => {
                result.current.setNoteText('   ');
            });

            await act(async () => {
                await result.current.handleAddNote();
            });

            expect(mockAddLeadNote).not.toHaveBeenCalled();
        });

        it('does not call addLeadNote when userId is undefined', async () => {
            setupSuccessfulLoad();

            const { result } = renderHook(() =>
                useLeadDetail({ leadId: 'lead-1', userId: undefined, userRole: 'manager', fullName: 'Test' }),
            );

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            act(() => {
                result.current.setNoteText('Some note');
            });

            await act(async () => {
                await result.current.handleAddNote();
            });

            expect(mockAddLeadNote).not.toHaveBeenCalled();
        });

        it('trims note text before sending', async () => {
            setupSuccessfulLoad();

            const { result } = renderHook(() => useLeadDetail(defaultParams));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            const noteActivity: LeadActivity = {
                id: 'a_note2',
                lead_id: 'lead-1',
                user_id: 'user-1',
                type: 'note',
                description: 'Trimmed',
                metadata: {},
                created_at: '2026-03-02T00:00:00Z',
            };

            mockAddLeadNote.mockResolvedValue({ data: noteActivity, error: null });

            act(() => {
                result.current.setNoteText('  Trimmed  ');
            });

            await act(async () => {
                await result.current.handleAddNote();
            });

            expect(mockAddLeadNote).toHaveBeenCalledWith('lead-1', 'Trimmed', 'user-1');
        });
    });

    // -----------------------------------------------------------------------
    // handleOpenReassign
    // -----------------------------------------------------------------------

    describe('handleOpenReassign', () => {
        it('fetches team agents and opens modal', async () => {
            setupSuccessfulLoad();

            const { result } = renderHook(() => useLeadDetail(defaultParams));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            const agents = [
                { id: 'agent-1', full_name: 'Agent A' },
                { id: 'agent-2', full_name: 'Agent B' },
                { id: 'agent-3', full_name: 'Agent C' },
            ];

            mockFetchTeamAgents.mockResolvedValue({ data: agents });

            await act(async () => {
                await result.current.handleOpenReassign();
            });

            expect(mockFetchTeamAgents).toHaveBeenCalledWith('user-1', 'manager');
            expect(result.current.showReassignModal).toBe(true);
            // Filters out the currently assigned agent (agent-1)
            expect(result.current.reassignAgents).toEqual([
                { id: 'agent-2', full_name: 'Agent B' },
                { id: 'agent-3', full_name: 'Agent C' },
            ]);
        });

        it('opens modal even when userId is undefined (no agent fetch)', async () => {
            setupSuccessfulLoad();

            const { result } = renderHook(() =>
                useLeadDetail({ leadId: 'lead-1', userId: undefined, userRole: 'manager', fullName: 'Test' }),
            );

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            await act(async () => {
                await result.current.handleOpenReassign();
            });

            expect(mockFetchTeamAgents).not.toHaveBeenCalled();
            expect(result.current.showReassignModal).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // handleReassign
    // -----------------------------------------------------------------------

    describe('handleReassign', () => {
        const TEAM_AGENTS = [
            { id: 'agent-1', full_name: 'Agent A' },
            { id: 'agent-2', full_name: 'Agent B' },
            { id: 'agent-3', full_name: 'Agent C' },
        ];

        /** Open reassign modal first so allAgents is populated */
        async function openReassignFirst(result: any) {
            mockFetchTeamAgents.mockResolvedValue({ data: TEAM_AGENTS });
            await act(async () => {
                await result.current.handleOpenReassign();
            });
        }

        it('reassigns lead and adds activity on success', async () => {
            setupSuccessfulLoad();

            const { result } = renderHook(() => useLeadDetail(defaultParams));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            await openReassignFirst(result);
            mockReassignLead.mockResolvedValue({ error: null });

            const toAgent = { id: 'agent-2', full_name: 'Agent B' };

            await act(async () => {
                await result.current.handleReassign(toAgent);
            });

            expect(mockReassignLead).toHaveBeenCalledWith(
                'lead-1',
                'agent-2',
                'agent-1', // fromId = lead.assigned_to
                'Agent A', // fromName = resolved from allAgents
                'Agent B',
                'user-1',
            );
            expect(result.current.showReassignModal).toBe(false);

            // Should have a new reassignment activity prepended
            expect(result.current.activities.length).toBe(ACTIVITIES.length + 1);
            const newActivity = result.current.activities[0];
            expect(newActivity.type).toBe('reassignment');
            expect(newActivity.lead_id).toBe('lead-1');
            expect(newActivity.user_id).toBe('user-1');
            expect(newActivity.metadata).toEqual({
                from_agent_id: 'agent-1',
                to_agent_id: 'agent-2',
                from_agent_name: 'Agent A',
                to_agent_name: 'Agent B',
            });
            expect(newActivity.actor_name).toBe('Test User');
        });

        it('does not add activity on failure', async () => {
            setupSuccessfulLoad();

            const { result } = renderHook(() => useLeadDetail(defaultParams));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            await openReassignFirst(result);
            mockReassignLead.mockResolvedValue({ error: 'Reassignment failed' });

            const toAgent = { id: 'agent-2', full_name: 'Agent B' };

            await act(async () => {
                await result.current.handleReassign(toAgent);
            });

            // Activities should not change
            expect(result.current.activities).toEqual(ACTIVITIES);
        });

        it('no-ops when lead is not loaded', async () => {
            mockFetchLead.mockResolvedValue({ data: null, error: null });
            mockFetchLeadActivities.mockResolvedValue({ data: [], error: null });

            const { result } = renderHook(() => useLeadDetail(defaultParams));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            await act(async () => {
                await result.current.handleReassign({ id: 'agent-2', full_name: 'Agent B' });
            });

            expect(mockReassignLead).not.toHaveBeenCalled();
        });

        it('no-ops when userId is undefined', async () => {
            setupSuccessfulLoad();

            const { result } = renderHook(() =>
                useLeadDetail({ leadId: 'lead-1', userId: undefined, userRole: 'manager', fullName: 'Test' }),
            );

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            await act(async () => {
                await result.current.handleReassign({ id: 'agent-2', full_name: 'Agent B' });
            });

            expect(mockReassignLead).not.toHaveBeenCalled();
        });

        it('closes the reassign modal immediately', async () => {
            setupSuccessfulLoad();

            const { result } = renderHook(() => useLeadDetail(defaultParams));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            // Open the modal first
            mockFetchTeamAgents.mockResolvedValue({ data: [{ id: 'agent-2', full_name: 'Agent B' }] });

            await act(async () => {
                await result.current.handleOpenReassign();
            });

            expect(result.current.showReassignModal).toBe(true);

            mockReassignLead.mockResolvedValue({ error: null });

            await act(async () => {
                await result.current.handleReassign({ id: 'agent-2', full_name: 'Agent B' });
            });

            expect(result.current.showReassignModal).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // logActivity
    // -----------------------------------------------------------------------

    describe('logActivity', () => {
        it('adds optimistic activity and calls addLeadActivity', async () => {
            setupSuccessfulLoad();
            mockAddLeadActivity.mockResolvedValue({ error: null });

            const { result } = renderHook(() => useLeadDetail(defaultParams));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            await act(async () => {
                await result.current.logActivity('call', 'Called client', { duration: 120 });
            });

            // Optimistic activity prepended
            expect(result.current.activities.length).toBe(ACTIVITIES.length + 1);
            const activity = result.current.activities[0];
            expect(activity.type).toBe('call');
            expect(activity.description).toBe('Called client');
            expect(activity.metadata).toEqual({ duration: 120 });
            expect(activity.user_id).toBe('user-1');
            expect(activity.actor_name).toBe('Test User');
            expect(activity.lead_id).toBe('lead-1');

            expect(mockAddLeadActivity).toHaveBeenCalledWith('lead-1', 'user-1', 'call', 'Called client', {
                duration: 120,
            });
        });

        it('logs whatsapp activity type', async () => {
            setupSuccessfulLoad();
            mockAddLeadActivity.mockResolvedValue({ error: null });

            const { result } = renderHook(() => useLeadDetail(defaultParams));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            await act(async () => {
                await result.current.logActivity('whatsapp', 'Sent WhatsApp', { template: 'intro' });
            });

            const activity = result.current.activities[0];
            expect(activity.type).toBe('whatsapp');
            expect(activity.description).toBe('Sent WhatsApp');
            expect(mockAddLeadActivity).toHaveBeenCalledWith('lead-1', 'user-1', 'whatsapp', 'Sent WhatsApp', {
                template: 'intro',
            });
        });

        it('does not call addLeadActivity when lead is null', async () => {
            mockFetchLead.mockResolvedValue({ data: null, error: null });
            mockFetchLeadActivities.mockResolvedValue({ data: [], error: null });

            const { result } = renderHook(() => useLeadDetail(defaultParams));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            act(() => {
                result.current.logActivity('call', 'No lead', {});
            });

            expect(mockAddLeadActivity).not.toHaveBeenCalled();
        });

        it('uses "me" as user_id when userId is undefined', async () => {
            setupSuccessfulLoad();

            const { result } = renderHook(() =>
                useLeadDetail({ leadId: 'lead-1', userId: undefined, userRole: 'manager', fullName: 'Test' }),
            );

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            act(() => {
                result.current.logActivity('call', 'Anon call', {});
            });

            const activity = result.current.activities[0];
            expect(activity.user_id).toBe('me');
            // addLeadActivity should NOT be called when userId is undefined
            expect(mockAddLeadActivity).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // UI state setters (note input, status picker, reassign modal)
    // -----------------------------------------------------------------------

    describe('UI state toggles', () => {
        it('toggles showNoteInput', async () => {
            setupSuccessfulLoad();

            const { result } = renderHook(() => useLeadDetail(defaultParams));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.showNoteInput).toBe(false);

            act(() => {
                result.current.setShowNoteInput(true);
            });

            expect(result.current.showNoteInput).toBe(true);
        });

        it('toggles showStatusPicker', async () => {
            setupSuccessfulLoad();

            const { result } = renderHook(() => useLeadDetail(defaultParams));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.showStatusPicker).toBe(false);

            act(() => {
                result.current.setShowStatusPicker(true);
            });

            expect(result.current.showStatusPicker).toBe(true);
        });

        it('toggles showReassignModal', async () => {
            setupSuccessfulLoad();

            const { result } = renderHook(() => useLeadDetail(defaultParams));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.showReassignModal).toBe(false);

            act(() => {
                result.current.setShowReassignModal(true);
            });

            expect(result.current.showReassignModal).toBe(true);
        });

        it('updates noteText', async () => {
            setupSuccessfulLoad();

            const { result } = renderHook(() => useLeadDetail(defaultParams));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            act(() => {
                result.current.setNoteText('Hello');
            });

            expect(result.current.noteText).toBe('Hello');
        });

        it('can clear error via setError', async () => {
            mockFetchLead.mockResolvedValue({ data: null, error: 'fail' });
            mockFetchLeadActivities.mockResolvedValue({ data: [], error: null });

            const { result } = renderHook(() => useLeadDetail(defaultParams));

            await waitFor(() => {
                expect(result.current.error).toBe('Failed to load lead details');
            });

            act(() => {
                result.current.setError(null);
            });

            expect(result.current.error).toBeNull();
        });
    });
});
