/**
 * R3 — pg_cron freshness probe.
 *
 * Every 15 minutes, ask the staging DB when each scheduled edge-function job
 * last succeeded. Alert if any job is past its expected window.
 *
 * Why this matters: all four jobs are the *only* way certain user-visible
 * notifications get sent. Silent failure (expired CRON_SECRET, pg_net broken,
 * edge fn crashing on deploy) would produce no user complaint until someone
 * notices "I stopped getting event reminders."
 *
 * Expected windows are tight on purpose. If a job fails once, we want to know
 * within one cadence, not after it has compounded.
 */
import { runProbe } from './_lib/run.mjs';
import { stagingServiceRoleClient, assertStagingMarker } from './_lib/supabase.mjs';

// Each job's max tolerated staleness, in minutes. Derived from the cron
// schedule in supabase/migrations/20260313200000_schedule_cron_jobs.sql plus
// a buffer that covers one missed run without paging.
const FRESHNESS_WINDOW_MIN = {
    'send-event-reminders': 20, // */5 min → tolerate one miss
    'send-interview-reminders': 20, // */5 min
    'check-stale-leads': 60 * 26, // daily at 1am UTC → tolerate 2h slip
    'send-roadshow-summary': 60 * 26, // daily at 2am UTC
};

await runProbe(
    'cron-freshness',
    async () => {
        const client = stagingServiceRoleClient();
        await assertStagingMarker(client);

        const { data, error } = await client.rpc('get_synthetic_cron_freshness');
        if (error) throw new Error(`rpc get_synthetic_cron_freshness: ${error.message}`);
        if (!Array.isArray(data) || data.length === 0) {
            throw new Error('RPC returned no rows — cron jobs may not be registered on this project.');
        }

        const rowsByName = new Map(data.map((r) => [r.jobname, r]));
        const now = Date.now();
        const stale = [];

        for (const [jobname, windowMin] of Object.entries(FRESHNESS_WINDOW_MIN)) {
            const row = rowsByName.get(jobname);
            if (!row) {
                stale.push({ jobname, reason: 'job not registered in cron.job' });
                continue;
            }
            if (!row.last_success_at) {
                stale.push({
                    jobname,
                    reason: `no successful run ever. last_status=${row.last_status ?? 'null'}, msg=${trim(row.last_return_message, 120)}`,
                });
                continue;
            }
            const ageMin = (now - new Date(row.last_success_at).getTime()) / 60_000;
            if (ageMin > windowMin) {
                stale.push({
                    jobname,
                    reason: `last success ${ageMin.toFixed(1)} min ago > window ${windowMin} min. last_status=${row.last_status}, msg=${trim(row.last_return_message, 120)}`,
                });
            }
        }

        if (stale.length > 0) {
            const lines = stale.map((s) => `  • ${s.jobname}: ${s.reason}`).join('\n');
            throw new Error(`${stale.length}/${Object.keys(FRESHNESS_WINDOW_MIN).length} cron jobs stale:\n${lines}`);
        }

        console.log(`[cron-freshness] all ${data.length} jobs fresh`);
    },
    { alertLabels: ['cron', 'P1'] },
);

function trim(s, n) {
    if (!s) return 'null';
    const str = String(s);
    return str.length > n ? str.slice(0, n) + '…' : str;
}
