/**
 * Shared candidate creation edge function.
 * Used by both lyfe-app (mobile) and lyfe-sg (web) to ensure consistent
 * candidate + invitation creation with a single source of truth.
 *
 * Auth: Bearer JWT (validates caller is staff)
 * Body: { name, phone, email?, notes?, job_id? }
 * Returns: { candidate, invitation, invite_token, invite_url }
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface CreatePayload {
    name: string;
    phone: string;
    email?: string;
    notes?: string;
    job_id?: string;
    assigned_manager_id?: string;
}

const LYFE_SG_URL = Deno.env.get('LYFE_SG_URL') || 'https://lyfe.sg';
const STAFF_ROLES = ['admin', 'director', 'manager', 'pa'];

function generateToken(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204 });
    }

    try {
        // ── Auth ──────────────────────────────────────────────────
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return jsonResponse({ error: 'Missing Authorization header' }, 401);
        }

        const token = authHeader.replace('Bearer ', '');
        const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
            global: { headers: { Authorization: `Bearer ${token}` } },
        });

        const {
            data: { user: caller },
            error: authError,
        } = await userClient.auth.getUser();
        if (authError || !caller) {
            return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const callerRole = caller.app_metadata?.role;
        if (!callerRole || !STAFF_ROLES.includes(callerRole)) {
            return jsonResponse({ error: 'Insufficient permissions' }, 403);
        }

        // ── Input validation ──────────────────────────────────────
        const payload: CreatePayload = await req.json();
        const { name, phone, email, notes, job_id, assigned_manager_id } = payload;

        if (!name?.trim()) return jsonResponse({ error: 'name is required' }, 400);
        if (!phone?.trim()) return jsonResponse({ error: 'phone is required' }, 400);

        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (job_id && !UUID_RE.test(job_id)) return jsonResponse({ error: 'Invalid job_id format' }, 400);
        if (assigned_manager_id && !UUID_RE.test(assigned_manager_id))
            return jsonResponse({ error: 'Invalid assigned_manager_id format' }, 400);

        // ── Service-role client for inserts ────────────────────────
        const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

        // Get caller's name for invitation
        const { data: staffUser } = await admin.from('users').select('full_name').eq('id', caller.id).single();

        // ── Resolve assigned manager ──────────────────────────────
        let managerId = caller.id; // Default: assign to self

        if (assigned_manager_id && assigned_manager_id !== caller.id) {
            // Validate target exists and is a manager/director/admin
            const { data: targetUser } = await admin
                .from('users')
                .select('id, role, is_active')
                .eq('id', assigned_manager_id)
                .single();

            if (!targetUser || !targetUser.is_active) {
                return jsonResponse({ error: 'Target manager not found or inactive' }, 400);
            }

            const validRoles = ['manager', 'director', 'admin'];
            if (!validRoles.includes(targetUser.role)) {
                return jsonResponse({ error: 'Target user is not a manager/director/admin' }, 403);
            }

            // If caller is PA, verify they are assigned to this manager
            if (callerRole === 'pa') {
                const { data: assignment } = await admin
                    .from('pa_manager_assignments')
                    .select('id')
                    .eq('pa_id', caller.id)
                    .eq('manager_id', assigned_manager_id)
                    .single();

                if (!assignment) {
                    return jsonResponse({ error: 'You are not assigned to this manager' }, 403);
                }
            }

            managerId = assigned_manager_id;
        }

        // Dedup: check for existing candidate with same phone
        const normalizedPhone = phone.trim().replace(/^\+/, '');
        const { data: existingCandidate } = await admin
            .from('candidates')
            .select('id')
            .eq('phone', normalizedPhone)
            .maybeSingle();

        if (existingCandidate) {
            return jsonResponse({ error: 'A candidate with this phone number already exists' }, 409);
        }

        // Generate invite token
        const inviteToken = generateToken();

        // Resolve pipeline stage if job_id provided
        let stageId: string | null = null;
        let stageEnteredAt: string | null = null;
        if (job_id) {
            const { data: firstStage } = await admin
                .from('pipeline_stages')
                .select('id')
                .eq('job_id', job_id)
                .order('display_order')
                .limit(1)
                .single();
            if (firstStage) {
                stageId = firstStage.id;
                stageEnteredAt = new Date().toISOString();
            }
        }

        // ── Insert candidate ──────────────────────────────────────
        const { data: candidate, error: candidateErr } = await admin
            .from('candidates')
            .insert({
                name: name.trim(),
                phone: phone.trim(),
                email: email?.trim() || null,
                notes: notes?.trim() || null,
                status: 'applied',
                job_id: job_id || null,
                current_stage_id: stageId,
                stage_entered_at: stageEnteredAt,
                assigned_manager_id: managerId,
                created_by_id: caller.id,
                invite_token: inviteToken,
            })
            .select()
            .single();

        if (candidateErr) {
            return jsonResponse({ error: candidateErr.message }, 500);
        }

        // ── Insert invitation ─────────────────────────────────────
        const { data: invitation, error: inviteErr } = await admin
            .from('invitations')
            .insert({
                token: inviteToken,
                email: email?.trim() || '',
                candidate_name: name.trim(),
                status: 'pending',
                invited_by: staffUser?.full_name || 'Staff',
                invited_by_user_id: caller.id,
                candidate_record_id: candidate.id,
                job_id: job_id || null,
            })
            .select('id, token, status')
            .single();

        if (inviteErr) {
            // Rollback candidate if invitation fails
            await admin.from('candidates').delete().eq('id', candidate.id);
            return jsonResponse({ error: inviteErr.message }, 500);
        }

        // ── Build invite URL ──────────────────────────────────────
        const inviteUrl = `${LYFE_SG_URL}/candidate/login?token=${inviteToken}`;

        return jsonResponse({
            candidate: {
                id: candidate.id,
                name: candidate.name,
                phone: candidate.phone,
                email: candidate.email,
                status: candidate.status,
            },
            invitation: { id: invitation.id, status: invitation.status },
            invite_url: inviteUrl,
        });
    } catch (err) {
        console.error('[create-candidate]', err);
        return jsonResponse({ error: 'Failed to create candidate. Please try again.' }, 500);
    }
});
