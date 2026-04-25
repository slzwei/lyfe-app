/**
 * Phase 0 hello-world probe.
 *
 * Proves, end-to-end:
 *   1. Env vars load.
 *   2. Staging guard passes (URL / project ref / kill switch).
 *   3. Service-role client can connect.
 *   4. synthetic_env_marker row exists (= this really is staging).
 *   5. Telemetry row lands in synthetic_probe_runs.
 *   6. Alerting opens / closes a GH issue.
 *
 * This probe does not exercise any real user flow. It is the smoke test that
 * every later probe builds on top of.
 */
import { runProbe } from './_lib/run.mjs';
import { stagingServiceRoleClient, assertStagingMarker } from './_lib/supabase.mjs';

await runProbe('hello', async () => {
    const client = stagingServiceRoleClient();

    // Defence-in-depth: URL guard already ran inside the client factory;
    // this adds the sentinel-row check.
    await assertStagingMarker(client);

    // Touch something real so a broken connection fails loudly.
    const { data, error } = await client
        .from('synthetic_env_marker')
        .select('env, created_at')
        .limit(1);
    if (error) throw new Error(`select synthetic_env_marker failed: ${error.message}`);
    if (!data || data.length === 0) throw new Error('synthetic_env_marker unexpectedly empty');

    console.log(`[hello] env=${data[0].env} seeded_at=${data[0].created_at}`);
});
