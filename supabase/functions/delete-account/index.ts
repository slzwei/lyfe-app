/**
 * Account deletion Edge Function.
 *
 * Called by the authenticated user to permanently delete their account.
 * 1. Verifies the caller's JWT
 * 2. Deletes the auth.users entry FIRST (safe to retry if this fails)
 * 3. Removes user data from public tables (cascading FKs properly)
 *
 * Order rationale: auth deletion is the irreversible gate. If it fails,
 * no data has been touched and the user can simply retry. Once auth is
 * deleted the user can no longer log in, so orphaned data is acceptable
 * (cleaned up below) but a zombie auth account with no data is not.
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
        // Phase 1: Delete auth account FIRST
        //          If this fails, nothing has been touched — safe to retry.
        // ══════════════════════════════════════════════════════════

        const { error: authDeleteError } = await admin.auth.admin.deleteUser(uid);
        if (authDeleteError) {
            console.error('[delete-account] auth delete failed:', authDeleteError.message);
            return jsonResponse(
                req,
                { error: 'Unable to delete account. No data was changed — please try again.' },
                500,
            );
        }

        // ══════════════════════════════════════════════════════════
        // Phase 2: Cascade-delete rows in tables with NOT NULL FKs
        //          Auth is already deleted, so user cannot log in.
        //          Any failure here means partial cleanup — flag it.
        // ══════════════════════════════════════════════════════════

        // ── Leads (assigned_to / created_by are NOT NULL) ────────
        const { data: userLeads } = await admin
            .from('leads')
            .select('id')
            .or(`assigned_to.eq.${uid},created_by.eq.${uid}`);
        if (userLeads?.length) {
            const leadIds = userLeads.map((l: { id: string }) => l.id);
            await del(admin, 'lead_activities', 'lead_id', leadIds);
            await del(admin, 'leads', 'id', leadIds);
        }

        // ── Events (created_by is NOT NULL) ──────────────────────
        const { data: userEvents } = await admin.from('events').select('id').eq('created_by', uid);
        if (userEvents?.length) {
            const eventIds = userEvents.map((e: { id: string }) => e.id);
            await del(admin, 'event_attendees', 'event_id', eventIds);
            await del(admin, 'roadshow_activities', 'event_id', eventIds);
            await del(admin, 'roadshow_attendance', 'event_id', eventIds);
            await del(admin, 'roadshow_configs', 'event_id', eventIds);
            await del(admin, 'events', 'id', eventIds);
        }

        // ── Interviews (manager_id / scheduled_by_id are NOT NULL)
        await del(admin, 'interviews', 'manager_id', uid);
        await del(admin, 'interviews', 'scheduled_by_id', uid);

        // ── Candidates (assigned_manager_id / created_by_id NOT NULL)
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

        // ══════════════════════════════════════════════════════════
        // Phase 3: Delete user's own rows (by user_id)
        // ══════════════════════════════════════════════════════════

        // Exam answers depend on exam_attempts — delete answers first
        const { data: attempts } = await admin.from('exam_attempts').select('id').eq('user_id', uid);
        if (attempts?.length) {
            const ids = attempts.map((a: { id: string }) => a.id);
            await del(admin, 'exam_answers', 'attempt_id', ids);
        }

        // Resolve candidate_id BEFORE deleting candidate_profiles (needed for progress cleanup)
        const { data: profile } = await admin
            .from('candidate_profiles')
            .select('candidate_id')
            .eq('user_id', uid)
            .maybeSingle();
        if (profile?.candidate_id) {
            await del(admin, 'candidate_module_item_progress', 'candidate_id', profile.candidate_id);
            await del(admin, 'candidate_module_progress', 'candidate_id', profile.candidate_id);
        }

        const ownedTables = [
            'notifications',
            'lead_activities',
            'candidate_activities',
            'event_attendees',
            'roadshow_attendance',
            'roadshow_activities',
            'exam_attempts',
            // lyfe-sg ATS tables (user_id FK)
            'disc_results',
            'disc_responses',
            'candidate_profiles',
        ];
        for (const table of ownedTables) {
            await del(admin, table, 'user_id', uid);
        }

        // invitations: null out user_id (nullable FK, keep invitation record for audit)
        await nullOut(admin, 'invitations', 'user_id', uid);

        // pa_manager_assignments uses manager_id / pa_id
        {
            const { error } = await admin
                .from('pa_manager_assignments')
                .delete()
                .or(`manager_id.eq.${uid},pa_id.eq.${uid}`);
            if (error) throw new DeleteError('pa_manager_assignments', 'manager_id|pa_id', error.message);
        }

        // ══════════════════════════════════════════════════════════
        // Phase 4: Null out nullable FK columns on shared rows
        // ══════════════════════════════════════════════════════════

        await nullOut(admin, 'roadshow_attendance', 'checked_in_by', uid);
        await nullOut(admin, 'candidate_module_progress', 'completed_by', uid);
        await nullOut(admin, 'candidate_module_item_progress', 'completed_by', uid);
        await nullOut(admin, 'candidate_programme_enrollment', 'unlocked_by', uid);
        await nullOut(admin, 'roadmap_programmes', 'archived_by', uid);
        await nullOut(admin, 'roadmap_modules', 'archived_by', uid);
        await nullOut(admin, 'users', 'reports_to', uid);

        // ══════════════════════════════════════════════════════════
        // Phase 5: Delete user profile row
        // ══════════════════════════════════════════════════════════

        await del(admin, 'users', 'id', uid);

        return jsonResponse(req, { success: true });
    } catch (err) {
        console.error('[delete-account]', err);

        if (err instanceof DeleteError) {
            console.error(`[delete-account] DeleteError at ${err.table}.${err.column}: ${err.message}`);
            return jsonResponse(
                req,
                {
                    error:
                        'Your account has been deleted but some data could not be removed automatically. ' +
                        'Please contact support for cleanup.',
                },
                500,
            );
        }

        return jsonResponse(req, { error: 'Internal server error' }, 500);
    }
});
