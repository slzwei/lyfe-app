/**
 * Candidate CRUD, resume upload, activities, and MKTR sync
 */
import type { CandidateStatus, Interview, RecruitmentCandidate } from '@/types/recruitment';
import { applyPageRange, resolvePage } from '../pagination';
import { captureError } from '../sentry';
import { supabase } from '../supabase';

export interface CreateCandidateInput {
    name: string;
    phone: string;
    email: string | null;
    notes: string | null;
}

/**
 * Fetch candidates. Managers see all; agents see only their assigned candidates.
 */
export async function fetchCandidates(
    userId: string,
    isManager: boolean,
    page?: number,
    pageSize: number = 50,
): Promise<{ data: RecruitmentCandidate[]; error: string | null; hasMore: boolean }> {
    let query = supabase.from('candidates').select('*').order('updated_at', { ascending: false });

    if (!isManager) {
        query = query.eq('assigned_manager_id', userId);
    }

    query = applyPageRange(query, page, pageSize);

    const { data: rows, error } = await query;
    if (error) return { data: [], error: error.message, hasMore: false };

    const typedRows = (rows || []) as {
        id: string;
        name: string;
        phone: string;
        email: string | null;
        status: string;
        assigned_manager_id: string;
        created_by_id: string;
        invite_token: string | null;
        notes: string | null;
        resume_url: string | null;
        created_at: string;
        updated_at: string;
    }[];

    // Fetch manager names for display
    const managerIds = [...new Set(typedRows.map((r) => r.assigned_manager_id))];
    let managerMap: Record<string, string> = {};
    if (managerIds.length > 0) {
        const { data: managers } = await supabase.from('users').select('id, full_name').in('id', managerIds);
        if (managers) {
            (managers as { id: string; full_name: string }[]).forEach((m) => {
                managerMap[m.id] = m.full_name;
            });
        }
    }

    // Fetch interviews for all candidates in one query
    const candidateIds = typedRows.map((r) => r.id);
    let interviewMap: Record<string, Interview[]> = {};
    if (candidateIds.length > 0) {
        const { data: interviews } = await supabase
            .from('interviews')
            .select('*')
            .in('candidate_id', candidateIds)
            .order('datetime', { ascending: false });
        if (interviews) {
            (interviews as Interview[]).forEach((iv) => {
                if (!interviewMap[iv.candidate_id]) interviewMap[iv.candidate_id] = [];
                interviewMap[iv.candidate_id].push(iv);
            });
        }
    }

    // Map to RecruitmentCandidate shape
    const candidates: RecruitmentCandidate[] = typedRows.map((r) => ({
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
        profile_pdf_path: null,
        disc_pdf_path: null,
        interviews: interviewMap[r.id] || [],
        created_at: r.created_at,
        updated_at: r.updated_at,
    }));

    const { data: paged, hasMore } = resolvePage(candidates, page, pageSize);
    return { data: paged, error: null, hasMore };
}

/**
 * Fetch a single candidate by ID with interviews.
 */
export async function fetchCandidate(
    candidateId: string,
): Promise<{ data: RecruitmentCandidate | null; error: string | null }> {
    const { data: row, error } = await supabase.from('candidates').select('*').eq('id', candidateId).single();

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

    // Interviews + invitation PDFs (parallel)
    const [{ data: interviews }, { data: invitation }] = await Promise.all([
        supabase.from('interviews').select('*').eq('candidate_id', candidateId).order('datetime', { ascending: false }),
        supabase
            .from('invitations')
            .select('profile_pdf_path, disc_pdf_path')
            .eq('candidate_record_id', candidateId)
            .single(),
    ]);

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
        profile_pdf_path: invitation?.profile_pdf_path || null,
        disc_pdf_path: invitation?.disc_pdf_path || null,
        interviews: (interviews || []) as Interview[],
        created_at: row.created_at ?? '',
        updated_at: row.updated_at ?? '',
    };

    return { data: candidate, error: null };
}

/**
 * Create a new candidate with a generated invite token.
 */
export async function createCandidate(
    input: CreateCandidateInput,
    userId: string,
): Promise<{ data: RecruitmentCandidate | null; inviteToken: string | null; error: string | null }> {
    // Generate a 32-byte base64url invite token (matches lyfe-sg format)
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const token = btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

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

    // Also create an invitations record so lyfe-sg ATS can track this candidate
    const { data: staffUser } = await supabase.from('users').select('full_name').eq('id', userId).single();
    await supabase.from('invitations').insert({
        token,
        email: input.email || '',
        candidate_name: input.name,
        status: 'pending',
        invited_by: staffUser?.full_name || 'Mobile App',
        invited_by_user_id: userId,
        candidate_record_id: row.id,
    });

    // Fetch manager name for the response
    const { data: mgr } = staffUser
        ? { data: staffUser }
        : await supabase.from('users').select('full_name').eq('id', userId).single();

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
        profile_pdf_path: null,
        disc_pdf_path: null,
        interviews: [],
        created_at: row.created_at ?? '',
        updated_at: row.updated_at ?? '',
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
    const { error } = await supabase.from('candidates').update({ status: newStatus }).eq('id', candidateId);

    if (error) return { error: error.message };
    return { error: null };
}

/**
 * Upload a PDF resume for a candidate and save the URL to the candidate record.
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

        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
            .from('candidate-resumes')
            .createSignedUrl(filePath, 3600);

        if (signedUrlError || !signedUrlData?.signedUrl) {
            return { url: null, error: signedUrlError?.message ?? 'Failed to generate signed URL' };
        }

        // Store the file path (not the signed URL) so we can re-sign on each access
        const { data: updated, error: updateError } = await supabase
            .from('candidates')
            .update({ resume_url: filePath })
            .eq('id', candidateId)
            .select('id');

        if (updateError) return { url: null, error: updateError.message };
        if (!updated || updated.length === 0)
            return { url: null, error: 'Permission denied: could not save resume URL' };

        return { url: signedUrlData.signedUrl, error: null };
    } catch (err: unknown) {
        captureError(err, { fn: 'uploadResume' });
        return { url: null, error: err instanceof Error ? err.message : 'Upload failed' };
    }
}

/**
 * Fetch candidate status counts for a manager's pipeline view.
 */
export async function fetchCandidateStatusCounts(
    managerId: string,
): Promise<{ data: { status: string }[]; error: string | null }> {
    const { data, error } = await supabase.from('candidates').select('status').eq('assigned_manager_id', managerId);

    if (error) return { data: [], error: error.message };
    return { data: (data || []) as { status: string }[], error: null };
}

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
        const {
            data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) {
            if (__DEV__) console.warn('Cannot sync agent to MKTR: no active session');
            return { success: false, error: 'No active session' };
        }

        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
        const response = await fetch(`${supabaseUrl}/functions/v1/sync-agent-to-mktr`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
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
    } catch (err: unknown) {
        captureError(err, { fn: 'syncAgentToMktr' });
        const message = err instanceof Error ? err.message : 'Unknown error';
        if (__DEV__) console.error('MKTR sync error:', message);
        return { success: false, error: message };
    }
}
