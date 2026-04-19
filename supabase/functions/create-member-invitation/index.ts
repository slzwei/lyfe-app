/**
 * Unified member invitation edge function.
 * Creates a member_invitation record for any role (candidate through director).
 * For candidates, also creates candidates + invitations rows for lyfe-sg compatibility.
 *
 * Auth: Bearer JWT (validates caller role against permission matrix)
 * Body: { name, phone, intended_role, assigned_manager_id?, notes? }
 * Returns: { invitation, invite_url? }
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface CreatePayload {
    name: string;
    phone: string;
    intended_role: string;
    assigned_manager_id?: string;
    notes?: string;
}

// Who can invite whom
const INVITE_PERMISSIONS: Record<string, string[]> = {
    admin: ['director', 'manager', 'agent', 'pa', 'candidate'],
    director: ['manager', 'agent', 'pa', 'candidate'],
    manager: ['agent', 'pa', 'candidate'],
    pa: ['candidate'],
};

const LYFE_SG_URL = Deno.env.get('LYFE_SG_URL') || 'https://lyfe.sg';

function generateToken(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGINS')?.split(',')[0] || 'https://lyfe.sg',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
}

/** Validate SG phone: 8 digits, starts with 8 or 9. Returns normalized 65XXXXXXXX (no + prefix, matches Supabase Auth format). */
function normalizePhone(raw: string): string | null {
    const digits = raw.replace(/[\s\-()]/g, '');
    // Already has +65 prefix
    if (/^\+65[89]\d{7}$/.test(digits)) return digits.slice(1);
    // Just 8 digits
    if (/^[89]\d{7}$/.test(digits)) return `65${digits}`;
    // 65 prefix without +
    if (/^65[89]\d{7}$/.test(digits)) return digits;
    return null;
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
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

        const callerRole = caller.app_metadata?.role as string;
        if (!callerRole || !INVITE_PERMISSIONS[callerRole]) {
            return jsonResponse({ error: 'You do not have permission to invite members' }, 403);
        }

        // ── Input validation ──────────────────────────────────────
        const payload: CreatePayload = await req.json();
        const { name, phone, intended_role, assigned_manager_id, notes } = payload;

        if (!name?.trim()) return jsonResponse({ error: 'name is required' }, 400);
        if (!phone?.trim()) return jsonResponse({ error: 'phone is required' }, 400);
        if (!intended_role) return jsonResponse({ error: 'intended_role is required' }, 400);

        // Permission check
        const allowed = INVITE_PERMISSIONS[callerRole];
        if (!allowed.includes(intended_role)) {
            return jsonResponse({ error: `${callerRole} cannot invite ${intended_role} role` }, 403);
        }

        // Phone validation
        const normalizedPhone = normalizePhone(phone);
        if (!normalizedPhone) {
            return jsonResponse({ error: 'Invalid Singapore phone number' }, 400);
        }

        // ── Service-role client ───────────────────────────────────
        const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

        // Check for existing pending invitation for same phone
        const { data: existing } = await admin
            .from('member_invitations')
            .select('id')
            .eq('phone', normalizedPhone)
            .eq('status', 'pending')
            .maybeSingle();

        if (existing) {
            return jsonResponse({ error: 'A pending invitation for this phone number already exists' }, 409);
        }

        // Check if user already exists with this phone
        const { data: existingUser } = await admin
            .from('users')
            .select('id')
            .eq('phone', normalizedPhone)
            .maybeSingle();

        if (existingUser) {
            return jsonResponse({ error: 'A user with this phone number already exists' }, 409);
        }

        // If caller is PA, verify they are assigned to the target manager
        let managerId = assigned_manager_id || null;
        if (callerRole === 'pa') {
            if (!assigned_manager_id) {
                // PA must specify a manager — look up their default assignment
                const { data: assignment } = await admin
                    .from('pa_manager_assignments')
                    .select('manager_id')
                    .eq('pa_id', caller.id)
                    .limit(1)
                    .single();

                if (!assignment) {
                    return jsonResponse({ error: 'No manager assignment found for PA' }, 400);
                }
                managerId = assignment.manager_id;
            } else {
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
        }

        // Validate assigned_manager_id if provided (for non-PA callers)
        if (managerId && callerRole !== 'pa') {
            const { data: targetUser } = await admin
                .from('users')
                .select('id, role, is_active')
                .eq('id', managerId)
                .single();

            if (!targetUser || !targetUser.is_active) {
                return jsonResponse({ error: 'Target manager not found or inactive' }, 400);
            }
            if (!['manager', 'director'].includes(targetUser.role)) {
                return jsonResponse({ error: 'Target user is not a manager or director' }, 403);
            }
        }

        // Get caller's name for candidate invitation
        const { data: staffUser } = await admin.from('users').select('full_name').eq('id', caller.id).single();

        // ── Insert member_invitation ──────────────────────────────
        const { data: invitation, error: invErr } = await admin
            .from('member_invitations')
            .insert({
                phone: normalizedPhone,
                full_name: name.trim(),
                intended_role: intended_role,
                status: 'pending',
                invited_by_id: caller.id,
                assigned_manager_id: managerId,
                notes: notes?.trim() || null,
            })
            .select()
            .single();

        if (invErr) {
            console.error('[create-member-invitation] insert:', invErr.message);
            return jsonResponse({ error: 'Failed to create invitation' }, 500);
        }

        // ── For candidates: also create candidates + invitations rows ──
        let inviteUrl: string | null = null;

        if (intended_role === 'candidate') {
            const inviteToken = generateToken();
            const resolvedManagerId = managerId || caller.id;

            // Insert candidate record
            const { data: candidate, error: candidateErr } = await admin
                .from('candidates')
                .insert({
                    name: name.trim(),
                    phone: normalizedPhone,
                    status: 'applied',
                    assigned_manager_id: resolvedManagerId,
                    created_by_id: caller.id,
                    invite_token: inviteToken,
                    notes: notes?.trim() || null,
                })
                .select()
                .single();

            if (candidateErr) {
                // Rollback member_invitation
                await admin.from('member_invitations').delete().eq('id', invitation.id);
                console.error('[create-member-invitation] candidate insert:', candidateErr.message);
                return jsonResponse({ error: 'Failed to create candidate record' }, 500);
            }

            // Insert lyfe-sg invitation record
            const { error: legacyInvErr } = await admin.from('invitations').insert({
                token: inviteToken,
                email: '',
                candidate_name: name.trim(),
                status: 'pending',
                invited_by: staffUser?.full_name || 'Staff',
                invited_by_user_id: caller.id,
                candidate_record_id: candidate.id,
                assigned_manager_id: resolvedManagerId,
            });

            if (legacyInvErr) {
                // Rollback both
                await admin.from('candidates').delete().eq('id', candidate.id);
                await admin.from('member_invitations').delete().eq('id', invitation.id);
                console.error('[create-member-invitation] legacy invite insert:', legacyInvErr.message);
                return jsonResponse({ error: 'Failed to create invitation record' }, 500);
            }

            inviteUrl = `${LYFE_SG_URL}/candidate/login?token=${inviteToken}`;
        }

        return jsonResponse({
            invitation,
            ...(inviteUrl && { invite_url: inviteUrl }),
        });
    } catch (err) {
        console.error('[create-member-invitation]', err);
        return jsonResponse({ error: 'Internal server error' }, 500);
    }
});
