/**
 * Interview scheduling operations
 */
import type { Interview } from '@/types/recruitment';
import { supabase } from '../supabase';

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
    const { data: row, error } = await supabase
        .from('interviews')
        .insert({
            candidate_id: input.candidateId,
            manager_id: input.managerId,
            scheduled_by_id: input.scheduledById,
            round_number: input.roundNumber,
            type: input.type,
            datetime: input.datetime,
            location: input.location,
            zoom_link: input.zoomLink,
            notes: input.notes,
            status: 'scheduled',
        })
        .select()
        .single();

    if (error) return { data: null, error: error.message };
    return { data: row as Interview, error: null };
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
    const { data: row, error } = await supabase
        .from('interviews')
        .update({
            type: input.type,
            datetime: input.datetime,
            location: input.location,
            zoom_link: input.zoomLink,
            notes: input.notes,
            status: input.status,
            recommendation: input.recommendation,
        })
        .eq('id', interviewId)
        .select()
        .single();

    if (error) return { data: null, error: error.message };
    return { data: row as Interview, error: null };
}

export async function deleteInterview(interviewId: string): Promise<{ error: string | null }> {
    const { error } = await supabase.from('interviews').delete().eq('id', interviewId);
    if (error) return { error: error.message };
    return { error: null };
}
