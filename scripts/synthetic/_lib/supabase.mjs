/**
 * Supabase client factories for synthetic probes.
 *
 * Every factory calls guardStaging() before returning — so if you ever see a
 * probe connecting to prod, the guard is broken, not the probe.
 */
import { createClient } from '@supabase/supabase-js';
import { guardStaging } from './env.mjs';

/**
 * Service-role client. Bypasses RLS. Only use for probe bookkeeping
 * (synthetic_probe_runs, synthetic_env_marker) and for seeding / cleanup
 * of synthetic test data.
 */
export function stagingServiceRoleClient() {
    const { url } = guardStaging();
    const key = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
    return createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

/**
 * Anon client, optionally carrying a user JWT so RLS applies as that user.
 * Use this for RLS authz probes (R2) where we need to simulate a real role.
 */
export function stagingAnonClient(jwt) {
    const { url } = guardStaging();
    const anon = process.env.STAGING_SUPABASE_ANON_KEY;
    if (!anon) throw new Error('[synthetic] STAGING_SUPABASE_ANON_KEY is not set.');
    const opts = { auth: { autoRefreshToken: false, persistSession: false } };
    if (jwt) opts.global = { headers: { Authorization: `Bearer ${jwt}` } };
    return createClient(url, anon, opts);
}

/**
 * Assert synthetic_env_marker has the 'staging' row. Throws otherwise.
 *
 * This is the SECOND line of defence (after the URL guard). It catches the
 * scenario where someone deliberately pointed STAGING_SUPABASE_URL at the
 * prod project: the marker row does not exist there, so the probe aborts
 * before writing anything.
 *
 * Call this once per probe, before any writes.
 */
export async function assertStagingMarker(client) {
    const { data, error } = await client
        .from('synthetic_env_marker')
        .select('env')
        .eq('env', 'staging')
        .maybeSingle();
    if (error) {
        throw new Error(`[synthetic] synthetic_env_marker lookup failed: ${error.message}`);
    }
    if (!data) {
        throw new Error(
            '[synthetic] synthetic_env_marker row (env=staging) not found. ' +
                'Either this is not the staging project or the seed has not been applied. ' +
                'Refusing to run.',
        );
    }
}
