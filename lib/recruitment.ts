/**
 * Recruitment service — Supabase CRUD for candidates & interviews
 */
import type {
    CandidateDocument,
    CandidateStatus,
    Interview,
    RecruitmentCandidate,
} from '@/types/recruitment';
import type { User } from '@/types/database';
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
        resume_url: r.resume_url || null,
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
        resume_url: row.resume_url || null,
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
        resume_url: row.resume_url || null,
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

// ── Resume ───────────────────────────────────────────────────

/**
 * Upload a PDF resume for a candidate and save the URL to the candidate record.
 * Returns the public URL on success.
 */
export async function uploadCandidateResume(
    candidateId: string,
    fileUri: string,
    fileName: string,
): Promise<{ url: string | null; error: string | null }> {
    try {
        const response = await fetch(fileUri);
        const arrayBuffer = await response.arrayBuffer();

        const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `${candidateId}/${Date.now()}_${safeName}`;

        const { error: uploadError } = await supabase.storage
            .from('candidate-resumes')
            .upload(filePath, arrayBuffer, { contentType: 'application/pdf', upsert: true });

        if (uploadError) return { url: null, error: uploadError.message };

        const { data: { publicUrl } } = supabase.storage
            .from('candidate-resumes')
            .getPublicUrl(filePath);

        const { data: updated, error: updateError } = await supabase
            .from('candidates')
            .update({ resume_url: publicUrl })
            .eq('id', candidateId)
            .select('id');

        if (updateError) return { url: null, error: updateError.message };
        if (!updated || updated.length === 0) return { url: null, error: 'Permission denied: could not save resume URL' };

        return { url: publicUrl, error: null };
    } catch (err: any) {
        return { url: null, error: err?.message || 'Upload failed' };
    }
}

// ── Candidate Activities ─────────────────────────────────────

/**
 * Log a call or WhatsApp activity against a candidate.
 */
export async function addCandidateActivity(
    candidateId: string,
    userId: string,
    type: 'call' | 'whatsapp' | 'note',
    outcome: string | null,
    note: string | null,
): Promise<{ error: string | null }> {
    const { error } = await supabase
        .from('candidate_activities')
        .insert({ candidate_id: candidateId, user_id: userId, type, outcome: outcome || null, note });
    if (error) return { error: error.message };
    return { error: null };
}

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
        if (__DEV__) console.warn('Cannot sync agent to MKTR: no email for candidate', candidate.name);
        return { success: false, error: 'No email address' };
    }

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
            if (__DEV__) console.warn('Cannot sync agent to MKTR: no active session');
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
            if (__DEV__) console.error(`MKTR sync failed (${response.status}):`, data);
            return { success: false, error: data.error || 'Unknown error' };
        }

        if (__DEV__) console.log('Agent synced to MKTR:', data);
        return { success: true };
    } catch (err: any) {
        if (__DEV__) console.error('MKTR sync error:', err.message);
        return { success: false, error: err.message };
    }
}

// ── Candidate Documents ──────────────────────────────────────

export async function fetchCandidateDocuments(
    candidateId: string,
): Promise<{ data: CandidateDocument[]; error: string | null }> {
    const { data, error } = await supabase
        .from('candidate_documents')
        .select('*')
        .eq('candidate_id', candidateId)
        .order('created_at', { ascending: false });

    if (error) return { data: [], error: error.message };
    return { data: (data || []) as CandidateDocument[], error: null };
}

export async function uploadCandidateDocument(
    candidateId: string,
    label: string,
    fileUri: string,
    fileName: string,
): Promise<{ data: CandidateDocument | null; error: string | null }> {
    try {
        const response = await fetch(fileUri);
        const arrayBuffer = await response.arrayBuffer();

        const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `${candidateId}/docs/${Date.now()}_${safeName}`;

        const { error: uploadError } = await supabase.storage
            .from('candidate-resumes')
            .upload(filePath, arrayBuffer, { contentType: 'application/pdf', upsert: true });

        if (uploadError) return { data: null, error: uploadError.message };

        const { data: { publicUrl } } = supabase.storage
            .from('candidate-resumes')
            .getPublicUrl(filePath);

        const { data: row, error: insertError } = await supabase
            .from('candidate_documents')
            .insert({ candidate_id: candidateId, label, file_url: publicUrl, file_name: fileName })
            .select()
            .single();

        if (insertError || !row) return { data: null, error: insertError?.message ?? 'Failed to save document' };

        return { data: row as CandidateDocument, error: null };
    } catch (err: any) {
        return { data: null, error: err?.message || 'Upload failed' };
    }
}

export async function deleteCandidateDocument(
    documentId: string,
): Promise<{ error: string | null }> {
    const { error } = await supabase
        .from('candidate_documents')
        .delete()
        .eq('id', documentId);

    if (error) return { error: error.message };
    return { error: null };
}

// ── PA Helper Queries ──────────────────────────────────────────

/** Fetch manager IDs assigned to a PA */
export async function fetchPAManagerIds(paId: string): Promise<string[]> {
    const { data } = await supabase
        .from('pa_manager_assignments')
        .select('manager_id')
        .eq('pa_id', paId);
    return (data || []).map((a: any) => a.manager_id);
}

/** Fetch managers (with profile info) assigned to a PA */
export async function fetchPAManagers(paId: string): Promise<User[]> {
    const { data } = await supabase
        .from('pa_manager_assignments')
        .select('manager:users!pa_manager_assignments_manager_id_fkey(id, full_name, role)')
        .eq('pa_id', paId);
    return (data as any[] || []).map(r => r.manager).filter(Boolean);
}

/** Count candidates across a set of manager IDs */
export async function fetchPACandidateCount(managerIds: string[]): Promise<number> {
    if (managerIds.length === 0) return 0;
    const { count } = await supabase
        .from('candidates')
        .select('id', { count: 'exact', head: true })
        .in('assigned_manager_id', managerIds);
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
