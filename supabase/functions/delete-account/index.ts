/**
 * Account deletion Edge Function.
 *
 * Called by the authenticated user to permanently delete their account.
 * 1. Verifies the caller's JWT
 * 2. Deactivates the user record (is_active = false) — immediate lockout via RLS
 * 3. Captures owned entity IDs (used by storage cleanup)
 * 4. Nulls out invitations FKs that would block downstream deletes
 * 5. Cleans up storage objects across all four buckets (best-effort)
 * 6. Cascade-deletes rows in the public schema (best-effort)
 * 7. Deletes the auth.users entry LAST
 *
 * Order rationale: deactivation is the instant gate — the user can no longer
 * act via RLS even if subsequent cleanup takes time. Data + storage cleanup
 * run best-effort so a single failure doesn't orphan the rest. Auth deletion
 * is last because it's the only truly irreversible step.
 *
 * Kept in sync with lyfe-sg/src/lib/users/delete.ts (the admin web flow runs
 * the same playbook).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || 'https://lyfe.sg').split(',');

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

class DeleteError extends Error {
    constructor(
        public table: string,
        public column: string,
        cause: string,
    ) {
        super(`Failed to delete ${table}.${column}: ${cause}`);
        this.name = 'DeleteError';
    }
}

// ─── Helpers (mirror lyfe-sg) ──────────────────────────────────────────────

async function del(
    // deno-lint-ignore no-explicit-any
    admin: any,
    table: string,
    column: string,
    value: string | string[],
) {
    const query = Array.isArray(value)
        ? admin.from(table).delete().in(column, value)
        : admin.from(table).delete().eq(column, value);
    const { error } = await query;
    if (error) throw new DeleteError(table, column, error.message);
}

async function nullOut(
    // deno-lint-ignore no-explicit-any
    admin: any,
    table: string,
    column: string,
    matchColumn: string,
    value: string | string[],
) {
    const update: Record<string, null> = { [column]: null };
    const query = Array.isArray(value)
        ? admin.from(table).update(update).in(matchColumn, value)
        : admin.from(table).update(update).eq(matchColumn, value);
    const { error } = await query;
    if (error) throw new DeleteError(table, column, error.message);
}

// ─── Storage cleanup (mirrors lyfe-sg/src/lib/users/storage-cleanup.ts) ────

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

async function cleanupUserStorage(
    // deno-lint-ignore no-explicit-any
    admin: any,
    uid: string,
    ownedInvitationIds: string[],
    ownedCandidateIds: string[],
): Promise<string[]> {
    const failures: string[] = [];
    const tasks: Array<{ label: string; run: () => Promise<void> }> = [
        { label: `avatars:${uid}`, run: () => removeUnder(admin, 'avatars', uid) },
        { label: `candidate-pdfs:${uid}`, run: () => removeUnder(admin, 'candidate-pdfs', uid) },
    ];
    for (const invId of ownedInvitationIds) {
        tasks.push({
            label: `candidate-resumes:invitations/${invId}`,
            run: () => removeUnder(admin, 'candidate-resumes', `invitations/${invId}`),
        });
    }
    for (const candId of ownedCandidateIds) {
        tasks.push({
            label: `candidate-documents:candidates/${candId}`,
            run: () => removeUnder(admin, 'candidate-documents', `candidates/${candId}`),
        });
    }

    for (const t of tasks) {
        try {
            await t.run();
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            failures.push(`storage ${t.label}: ${msg}`);
            console.error(`[delete-account] ${t.label} failed:`, msg);
        }
    }

    return failures;
}

// ─── Handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders(req) });
    }

    try {
        // ── Authenticate caller via JWT ──────────────────────────
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return jsonResponse(req, { error: 'Missing authorization header' }, 401);
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

        const userClient = createClient(supabaseUrl, anonKey, {
            global: { headers: { Authorization: authHeader } },
        });
        const {
            data: { user },
            error: authError,
        } = await userClient.auth.getUser();

        if (authError || !user) {
            return jsonResponse(req, { error: 'Invalid or expired token' }, 401);
        }

        const uid = user.id;
        const startedAt = Date.now();

        // ── Service-role client ─────────────────────────────────
        const admin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        // ══════════════════════════════════════════════════════════
        // Phase 1: Deactivate immediately
        // ══════════════════════════════════════════════════════════
        const { error: deactivateError } = await admin.from('users').update({ is_active: false }).eq('id', uid);

        if (deactivateError) {
            console.error('[delete-account] deactivation failed:', deactivateError.message);
            return jsonResponse(
                req,
                { error: 'Unable to delete account. No data was changed — please try again.' },
                500,
            );
        }

        const failures: string[] = [];
        const track = async (label: string, fn: () => Promise<void>) => {
            try {
                await fn();
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                failures.push(`${label}: ${msg}`);
                console.error(`[delete-account] ${label} failed:`, msg);
            }
        };

        // ══════════════════════════════════════════════════════════
        // Phase 2: Capture owned entity IDs
        // ══════════════════════════════════════════════════════════
        let ownedLeadIds: string[] = [];
        let ownedEventIds: string[] = [];
        let ownedCandidateIds: string[] = [];
        let ownedSgInvitationIds: string[] = [];

        await track('capture leads', async () => {
            const { data } = await admin.from('leads').select('id').or(`assigned_to.eq.${uid},created_by.eq.${uid}`);
            ownedLeadIds = (data ?? []).map((r: { id: string }) => r.id);
        });

        await track('capture events', async () => {
            const { data } = await admin.from('events').select('id').eq('created_by', uid);
            ownedEventIds = (data ?? []).map((r: { id: string }) => r.id);
        });

        await track('capture candidates', async () => {
            const { data } = await admin
                .from('candidates')
                .select('id')
                .or(`assigned_manager_id.eq.${uid},created_by_id.eq.${uid}`);
            ownedCandidateIds = (data ?? []).map((r: { id: string }) => r.id);
        });

        await track('capture sg invitations', async () => {
            const { data } = await admin.from('invitations').select('id').eq('invited_by_user_id', uid);
            ownedSgInvitationIds = (data ?? []).map((r: { id: string }) => r.id);
        });

        // ══════════════════════════════════════════════════════════
        // Phase 3: Null out invitations FKs (lyfe-sg `invitations`)
        // Done BEFORE candidate delete so candidate_record_id FK
        // doesn't block.
        // ══════════════════════════════════════════════════════════

        if (ownedCandidateIds.length > 0) {
            await track('null invitations.candidate_record_id', () =>
                nullOut(admin, 'invitations', 'candidate_record_id', 'candidate_record_id', ownedCandidateIds),
            );
        }
        await track('null invitations.user_id', () => nullOut(admin, 'invitations', 'user_id', 'user_id', uid));
        await track('null invitations.invited_by_user_id', () =>
            nullOut(admin, 'invitations', 'invited_by_user_id', 'invited_by_user_id', uid),
        );
        await track('null invitations.assigned_manager_id', () =>
            nullOut(admin, 'invitations', 'assigned_manager_id', 'assigned_manager_id', uid),
        );

        // ══════════════════════════════════════════════════════════
        // Phase 4: Storage cleanup — uses captured IDs
        // ══════════════════════════════════════════════════════════
        const storageFailures = await cleanupUserStorage(admin, uid, ownedSgInvitationIds, ownedCandidateIds);
        failures.push(...storageFailures);

        // ══════════════════════════════════════════════════════════
        // Phase 5: Cascade-delete owned rows
        // ══════════════════════════════════════════════════════════

        if (ownedLeadIds.length > 0) {
            await track('leads', async () => {
                await del(admin, 'lead_activities', 'lead_id', ownedLeadIds);
                await del(admin, 'leads', 'id', ownedLeadIds);
            });
        }

        if (ownedEventIds.length > 0) {
            await track('events', async () => {
                await del(admin, 'event_attendees', 'event_id', ownedEventIds);
                await del(admin, 'roadshow_activities', 'event_id', ownedEventIds);
                await del(admin, 'roadshow_attendance', 'event_id', ownedEventIds);
                await del(admin, 'roadshow_configs', 'event_id', ownedEventIds);
                await del(admin, 'events', 'id', ownedEventIds);
            });
        }

        await track('interviews', async () => {
            await del(admin, 'interviews', 'manager_id', uid);
            await del(admin, 'interviews', 'scheduled_by_id', uid);
        });

        if (ownedCandidateIds.length > 0) {
            await track('candidates', async () => {
                await del(admin, 'candidate_activities', 'candidate_id', ownedCandidateIds);
                await del(admin, 'candidate_documents', 'candidate_id', ownedCandidateIds);
                await del(admin, 'candidate_programme_enrollment', 'candidate_id', ownedCandidateIds);
                await del(admin, 'candidates', 'id', ownedCandidateIds);
            });
        }

        // ══════════════════════════════════════════════════════════
        // Phase 6: Delete user-keyed rows
        // ══════════════════════════════════════════════════════════

        await track('exam_answers', async () => {
            const { data: attempts } = await admin.from('exam_attempts').select('id').eq('user_id', uid);
            if (attempts?.length) {
                await del(
                    admin,
                    'exam_answers',
                    'attempt_id',
                    attempts.map((a: { id: string }) => a.id),
                );
            }
        });

        await track('candidate_progress', async () => {
            const { data: profile } = await admin
                .from('candidate_profiles')
                .select('candidate_id')
                .eq('user_id', uid)
                .maybeSingle();
            if (profile?.candidate_id) {
                await del(admin, 'candidate_module_item_progress', 'candidate_id', profile.candidate_id);
                await del(admin, 'candidate_module_progress', 'candidate_id', profile.candidate_id);
            }
        });

        const ownedTables = [
            'notifications',
            'lead_activities',
            'candidate_activities',
            'event_attendees',
            'roadshow_attendance',
            'roadshow_activities',
            'exam_attempts',
            'disc_results',
            'disc_responses',
            'enneagram_results',
            'enneagram_responses',
            'candidate_profiles',
        ];
        for (const table of ownedTables) {
            await track(table, () => del(admin, table, 'user_id', uid));
        }

        await track('pa_manager_assignments', async () => {
            const { error } = await admin
                .from('pa_manager_assignments')
                .delete()
                .or(`manager_id.eq.${uid},pa_id.eq.${uid}`);
            if (error) throw new DeleteError('pa_manager_assignments', 'manager_id|pa_id', error.message);
        });

        // ══════════════════════════════════════════════════════════
        // Phase 7: member_invitations cleanup
        // accepted_by_id → delete the invitation. With the acceptor gone
        // the row has no audit value and would otherwise show as an
        // orphaned "ghost" row in the staff admin Staff Invites list.
        // assigned_manager_id is nullable and may sit on rows we still
        // want to keep — null out for audit.
        // invited_by_id is NOT NULL → delete sent rows.
        // ══════════════════════════════════════════════════════════
        await track('member_invitations.accepted_by_id', () => del(admin, 'member_invitations', 'accepted_by_id', uid));
        await track('member_invitations.assigned_manager_id', () =>
            nullOut(admin, 'member_invitations', 'assigned_manager_id', 'assigned_manager_id', uid),
        );
        await track('member_invitations.invited_by_id', () => del(admin, 'member_invitations', 'invited_by_id', uid));

        // ══════════════════════════════════════════════════════════
        // Phase 8: Null out nullable FK columns on shared rows
        // ══════════════════════════════════════════════════════════
        const nullOuts: Array<[string, string]> = [
            ['roadshow_attendance', 'checked_in_by'],
            ['candidate_module_progress', 'completed_by'],
            ['candidate_module_item_progress', 'completed_by'],
            ['candidate_programme_enrollment', 'unlocked_by'],
            ['roadmap_programmes', 'archived_by'],
            ['roadmap_modules', 'archived_by'],
            ['users', 'reports_to'],
        ];
        for (const [table, column] of nullOuts) {
            await track(`${table}.${column}`, () => nullOut(admin, table, column, column, uid));
        }

        // ══════════════════════════════════════════════════════════
        // Phase 9: Delete users row
        // ══════════════════════════════════════════════════════════
        await track('users', () => del(admin, 'users', 'id', uid));

        // ══════════════════════════════════════════════════════════
        // Phase 10: Delete auth account LAST
        // ══════════════════════════════════════════════════════════
        const { error: authDeleteError } = await admin.auth.admin.deleteUser(uid);
        if (authDeleteError) {
            failures.push(`auth: ${authDeleteError.message}`);
            console.error('[delete-account] auth delete failed:', authDeleteError.message);
        }

        const elapsedMs = Date.now() - startedAt;
        console.log(`[delete-account] uid=${uid} elapsed=${elapsedMs}ms failures=${failures.length}`);

        if (failures.length > 0) {
            console.error(`[delete-account] Completed with ${failures.length} failures for user ${uid}:`, failures);
            return jsonResponse(req, {
                success: true,
                warning:
                    'Your account has been deleted but some data could not be removed automatically. ' +
                    'Please contact support if you notice any remaining data.',
                failures: failures.length,
            });
        }

        return jsonResponse(req, { success: true });
    } catch (err) {
        console.error('[delete-account]', err);
        return jsonResponse(req, { error: 'Internal server error' }, 500);
    }
});
