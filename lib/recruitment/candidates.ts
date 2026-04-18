/**
 * Candidate CRUD, resume upload, activities, and MKTR sync
 */
import type { CandidateStatus, Interview, RecruitmentCandidate } from '@/types/recruitment';
import { applyPageRange, resolvePage } from '../pagination';
import { captureError } from '../sentry';
import { supabase } from '../supabase';
import { markCandidateLicensed } from './progression';

export interface CreateCandidateInput {
    name: string;
    phone: string;
    email: string | null;
    notes: string | null;
    assigned_manager_id?: string;
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
        stage_before_hold: string | null;
        rejected_at: string | null;
        rejected_reason: string | null;
        rejected_by_user_id: string | null;
        created_at: string;
        updated_at: string;
    }[];

    // Fetch manager names and interviews in parallel (independent lookups)
    const managerIds = [...new Set(typedRows.map((r) => r.assigned_manager_id))];
    const candidateIds = typedRows.map((r) => r.id);

    const [managersResult, interviewsResult] = await Promise.all([
        managerIds.length > 0
            ? supabase.from('users').select('id, full_name').in('id', managerIds)
            : Promise.resolve({ data: null }),
        candidateIds.length > 0
            ? supabase
                  .from('interviews')
                  .select('*')
                  .in('candidate_id', candidateIds)
                  .order('datetime', { ascending: false })
            : Promise.resolve({ data: null }),
    ]);

    let managerMap: Record<string, string> = {};
    if (managersResult.data) {
        (managersResult.data as { id: string; full_name: string }[]).forEach((m) => {
            managerMap[m.id] = m.full_name;
        });
    }

    let interviewMap: Record<string, Interview[]> = {};
    if (interviewsResult.data) {
        (interviewsResult.data as Interview[]).forEach((iv) => {
            if (!interviewMap[iv.candidate_id]) interviewMap[iv.candidate_id] = [];
            interviewMap[iv.candidate_id].push(iv);
        });
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
        disc_results: null,
        profile_details: null,
        interviews: interviewMap[r.id] || [],
        stage_before_hold: (r.stage_before_hold as CandidateStatus | null) ?? null,
        rejected_at: r.rejected_at ?? null,
        rejected_reason: r.rejected_reason ?? null,
        rejected_by_user_id: r.rejected_by_user_id ?? null,
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

    // Fetch manager name and profile in parallel (independent queries)
    const profileFields =
        'user_id, completed, onboarding_step, full_name, chinese_name, alias, date_of_birth, nationality, race, gender, marital_status, address_block, address_street, address_unit, address_postal, position_applied, expected_salary, salary_period, date_available, emergency_name, emergency_relationship, emergency_contact, education, employment_history, languages, software_competencies, shorthand_wpm, typing_wpm';

    const [mgrResult, profileResult] = await Promise.all([
        row.assigned_manager_id
            ? supabase.from('users').select('full_name').eq('id', row.assigned_manager_id).single()
            : Promise.resolve({ data: null }),
        supabase.from('candidate_profiles').select(profileFields).eq('candidate_id', candidateId).single(),
    ]);

    const managerName = mgrResult.data?.full_name || 'Unknown';
    const profile = profileResult.data;

    // Interviews + invitation PDFs + DISC results (parallel)
    const discPromise = profile?.user_id
        ? supabase
              .from('disc_results')
              .select('d_pct, i_pct, s_pct, c_pct, disc_type, angle')
              .eq('user_id', profile.user_id)
              .single()
        : Promise.resolve({ data: null });

    const [{ data: interviews }, { data: invitation }, { data: discRow }] = await Promise.all([
        supabase.from('interviews').select('*').eq('candidate_id', candidateId).order('datetime', { ascending: false }),
        supabase
            .from('invitations')
            .select('profile_pdf_path, disc_pdf_path')
            .eq('candidate_record_id', candidateId)
            .single(),
        discPromise,
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
        stage_before_hold: (row.stage_before_hold as CandidateStatus | null) ?? null,
        rejected_at: row.rejected_at ?? null,
        rejected_reason: row.rejected_reason ?? null,
        rejected_by_user_id: row.rejected_by_user_id ?? null,
        disc_results: discRow
            ? {
                  d_pct: discRow.d_pct,
                  i_pct: discRow.i_pct,
                  s_pct: discRow.s_pct,
                  c_pct: discRow.c_pct,
                  disc_type: discRow.disc_type,
                  angle: discRow.angle,
              }
            : null,
        profile_details: profile
            ? {
                  completed: profile.completed,
                  onboarding_step: profile.onboarding_step,
                  full_name: profile.full_name,
                  chinese_name: profile.chinese_name,
                  alias: profile.alias,
                  date_of_birth: profile.date_of_birth,
                  nationality: profile.nationality,
                  race: profile.race,
                  gender: profile.gender,
                  marital_status: profile.marital_status,
                  address_block: profile.address_block,
                  address_street: profile.address_street,
                  address_unit: profile.address_unit,
                  address_postal: profile.address_postal,
                  position_applied: profile.position_applied,
                  expected_salary: profile.expected_salary,
                  salary_period: profile.salary_period,
                  date_available: profile.date_available,
                  emergency_name: profile.emergency_name,
                  emergency_relationship: profile.emergency_relationship,
                  emergency_contact: profile.emergency_contact,
                  education: (profile.education as any[]) || [],
                  employment_history: (profile.employment_history as any[]) || [],
                  languages: (profile.languages as any[]) || [],
                  software_competencies: profile.software_competencies,
                  shorthand_wpm: profile.shorthand_wpm,
                  typing_wpm: profile.typing_wpm,
              }
            : null,
        interviews: (interviews || []) as Interview[],
        created_at: row.created_at ?? '',
        updated_at: row.updated_at ?? '',
    };

    return { data: candidate, error: null };
}

/**
 * Create a new candidate via the shared create-candidate edge function.
 * This ensures consistent candidate + invitation creation across both apps.
 */
export async function createCandidate(
    input: CreateCandidateInput,
    userId: string,
): Promise<{ data: RecruitmentCandidate | null; inviteToken: string | null; error: string | null }> {
    try {
        const {
            data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) {
            return { data: null, inviteToken: null, error: 'No active session' };
        }

        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
        const response = await fetch(`${supabaseUrl}/functions/v1/create-candidate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
                name: input.name,
                phone: input.phone,
                email: input.email || undefined,
                notes: input.notes || undefined,
                assigned_manager_id: input.assigned_manager_id || undefined,
            }),
        });

        const result = await response.json();
        if (!response.ok) {
            return { data: null, inviteToken: null, error: result.error || 'Failed to create candidate' };
        }

        const row = result.candidate;

        // Fetch manager name for the response
        const { data: mgr } = await supabase.from('users').select('full_name').eq('id', userId).single();

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
            disc_results: null,
            profile_details: null,
            interviews: [],
            stage_before_hold: row.stage_before_hold ?? null,
            rejected_at: row.rejected_at ?? null,
            rejected_reason: row.rejected_reason ?? null,
            rejected_by_user_id: row.rejected_by_user_id ?? null,
            created_at: row.created_at ?? '',
            updated_at: row.updated_at ?? '',
        };

        return { data: candidate, inviteToken: result.invite_token, error: null };
    } catch (err: unknown) {
        captureError(err, { fn: 'createCandidate' });
        return {
            data: null,
            inviteToken: null,
            error: err instanceof Error ? err.message : 'Failed to create candidate',
        };
    }
}

/**
 * Update a candidate's status, with transition guards:
 *  - `active_agent` is NEVER set via this path — only the `activate-agent`
 *    edge function (Phase G) can flip it, because it atomically updates
 *    users.role + MKTR sync + converted_to_agent_at in one transaction.
 *  - `licensed` delegates to `markCandidateLicensed` so the papers-passed +
 *    RNF-issued readiness check runs server-side against fresh data.
 *  - `eapp_done` is accepted as a click target but the DB BEFORE-UPDATE
 *    trigger `trg_auto_advance_eapp_done` rewrites it to `exam_prep`;
 *    callers must re-fetch to see the server-authoritative status.
 */
export async function updateCandidateStatus(
    candidateId: string,
    newStatus: CandidateStatus,
): Promise<{ error: string | null }> {
    if (newStatus === 'active_agent') {
        return {
            error: 'Active agent status can only be set by activating the agent. Use the activate-agent action instead.',
        };
    }
    if (newStatus === 'licensed') {
        return markCandidateLicensed(candidateId);
    }
    if (newStatus === 'rejected') {
        return {
            error: 'Rejection requires a reason. Use rejectCandidate(id, reason, userId) instead of updateCandidateStatus.',
        };
    }

    const { error } = await supabase.from('candidates').update({ status: newStatus }).eq('id', candidateId);
    if (error) return { error: error.message };
    return { error: null };
}

/**
 * Reject a candidate with a reason. Writes status='rejected', rejected_reason,
 * and rejected_by_user_id atomically; the DB trigger trg_stamp_rejected_at
 * auto-stamps rejected_at on the status transition. The caller must have the
 * `reject_candidate` capability (enforced at UI + RLS layers).
 */
export async function rejectCandidate(
    candidateId: string,
    reason: string,
    rejectedByUserId: string,
): Promise<{ error: string | null }> {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
        return { error: 'A rejection reason is required.' };
    }
    if (!rejectedByUserId) {
        return { error: 'Not authenticated.' };
    }
    const { error } = await supabase
        .from('candidates')
        .update({
            status: 'rejected',
            rejected_reason: trimmedReason,
            rejected_by_user_id: rejectedByUserId,
        })
        .eq('id', candidateId);
    if (error) return { error: error.message };
    return { error: null };
}

export interface AssignableManager {
    id: string;
    full_name: string;
    role: string;
}

/**
 * Fetch managers/directors that the current user can assign candidates to.
 * PAs: only their assigned managers. Manager+: all active managers/directors (excluding self).
 */
export async function fetchAssignableManagers(
    userId: string,
    userRole: string,
): Promise<{ data: AssignableManager[]; error: string | null }> {
    try {
        if (userRole === 'pa') {
            const { data: assignments, error: aErr } = await supabase
                .from('pa_manager_assignments')
                .select('manager_id')
                .eq('pa_id', userId);

            if (aErr || !assignments?.length) return { data: [], error: aErr?.message || null };

            const managerIds = assignments.map((a) => a.manager_id);
            const { data: managers, error: mErr } = await supabase
                .from('users')
                .select('id, full_name, role')
                .in('id', managerIds)
                .eq('is_active', true)
                .order('full_name');

            return { data: (managers || []) as AssignableManager[], error: mErr?.message || null };
        }

        const { data: managers, error } = await supabase
            .from('users')
            .select('id, full_name, role')
            .in('role', ['manager', 'director'])
            .eq('is_active', true)
            .neq('id', userId)
            .order('full_name');

        return { data: (managers || []) as AssignableManager[], error: error?.message || null };
    } catch (err: unknown) {
        captureError(err, { fn: 'fetchAssignableManagers' });
        return { data: [], error: err instanceof Error ? err.message : 'Failed to fetch managers' };
    }
}

/**
 * Reassign a candidate to a different manager.
 */
export async function reassignCandidate(
    candidateId: string,
    newManagerId: string,
    userId: string,
): Promise<{ error: string | null }> {
    try {
        // Get old manager name for activity log
        const { data: candidate } = await supabase
            .from('candidates')
            .select('assigned_manager_id')
            .eq('id', candidateId)
            .single();

        const { error } = await supabase
            .from('candidates')
            .update({ assigned_manager_id: newManagerId })
            .eq('id', candidateId);

        if (error) return { error: error.message };

        // Get names for activity log
        const ids = [candidate?.assigned_manager_id, newManagerId].filter(Boolean) as string[];
        const { data: users } = await supabase.from('users').select('id, full_name').in('id', ids);
        const nameMap = new Map((users || []).map((u: { id: string; full_name: string }) => [u.id, u.full_name]));

        await supabase.from('candidate_activities').insert({
            candidate_id: candidateId,
            user_id: userId,
            type: 'reassignment',
            note: `Reassigned from ${nameMap.get(candidate?.assigned_manager_id) || 'Unknown'} to ${nameMap.get(newManagerId) || 'Unknown'}`,
        });

        return { error: null };
    } catch (err: unknown) {
        captureError(err, { fn: 'reassignCandidate' });
        return { error: err instanceof Error ? err.message : 'Failed to reassign' };
    }
}

/**
 * Upload a PDF resume for a candidate and save the URL to the candidate record.
 */
const MAX_RESUME_BYTES = 10 * 1024 * 1024; // 10 MB

export async function uploadCandidateResume(
    candidateId: string,
    fileUri: string,
    fileName: string,
): Promise<{ url: string | null; error: string | null }> {
    try {
        const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
        if (ext !== '.pdf') {
            return { url: null, error: 'Only PDF files are allowed.' };
        }

        const response = await fetch(fileUri);
        const arrayBuffer = await response.arrayBuffer();

        if (arrayBuffer.byteLength > MAX_RESUME_BYTES) {
            return { url: null, error: 'File must be under 10 MB.' };
        }

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
 * Phase G: activate a licensed candidate to an active agent. Calls the
 * activate-agent edge function which wraps fn_activate_agent (atomic DB flip)
 * + auth.admin app_metadata update. Readiness gates are server-enforced.
 *
 * Returns { error } on any failure path; on success returns { error: null,
 * userId, warning }. `warning` is populated when the DB flip succeeded but
 * auth.users.app_metadata could not be updated (rare) — the caller should
 * surface this as a "sign-out and back in to refresh your role" hint.
 */
export async function activateAgent(
    candidateId: string,
): Promise<{ error: string | null; userId?: string; warning?: string }> {
    try {
        const {
            data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) {
            return { error: 'Not authenticated' };
        }
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
        const response = await fetch(`${supabaseUrl}/functions/v1/activate-agent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ candidate_id: candidateId }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return { error: (data?.error as string) || `Activation failed (HTTP ${response.status})` };
        }

        return {
            error: null,
            userId: data.user_id as string | undefined,
            warning: data.warning as string | undefined,
        };
    } catch (err: unknown) {
        captureError(err, { fn: 'activateAgent' });
        return { error: err instanceof Error ? err.message : 'Activation failed' };
    }
}
