/**
 * Recruitment service — Supabase CRUD for candidates & interviews
 */
import type {
    CandidateStatus,
    Interview,
    RecruitmentCandidate,
} from '@/types/recruitment';
import { supabase } from './supabase';

// ── Types ────────────────────────────────────────────────────

export interface CreateCandidateInput {
    name: string;
    phone: string;
    email: string | null;
    notes: string | null;
}

// ── Candidates ───────────────────────────────────────────────

/**
 * Fetch candidates. Managers see all; agents see only their assigned candidates.
 */
export async function fetchCandidates(
    userId: string,
    isManager: boolean,
): Promise<{ data: RecruitmentCandidate[]; error: string | null }> {
    // Fetch candidates
    let query = supabase
        .from('candidates')
        .select('*')
        .order('updated_at', { ascending: false });

    if (!isManager) {
        query = query.eq('assigned_manager_id', userId);
    }

    const { data: rows, error } = await query;
    if (error) return { data: [], error: error.message };

    // Fetch manager names for display
    const managerIds = [...new Set((rows || []).map((r: any) => r.assigned_manager_id))];
    let managerMap: Record<string, string> = {};
    if (managerIds.length > 0) {
        const { data: managers } = await supabase
            .from('users')
            .select('id, full_name')
            .in('id', managerIds);
        if (managers) {
            managers.forEach((m: any) => { managerMap[m.id] = m.full_name; });
        }
    }

    // Fetch interviews for all candidates in one query
    const candidateIds = (rows || []).map((r: any) => r.id);
    let interviewMap: Record<string, Interview[]> = {};
    if (candidateIds.length > 0) {
        const { data: interviews } = await supabase
            .from('interviews')
            .select('*')
            .in('candidate_id', candidateIds)
            .order('datetime', { ascending: false });
        if (interviews) {
            interviews.forEach((iv: any) => {
                if (!interviewMap[iv.candidate_id]) interviewMap[iv.candidate_id] = [];
                interviewMap[iv.candidate_id].push(iv as Interview);
            });
        }
    }

    // Map to RecruitmentCandidate shape
    const candidates: RecruitmentCandidate[] = (rows || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        phone: r.phone,
        email: r.email,
        status: r.status as CandidateStatus,
        assigned_manager_id: r.assigned_manager_id,
        assigned_manager_name: managerMap[r.assigned_manager_id] || 'Unknown',
        created_by_id: r.created_by_id,
        invite_token: r.invite_token,
        notes: r.notes,
        interviews: interviewMap[r.id] || [],
        created_at: r.created_at,
        updated_at: r.updated_at,
    }));

    return { data: candidates, error: null };
}

/**
 * Fetch a single candidate by ID with interviews.
 */
export async function fetchCandidate(
    candidateId: string,
): Promise<{ data: RecruitmentCandidate | null; error: string | null }> {
    const { data: row, error } = await supabase
        .from('candidates')
        .select('*')
        .eq('id', candidateId)
        .single();

    if (error) return { data: null, error: error.message };

    // Manager name
    let managerName = 'Unknown';
    if (row.assigned_manager_id) {
        const { data: mgr } = await supabase
            .from('users')
            .select('full_name')
            .eq('id', row.assigned_manager_id)
            .single();
        if (mgr) managerName = mgr.full_name;
    }

    // Interviews
    const { data: interviews } = await supabase
        .from('interviews')
        .select('*')
        .eq('candidate_id', candidateId)
        .order('datetime', { ascending: false });

    const candidate: RecruitmentCandidate = {
        id: row.id,
        name: row.name,
        phone: row.phone,
        email: row.email,
        status: row.status as CandidateStatus,
        assigned_manager_id: row.assigned_manager_id,
        assigned_manager_name: managerName,
        created_by_id: row.created_by_id,
        invite_token: row.invite_token,
        notes: row.notes,
        interviews: (interviews || []) as Interview[],
        created_at: row.created_at,
        updated_at: row.updated_at,
    };

    return { data: candidate, error: null };
}

/**
 * Create a new candidate with an generated invite token.
 */
export async function createCandidate(
    input: CreateCandidateInput,
    userId: string,
): Promise<{ data: RecruitmentCandidate | null; inviteToken: string | null; error: string | null }> {
    // Generate a random invite token
    const token = `inv_${Array.from({ length: 20 }, () =>
        'abcdefghijklmnopqrstuvwxyz0123456789'.charAt(Math.floor(Math.random() * 36))
    ).join('')}`;

    const { data: row, error } = await supabase
        .from('candidates')
        .insert({
            name: input.name,
            phone: input.phone,
            email: input.email || null,
            notes: input.notes || null,
            status: 'applied',
            assigned_manager_id: userId,
            created_by_id: userId,
            invite_token: token,
        })
        .select()
        .single();

    if (error) return { data: null, inviteToken: null, error: error.message };

    // Fetch manager name for the response
    const { data: mgr } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', userId)
        .single();

    const candidate: RecruitmentCandidate = {
        id: row.id,
        name: row.name,
        phone: row.phone,
        email: row.email,
        status: row.status,
        assigned_manager_id: row.assigned_manager_id,
        assigned_manager_name: mgr?.full_name || 'Unknown',
        created_by_id: row.created_by_id,
        invite_token: row.invite_token,
        notes: row.notes,
        interviews: [],
        created_at: row.created_at,
        updated_at: row.updated_at,
    };

    return { data: candidate, inviteToken: token, error: null };
}

/**
 * Update a candidate's status.
 */
export async function updateCandidateStatus(
    candidateId: string,
    newStatus: CandidateStatus,
): Promise<{ error: string | null }> {
    const { error } = await supabase
        .from('candidates')
        .update({ status: newStatus })
        .eq('id', candidateId);

    if (error) return { error: error.message };
    return { error: null };
}

// ── MKTR Agent Sync ──────────────────────────────────────────

/**
 * Sync a newly-activated agent to MKTR so they can receive leads.
 * Fire-and-forget — errors are logged but never block the caller.
 */
export async function syncAgentToMKTR(candidate: {
    email: string | null;
    name: string;
    phone: string;
    lyfeUserId?: string;
}): Promise<{ success: boolean; error?: string }> {
    if (!candidate.email) {
        console.warn('⚠️ Cannot sync agent to MKTR: no email for candidate', candidate.name);
        return { success: false, error: 'No email address' };
    }

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
            console.warn('⚠️ Cannot sync agent to MKTR: no active session');
            return { success: false, error: 'No active session' };
        }

        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
        const response = await fetch(`${supabaseUrl}/functions/v1/sync-agent-to-mktr`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
                email: candidate.email,
                full_name: candidate.name,
                phone: candidate.phone || null,
                lyfe_user_id: candidate.lyfeUserId || null,
            }),
        });

        const data = await response.json();
        if (!response.ok) {
            console.error(`❌ MKTR sync failed (${response.status}):`, data);
            return { success: false, error: data.error || 'Unknown error' };
        }

        console.log('✅ Agent synced to MKTR:', data);
        return { success: true };
    } catch (err: any) {
        console.error('❌ MKTR sync error:', err.message);
        return { success: false, error: err.message };
    }
}
