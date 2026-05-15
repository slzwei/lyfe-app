/**
 * B1.1 — `create-member-invitation` edge function probe.
 *
 * The unified invite path. Highest production value of the user-creation
 * functions: silent breakage stops every new staff/candidate from being
 * onboarded. This probe exercises the most complex variant
 * (intended_role='candidate') which cascades into 3 tables:
 *   1. member_invitations
 *   2. candidates (with invite_token)
 *   3. invitations (legacy, links via invite_token)
 *
 * Auth: signs in as probe+admin@lyfe.sg (seeded by scripts/synthetic/seed.mjs)
 * with PROBE_ACCOUNT_PASSWORD, then passes the resulting JWT.
 *
 * Cleanup strategy: stable phone +6580001999 reserved for this probe.
 * Pre-cleanup sweeps any orphan rows for that phone before each run, so
 * a crashed prior run self-heals on next dispatch.
 */
import { runProbe } from './_lib/run.mjs';
import {
    stagingServiceRoleClient,
    stagingAnonClient,
    assertStagingMarker,
} from './_lib/supabase.mjs';

const PROBE_ADMIN_EMAIL = 'probe+admin@lyfe.sg';
const SYN_INVITE_PHONE = '6580001999';
const SYN_INVITE_PHONE_E164 = '+6580001999';
const SYN_INVITE_NAME = 'Probe Synthetic Invite';

await runProbe(
    'create-member-invitation',
    async () => {
        const service = stagingServiceRoleClient();
        await assertStagingMarker(service);

        // Self-heal any orphans from a previous failed run.
        const preCleanup = await cleanupSyntheticInvite(service);
        if (preCleanup > 0) {
            console.log(`[create-member-invitation] self-healed ${preCleanup} orphan row(s)`);
        }

        // Sign in as the probe admin so the edge function sees role=admin
        // in app_metadata.
        const password = process.env.PROBE_ACCOUNT_PASSWORD;
        if (!password) throw new Error('PROBE_ACCOUNT_PASSWORD is not set.');
        const anon = stagingAnonClient();
        const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({
            email: PROBE_ADMIN_EMAIL,
            password,
        });
        if (signInErr || !signIn?.session?.access_token) {
            throw new Error(
                `sign-in ${PROBE_ADMIN_EMAIL}: ${signInErr?.message || 'no session'}. ` +
                    `Did seed.mjs run? Is PROBE_ACCOUNT_PASSWORD correct?`,
            );
        }
        const adminJwt = signIn.session.access_token;

        // Call the edge function.
        const url = `${process.env.STAGING_SUPABASE_URL}/functions/v1/create-member-invitation`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${adminJwt}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: SYN_INVITE_NAME,
                phone: SYN_INVITE_PHONE_E164,
                intended_role: 'candidate',
                notes: 'synthetic probe — auto-cleaned',
            }),
        });

        let body = {};
        try {
            body = await res.json();
        } catch {
            // leave body={}
        }

        if (res.status !== 200) {
            throw new Error(
                `edge fn returned ${res.status}: ${JSON.stringify(body).slice(0, 500)}`,
            );
        }
        if (!body.invitation?.id) {
            throw new Error(
                `expected invitation.id in response: ${JSON.stringify(body).slice(0, 500)}`,
            );
        }
        if (!body.invite_url || !body.invite_url.includes('/candidate/login?token=')) {
            throw new Error(
                `expected invite_url with /candidate/login?token=: ${JSON.stringify(body).slice(0, 500)}`,
            );
        }

        const invitationId = body.invitation.id;
        const inviteToken = body.invite_url.split('token=')[1];

        // Assert member_invitations row.
        const { data: invRow, error: invErr } = await service
            .from('member_invitations')
            .select('id, status, intended_role, phone, full_name')
            .eq('id', invitationId)
            .single();
        if (invErr || !invRow) {
            throw new Error(`member_invitations ${invitationId} not found: ${invErr?.message}`);
        }
        if (invRow.status !== 'pending') {
            throw new Error(`expected status=pending, got ${invRow.status}`);
        }
        if (invRow.intended_role !== 'candidate') {
            throw new Error(`expected intended_role=candidate, got ${invRow.intended_role}`);
        }
        if (invRow.phone !== SYN_INVITE_PHONE) {
            throw new Error(`expected phone=${SYN_INVITE_PHONE}, got ${invRow.phone}`);
        }

        // Assert candidates row (created because intended_role=candidate).
        const { data: candRow } = await service
            .from('candidates')
            .select('id, status, phone, invite_token')
            .eq('phone', SYN_INVITE_PHONE)
            .eq('invite_token', inviteToken)
            .maybeSingle();
        if (!candRow) {
            throw new Error(
                `candidates row not created for phone=${SYN_INVITE_PHONE} token=${inviteToken.slice(0, 8)}…`,
            );
        }
        if (candRow.status !== 'applied') {
            throw new Error(`expected candidate.status=applied, got ${candRow.status}`);
        }

        // Assert legacy invitations row (links via token).
        const { data: legacyRow } = await service
            .from('invitations')
            .select('id, status, candidate_record_id')
            .eq('token', inviteToken)
            .maybeSingle();
        if (!legacyRow) {
            throw new Error(`legacy invitations row not created for token=${inviteToken.slice(0, 8)}…`);
        }
        if (legacyRow.candidate_record_id !== candRow.id) {
            throw new Error(
                `legacy invitations.candidate_record_id mismatch: got ${legacyRow.candidate_record_id}, expected ${candRow.id}`,
            );
        }

        console.log(
            `[create-member-invitation] invite=${invitationId} candidate=${candRow.id} token=${inviteToken.slice(0, 8)}… all 3 rows present`,
        );

        // Cleanup. Order matters — invitations.candidate_record_id FKs to candidates.id.
        await cleanupSyntheticInvite(service);
    },
    { alertLabels: ['user-creation', 'P1'] },
);

/**
 * Idempotently delete every row tied to the synthetic invite phone.
 * Returns the total rows deleted across the 3 tables.
 */
async function cleanupSyntheticInvite(service) {
    let total = 0;

    // 1. legacy invitations — delete by token first (FK to candidates).
    const { data: cands } = await service
        .from('candidates')
        .select('id, invite_token')
        .eq('phone', SYN_INVITE_PHONE);
    const candidateIds = (cands || []).map((c) => c.id);
    const tokens = (cands || []).map((c) => c.invite_token).filter(Boolean);

    if (tokens.length) {
        const { error, count } = await service
            .from('invitations')
            .delete({ count: 'exact' })
            .in('token', tokens);
        if (!error) total += count || 0;
    }

    // 2. candidates
    if (candidateIds.length) {
        const { error, count } = await service
            .from('candidates')
            .delete({ count: 'exact' })
            .in('id', candidateIds);
        if (!error) total += count || 0;
    }

    // 3. member_invitations (might exist even without candidate row if a prior
    // run failed between insert #1 and insert #2)
    const { error: miErr, count: miCount } = await service
        .from('member_invitations')
        .delete({ count: 'exact' })
        .eq('phone', SYN_INVITE_PHONE);
    if (!miErr) total += miCount || 0;

    return total;
}
