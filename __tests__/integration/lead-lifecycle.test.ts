/**
 * Integration test — Lead lifecycle flow
 *
 * Tests the full sequence: create lead -> add note -> change status ->
 * reassign -> verify activity log, ensuring each step makes the correct
 * Supabase calls and passes data between stages.
 */
import { supabase } from '@/lib/supabase';
import {
    createLead,
    addLeadNote,
    updateLeadStatus,
    reassignLead,
    fetchLeadActivities,
} from '@/lib/leads';

jest.mock('@/lib/supabase');

const mockSupa = supabase as any;

function mockResolve(chain: any, value: any) {
    chain.__resolveWith(value);
}

// ── Fixtures ──

const AGENT_ID = 'agent-001';
const MANAGER_ID = 'mgr-001';
const NEW_AGENT_ID = 'agent-002';

const CREATED_LEAD = {
    id: 'lead-100',
    full_name: 'Alice Tan',
    phone: '+6598765432',
    email: 'alice@example.com',
    source: 'referral',
    product_interest: 'life_insurance',
    status: 'new',
    assigned_to: AGENT_ID,
    created_by: AGENT_ID,
    notes: 'Met at roadshow',
    created_at: '2026-03-17T08:00:00Z',
    updated_at: '2026-03-17T08:00:00Z',
};

const LEAD_INPUT = {
    full_name: 'Alice Tan',
    phone: '+6598765432',
    email: 'alice@example.com',
    source: 'referral' as const,
    product_interest: 'life_insurance' as const,
    notes: 'Met at roadshow',
};

const NOTE_ACTIVITY = {
    id: 'act-note-1',
    lead_id: 'lead-100',
    user_id: AGENT_ID,
    type: 'note',
    description: 'Discussed whole life policy options',
    metadata: {},
    created_at: '2026-03-17T09:00:00Z',
};

// ── Helpers ──

beforeEach(() => {
    mockSupa.__resetChains();
    jest.clearAllMocks();
});

// ── Full lifecycle (happy path) ──

describe('Lead lifecycle — happy path', () => {
    it('Step 1: createLead — inserts lead and logs "created" activity', async () => {
        const leadsChain = mockSupa.__getChain('leads');
        mockResolve(leadsChain, { data: CREATED_LEAD, error: null });

        const activitiesChain = mockSupa.__getChain('lead_activities');
        mockResolve(activitiesChain, { error: null });

        const result = await createLead(LEAD_INPUT, AGENT_ID);

        expect(result.error).toBeNull();
        expect(result.data).not.toBeNull();
        expect(result.data!.id).toBe('lead-100');
        expect(result.data!.full_name).toBe('Alice Tan');
        expect(result.data!.assigned_to).toBe(AGENT_ID);

        // Verify both tables were touched
        expect(mockSupa.from).toHaveBeenCalledWith('leads');
        expect(mockSupa.from).toHaveBeenCalledWith('lead_activities');
    });

    it('Step 2: addLeadNote — bumps updated_at and inserts note activity', async () => {
        const leadsChain = mockSupa.__getChain('leads');
        mockResolve(leadsChain, { error: null });

        const activitiesChain = mockSupa.__getChain('lead_activities');
        mockResolve(activitiesChain, { data: NOTE_ACTIVITY, error: null });

        const result = await addLeadNote('lead-100', 'Discussed whole life policy options', AGENT_ID);

        expect(result.error).toBeNull();
        expect(result.data).not.toBeNull();
        expect(result.data!.type).toBe('note');
        expect(result.data!.description).toBe('Discussed whole life policy options');

        // Verify leads table was updated (for updated_at bump)
        expect(mockSupa.from).toHaveBeenCalledWith('leads');
        // Verify activity was inserted
        expect(mockSupa.from).toHaveBeenCalledWith('lead_activities');
    });

    it('Step 3: updateLeadStatus — transitions status and logs status_change activity', async () => {
        const leadsChain = mockSupa.__getChain('leads');
        mockResolve(leadsChain, { error: null });

        const activitiesChain = mockSupa.__getChain('lead_activities');
        mockResolve(activitiesChain, { error: null });

        const result = await updateLeadStatus('lead-100', 'contacted', 'new', AGENT_ID);

        expect(result.error).toBeNull();
        expect(mockSupa.from).toHaveBeenCalledWith('leads');
        expect(mockSupa.from).toHaveBeenCalledWith('lead_activities');
    });

    it('Step 4: reassignLead — transfers ownership and logs reassignment activity', async () => {
        const leadsChain = mockSupa.__getChain('leads');
        mockResolve(leadsChain, { error: null });

        const activitiesChain = mockSupa.__getChain('lead_activities');
        mockResolve(activitiesChain, { error: null });

        const result = await reassignLead('lead-100', NEW_AGENT_ID, AGENT_ID, 'Agent One', 'Agent Two', MANAGER_ID);

        expect(result.error).toBeNull();
        expect(mockSupa.from).toHaveBeenCalledWith('leads');
        expect(mockSupa.from).toHaveBeenCalledWith('lead_activities');
    });

    it('Step 5: fetchLeadActivities — returns all logged activities', async () => {
        const activitiesChain = mockSupa.__getChain('lead_activities');
        mockResolve(activitiesChain, {
            data: [
                {
                    id: 'act-4',
                    lead_id: 'lead-100',
                    user_id: MANAGER_ID,
                    type: 'reassignment',
                    description: null,
                    metadata: {
                        from_agent_id: AGENT_ID,
                        to_agent_id: NEW_AGENT_ID,
                        from_agent_name: 'Agent One',
                        to_agent_name: 'Agent Two',
                    },
                    created_at: '2026-03-17T11:00:00Z',
                    actor: { full_name: 'Manager Mike' },
                },
                {
                    id: 'act-3',
                    lead_id: 'lead-100',
                    user_id: AGENT_ID,
                    type: 'status_change',
                    description: null,
                    metadata: { from_status: 'new', to_status: 'contacted' },
                    created_at: '2026-03-17T10:00:00Z',
                    actor: { full_name: 'Agent One' },
                },
                {
                    id: 'act-2',
                    lead_id: 'lead-100',
                    user_id: AGENT_ID,
                    type: 'note',
                    description: 'Discussed whole life policy options',
                    metadata: {},
                    created_at: '2026-03-17T09:00:00Z',
                    actor: { full_name: 'Agent One' },
                },
                {
                    id: 'act-1',
                    lead_id: 'lead-100',
                    user_id: AGENT_ID,
                    type: 'created',
                    description: 'Lead created from referral',
                    metadata: {},
                    created_at: '2026-03-17T08:00:00Z',
                    actor: { full_name: 'Agent One' },
                },
            ],
            error: null,
        });

        const result = await fetchLeadActivities('lead-100');

        expect(result.error).toBeNull();
        expect(result.data).toHaveLength(4);

        // Verify chronological order (most recent first)
        const types = result.data.map((a) => a.type);
        expect(types).toEqual(['reassignment', 'status_change', 'note', 'created']);

        // Verify reassignment activity has correct metadata
        const reassignment = result.data.find((a) => a.type === 'reassignment')!;
        expect(reassignment.actor_name).toBe('Manager Mike');
        expect(reassignment.metadata?.from_agent_id).toBe(AGENT_ID);
        expect(reassignment.metadata?.to_agent_id).toBe(NEW_AGENT_ID);

        // Verify status_change activity
        const statusChange = result.data.find((a) => a.type === 'status_change')!;
        expect(statusChange.metadata?.from_status).toBe('new');
        expect(statusChange.metadata?.to_status).toBe('contacted');

        // Verify note activity
        const note = result.data.find((a) => a.type === 'note')!;
        expect(note.description).toBe('Discussed whole life policy options');
        expect(note.actor_name).toBe('Agent One');

        // Verify created activity
        const created = result.data.find((a) => a.type === 'created')!;
        expect(created.description).toBe('Lead created from referral');
    });
});

// ── Sequential flow in a single test ──

describe('Lead lifecycle — end-to-end sequence', () => {
    it('runs create -> note -> status change -> reassign -> fetch activities', async () => {
        // --- Step 1: Create lead ---
        let leadsChain = mockSupa.__getChain('leads');
        mockResolve(leadsChain, { data: CREATED_LEAD, error: null });

        let activitiesChain = mockSupa.__getChain('lead_activities');
        mockResolve(activitiesChain, { error: null });

        const createResult = await createLead(LEAD_INPUT, AGENT_ID);
        expect(createResult.data!.id).toBe('lead-100');

        // --- Step 2: Add note ---
        mockSupa.__resetChains();

        leadsChain = mockSupa.__getChain('leads');
        mockResolve(leadsChain, { error: null });

        activitiesChain = mockSupa.__getChain('lead_activities');
        mockResolve(activitiesChain, { data: NOTE_ACTIVITY, error: null });

        const noteResult = await addLeadNote('lead-100', 'Discussed whole life policy options', AGENT_ID);
        expect(noteResult.data!.type).toBe('note');

        // --- Step 3: Change status ---
        mockSupa.__resetChains();

        leadsChain = mockSupa.__getChain('leads');
        mockResolve(leadsChain, { error: null });

        activitiesChain = mockSupa.__getChain('lead_activities');
        mockResolve(activitiesChain, { error: null });

        const statusResult = await updateLeadStatus('lead-100', 'contacted', 'new', AGENT_ID);
        expect(statusResult.error).toBeNull();

        // --- Step 4: Reassign ---
        mockSupa.__resetChains();

        leadsChain = mockSupa.__getChain('leads');
        mockResolve(leadsChain, { error: null });

        activitiesChain = mockSupa.__getChain('lead_activities');
        mockResolve(activitiesChain, { error: null });

        const reassignResult = await reassignLead(
            'lead-100',
            NEW_AGENT_ID,
            AGENT_ID,
            'Agent One',
            'Agent Two',
            MANAGER_ID,
        );
        expect(reassignResult.error).toBeNull();

        // --- Step 5: Fetch all activities ---
        mockSupa.__resetChains();

        activitiesChain = mockSupa.__getChain('lead_activities');
        mockResolve(activitiesChain, {
            data: [
                {
                    id: 'act-4',
                    lead_id: 'lead-100',
                    user_id: MANAGER_ID,
                    type: 'reassignment',
                    description: null,
                    metadata: { from_agent_id: AGENT_ID, to_agent_id: NEW_AGENT_ID },
                    created_at: '2026-03-17T11:00:00Z',
                    actor: { full_name: 'Manager Mike' },
                },
                {
                    id: 'act-3',
                    lead_id: 'lead-100',
                    user_id: AGENT_ID,
                    type: 'status_change',
                    description: null,
                    metadata: { from_status: 'new', to_status: 'contacted' },
                    created_at: '2026-03-17T10:00:00Z',
                    actor: { full_name: 'Agent One' },
                },
                {
                    id: 'act-2',
                    lead_id: 'lead-100',
                    user_id: AGENT_ID,
                    type: 'note',
                    description: 'Discussed whole life policy options',
                    metadata: {},
                    created_at: '2026-03-17T09:00:00Z',
                    actor: { full_name: 'Agent One' },
                },
                {
                    id: 'act-1',
                    lead_id: 'lead-100',
                    user_id: AGENT_ID,
                    type: 'created',
                    description: 'Lead created from referral',
                    metadata: {},
                    created_at: '2026-03-17T08:00:00Z',
                    actor: { full_name: 'Agent One' },
                },
            ],
            error: null,
        });

        const activities = await fetchLeadActivities('lead-100');
        expect(activities.error).toBeNull();
        expect(activities.data).toHaveLength(4);

        // Verify the full trail exists in order
        expect(activities.data.map((a) => a.type)).toEqual(['reassignment', 'status_change', 'note', 'created']);
    });
});

// ── Error scenarios ──

describe('Lead lifecycle — error scenarios', () => {
    it('createLead fails — returns error and no data', async () => {
        const leadsChain = mockSupa.__getChain('leads');
        mockResolve(leadsChain, { data: null, error: { message: 'Duplicate phone number' } });

        const result = await createLead(LEAD_INPUT, AGENT_ID);

        expect(result.error).toBe('Duplicate phone number');
        expect(result.data).toBeNull();

        // Activity should NOT be inserted when lead creation fails
        const fromCalls = mockSupa.from.mock.calls.map((c: any[]) => c[0]);
        const activityCalls = fromCalls.filter((t: string) => t === 'lead_activities');
        expect(activityCalls).toHaveLength(0);
    });

    it('addLeadNote fails — returns error from activity insert', async () => {
        const leadsChain = mockSupa.__getChain('leads');
        mockResolve(leadsChain, { error: null });

        const activitiesChain = mockSupa.__getChain('lead_activities');
        mockResolve(activitiesChain, { data: null, error: { message: 'Note too long' } });

        const result = await addLeadNote('lead-100', 'x'.repeat(10000), AGENT_ID);

        expect(result.error).toBe('Note too long');
        expect(result.data).toBeNull();
    });

    it('updateLeadStatus fails — returns error and skips activity log', async () => {
        const leadsChain = mockSupa.__getChain('leads');
        mockResolve(leadsChain, { error: { message: 'Invalid status transition' } });

        const result = await updateLeadStatus('lead-100', 'won', 'new', AGENT_ID);

        expect(result.error).toBe('Invalid status transition');
    });

    it('reassignLead fails — returns error when lead update rejects', async () => {
        const leadsChain = mockSupa.__getChain('leads');
        mockResolve(leadsChain, { error: { message: 'Permission denied' } });

        const result = await reassignLead('lead-100', NEW_AGENT_ID, AGENT_ID, 'A', 'B', MANAGER_ID);

        expect(result.error).toBe('Permission denied');
    });

    it('fetchLeadActivities fails — returns empty data with error', async () => {
        const activitiesChain = mockSupa.__getChain('lead_activities');
        mockResolve(activitiesChain, { data: null, error: { message: 'Table not found' } });

        const result = await fetchLeadActivities('lead-100');

        expect(result.error).toBe('Table not found');
        expect(result.data).toEqual([]);
        expect(result.hasMore).toBe(false);
    });
});

// ── Edge cases ──

describe('Lead lifecycle — edge cases', () => {
    it('createLead with minimal fields (phone and email null)', async () => {
        const minimalLead = {
            ...CREATED_LEAD,
            phone: null,
            email: null,
            notes: null,
        };

        const leadsChain = mockSupa.__getChain('leads');
        mockResolve(leadsChain, { data: minimalLead, error: null });

        const activitiesChain = mockSupa.__getChain('lead_activities');
        mockResolve(activitiesChain, { error: null });

        const result = await createLead(
            {
                full_name: 'Alice Tan',
                phone: null,
                email: null,
                source: 'referral',
                product_interest: 'life_insurance',
                notes: null,
            },
            AGENT_ID,
        );

        expect(result.error).toBeNull();
        expect(result.data).not.toBeNull();
    });

    it('fetchLeadActivities with actors missing returns undefined actor_name', async () => {
        const activitiesChain = mockSupa.__getChain('lead_activities');
        mockResolve(activitiesChain, {
            data: [
                {
                    id: 'act-1',
                    lead_id: 'lead-100',
                    user_id: 'deleted-user',
                    type: 'note',
                    description: 'Old note',
                    metadata: {},
                    created_at: '2026-03-17T08:00:00Z',
                    actor: null,
                },
            ],
            error: null,
        });

        const result = await fetchLeadActivities('lead-100');

        expect(result.data).toHaveLength(1);
        expect(result.data[0].actor_name).toBeUndefined();
    });

    it('multiple status transitions are each recorded independently', async () => {
        // First transition: new -> contacted
        const leadsChain = mockSupa.__getChain('leads');
        mockResolve(leadsChain, { error: null });

        const activitiesChain = mockSupa.__getChain('lead_activities');
        mockResolve(activitiesChain, { error: null });

        const r1 = await updateLeadStatus('lead-100', 'contacted', 'new', AGENT_ID);
        expect(r1.error).toBeNull();

        // Reset and do second transition: contacted -> qualified
        mockSupa.__resetChains();

        const leadsChain2 = mockSupa.__getChain('leads');
        mockResolve(leadsChain2, { error: null });

        const activitiesChain2 = mockSupa.__getChain('lead_activities');
        mockResolve(activitiesChain2, { error: null });

        const r2 = await updateLeadStatus('lead-100', 'qualified', 'contacted', AGENT_ID);
        expect(r2.error).toBeNull();

        // Both transitions should have called lead_activities
        expect(mockSupa.from).toHaveBeenCalledWith('lead_activities');
    });

    it('reassignLead back to original agent records both transfers', async () => {
        // Reassign to agent-002
        const leadsChain = mockSupa.__getChain('leads');
        mockResolve(leadsChain, { error: null });

        const activitiesChain = mockSupa.__getChain('lead_activities');
        mockResolve(activitiesChain, { error: null });

        const r1 = await reassignLead('lead-100', NEW_AGENT_ID, AGENT_ID, 'Agent One', 'Agent Two', MANAGER_ID);
        expect(r1.error).toBeNull();

        // Reset and reassign back to agent-001
        mockSupa.__resetChains();

        const leadsChain2 = mockSupa.__getChain('leads');
        mockResolve(leadsChain2, { error: null });

        const activitiesChain2 = mockSupa.__getChain('lead_activities');
        mockResolve(activitiesChain2, { error: null });

        const r2 = await reassignLead('lead-100', AGENT_ID, NEW_AGENT_ID, 'Agent Two', 'Agent One', MANAGER_ID);
        expect(r2.error).toBeNull();

        expect(mockSupa.from).toHaveBeenCalledWith('leads');
        expect(mockSupa.from).toHaveBeenCalledWith('lead_activities');
    });
});
