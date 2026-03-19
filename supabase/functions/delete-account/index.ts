/**
 * Account deletion Edge Function.
 *
 * Called by the authenticated user to permanently delete their account.
 * 1. Verifies the caller's JWT
 * 2. Removes user data from public tables (cascading FKs properly)
 * 3. Deletes the auth.users entry via admin API
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}

// Helper: delete rows, log warnings on error
async function del(admin: ReturnType<typeof createClient>, table: string, column: string, value: string | string[]) {
    const query = Array.isArray(value)
        ? admin.from(table).delete().in(column, value)
        : admin.from(table).delete().eq(column, value);
    const { error } = await query;
    if (error) console.warn(`[delete-account] ${table}.${column}:`, error.message);
}

// Helper: null out a column, log warnings on error
async function nullOut(admin: ReturnType<typeof createClient>, table: string, column: string, value: string) {
    const { error } = await admin
        .from(table)
        .update({ [column]: null })
        .eq(column, value);
    if (error) console.warn(`[delete-account] ${table}.${column}:`, error.message);
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
        // ── Authenticate caller via JWT ──────────────────────────
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return jsonResponse({ error: 'Missing authorization header' }, 401);
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
            return jsonResponse({ error: 'Invalid or expired token' }, 401);
        }

        const uid = user.id;

        // ── Service-role client for admin operations ─────────────
        const admin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        // ══════════════════════════════════════════════════════════
        // Phase 1: Cascade-delete rows in tables with NOT NULL FKs
        //          (these columns can't be set to null)
        // ══════════════════════════════════════════════════════════

        // ── Leads (assigned_to / created_by are NOT NULL) ────────
        // Find all leads referencing this user, delete their activities first
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
        // Find events created by this user, delete dependents first
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
        // Find candidates referencing this user, delete dependents
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

        // ── Invite tokens (created_by is NOT NULL) ───────────────
        await del(admin, 'invite_tokens', 'created_by', uid);

        // ══════════════════════════════════════════════════════════
        // Phase 2: Delete user's own rows (by user_id)
        // ══════════════════════════════════════════════════════════

        // Exam answers depend on exam_attempts — delete answers first
        const { data: attempts } = await admin.from('exam_attempts').select('id').eq('user_id', uid);
        if (attempts?.length) {
            const ids = attempts.map((a: { id: string }) => a.id);
            await del(admin, 'exam_answers', 'attempt_id', ids);
        }

        const ownedTables = [
            'notifications',
            'lead_activities',
            'candidate_activities',
            'event_attendees',
            'roadshow_attendance',
            'roadshow_activities',
            'exam_attempts',
        ];
        for (const table of ownedTables) {
            await del(admin, table, 'user_id', uid);
        }

        // candidate_module_*_progress uses candidate_id = users.id
        await del(admin, 'candidate_module_item_progress', 'candidate_id', uid);
        await del(admin, 'candidate_module_progress', 'candidate_id', uid);

        // pa_manager_assignments uses manager_id / pa_id
        {
            const { error } = await admin
                .from('pa_manager_assignments')
                .delete()
                .or(`manager_id.eq.${uid},pa_id.eq.${uid}`);
            if (error) console.warn('[delete-account] pa_manager_assignments:', error.message);
        }

        // ══════════════════════════════════════════════════════════
        // Phase 3: Null out nullable FK columns on shared rows
        // ══════════════════════════════════════════════════════════

        await nullOut(admin, 'invite_tokens', 'assigned_manager_id', uid);
        await nullOut(admin, 'invite_tokens', 'consumed_by', uid);
        await nullOut(admin, 'roadshow_attendance', 'checked_in_by', uid);
        await nullOut(admin, 'candidate_module_progress', 'completed_by', uid);
        await nullOut(admin, 'candidate_module_item_progress', 'completed_by', uid);
        await nullOut(admin, 'candidate_programme_enrollment', 'unlocked_by', uid);
        await nullOut(admin, 'roadmap_programmes', 'archived_by', uid);
        await nullOut(admin, 'roadmap_modules', 'archived_by', uid);
        await nullOut(admin, 'users', 'reports_to', uid);

        // ══════════════════════════════════════════════════════════
        // Phase 4: Delete user profile, then auth user
        // ══════════════════════════════════════════════════════════

        const { error: userDeleteError } = await admin.from('users').delete().eq('id', uid);
        if (userDeleteError) {
            console.error('[delete-account] users delete:', userDeleteError.message);
            return jsonResponse({ error: 'Failed to delete account. Please try again.' }, 500);
        }

        const { error: authDeleteError } = await admin.auth.admin.deleteUser(uid);
        if (authDeleteError) {
            console.error('[delete-account] auth delete:', authDeleteError.message);
            return jsonResponse({ error: 'Failed to delete account. Please try again.' }, 500);
        }

        return jsonResponse({ success: true });
    } catch (err) {
        console.error('[delete-account]', err);
        return jsonResponse({ error: 'Internal server error' }, 500);
    }
});
