/**
 * Interview scheduling operations
 */
import type { Interview } from '@/types/recruitment';
import { supabase } from '../supabase';
import { queueMutation } from '../offline';

/**
 * Schedule an interview for a candidate.
 */
export async function scheduleInterview(input: {
    candidateId: string;
    managerId: string;
    scheduledById: string;
    roundNumber: number;
    type: 'zoom' | 'in_person';
    datetime: string;
    location: string | null;
    zoomLink: string | null;
    notes: string | null;
}): Promise<{ data: Interview | null; error: string | null }> {
    const row = {
        candidate_id: input.candidateId,
        manager_id: input.managerId,
        scheduled_by_id: input.scheduledById,
        round_number: input.roundNumber,
        type: input.type,
        datetime: input.datetime,
        location: input.location,
        zoom_link: input.zoomLink,
        notes: input.notes,
        status: 'scheduled' as const,
    };
    const res = await queueMutation('interviews', 'insert', row, undefined, () =>
        supabase.from('interviews').insert(row).select().single(),
    );
    if (res.error) return { data: null, error: res.error };
    // Queued offline → optimistic stub so the interview shows immediately.
    const data = res.data ?? ({ id: `offline-${Date.now()}`, ...row } as unknown as Interview);
    return { data: data as Interview, error: null };
}

/**
 * Update an existing interview.
 */
export async function updateInterview(
    interviewId: string,
    input: {
        type: 'zoom' | 'in_person';
        datetime: string;
        location: string | null;
        zoomLink: string | null;
        notes: string | null;
        status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';
        recommendation: string | null;
    },
): Promise<{ data: Interview | null; error: string | null }> {
    const patch = {
        type: input.type,
        datetime: input.datetime,
        location: input.location,
        zoom_link: input.zoomLink,
        notes: input.notes,
        status: input.status,
        recommendation: input.recommendation,
    };
    const res = await queueMutation('interviews', 'update', patch, { id: interviewId }, () =>
        supabase.from('interviews').update(patch).eq('id', interviewId).select().single(),
    );
    if (res.error) return { data: null, error: res.error };
    const data = res.data ?? ({ id: interviewId, ...patch } as unknown as Interview);
    return { data: data as Interview, error: null };
}

export async function deleteInterview(interviewId: string): Promise<{ error: string | null }> {
    const res = await queueMutation('interviews', 'delete', {}, { id: interviewId }, () =>
        supabase.from('interviews').delete().eq('id', interviewId),
    );
    return { error: res.error };
}
