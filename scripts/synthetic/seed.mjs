/**
 * Synthetic monitoring — one-shot seeder.
 *
 * Idempotent. Run once against staging after applying the
 * `20260422180000_synthetic_monitoring_tables.sql` migration and the
 * `supabase/seed-synthetic.sql` SQL seed.
 *
 *     cd scripts/synthetic && npm ci && npm run seed
 *
 * Creates six probe auth users (one per role) via the Supabase Admin API.
 * Each user has a stable phone number in the reserved synthetic-probe range
 * and a password loaded from PROBE_ACCOUNT_PASSWORD. Users are tagged with
 * user_metadata.synthetic_probe = true so they are easy to identify and
 * filter out of any user-facing query.
 *
 * Re-running is safe: users with already-present phone numbers are skipped.
 */
import { stagingServiceRoleClient, assertStagingMarker } from './_lib/supabase.mjs';

// Stable SG phone range reserved for synthetic probes. Must be within the
// OTP_WHITELIST_PHONES set on staging so they never emit real SMS.
//
// `key` is the stable identifier used in emails (`probe+{key}@lyfe.sg`);
// `role` is the Lyfe role. Most keys match the role; `agent2` is a second
// agent required by R1's MKTR reassign probe.
const PROBE_ACCOUNTS = [
    { key: 'admin', role: 'admin', phone: '+6580000101' },
    { key: 'director', role: 'director', phone: '+6580000102' },
    { key: 'manager', role: 'manager', phone: '+6580000103' },
    { key: 'agent', role: 'agent', phone: '+6580000104' },
    { key: 'pa', role: 'pa', phone: '+6580000105' },
    { key: 'candidate', role: 'candidate', phone: '+6580000106' },
    { key: 'agent2', role: 'agent', phone: '+6580000107' },
];

async function main() {
    const password = process.env.PROBE_ACCOUNT_PASSWORD;
    if (!password || password.length < 16) {
        throw new Error('PROBE_ACCOUNT_PASSWORD must be set to a >=16 char secret.');
    }

    const client = stagingServiceRoleClient();
    await assertStagingMarker(client);
    console.log('[seed] staging marker confirmed');

    // List existing users so we can skip ones already present.
    const { data: existingList, error: listErr } = await client.auth.admin.listUsers({
        perPage: 1000,
    });
    if (listErr) throw listErr;
    const existingByPhone = new Map(
        (existingList?.users || [])
            .filter((u) => u.phone)
            .map((u) => [u.phone.replace(/^\+/, ''), u]),
    );

    for (const acct of PROBE_ACCOUNTS) {
        const phoneDigits = acct.phone.replace(/^\+/, '');
        const email = `probe+${acct.key}@lyfe.sg`;

        if (existingByPhone.has(phoneDigits)) {
            console.log(`[seed] skip ${acct.key} (${acct.phone}) — already exists`);
            continue;
        }

        const { data, error } = await client.auth.admin.createUser({
            phone: phoneDigits,
            email,
            password,
            phone_confirm: true,
            email_confirm: true,
            app_metadata: { role: acct.role, synthetic_probe: true },
            user_metadata: { synthetic_probe: true, full_name: `Probe ${acct.key}` },
        });
        if (error) {
            console.error(`[seed] FAILED ${acct.key}: ${error.message}`);
            throw error;
        }

        // Ensure the public.users row (auto-created by trigger) has the
        // right role; trigger defaults everyone to 'candidate'.
        const { error: updateErr } = await client
            .from('users')
            .update({ role: acct.role, full_name: `Probe ${acct.key}`, is_active: true })
            .eq('id', data.user.id);
        if (updateErr) {
            console.warn(`[seed] user row update for ${acct.key}: ${updateErr.message}`);
        }

        console.log(`[seed] created ${acct.key} (role=${acct.role}) → ${acct.phone} (auth id ${data.user.id})`);
    }

    console.log('[seed] done.');
}

main().catch((err) => {
    console.error('[seed] fatal:', err);
    process.exit(1);
});
