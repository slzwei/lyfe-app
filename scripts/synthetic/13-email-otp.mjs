/**
 * B1.3 — `send-email-otp` + `verify-email-otp` paired probe.
 *
 * Exercises the candidate email-verification path end-to-end:
 *   1. Signs in as probe+candidate@lyfe.sg with PROBE_ACCOUNT_PASSWORD.
 *   2. Calls send-email-otp against staging (real edge function + SES path).
 *   3. Asserts an email_otp_codes row was written.
 *   4. Recovers the six-digit OTP from the staging-only hash row using the
 *      service-role client, then verifies one wrong code and the correct code.
 *   5. Asserts users.email_verified=true and all OTP rows are removed.
 *   6. Restores the probe user's original public.users email state.
 *
 * Cleanup strategy: the probe user is stable, seeded by seed.mjs. OTP rows
 * are deleted before and after each run so a failed run self-heals next time.
 */
import { createHash } from 'node:crypto';
import { runProbe } from './_lib/run.mjs';
import { stagingServiceRoleClient, stagingAnonClient, assertStagingMarker } from './_lib/supabase.mjs';
import { guardedFetch } from './_lib/env.mjs';

const PROBE_CANDIDATE_EMAIL = 'probe+candidate@lyfe.sg';

await runProbe(
    'email-otp',
    async () => {
        const service = stagingServiceRoleClient();
        await assertStagingMarker(service);

        let originalUserState = null;
        try {
            originalUserState = await prepareProbeCandidate(service);
            await cleanupOtpRows(service, originalUserState.id);

            const candidateJwt = await signInAsProbeCandidate();

            const send = await callJsonFunction('send-email-otp', candidateJwt, {
                email: PROBE_CANDIDATE_EMAIL,
            });
            if (send.status !== 200 || send.body?.success !== true) {
                throw new Error(
                    `send-email-otp expected 200 success=true, got ${send.status}: ${JSON.stringify(send.body).slice(0, 500)}`,
                );
            }

            const otpRecord = await loadLatestOtpRecord(service, originalUserState.id);
            const recoveredCode = recoverOtpFromHash(otpRecord.code_hash);
            const wrongCode = recoveredCode === '000000' ? '000001' : '000000';

            const wrong = await callJsonFunction('verify-email-otp', candidateJwt, {
                email: PROBE_CANDIDATE_EMAIL,
                code: wrongCode,
            });
            if (wrong.status !== 400 || wrong.body?.error !== 'Invalid verification code') {
                throw new Error(
                    `verify-email-otp wrong-code expected 400 Invalid verification code, got ${wrong.status}: ${JSON.stringify(wrong.body).slice(0, 500)}`,
                );
            }

            const { data: afterWrong, error: afterWrongErr } = await service
                .from('email_otp_codes')
                .select('failed_attempts')
                .eq('id', otpRecord.id)
                .single();
            if (afterWrongErr || !afterWrong) {
                throw new Error(`email_otp_codes lookup after wrong code: ${afterWrongErr?.message}`);
            }
            if (afterWrong.failed_attempts !== 1) {
                throw new Error(`expected failed_attempts=1 after wrong code, got ${afterWrong.failed_attempts}`);
            }

            const verified = await callJsonFunction('verify-email-otp', candidateJwt, {
                email: PROBE_CANDIDATE_EMAIL,
                code: recoveredCode,
            });
            if (verified.status !== 200 || verified.body?.success !== true) {
                throw new Error(
                    `verify-email-otp expected 200 success=true, got ${verified.status}: ${JSON.stringify(verified.body).slice(0, 500)}`,
                );
            }

            const { data: userAfter, error: userAfterErr } = await service
                .from('users')
                .select('email, email_verified')
                .eq('id', originalUserState.id)
                .single();
            if (userAfterErr || !userAfter) {
                throw new Error(`users lookup after verify: ${userAfterErr?.message}`);
            }
            if (userAfter.email !== PROBE_CANDIDATE_EMAIL || userAfter.email_verified !== true) {
                throw new Error(
                    `expected verified email ${PROBE_CANDIDATE_EMAIL}, got email=${userAfter.email} email_verified=${userAfter.email_verified}`,
                );
            }

            const remaining = await countOtpRows(service, originalUserState.id);
            if (remaining !== 0) {
                throw new Error(`expected verify-email-otp to delete OTP rows, found ${remaining}`);
            }

            console.log(
                `[email-otp] sent + verified ${PROBE_CANDIDATE_EMAIL}; wrong-code guard incremented failed_attempts`,
            );
        } finally {
            if (originalUserState) {
                await cleanupOtpRows(service, originalUserState.id);
                await restoreProbeCandidate(service, originalUserState);
            }
        }
    },
    { alertLabels: ['user-creation', 'P1'] },
);

async function prepareProbeCandidate(service) {
    const { data: authList, error: listErr } = await service.auth.admin.listUsers({ perPage: 1000 });
    if (listErr) throw new Error(`auth listUsers: ${listErr.message}`);
    const authUser = (authList?.users || []).find((user) => user.email === PROBE_CANDIDATE_EMAIL);
    if (!authUser) {
        throw new Error(`${PROBE_CANDIDATE_EMAIL} not found. Run \`npm run seed\` in scripts/synthetic/.`);
    }

    const { data: publicUser, error: userErr } = await service
        .from('users')
        .select('id, email, email_verified')
        .eq('id', authUser.id)
        .single();
    if (userErr || !publicUser) {
        throw new Error(`public.users row for ${PROBE_CANDIDATE_EMAIL} not found: ${userErr?.message}`);
    }

    const { error: metaErr } = await service.auth.admin.updateUserById(authUser.id, {
        app_metadata: { role: 'candidate', synthetic_probe: true },
    });
    if (metaErr) throw new Error(`reset candidate auth metadata: ${metaErr.message}`);

    const { error: updateErr } = await service
        .from('users')
        .update({
            email: PROBE_CANDIDATE_EMAIL,
            email_verified: false,
            role: 'candidate',
            is_active: true,
            is_test_data: true,
        })
        .eq('id', authUser.id);
    if (updateErr) throw new Error(`prepare public.users probe candidate: ${updateErr.message}`);

    return {
        id: authUser.id,
        email: publicUser.email,
        email_verified: publicUser.email_verified,
    };
}

async function restoreProbeCandidate(service, original) {
    const { error } = await service
        .from('users')
        .update({
            email: original.email,
            email_verified: original.email_verified,
            role: 'candidate',
        })
        .eq('id', original.id);
    if (error) {
        console.error(`[email-otp] restore public.users probe candidate: ${error.message}`);
    }
}

async function signInAsProbeCandidate() {
    const password = process.env.PROBE_ACCOUNT_PASSWORD;
    if (!password) throw new Error('PROBE_ACCOUNT_PASSWORD is not set.');

    const anon = stagingAnonClient();
    const { data, error } = await anon.auth.signInWithPassword({
        email: PROBE_CANDIDATE_EMAIL,
        password,
    });
    if (error || !data?.session?.access_token) {
        throw new Error(`probe candidate signin: ${error?.message || 'no session'}`);
    }
    return data.session.access_token;
}

async function callJsonFunction(name, jwt, body) {
    const res = await guardedFetch(`${process.env.STAGING_SUPABASE_URL}/functions/v1/${name}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${jwt}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    const text = await res.text();
    let parsed = {};
    if (text) {
        try {
            parsed = JSON.parse(text);
        } catch {
            parsed = { raw: text };
        }
    }

    return { status: res.status, body: parsed };
}

async function loadLatestOtpRecord(service, userId) {
    const { data, error } = await service
        .from('email_otp_codes')
        .select('id, email, code_hash, failed_attempts, expires_at, created_at')
        .eq('user_id', userId)
        .eq('email', PROBE_CANDIDATE_EMAIL)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error || !data) {
        throw new Error(`email_otp_codes row not created: ${error?.message || 'none found'}`);
    }
    if (!data.code_hash) {
        throw new Error(`email_otp_codes ${data.id} missing code_hash`);
    }
    if (new Date(data.expires_at).getTime() <= Date.now()) {
        throw new Error(`email_otp_codes ${data.id} expires_at is not in the future: ${data.expires_at}`);
    }
    if ((data.failed_attempts ?? 0) !== 0) {
        throw new Error(`expected failed_attempts=0 on new code, got ${data.failed_attempts}`);
    }
    return data;
}

function recoverOtpFromHash(expectedHash) {
    const startedAt = Date.now();
    for (let i = 0; i <= 999999; i += 1) {
        const code = String(i).padStart(6, '0');
        if (sha256Hex(code) === expectedHash) {
            console.log(`[email-otp] recovered staging OTP hash in ${Date.now() - startedAt}ms`);
            return code;
        }
    }
    throw new Error('unable to recover six-digit OTP from stored hash');
}

function sha256Hex(value) {
    return createHash('sha256').update(value).digest('hex');
}

async function cleanupOtpRows(service, userId) {
    const { error } = await service.from('email_otp_codes').delete().eq('user_id', userId);
    if (error) {
        console.error(`[email-otp] cleanup email_otp_codes: ${error.message}`);
    }
}

async function countOtpRows(service, userId) {
    const { count, error } = await service
        .from('email_otp_codes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);
    if (error) throw new Error(`count email_otp_codes: ${error.message}`);
    return count ?? 0;
}
