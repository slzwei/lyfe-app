/**
 * Shared candidate creation edge function.
 * Used by lyfe-app (mobile) to create a candidate + invitation with the same
 * semantics as the lyfe-sg ATS invite flow.
 *
 * Auth: Bearer JWT (validates caller is staff)
 * Body: { name, phone, email?, notes?, job_id?, assigned_manager_id? }
 * Returns: { candidate, invitation, invite_token, invite_url, email_sent, email_error? }
 *
 * Behaviour:
 *  - Phone is normalized to the canonical `65XXXXXXXX` SG storage form.
 *    Non-SG / malformed phones are rejected (400).
 *  - When an email is provided it is trimmed + lowercased and a candidate
 *    invitation email is sent via SES. A failed send never fails creation —
 *    `email_sent: false` + `email_error` are returned so the app can show a
 *    manual-link message.
 *  - An invite URL is always returned regardless of email status.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { legacyPhoneEquivalents, normalizeSgPhone } from '../_shared/phone.ts';
import { isSesConfigured, sendCandidateInvitationEmail } from '../_shared/email.ts';

interface CreatePayload {
    name: string;
    phone: string;
    email?: string;
    notes?: string;
    job_id?: string;
    assigned_manager_id?: string;
}

const LYFE_SG_URL = Deno.env.get('LYFE_SG_URL') || 'https://lyfe.sg';
const STAFF_ROLES = ['admin', 'director', 'manager', 'pa', 'ro'];

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

function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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

        // Single SG normalizer for candidate invites. `90000000`, `+65 9000 0000`
        // and `6590000000` all collapse to `6590000000`; non-SG values reject.
        const normalizedPhone = normalizeSgPhone(phone);
        if (!normalizedPhone) {
            return jsonResponse({ error: 'Enter a valid Singapore mobile number' }, 400);
        }

        // Normalize email: trim + lowercase. Validate only if present (email is
        // optional for candidate invites).
        let normalizedEmail: string | null = null;
        if (email?.trim()) {
            normalizedEmail = email.trim().toLowerCase();
            if (!isValidEmail(normalizedEmail)) {
                return jsonResponse({ error: 'Enter a valid email address' }, 400);
            }
        }

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

            const validRoles = ['manager', 'director'];
            if (!validRoles.includes(targetUser.role)) {
                return jsonResponse({ error: 'Target user is not a manager or director' }, 403);
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

        // ── Duplicate phone check ─────────────────────────────────
        // Match every legacy representation (`90000000`, `6590000000`,
        // `+6590000000`, `+65 9000 0000`) so the same phone can't slip past
        // dedup just because an older row stored it differently.
        const { data: existingByPhone } = await admin
            .from('candidates')
            .select('id')
            .in('phone', legacyPhoneEquivalents(normalizedPhone))
            .limit(1)
            .maybeSingle();

        if (existingByPhone) {
            return jsonResponse({ error: 'A candidate with this phone number already exists' }, 409);
        }

        if (normalizedEmail) {
            const { data: existingByEmail } = await admin
                .from('candidates')
                .select('id')
                .eq('email', normalizedEmail)
                .maybeSingle();

            if (existingByEmail) {
                return jsonResponse({ error: 'A candidate with this email already exists' }, 409);
            }
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
                phone: normalizedPhone,
                email: normalizedEmail,
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
            console.error('[create-candidate] candidate insert:', candidateErr.message);
            return jsonResponse({ error: 'Failed to create candidate record' }, 500);
        }

        // ── Insert invitation ─────────────────────────────────────
        // `invitations.email` stores a real email or an empty string only —
        // never a synthetic/phone-like value.
        const { data: invitation, error: inviteErr } = await admin
            .from('invitations')
            .insert({
                token: inviteToken,
                email: normalizedEmail || '',
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
            console.error('[create-candidate] invitation insert:', inviteErr.message);
            return jsonResponse({ error: 'Failed to create invitation' }, 500);
        }

        // ── Mirror into member_invitations so Team → Pending reflects the invite.
        // Best-effort: a pre-existing pending row for this phone skips silently so
        // the primary candidate+invitation flow isn't blocked.
        const { data: existingMemberInv } = await admin
            .from('member_invitations')
            .select('id')
            .eq('phone', normalizedPhone)
            .eq('status', 'pending')
            .maybeSingle();

        if (!existingMemberInv) {
            const { error: memberInvErr } = await admin.from('member_invitations').insert({
                phone: normalizedPhone,
                full_name: name.trim(),
                intended_role: 'candidate',
                status: 'pending',
                invited_by_id: caller.id,
                assigned_manager_id: managerId,
                notes: notes?.trim() || null,
            });
            if (memberInvErr) {
                console.warn('[create-candidate] member_invitations mirror:', memberInvErr.message);
            }
        }

        // ── Build invite URL ──────────────────────────────────────
        const inviteUrl = `${LYFE_SG_URL}/candidate/login?token=${inviteToken}`;

        // ── Send candidate invitation email (best-effort) ─────────
        // A failed send must NOT roll back the candidate — the app surfaces
        // `email_sent: false` + `email_error` and shows a manual-link message.
        let emailSent = false;
        let emailError: string | null = null;
        if (normalizedEmail) {
            if (!isSesConfigured()) {
                emailError = 'Email service is not configured';
                console.warn('[create-candidate] SES not configured — skipping invite email');
            } else {
                try {
                    await sendCandidateInvitationEmail({
                        to: normalizedEmail,
                        candidateName: name.trim(),
                        position: null,
                        inviteUrl,
                    });
                    emailSent = true;
                } catch (err) {
                    emailError = err instanceof Error ? err.message : 'Failed to send invitation email';
                    console.error('[create-candidate] invite email failed:', emailError);
                }
            }
        }

        return jsonResponse({
            candidate: {
                id: candidate.id,
                name: candidate.name,
                phone: candidate.phone,
                email: candidate.email,
                status: candidate.status,
                invite_token: inviteToken,
            },
            invitation: { id: invitation.id, status: invitation.status },
            invite_token: inviteToken,
            invite_url: inviteUrl,
            email_sent: emailSent,
            ...(emailError ? { email_error: emailError } : {}),
        });
    } catch (err) {
        console.error('[create-candidate]', err);
        return jsonResponse({ error: 'Failed to create candidate. Please try again.' }, 500);
    }
});
