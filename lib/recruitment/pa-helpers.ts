/**
 * PA-specific helper queries — manager assignments, candidate/interview counts
 */
import type { User } from '@/types/database';
import { supabase } from '../supabase';

/** Fetch manager IDs assigned to a PA */
export async function fetchPAManagerIds(paId: string): Promise<string[]> {
    const { data } = await supabase.from('pa_manager_assignments').select('manager_id').eq('pa_id', paId);
    return (data || []).map((a: { manager_id: string }) => a.manager_id);
}

/** Fetch managers (with profile info) assigned to a PA */
export async function fetchPAManagers(paId: string): Promise<User[]> {
    const { data } = await supabase
        .from('pa_manager_assignments')
        .select('manager:users!pa_manager_assignments_manager_id_fkey(id, full_name, role)')
        .eq('pa_id', paId);
    return ((data || []) as { manager: User | null }[]).map((r) => r.manager).filter(Boolean) as User[];
}

/** Count active candidates across a set of manager IDs */
export async function fetchPACandidateCount(managerIds: string[]): Promise<number> {
    if (managerIds.length === 0) return 0;
    const { count } = await supabase
        .from('candidates')
        .select('id', { count: 'exact', head: true })
        .in('assigned_manager_id', managerIds)
        .in('status', ['applied', 'interview_scheduled', 'interviewed', 'approved', 'exam_prep']);
    return count ?? 0;
}

/** Count candidates with interview_scheduled status across manager IDs */
export async function fetchPAInterviewCount(managerIds: string[]): Promise<number> {
    if (managerIds.length === 0) return 0;
    const { count } = await supabase
        .from('candidates')
        .select('id', { count: 'exact', head: true })
        .in('assigned_manager_id', managerIds)
        .eq('status', 'interview_scheduled');
    return count ?? 0;
}
