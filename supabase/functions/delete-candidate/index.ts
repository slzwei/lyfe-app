/**
 * delete-candidate edge function.
 *
 * Hard-deletes a candidate and every dependent row, for lyfe-app mobile staff.
 * Phase 2 of CANDIDATE_DELETE_ARCHIVE_PLAN.md.
 *
 * Flow:
 *   1. Verify caller JWT; require a staff role (admin/director/manager/pa/ro).
 *   2. Team-access guard — admin/director/ro: global; manager: own candidates;
 *      pa: candidates of a manager they are assigned to.
 *   3. Eligibility guard (lyfe-sg parity) — block when the candidate has
 *      completed registration AND a personality quiz. Those must be archived,
 *      not deleted. There is intentionally no licensed/active_agent status
 *      guard (owner decision Q5).
 *   4. Capture linked user / invitation ids for storage cleanup.
 *   5. delete_candidate_cascade(candidate_id) — one transactional DB delete.
 *   6. Best-effort storage cleanup + auth-user deletion. Failures here are
 *      reported as `warnings` on an HTTP 200 — the candidate is already gone,
 *      so a cleanup hiccup must not read as a failed delete (owner decision Q4).
 *
 * Auth: Bearer JWT. Body: { candidate_id: string }.
 * Success: { ok: true, candidate_id, auth_deleted_count, storage_failed_count, warnings? }.
 * Error:   { code?, error }.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STAFF_WITH_DELETE = ['admin', 'director', 'manager', 'pa', 'ro'];
const GLOBAL_ACCESS_ROLES = ['admin', 'director', 'ro'];
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || 'https://lyfe.sg').split(',');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getCorsOrigin(req: Request): string {
    const origin = req.headers.get('Origin') || '';
    return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
}

function corsHeaders(req: Request) {
    return {
        'Access-Control-Allow-Origin': getCorsOrigin(req),
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    };
}

function jsonResponse(req: Request, body: Record<string, unknown>, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    });
}

// ─── Storage cleanup (mirrors delete-account/index.ts) ──────────────────────

const LIST_PAGE_SIZE = 100;
const REMOVE_BATCH_SIZE = 1000;

async function listAllFiles(
    // deno-lint-ignore no-explicit-any
    admin: any,
    bucket: string,
    prefix: string,
): Promise<string[]> {
    const allPaths: string[] = [];
    const queue: string[] = [prefix];

    while (queue.length > 0) {
        const current = queue.shift()!;
        let offset = 0;
        while (true) {
            const { data, error } = await admin.storage.from(bucket).list(current, { limit: LIST_PAGE_SIZE, offset });
            if (error) throw new Error(`list(${bucket}/${current}): ${error.message}`);
            if (!data || data.length === 0) break;

            for (const raw of data) {
                const path = current ? `${current}/${raw.name}` : raw.name;
                // Folders have id=null; recurse. Files: add path.
                if (raw.id === null || raw.id === undefined) {
                    queue.push(path);
                } else {
                    allPaths.push(path);
                }
            }

            if (data.length < LIST_PAGE_SIZE) break;
            offset += LIST_PAGE_SIZE;
        }
    }

    return allPaths;
}

async function removeUnder(
    // deno-lint-ignore no-explicit-any
    admin: any,
    bucket: string,
    prefix: string,
): Promise<void> {
    const paths = await listAllFiles(admin, bucket, prefix);
    if (paths.length === 0) return;
    for (let i = 0; i < paths.length; i += REMOVE_BATCH_SIZE) {
        const batch = paths.slice(i, i + REMOVE_BATCH_SIZE);
        const { error } = await admin.storage.from(bucket).remove(batch);
        if (error) throw new Error(`remove(${bucket}/${prefix}): ${error.message}`);
    }
}

// ─── Handler ────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders(req) });
    }

    try {
        // ── Authenticate caller ───────────────────────────────────
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return jsonResponse(req, { error: 'Missing Authorization header' }, 401);
        }
        const token = authHeader.replace('Bearer ', '');

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
            global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const {
            data: { user: caller },
            error: authError,
        } = await userClient.auth.getUser();
        if (authError || !caller) {
            return jsonResponse(req, { error: 'Unauthorized' }, 401);
        }

        const callerRole: string | undefined = caller.app_metadata?.role;
        if (!callerRole || !STAFF_WITH_DELETE.includes(callerRole)) {
            return jsonResponse(req, { error: 'Insufficient permissions' }, 403);
        }

        // ── Validate input ────────────────────────────────────────
        const payload = await req.json().catch(() => null);
        const candidateId: unknown = payload?.candidate_id;
        if (typeof candidateId !== 'string' || !UUID_RE.test(candidateId)) {
            return jsonResponse(req, { error: 'A valid candidate_id is required' }, 400);
        }

        const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        // ── Load candidate ────────────────────────────────────────
        const { data: candidate, error: candErr } = await admin
            .from('candidates')
            .select('id, name, status, assigned_manager_id')
            .eq('id', candidateId)
            .maybeSingle();
        if (candErr) {
            console.error('[delete-candidate] candidate fetch:', candErr.message);
            return jsonResponse(req, { error: 'Failed to load candidate' }, 500);
        }
        if (!candidate) {
            return jsonResponse(req, { error: 'Candidate not found' }, 404);
        }

        // ── Team-access guard ─────────────────────────────────────
        if (!GLOBAL_ACCESS_ROLES.includes(callerRole)) {
            const managerId = candidate.assigned_manager_id as string | null;
            if (callerRole === 'manager') {
                if (managerId !== caller.id) {
                    return jsonResponse(req, { error: 'This candidate is not on your team' }, 403);
                }
            } else if (callerRole === 'pa') {
                if (!managerId) {
                    return jsonResponse(req, { error: 'This candidate is not on your team' }, 403);
                }
                const { data: assignment } = await admin
                    .from('pa_manager_assignments')
                    .select('id')
                    .eq('pa_id', caller.id)
                    .eq('manager_id', managerId)
                    .maybeSingle();
                if (!assignment) {
                    return jsonResponse(req, { error: 'This candidate is not on your team' }, 403);
                }
            }
        }

        // ── Eligibility guard (lyfe-sg parity) ────────────────────
        // Block deletion once a candidate has completed registration AND a
        // personality quiz; those records must be archived instead.
        const { data: profiles } = await admin
            .from('candidate_profiles')
            .select('user_id, completed')
            .eq('candidate_id', candidateId);
        const profileRows: Array<{ user_id: string | null; completed: boolean | null }> = profiles ?? [];
        const userIds = [...new Set(profileRows.map((p) => p.user_id).filter((v): v is string => !!v))];
        const completedUserIds = profileRows.filter((p) => p.completed && p.user_id).map((p) => p.user_id as string);

        if (completedUserIds.length > 0) {
            const [discRes, enneRes] = await Promise.all([
                admin.from('disc_results').select('user_id').in('user_id', completedUserIds).limit(1),
                admin.from('enneagram_results').select('user_id').in('user_id', completedUserIds).limit(1),
            ]);
            const hasQuiz = (discRes.data?.length ?? 0) > 0 || (enneRes.data?.length ?? 0) > 0;
            if (hasQuiz) {
                return jsonResponse(
                    req,
                    {
                        code: 'candidate_completed_profile_and_quiz',
                        error: 'This candidate has completed registration and quiz. Archive them instead of deleting.',
                    },
                    409,
                );
            }
        }

        // ── Capture linked invitation ids (for storage cleanup) ───
        const invitationIdSet = new Set<string>();
        {
            const { data: byRecord } = await admin
                .from('invitations')
                .select('id')
                .eq('candidate_record_id', candidateId);
            for (const r of byRecord ?? []) invitationIdSet.add(r.id);
            if (userIds.length > 0) {
                const { data: byUser } = await admin.from('invitations').select('id').in('user_id', userIds);
                for (const r of byUser ?? []) invitationIdSet.add(r.id);
            }
        }
        const invitationIds = [...invitationIdSet];

        // ── Transactional DB delete ───────────────────────────────
        const { error: rpcErr } = await admin.rpc('delete_candidate_cascade', {
            p_candidate_id: candidateId,
        });
        if (rpcErr) {
            console.error('[delete-candidate] cascade rpc failed:', rpcErr.code, rpcErr.message);
            const status = rpcErr.code === 'P0002' ? 404 : rpcErr.code === '23503' ? 409 : 500;
            const message =
                status === 404
                    ? 'Candidate not found'
                    : status === 409
                      ? 'Candidate could not be deleted because related records remain. Please contact support.'
                      : 'Failed to delete candidate. No changes were made.';
            return jsonResponse(req, { error: message }, status);
        }

        // ── Best-effort cleanup — the candidate row is already gone ───
        const warnings: string[] = [];

        const storageTasks: Array<{ label: string; run: () => Promise<void> }> = [
            {
                label: `candidate-documents:candidates/${candidateId}`,
                run: () => removeUnder(admin, 'candidate-documents', `candidates/${candidateId}`),
            },
        ];
        for (const uid of userIds) {
            storageTasks.push({ label: `avatars:${uid}`, run: () => removeUnder(admin, 'avatars', uid) });
            storageTasks.push({ label: `candidate-pdfs:${uid}`, run: () => removeUnder(admin, 'candidate-pdfs', uid) });
        }
        for (const invId of invitationIds) {
            storageTasks.push({
                label: `candidate-resumes:invitations/${invId}`,
                run: () => removeUnder(admin, 'candidate-resumes', `invitations/${invId}`),
            });
        }

        let storageFailed = 0;
        for (const task of storageTasks) {
            try {
                await task.run();
            } catch (err) {
                storageFailed++;
                const msg = err instanceof Error ? err.message : String(err);
                warnings.push(`storage ${task.label}: ${msg}`);
                console.error(`[delete-candidate] ${task.label} failed:`, msg);
            }
        }

        let authDeleted = 0;
        for (const uid of userIds) {
            const { error: authDelErr } = await admin.auth.admin.deleteUser(uid);
            if (authDelErr) {
                warnings.push(`auth ${uid}: ${authDelErr.message}`);
                console.error(`[delete-candidate] auth delete ${uid} failed:`, authDelErr.message);
            } else {
                authDeleted++;
            }
        }

        console.log(
            `[delete-candidate] candidate=${candidateId} by=${caller.id} role=${callerRole} ` +
                `users=${userIds.length} authDeleted=${authDeleted} storageFailed=${storageFailed} ` +
                `warnings=${warnings.length}`,
        );

        return jsonResponse(req, {
            ok: true,
            candidate_id: candidateId,
            auth_deleted_count: authDeleted,
            storage_failed_count: storageFailed,
            ...(warnings.length > 0 ? { warnings } : {}),
        });
    } catch (err) {
        console.error('[delete-candidate]', err);
        return jsonResponse(req, { error: 'Failed to delete candidate. Please try again.' }, 500);
    }
});
