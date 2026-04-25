/**
 * R2 — RLS authorisation matrix probe.
 *
 * Signs in as each of the 6 probe users and runs a matrix of SELECT
 * assertions. Every `active` assertion violation causes the probe to fail
 * and opens a P0 `security-regression` issue. `pending` assertions (known
 * permissive policies today) are logged but do not alert — they flip to
 * `active` once the policy is tightened.
 *
 * JWT sessions are obtained by password login against the staging Supabase
 * Auth using credentials seeded by scripts/synthetic/seed.mjs.
 */
import { runProbe } from './_lib/run.mjs';
import { stagingServiceRoleClient, stagingAnonClient, assertStagingMarker } from './_lib/supabase.mjs';
import { RLS_ASSERTIONS, partitionByStatus } from './_lib/rls-matrix.mjs';

const PROBE_KEYS = new Set(RLS_ASSERTIONS.map((a) => a.role));

async function signInProbeUser(key, password) {
    const email = `probe+${key}@lyfe.sg`;
    const client = stagingAnonClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(`sign-in as ${email} failed: ${error.message}`);
    if (!data?.session?.access_token) throw new Error(`sign-in as ${email}: no access_token`);
    return {
        userId: data.user.id,
        jwt: data.session.access_token,
        // Fresh anon client carrying the JWT so RLS applies as this user.
        scopedClient: stagingAnonClient(data.session.access_token),
    };
}

await runProbe(
    'rls-matrix',
    async () => {
        const service = stagingServiceRoleClient();
        await assertStagingMarker(service);

        const password = process.env.PROBE_ACCOUNT_PASSWORD;
        if (!password) throw new Error('PROBE_ACCOUNT_PASSWORD is not set.');

        // Authenticate each role once, reuse the scoped client across its assertions.
        const sessions = {};
        for (const key of PROBE_KEYS) {
            sessions[key] = await signInProbeUser(key, password);
            console.log(`[rls-matrix] signed in probe+${key} → ${sessions[key].userId.slice(0, 8)}…`);
        }

        const { active, pending } = partitionByStatus(RLS_ASSERTIONS);

        // Run pending first, log-only.
        for (const assertion of pending) {
            const session = sessions[assertion.role];
            if (!session) continue;
            const { rowCount, error } = await assertion.check(session.scopedClient, { ownUserId: session.userId });
            const passed = evaluate(assertion.mode, rowCount, error);
            console.log(
                `[rls-matrix] PENDING ${passed ? 'ok' : 'still-gap'}: ${assertion.label} (role=${assertion.role}, rows=${rowCount}, err=${error?.code || 'none'})`,
            );
        }

        // Run active. Any failure collects into `failures`.
        const failures = [];
        for (const assertion of active) {
            const session = sessions[assertion.role];
            if (!session) {
                failures.push({ assertion, reason: `no session for role ${assertion.role}` });
                continue;
            }
            const { rowCount, error } = await assertion.check(session.scopedClient, { ownUserId: session.userId });
            const passed = evaluate(assertion.mode, rowCount, error);
            if (!passed) {
                failures.push({
                    assertion,
                    reason: `mode=${assertion.mode} rows=${rowCount} err=${error?.code || 'none'}: ${error?.message ?? ''}`,
                });
            } else {
                console.log(`[rls-matrix] ok: ${assertion.label}`);
            }
        }

        if (failures.length > 0) {
            const lines = failures.map((f) => `  • [${f.assertion.role}] ${f.assertion.label} → ${f.reason}`).join('\n');
            throw new Error(
                `${failures.length}/${active.length} active RLS assertion(s) failed:\n${lines}\n\n` +
                    `This likely indicates an RLS policy regression from a recent migration. ` +
                    `Review supabase/migrations/ for changes touching the affected tables.`,
            );
        }

        console.log(`[rls-matrix] ${active.length} active + ${pending.length} pending assertions checked; all active passing.`);
    },
    { alertLabels: ['security-regression', 'P0'], timeoutMs: 120_000 },
);

/**
 * Convert (mode, rowCount, error) into a pass/fail boolean.
 *
 * must_deny  → passes when rowCount is 0 OR an RLS error was returned.
 * must_allow → passes when NO error AND rowCount > 0 (treats rowCount=1
 *              as a synthetic pass for "allowed to query").
 */
function evaluate(mode, rowCount, error) {
    if (mode === 'must_deny') {
        return rowCount === 0 || !!error;
    }
    if (mode === 'must_allow') {
        return !error && rowCount > 0;
    }
    throw new Error(`unknown assertion mode: ${mode}`);
}
