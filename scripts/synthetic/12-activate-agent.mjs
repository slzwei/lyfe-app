/**
 * B1.2 — `activate-agent` edge function probe.
 *
 * Exercises the candidate→agent flip end-to-end. Significant fixture
 * cost vs B1.1: requires a candidate in status=licensed with a linked
 * candidate_profile + 4 milestone rows in the right states.
 *
 * Strategy: stable fixtures (one auth user, one candidate, one profile,
 * 4 milestones) reused across runs. Each probe:
 *   1. Heals probe admin role drift (defensive).
 *   2. Idempotently sets up the activation fixture chain in 'licensed' state.
 *   3. Calls activate-agent as probe+admin@lyfe.sg.
 *   4. Asserts:
 *        - HTTP 200 + ok=true
 *        - response carries the right user_id + candidate_id + app_metadata_updated=true
 *        - candidates.status='active_agent' + converted_to_agent_at set
 *        - public.users.role='agent'
 *        - auth.users.app_metadata.role='agent'
 *   5. Resets state back to 'licensed' / 'candidate' (in finally — runs even on failure).
 *
 * No teardown of the auth user / candidate row across runs — they're stable
 * synthetic fixtures, never used by anything other than this probe.
 */
import { runProbe } from './_lib/run.mjs';
import {
    stagingServiceRoleClient,
    stagingAnonClient,
    assertStagingMarker,
} from './_lib/supabase.mjs';

const PROBE_ADMIN_EMAIL = 'probe+admin@lyfe.sg';
const PROBE_MANAGER_EMAIL = 'probe+manager@lyfe.sg';
const PROBE_ACTIVATION_EMAIL = 'probe+activation@lyfe.sg';
const PROBE_ACTIVATION_PHONE = '6580001998';
const PROBE_ACTIVATION_NAME = 'Probe Activation Subject';

await runProbe(
    'activate-agent',
    async () => {
        const service = stagingServiceRoleClient();
        await assertStagingMarker(service);

        // Defensive seed-heal — probe admin role can drift to 'pa' after
        // manual tests; B1.1 hit this in production. Fix idempotently.
        await healProbeAdminRole(service);

        // Probe manager UUID is required for candidates.assigned_manager_id +
        // created_by_id. Probe manager is seeded by scripts/synthetic/seed.mjs.
        const probeManagerId = await lookupUserIdByEmail(service, PROBE_MANAGER_EMAIL);

        // Idempotently materialise the activation fixture chain in
        // 'licensed' state. Returns IDs we'll use to assert post-conditions.
        const { activationUserId, candidateId } = await setupActivationFixture(service, probeManagerId);

        // Sign in as probe admin (admin/director/manager/pa can call activate-agent).
        const adminJwt = await signInAsProbeAdmin();

        // Call the edge function. Wrap in try/finally so cleanup ALWAYS runs
        // — without that, a failed assertion would leave the fixture stuck in
        // active_agent state, breaking every subsequent run until manually fixed.
        let probeError = null;
        try {
            const url = `${process.env.STAGING_SUPABASE_URL}/functions/v1/activate-agent`;
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${adminJwt}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ candidate_id: candidateId }),
            });

            let body = {};
            try {
                body = await res.json();
            } catch {
                // leave body={}
            }

            if (res.status !== 200) {
                throw new Error(`edge fn returned ${res.status}: ${JSON.stringify(body).slice(0, 500)}`);
            }
            if (body.ok !== true) {
                throw new Error(`expected ok=true, got ${JSON.stringify(body).slice(0, 500)}`);
            }
            if (body.user_id !== activationUserId) {
                throw new Error(`expected user_id=${activationUserId}, got ${body.user_id}`);
            }
            if (body.candidate_id !== candidateId) {
                throw new Error(`expected candidate_id=${candidateId}, got ${body.candidate_id}`);
            }
            if (body.app_metadata_updated !== true) {
                throw new Error(
                    `expected app_metadata_updated=true (got ${body.app_metadata_updated}). ` +
                        `Warning: ${body.warning || 'none'}`,
                );
            }

            // Assert candidates row.
            const { data: candAfter, error: candErr } = await service
                .from('candidates')
                .select('status, converted_to_agent_at')
                .eq('id', candidateId)
                .single();
            if (candErr || !candAfter) throw new Error(`candidate lookup post-activation: ${candErr?.message}`);
            if (candAfter.status !== 'active_agent') {
                throw new Error(`expected candidates.status=active_agent, got ${candAfter.status}`);
            }
            if (!candAfter.converted_to_agent_at) {
                throw new Error('expected candidates.converted_to_agent_at to be set, was null');
            }

            // Assert public.users row.
            const { data: userAfter, error: userErr } = await service
                .from('users')
                .select('role')
                .eq('id', activationUserId)
                .single();
            if (userErr || !userAfter) throw new Error(`user lookup post-activation: ${userErr?.message}`);
            if (userAfter.role !== 'agent') {
                throw new Error(`expected users.role=agent, got ${userAfter.role}`);
            }

            // Assert auth.users.app_metadata.role.
            const { data: authData, error: authErr } = await service.auth.admin.getUserById(activationUserId);
            if (authErr || !authData?.user) throw new Error(`auth user lookup: ${authErr?.message}`);
            const authRole = authData.user.app_metadata?.role;
            if (authRole !== 'agent') {
                throw new Error(`expected auth.users.app_metadata.role=agent, got ${authRole}`);
            }

            console.log(
                `[activate-agent] candidate=${candidateId.slice(0, 8)}… user=${activationUserId.slice(0, 8)}… → agent OK ` +
                    `(candidates.status=active_agent, users.role=agent, app_metadata.role=agent)`,
            );
        } catch (err) {
            probeError = err;
        } finally {
            // ALWAYS reset state, even on assertion failure.
            await resetActivationState(service, activationUserId, candidateId);
        }

        if (probeError) throw probeError;
    },
    { alertLabels: ['user-creation', 'P1'] },
);

// ----- helpers -----

async function healProbeAdminRole(service) {
    const { data: row } = await service
        .from('users')
        .select('id, role')
        .eq('email', PROBE_ADMIN_EMAIL)
        .maybeSingle();
    if (!row) {
        throw new Error(`${PROBE_ADMIN_EMAIL} not found. Run \`npm run seed\` in scripts/synthetic/.`);
    }
    await service.auth.admin.updateUserById(row.id, {
        app_metadata: { role: 'admin', synthetic_probe: true },
    });
    if (row.role !== 'admin') {
        await service.from('users').update({ role: 'admin' }).eq('id', row.id);
    }
}

async function lookupUserIdByEmail(service, email) {
    const { data } = await service.from('users').select('id').eq('email', email).maybeSingle();
    if (!data) {
        throw new Error(`${email} not found in users. Run \`npm run seed\` in scripts/synthetic/.`);
    }
    return data.id;
}

async function setupActivationFixture(service, probeManagerId) {
    // 1. Ensure activation auth user exists.
    const { data: list, error: listErr } = await service.auth.admin.listUsers({ perPage: 1000 });
    if (listErr) throw new Error(`auth listUsers: ${listErr.message}`);
    let activationUser = list?.users?.find((u) => u.email === PROBE_ACTIVATION_EMAIL);

    if (!activationUser) {
        const password = process.env.PROBE_ACCOUNT_PASSWORD;
        if (!password) throw new Error('PROBE_ACCOUNT_PASSWORD not set; cannot create activation user.');
        const { data: created, error: createErr } = await service.auth.admin.createUser({
            phone: PROBE_ACTIVATION_PHONE,
            email: PROBE_ACTIVATION_EMAIL,
            password,
            phone_confirm: true,
            email_confirm: true,
            app_metadata: { role: 'candidate', synthetic_probe: true },
            user_metadata: { synthetic_probe: true, full_name: PROBE_ACTIVATION_NAME },
        });
        if (createErr) throw new Error(`create activation user: ${createErr.message}`);
        activationUser = created.user;
        console.log(`[activate-agent] created activation auth user ${activationUser.id}`);
    }

    // 2. Reset auth user metadata to candidate (in case prior run failed mid-flip).
    await service.auth.admin.updateUserById(activationUser.id, {
        app_metadata: { role: 'candidate', synthetic_probe: true },
    });

    // 3. Reset public.users to candidate.
    await service.from('users').update({
        role: 'candidate',
        is_active: true,
        full_name: PROBE_ACTIVATION_NAME,
        is_test_data: true,
    }).eq('id', activationUser.id);

    // 4. Find or create candidates row.
    let { data: candidate } = await service
        .from('candidates')
        .select('id')
        .eq('phone', PROBE_ACTIVATION_PHONE)
        .maybeSingle();

    if (!candidate) {
        const { data: created, error: candErr } = await service
            .from('candidates')
            .insert({
                name: PROBE_ACTIVATION_NAME,
                phone: PROBE_ACTIVATION_PHONE,
                status: 'licensed',
                assigned_manager_id: probeManagerId,
                created_by_id: probeManagerId,
                invite_token: `probe-activation-${activationUser.id.slice(0, 8)}`,
            })
            .select('id')
            .single();
        if (candErr) throw new Error(`create activation candidate: ${candErr.message}`);
        candidate = created;
        console.log(`[activate-agent] created activation candidate ${candidate.id}`);
    }

    // 5. Reset candidate state to licensed (clears any prior active_agent flip).
    await service.from('candidates').update({
        status: 'licensed',
        converted_to_agent_at: null,
    }).eq('id', candidate.id);

    // 6. Find or create candidate_profiles row (this is what links candidate → auth user).
    const { data: prof } = await service
        .from('candidate_profiles')
        .select('id, user_id')
        .eq('candidate_id', candidate.id)
        .maybeSingle();

    if (!prof) {
        const { error: profErr } = await service.from('candidate_profiles').insert({
            candidate_id: candidate.id,
            user_id: activationUser.id,
            full_name: PROBE_ACTIVATION_NAME,
            completed: true,
            declaration_agreed: true,
            education: [],
            employment_history: [],
            languages: [],
            onboarding_step: 6,
        });
        if (profErr) throw new Error(`create candidate_profile: ${profErr.message}`);
        console.log(`[activate-agent] created candidate_profile`);
    } else if (prof.user_id !== activationUser.id) {
        // Re-link if a stale link exists (e.g. fixture was rebuilt).
        await service.from('candidate_profiles').update({
            user_id: activationUser.id,
            completed: true,
        }).eq('candidate_id', candidate.id);
    }

    // 7. Upsert 4 milestones in the states fn_activate_agent requires.
    const milestones = [
        { milestone_code: 'bdm', status: 'completed' },
        { milestone_code: 'bes_induction', status: 'completed' },
        { milestone_code: 'rnf', status: 'issued' },
        { milestone_code: 'sales_authority', status: 'issued' },
    ];
    for (const m of milestones) {
        const { error } = await service
            .from('candidate_milestones')
            .upsert(
                { candidate_id: candidate.id, milestone_code: m.milestone_code, status: m.status },
                { onConflict: 'candidate_id,milestone_code' },
            );
        if (error) throw new Error(`upsert milestone ${m.milestone_code}: ${error.message}`);
    }

    return {
        activationUserId: activationUser.id,
        candidateId: candidate.id,
    };
}

async function resetActivationState(service, userId, candidateId) {
    // Roll back the role flip on all 3 surfaces. Don't throw — best-effort.
    try {
        await service.from('candidates').update({
            status: 'licensed',
            converted_to_agent_at: null,
        }).eq('id', candidateId);
    } catch (e) {
        console.error(`[activate-agent] reset candidates: ${e.message}`);
    }
    try {
        await service.from('users').update({ role: 'candidate' }).eq('id', userId);
    } catch (e) {
        console.error(`[activate-agent] reset users.role: ${e.message}`);
    }
    try {
        await service.auth.admin.updateUserById(userId, {
            app_metadata: { role: 'candidate', synthetic_probe: true },
        });
    } catch (e) {
        console.error(`[activate-agent] reset auth metadata: ${e.message}`);
    }
}

async function signInAsProbeAdmin() {
    const password = process.env.PROBE_ACCOUNT_PASSWORD;
    if (!password) throw new Error('PROBE_ACCOUNT_PASSWORD not set.');
    const anon = stagingAnonClient();
    const { data, error } = await anon.auth.signInWithPassword({
        email: PROBE_ADMIN_EMAIL,
        password,
    });
    if (error || !data?.session?.access_token) {
        throw new Error(`probe admin signin: ${error?.message || 'no session'}`);
    }
    return data.session.access_token;
}
