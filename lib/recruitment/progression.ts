/**
 * Candidate progression — paper attempts, milestones, prep-course bookings.
 *
 * Papers use an attempts-only model:
 *   - `candidate_paper_attempts` is the single source of truth
 *   - each row = one sitting (scheduled, passed, or failed)
 *   - derive per-requirement status client-side from the attempt list
 *
 * See migration 20260417100100_candidate_lifecycle_tables.sql.
 */
import type {
    CandidateMilestone,
    CandidatePaperAttempt,
    CandidatePrepCourseBooking,
    MilestoneCode,
    MilestoneStatus,
    PaperCode,
    PrepCourseCode,
} from '@/types/recruitment';
import { EMOCK_MODULE_CODES, type EmockAttempt } from '@/types/emock';
import { supabase } from '../supabase';

// ── Reads ──────────────────────────────────────────────────────────────────

export async function fetchPaperAttempts(
    candidateId: string,
): Promise<{ data: CandidatePaperAttempt[]; error: string | null }> {
    const { data, error } = await supabase
        .from('candidate_paper_attempts')
        .select('*')
        .eq('candidate_id', candidateId)
        .order('exam_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
    if (error) return { data: [], error: error.message };
    return { data: (data || []) as CandidatePaperAttempt[], error: null };
}

export async function fetchMilestones(
    candidateId: string,
): Promise<{ data: CandidateMilestone[]; error: string | null }> {
    const { data, error } = await supabase.from('candidate_milestones').select('*').eq('candidate_id', candidateId);
    if (error) return { data: [], error: error.message };
    return { data: (data || []) as CandidateMilestone[], error: null };
}

export async function fetchPrepCourseBookings(
    candidateId: string,
): Promise<{ data: CandidatePrepCourseBooking[]; error: string | null }> {
    const { data, error } = await supabase
        .from('candidate_prep_course_bookings')
        .select('*')
        .eq('candidate_id', candidateId);
    if (error) return { data: [], error: error.message };
    return { data: (data || []) as CandidatePrepCourseBooking[], error: null };
}

/**
 * eMock practice attempts for a candidate.
 *
 * Bridges candidate_id → candidate_profiles.user_id → emock_attempts.user_id.
 * RLS allows staff reads via `emock_attempts_staff_select` policy
 * (migration 20260427190000) — the policy joins candidate_profiles and uses
 * the same can_access_candidate_user() helper as candidate_paper_attempts.
 *
 * Returns only completed attempts; in-progress quizzes are excluded so the
 * UI shows confirmed scores only.
 */
export async function fetchEmockAttemptsForCandidate(
    candidateId: string,
): Promise<{ data: EmockAttempt[]; error: string | null }> {
    const { data: profile, error: profErr } = await supabase
        .from('candidate_profiles')
        .select('user_id')
        .eq('candidate_id', candidateId)
        .maybeSingle();
    if (profErr) return { data: [], error: profErr.message };
    if (!profile?.user_id) return { data: [], error: null };

    const { data, error } = await supabase
        .from('emock_attempts')
        .select('id, module_id, quiz_id, score, total, passed, time_taken_seconds, completed_at, status')
        .eq('user_id', profile.user_id)
        .eq('status', 'completed')
        .in('module_id', EMOCK_MODULE_CODES as unknown as string[])
        .order('completed_at', { ascending: false });
    if (error) return { data: [], error: error.message };
    return { data: (data || []) as EmockAttempt[], error: null };
}

// ── Bulk fetchers (one roundtrip per data-type for a list of candidates) ───
// Used by the pipeline view so we can compute urgency for 30+ candidates in
// 3 queries instead of 30×3 = 90.

export async function fetchPaperAttemptsForCandidates(
    candidateIds: string[],
): Promise<{ data: CandidatePaperAttempt[]; error: string | null }> {
    if (candidateIds.length === 0) return { data: [], error: null };
    const { data, error } = await supabase
        .from('candidate_paper_attempts')
        .select('*')
        .in('candidate_id', candidateIds)
        .order('exam_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
    if (error) return { data: [], error: error.message };
    return { data: (data || []) as CandidatePaperAttempt[], error: null };
}

export async function fetchMilestonesForCandidates(
    candidateIds: string[],
): Promise<{ data: CandidateMilestone[]; error: string | null }> {
    if (candidateIds.length === 0) return { data: [], error: null };
    const { data, error } = await supabase.from('candidate_milestones').select('*').in('candidate_id', candidateIds);
    if (error) return { data: [], error: error.message };
    return { data: (data || []) as CandidateMilestone[], error: null };
}

export async function fetchActivitiesForCandidates(
    candidateIds: string[],
    /** Only fetch activities newer than this cutoff (perf + payload size). */
    sinceDaysAgo = 60,
): Promise<{ data: import('@/types/recruitment').CandidateActivity[]; error: string | null }> {
    if (candidateIds.length === 0) return { data: [], error: null };
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - sinceDaysAgo);
    const { data, error } = await supabase
        .from('candidate_activities')
        .select('*')
        .in('candidate_id', candidateIds)
        .gte('created_at', cutoff.toISOString())
        .order('created_at', { ascending: false });
    if (error) return { data: [], error: error.message };
    return {
        data: (data || []) as import('@/types/recruitment').CandidateActivity[],
        error: null,
    };
}

// ── Shared readiness primitive ─────────────────────────────────────────────
// Mirrors fn_all_papers_passed() in 20260417100100. A paper requirement is
// passed iff some attempt for an accepted code has result='passed'.
export function checkAllPapersPassed(attempts: CandidatePaperAttempt[]): boolean {
    const passed = new Set<PaperCode>(attempts.filter((a) => a.result === 'passed').map((a) => a.paper_code));
    return (
        (passed.has('M9') || passed.has('CM_LIP')) &&
        (passed.has('M9A') || passed.has('CM_LIP')) &&
        (passed.has('M5') || passed.has('RES5')) &&
        passed.has('HI')
    );
}

// ── Paper-attempt writes ──────────────────────────────────────────────────

export interface PaperAttemptPatch {
    paperCode: PaperCode;
    examAt?: string | null;
    cost?: number | null;
    result?: 'passed' | 'failed' | null;
}

export async function upsertPaperAttempt(
    candidateId: string,
    patch: PaperAttemptPatch & { id?: string },
    actorUserId?: string,
): Promise<{ data: CandidatePaperAttempt | null; error: string | null }> {
    const row = {
        id: patch.id,
        candidate_id: candidateId,
        paper_code: patch.paperCode,
        exam_at: patch.examAt ?? null,
        cost: patch.cost ?? null,
        result: patch.result ?? null,
        logged_by_user_id: actorUserId ?? null,
    };
    const { data, error } = patch.id
        ? await supabase.from('candidate_paper_attempts').update(row).eq('id', patch.id).select().single()
        : await supabase.from('candidate_paper_attempts').insert(row).select().single();
    if (error) return { data: null, error: error.message };
    return { data: data as CandidatePaperAttempt, error: null };
}

export async function deletePaperAttempt(id: string): Promise<{ error: string | null }> {
    const { error } = await supabase.from('candidate_paper_attempts').delete().eq('id', id);
    if (error) return { error: error.message };
    return { error: null };
}

// ── Milestone writes ──────────────────────────────────────────────────────

export interface MilestonePatch {
    status: MilestoneStatus;
    scheduledDate?: string | null;
    scheduledEndDate?: string | null;
    completedDate?: string | null;
    referenceNumber?: string | null;
    note?: string | null;
}

export async function upsertMilestone(
    candidateId: string,
    code: MilestoneCode,
    patch: MilestonePatch,
    actorUserId?: string,
): Promise<{ data: CandidateMilestone | null; error: string | null }> {
    if (code === 'rnf' && patch.status === 'issued' && !patch.referenceNumber?.trim()) {
        return { data: null, error: 'RNF reference number is required to mark as issued.' };
    }

    const today = new Date().toISOString().slice(0, 10);
    const isDone = patch.status === 'completed' || patch.status === 'issued';

    const row = {
        candidate_id: candidateId,
        milestone_code: code,
        status: patch.status,
        scheduled_date: patch.scheduledDate ?? null,
        scheduled_end_date: patch.scheduledEndDate ?? null,
        completed_date: isDone ? (patch.completedDate ?? today) : (patch.completedDate ?? null),
        reference_number: patch.referenceNumber?.trim() || null,
        note: patch.note ?? null,
        verified_by_user_id:
            patch.status === 'not_started' || patch.status === 'scheduled' ? null : (actorUserId ?? null),
    };

    const { data, error } = await supabase
        .from('candidate_milestones')
        .upsert(row, { onConflict: 'candidate_id,milestone_code' })
        .select()
        .single();
    if (error) return { data: null, error: error.message };
    return { data: data as CandidateMilestone, error: null };
}

// ── Prep course booking writes ────────────────────────────────────────────

export interface PrepCourseBookingPatch {
    bookedDate?: string | null;
    bookedEndDate?: string | null;
    attended?: boolean;
    note?: string | null;
}

export async function upsertPrepCourseBooking(
    candidateId: string,
    code: PrepCourseCode,
    patch: PrepCourseBookingPatch,
    actorUserId?: string,
): Promise<{ data: CandidatePrepCourseBooking | null; error: string | null }> {
    const row = {
        candidate_id: candidateId,
        course_code: code,
        booked_date: patch.bookedDate ?? null,
        booked_end_date: patch.bookedEndDate ?? null,
        attended: patch.attended ?? false,
        note: patch.note ?? null,
        booked_by_user_id: patch.bookedDate ? (actorUserId ?? null) : null,
    };

    const { data, error } = await supabase
        .from('candidate_prep_course_bookings')
        .upsert(row, { onConflict: 'candidate_id,course_code' })
        .select()
        .single();
    if (error) return { data: null, error: error.message };
    return { data: data as CandidatePrepCourseBooking, error: null };
}

// ── Licensed-readiness promotion ──────────────────────────────────────────

export async function markCandidateLicensed(candidateId: string): Promise<{ error: string | null }> {
    const [attemptsRes, milestonesRes] = await Promise.all([
        fetchPaperAttempts(candidateId),
        fetchMilestones(candidateId),
    ]);
    if (attemptsRes.error) return { error: attemptsRes.error };
    if (milestonesRes.error) return { error: milestonesRes.error };

    if (!checkAllPapersPassed(attemptsRes.data)) {
        return { error: 'All 4 paper requirements must be passed before marking as licensed.' };
    }
    const rnf = milestonesRes.data.find((m) => m.milestone_code === 'rnf');
    if (rnf?.status !== 'issued') {
        return { error: 'RNF must be issued before marking as licensed.' };
    }

    const { error } = await supabase.from('candidates').update({ status: 'licensed' }).eq('id', candidateId);
    if (error) return { error: error.message };
    return { error: null };
}
