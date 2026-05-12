/**
 * R8 — cron-receiver EF auth probe.
 *
 * Hits each of the 4 cron-receiver edge functions on staging with the
 * staging CRON_SECRET and asserts a 200. Regression guard for the
 * vault-backed cron auth set up in migration 20260510130000 (Sprint 1
 * item 1.17): if vault.cron_secret is rotated but the EF env CRON_SECRET
 * isn't updated to match — or vice versa — this probe flips red.
 *
 * Without this, a future regression would silently re-create the
 * 58-day cron outage we just closed (31,138 failed runs / zero alerts).
 *
 * The four receivers all share the same Bearer auth pattern, so we
 * sweep them in one probe rather than splitting into 4 workflows.
 *
 * Required env (from synthetic-monitoring GH environment):
 *   STAGING_SUPABASE_URL        — already used by every probe
 *   STAGING_CRON_SECRET         — must equal staging EF env CRON_SECRET
 *                                 AND staging vault.cron_secret
 */
import { runProbe } from './_lib/run.mjs';
import { guardedFetch } from './_lib/env.mjs';

const RECEIVERS = [
    'send-event-reminders',
    'send-interview-reminders',
    'check-stale-leads',
    'send-roadshow-summary',
];

await runProbe(
    'cron-receivers',
    async () => {
        const baseUrl = process.env.STAGING_SUPABASE_URL;
        if (!baseUrl) throw new Error('STAGING_SUPABASE_URL is not set.');

        const secret = process.env.STAGING_CRON_SECRET;
        if (!secret) {
            throw new Error(
                'STAGING_CRON_SECRET is not set. Add it to the synthetic-monitoring GH environment; ' +
                    'value must match the staging EF env CRON_SECRET and vault.cron_secret.',
            );
        }

        const failures = [];

        for (const fn of RECEIVERS) {
            const url = `${baseUrl}/functions/v1/${fn}`;
            let res;
            try {
                res = await guardedFetch(url, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${secret}`,
                        'Content-Type': 'application/json',
                    },
                    body: '{}',
                });
            } catch (e) {
                failures.push(`${fn}: network error: ${e.message}`);
                continue;
            }

            if (res.status !== 200) {
                const txt = await res.text().catch(() => '');
                failures.push(`${fn}: expected 200, got ${res.status}: ${txt.slice(0, 200)}`);
                continue;
            }

            console.log(`[cron-receivers] ${fn} → 200`);
        }

        if (failures.length > 0) {
            throw new Error(`cron receiver(s) unhealthy:\n  - ${failures.join('\n  - ')}`);
        }

        console.log(`[cron-receivers] all ${RECEIVERS.length} receivers returned 200`);
    },
    { alertLabels: ['cron', 'P1'] },
);
