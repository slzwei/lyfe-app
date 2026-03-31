/**
 * Account deletion Edge Function.
 *
 * Called by the authenticated user to permanently delete their account.
 * 1. Verifies the caller's JWT
 * 2. Deactivates the user record (is_active = false) — immediate lockout via RLS
 * 3. Removes user data from public tables (best-effort, continues on failure)
 * 4. Deletes the auth.users entry LAST (only after data cleanup)
 *
 * Order rationale: deactivation is the instant gate — the user can no longer
 * act via RLS even if auth deletion takes time. Data cleanup runs best-effort
 * so a single table failure doesn't orphan the rest. Auth deletion is last
 * because it's the only truly irreversible step.
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

// Helper: delete rows, throw on error
async function del(admin: ReturnType<typeof createClient>, table: string, column: string, value: string | string[]) {
    const query = Array.isArray(value)
        ? admin.from(table).delete().in(column, value)
        : admin.from(table).delete().eq(column, value);
    const { error } = await query;
    if (error) throw new DeleteError(table, column, error.message);
}

// Helper: null out a column, throw on error
async function nullOut(admin: ReturnType<typeof createClient>, table: string, column: string, value: string) {
    const { error } = await admin
        .from(table)
        .update({ [column]: null })
        .eq(column, value);
    if (error) throw new DeleteError(table, column, error.message);
}

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

        // Use anon client with user's JWT to verify identity
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

        // ── Service-role client for admin operations ─────────────
        const admin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        // ══════════════════════════════════════════════════════════
        // Phase 1: Deactivate user immediately
        //          is_active = false blocks further API access via RLS.
        //          If this fails, nothing has been touched — safe to retry.
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

        // ══════════════════════════════════════════════════════════
        // Phase 2-4: Best-effort data cleanup
        //            Each group is wrapped in try/catch so a failure
        //            in one table doesn't block cleanup of others.
        // ══════════════════════════════════════════════════════════

        const failures: string[] = [];

        // ── Phase 2: Cascade-delete rows in tables with NOT NULL FKs

        // Leads
        try {
            const { data: userLeads } = await admin
                .from('leads')
                .select('id')
                .or(`assigned_to.eq.${uid},created_by.eq.${uid}`);
            if (userLeads?.length) {
                const leadIds = userLeads.map((l: { id: string }) => l.id);
                await del(admin, 'lead_activities', 'lead_id', leadIds);
                await del(admin, 'leads', 'id', leadIds);
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            failures.push(`leads: ${msg}`);
            console.error('[delete-account] leads cleanup failed:', msg);
        }

        // Events
        try {
            const { data: userEvents } = await admin.from('events').select('id').eq('created_by', uid);
            if (userEvents?.length) {
                const eventIds = userEvents.map((e: { id: string }) => e.id);
                await del(admin, 'event_attendees', 'event_id', eventIds);
                await del(admin, 'roadshow_activities', 'event_id', eventIds);
                await del(admin, 'roadshow_attendance', 'event_id', eventIds);
                await del(admin, 'roadshow_configs', 'event_id', eventIds);
                await del(admin, 'events', 'id', eventIds);
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            failures.push(`events: ${msg}`);
            console.error('[delete-account] events cleanup failed:', msg);
        }

        // Interviews
        try {
            await del(admin, 'interviews', 'manager_id', uid);
            await del(admin, 'interviews', 'scheduled_by_id', uid);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            failures.push(`interviews: ${msg}`);
            console.error('[delete-account] interviews cleanup failed:', msg);
        }

        // Candidates (created/managed by this user)
        try {
            const { data: userCandidates } = await admin
                .from('candidates')
                .select('id')
                .or(`assigned_manager_id.eq.${uid},created_by_id.eq.${uid}`);
            if (userCandidates?.length) {
                const candIds = userCandidates.map((c: { id: string }) => c.id);
                await del(admin, 'candidate_activities', 'candidate_id', candIds);
                await del(admin, 'candidate_documents', 'candidate_id', candIds);
                await del(admin, 'candidate_programme_enrollment', 'candidate_id', candIds);
                await del(admin, 'candidates', 'id', candIds);
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            failures.push(`candidates: ${msg}`);
            console.error('[delete-account] candidates cleanup failed:', msg);
        }

        // ── Phase 3: Delete user's own rows (by user_id)

        // Exam answers depend on exam_attempts
        try {
            const { data: attempts } = await admin.from('exam_attempts').select('id').eq('user_id', uid);
            if (attempts?.length) {
                const ids = attempts.map((a: { id: string }) => a.id);
                await del(admin, 'exam_answers', 'attempt_id', ids);
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            failures.push(`exam_answers: ${msg}`);
            console.error('[delete-account] exam_answers cleanup failed:', msg);
        }

        // Resolve candidate_id for progress cleanup
        try {
            const { data: profile } = await admin
                .from('candidate_profiles')
                .select('candidate_id')
                .eq('user_id', uid)
                .maybeSingle();
            if (profile?.candidate_id) {
                await del(admin, 'candidate_module_item_progress', 'candidate_id', profile.candidate_id);
                await del(admin, 'candidate_module_progress', 'candidate_id', profile.candidate_id);
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            failures.push(`candidate_progress: ${msg}`);
            console.error('[delete-account] candidate_progress cleanup failed:', msg);
        }

        // User-keyed tables
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
            'candidate_profiles',
        ];
        for (const table of ownedTables) {
            try {
                await del(admin, table, 'user_id', uid);
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                failures.push(`${table}: ${msg}`);
                console.error(`[delete-account] ${table} cleanup failed:`, msg);
            }
        }

        // Invitations: null out user_id (keep for audit)
        try {
            await nullOut(admin, 'invitations', 'user_id', uid);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            failures.push(`invitations: ${msg}`);
            console.error('[delete-account] invitations cleanup failed:', msg);
        }

        // PA/manager assignments
        try {
            const { error } = await admin
                .from('pa_manager_assignments')
                .delete()
                .or(`manager_id.eq.${uid},pa_id.eq.${uid}`);
            if (error) throw new DeleteError('pa_manager_assignments', 'manager_id|pa_id', error.message);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            failures.push(`pa_manager_assignments: ${msg}`);
            console.error('[delete-account] pa_manager_assignments cleanup failed:', msg);
        }

        // ── Phase 4: Null out nullable FK columns on shared rows

        const nullOuts: [string, string][] = [
            ['roadshow_attendance', 'checked_in_by'],
            ['candidate_module_progress', 'completed_by'],
            ['candidate_module_item_progress', 'completed_by'],
            ['candidate_programme_enrollment', 'unlocked_by'],
            ['roadmap_programmes', 'archived_by'],
            ['roadmap_modules', 'archived_by'],
            ['users', 'reports_to'],
        ];
        for (const [table, column] of nullOuts) {
            try {
                await nullOut(admin, table, column, uid);
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                failures.push(`${table}.${column}: ${msg}`);
                console.error(`[delete-account] ${table}.${column} null-out failed:`, msg);
            }
        }

        // ══════════════════════════════════════════════════════════
        // Phase 5: Delete user profile row
        // ══════════════════════════════════════════════════════════

        try {
            await del(admin, 'users', 'id', uid);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            failures.push(`users: ${msg}`);
            console.error('[delete-account] users row deletion failed:', msg);
        }

        // ══════════════════════════════════════════════════════════
        // Phase 6: Delete auth account LAST
        //          Data is already cleaned. If this fails, the user
        //          is deactivated with no data — admin can finish.
        // ══════════════════════════════════════════════════════════

        const { error: authDeleteError } = await admin.auth.admin.deleteUser(uid);
        if (authDeleteError) {
            failures.push(`auth: ${authDeleteError.message}`);
            console.error('[delete-account] auth delete failed:', authDeleteError.message);
        }

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
