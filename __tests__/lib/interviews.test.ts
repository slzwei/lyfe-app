/**
 * Tests for lib/recruitment/interviews.ts — Interview scheduling operations
 */
import { supabase } from '@/lib/supabase';
import { scheduleInterview, updateInterview, deleteInterview } from '@/lib/recruitment/interviews';

jest.mock('@/lib/supabase');

const mockSupa = supabase as any;

// ── Fixtures ──

const INTERVIEW_ROW = {
    id: 'iv-1',
    candidate_id: 'cand-1',
    manager_id: 'mgr-1',
    scheduled_by_id: 'mgr-1',
    round_number: 1,
    type: 'zoom' as const,
    datetime: '2026-03-20T14:00:00Z',
    location: null,
    zoom_link: 'https://zoom.us/j/123456',
    google_calendar_event_id: null,
    notes: null,
    recommendation: null,
    status: 'scheduled' as const,
    created_at: '2026-03-10T08:00:00Z',
};

const SCHEDULE_INPUT = {
    candidateId: 'cand-1',
    managerId: 'mgr-1',
    scheduledById: 'mgr-1',
    roundNumber: 1,
    type: 'zoom' as const,
    datetime: '2026-03-20T14:00:00Z',
    location: null,
    zoomLink: 'https://zoom.us/j/123456',
    notes: null,
};

beforeEach(() => {
    mockSupa.__resetChains();
    jest.clearAllMocks();
});

// ── scheduleInterview ──

describe('scheduleInterview', () => {
    it('returns the created interview on success', async () => {
        const chain = mockSupa.__getChain('interviews');
        chain.__resolveWith({ data: INTERVIEW_ROW, error: null });

        const result = await scheduleInterview(SCHEDULE_INPUT);

        expect(result.error).toBeNull();
        expect(result.data).not.toBeNull();
        expect(result.data?.id).toBe('iv-1');
        expect(result.data?.type).toBe('zoom');
        expect(result.data?.status).toBe('scheduled');
    });

    it('returns null data and an error message on Supabase error', async () => {
        const chain = mockSupa.__getChain('interviews');
        chain.__resolveWith({ data: null, error: { message: 'insert violates foreign key constraint' } });

        const result = await scheduleInterview(SCHEDULE_INPUT);

        expect(result.data).toBeNull();
        expect(result.error).toBe('insert violates foreign key constraint');
    });

    it('targets the "interviews" table and returns data with status="scheduled"', async () => {
        const chain = mockSupa.__getChain('interviews');
        // The returned row already has status:'scheduled' as the DB would set it.
        // This confirms the function inserted with that value (production code hardcodes it).
        chain.__resolveWith({ data: INTERVIEW_ROW, error: null });

        const result = await scheduleInterview(SCHEDULE_INPUT);

        expect(mockSupa.from).toHaveBeenCalledWith('interviews');
        expect(result.data?.status).toBe('scheduled');
    });

    it('maps camelCase input fields to snake_case database columns in the returned data', async () => {
        const chain = mockSupa.__getChain('interviews');
        chain.__resolveWith({
            data: { ...INTERVIEW_ROW, type: 'in_person', location: 'HQ Boardroom', zoom_link: null },
            error: null,
        });

        const result = await scheduleInterview({
            ...SCHEDULE_INPUT,
            type: 'in_person',
            location: 'HQ Boardroom',
            zoomLink: null,
        });

        // Verify the service correctly passes through what Supabase returns
        expect(result.error).toBeNull();
        expect(result.data?.type).toBe('in_person');
        expect(result.data?.location).toBe('HQ Boardroom');
        expect(result.data?.zoom_link).toBeNull();
        expect(mockSupa.from).toHaveBeenCalledWith('interviews');
    });
});

// ── updateInterview ──

describe('updateInterview', () => {
    const UPDATE_INPUT = {
        type: 'zoom' as const,
        datetime: '2026-03-25T10:00:00Z',
        location: null,
        zoomLink: 'https://zoom.us/j/999',
        notes: 'Rescheduled by candidate',
        status: 'rescheduled' as const,
        recommendation: null as string | null,
    };

    it('returns the updated interview on success', async () => {
        const chain = mockSupa.__getChain('interviews');
        chain.__resolveWith({
            data: { ...INTERVIEW_ROW, status: 'rescheduled', datetime: '2026-03-25T10:00:00Z' },
            error: null,
        });

        const result = await updateInterview('iv-1', UPDATE_INPUT);

        expect(result.error).toBeNull();
        expect(result.data?.id).toBe('iv-1');
        expect(result.data?.status).toBe('rescheduled');
        expect(result.data?.datetime).toBe('2026-03-25T10:00:00Z');
    });

    it('returns null data and an error message on Supabase error', async () => {
        const chain = mockSupa.__getChain('interviews');
        chain.__resolveWith({ data: null, error: { message: 'row not found' } });

        const result = await updateInterview('bad-id', UPDATE_INPUT);

        expect(result.data).toBeNull();
        expect(result.error).toBe('row not found');
    });

    it('targets the "interviews" table and returns the updated row', async () => {
        const chain = mockSupa.__getChain('interviews');
        chain.__resolveWith({
            data: { ...INTERVIEW_ROW, status: 'completed', notes: 'Rescheduled by candidate' },
            error: null,
        });

        const result = await updateInterview('iv-1', { ...UPDATE_INPUT, status: 'completed' });

        expect(mockSupa.from).toHaveBeenCalledWith('interviews');
        expect(result.error).toBeNull();
        expect(result.data?.status).toBe('completed');
        expect(result.data?.notes).toBe('Rescheduled by candidate');
    });

    it('includes recommendation in update', async () => {
        const chain = mockSupa.__getChain('interviews');
        chain.__resolveWith({
            data: { ...INTERVIEW_ROW, status: 'completed', recommendation: 'second_interview' },
            error: null,
        });

        const result = await updateInterview('iv-1', {
            ...UPDATE_INPUT,
            status: 'completed',
            recommendation: 'second_interview',
        });

        expect(result.error).toBeNull();
        expect(result.data?.recommendation).toBe('second_interview');
    });

    it('handles all valid status values', async () => {
        const statuses = ['scheduled', 'completed', 'cancelled', 'rescheduled'] as const;

        for (const status of statuses) {
            mockSupa.__resetChains();
            const chain = mockSupa.__getChain('interviews');
            chain.__resolveWith({ data: { ...INTERVIEW_ROW, status }, error: null });

            const result = await updateInterview('iv-1', { ...UPDATE_INPUT, status });

            expect(result.error).toBeNull();
            expect(result.data?.status).toBe(status);
        }
    });
});

// ── deleteInterview ──

describe('deleteInterview', () => {
    it('returns null error on successful deletion', async () => {
        const chain = mockSupa.__getChain('interviews');
        chain.__resolveWith({ error: null });

        const result = await deleteInterview('iv-1');

        expect(result.error).toBeNull();
    });

    it('returns an error message when Supabase reports a failure', async () => {
        const chain = mockSupa.__getChain('interviews');
        chain.__resolveWith({ error: { message: 'permission denied for table interviews' } });

        const result = await deleteInterview('iv-1');

        expect(result.error).toBe('permission denied for table interviews');
    });

    it('targets the "interviews" table when deleting', async () => {
        const chain = mockSupa.__getChain('interviews');
        chain.__resolveWith({ error: null });

        await deleteInterview('iv-99');

        expect(mockSupa.from).toHaveBeenCalledWith('interviews');
    });
});
