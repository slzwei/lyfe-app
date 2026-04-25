/**
 * R7 — edge function OPTIONS sweep.
 *
 * Every 10 minutes, send an OPTIONS request to every deployed edge function
 * on staging. Any response at all (even 401/403/500) means the function is
 * deployed and the Functions runtime is healthy. **Only 404 or a network
 * error counts as a failure** — that's what "the function is gone" looks
 * like.
 *
 * This is the broadest, cheapest monitor we have — it catches full-project
 * outages, mis-applied deploys, and DNS / Functions-gateway failures faster
 * than any per-function probe.
 *
 * Staging only. R7 was descoped from prod as part of the zero-prod policy
 * (see "Zero-prod guardrails" in docs/synthetic-monitoring-audit.md).
 */
import { runProbe } from './_lib/run.mjs';
import { stagingServiceRoleClient, assertStagingMarker } from './_lib/supabase.mjs';
import { guardedFetch } from './_lib/env.mjs';

// All edge functions that exist under supabase/functions/ as of 2026-04-23.
// Add new fns here when they ship. No CI check catches a forgotten add — the
// probe just won't cover the new one until it's added.
const EDGE_FUNCTIONS = [
    'activate-agent',
    'check-stale-leads',
    'create-candidate',
    'create-member-invitation',
    'custom-sms-hook', // Auth hook. OPTIONS still reaches the runtime.
    'delete-account',
    'mktr-agents',
    'notify-roadshow-pledge',
    'receive-mktr-lead',
    'send-announcement',
    'send-email-otp',
    'send-event-reminders',
    'send-interview-reminders',
    'send-push-notification',
    'send-roadshow-summary',
    'verify-email-otp',
    'verify-face',
];

// A 404 or a network error means the function is missing. Anything else
// means the runtime responded — that's success for an up-check.
function isMissing(status) {
    return status === 404;
}

await runProbe(
    'edge-options',
    async () => {
        const client = stagingServiceRoleClient();
        await assertStagingMarker(client);

        const base = `${process.env.STAGING_SUPABASE_URL}/functions/v1`;

        const results = await Promise.all(
            EDGE_FUNCTIONS.map(async (name) => {
                const startedAt = Date.now();
                try {
                    const res = await guardedFetch(`${base}/${name}`, {
                        method: 'OPTIONS',
                        headers: {
                            // Preflight-ish headers so fns with a real CORS
                            // handler respond naturally.
                            Origin: 'https://lyfe.sg',
                            'Access-Control-Request-Method': 'POST',
                        },
                    });
                    return { name, ok: !isMissing(res.status), status: res.status, ms: Date.now() - startedAt };
                } catch (e) {
                    return { name, ok: false, status: 'NET_ERR', error: e.message, ms: Date.now() - startedAt };
                }
            }),
        );

        const missing = results.filter((r) => !r.ok);

        // Log a one-line summary per function so the run log is useful during
        // triage, even when everything is green.
        for (const r of results) {
            const mark = r.ok ? '✓' : '✗';
            console.log(`[edge-options] ${mark} ${r.name} → ${r.status} (${r.ms}ms)`);
        }

        if (missing.length > 0) {
            const lines = missing
                .map((m) => `  • ${m.name} → ${m.status}${m.error ? ` (${m.error})` : ''}`)
                .join('\n');
            throw new Error(`${missing.length}/${EDGE_FUNCTIONS.length} edge fns missing:\n${lines}`);
        }
    },
    { alertLabels: ['edge-functions', 'P2'] },
);
