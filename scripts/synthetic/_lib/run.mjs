/**
 * Probe runner.
 *
 * Wraps a probe function in:
 *   - a timeout (default 60s)
 *   - try/catch with structured failure classification
 *   - telemetry write to synthetic_probe_runs
 *   - open-or-close GitHub issue based on status
 *   - process exit code: 0 on pass, 1 on fail (so workflows go red)
 *
 * Each probe file calls runProbe() exactly once with its logic inside.
 */
import { stagingServiceRoleClient } from './supabase.mjs';
import { openOrUpdateIssue, closeIssueIfOpen } from './alert.mjs';

function issueTitle(probeName) {
    return `[synthetic] ${probeName} failing`;
}

function failureBody({ probeName, durationMs, errorMessage, runId }) {
    const runUrl =
        process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
            ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
            : '(local run)';
    return [
        `**Probe:** \`${probeName}\``,
        `**Status:** failed in ${durationMs} ms`,
        `**At:** ${new Date().toISOString()}`,
        `**Workflow run:** ${runUrl}`,
        `**Telemetry row:** ${runId || 'n/a'}`,
        '',
        '```',
        errorMessage || '(no message)',
        '```',
        '',
        '_Auto-closed when the probe next passes. See `docs/synthetic-monitoring-runbook.md` for triage._',
    ].join('\n');
}

function recoveryBody({ probeName }) {
    return `Probe \`${probeName}\` passed at ${new Date().toISOString()}. Auto-closing.`;
}

async function writeTelemetry({ probeName, status, durationMs, errorCode, errorMessage }) {
    try {
        const client = stagingServiceRoleClient();
        const { data, error } = await client
            .from('synthetic_probe_runs')
            .insert({
                probe_name: probeName,
                duration_ms: durationMs,
                status,
                error_code: errorCode,
                error_message: errorMessage ? String(errorMessage).slice(0, 4000) : null,
                env: 'staging',
            })
            .select('id')
            .single();
        if (error) {
            console.error(`[synthetic/run] telemetry write failed: ${error.message}`);
            return null;
        }
        return data?.id ?? null;
    } catch (e) {
        console.error(`[synthetic/run] telemetry write threw:`, e);
        return null;
    }
}

/**
 * Invoke `fn` as the body of a probe.
 *
 * @param {string} probeName Stable identifier used for dedup + telemetry.
 * @param {() => Promise<void>} fn The probe body.
 * @param {{ timeoutMs?: number; alertLabels?: string[] }} opts
 */
export async function runProbe(probeName, fn, opts = {}) {
    const timeoutMs = opts.timeoutMs ?? 60_000;
    const alertLabels = opts.alertLabels ?? [];
    const startedAt = Date.now();

    let status = 'pass';
    let errorCode = null;
    let errorMessage = null;

    try {
        await Promise.race([
            Promise.resolve().then(fn),
            new Promise((_, reject) =>
                setTimeout(() => {
                    const e = new Error('PROBE_TIMEOUT');
                    e.code = 'PROBE_TIMEOUT';
                    reject(e);
                }, timeoutMs),
            ),
        ]);
    } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        status = e.code === 'PROBE_TIMEOUT' ? 'timeout' : 'fail';
        errorCode = e.code || (e.message ? e.message.split(':')[0].trim().slice(0, 64) : 'UNKNOWN');
        errorMessage = e.stack || e.message;
        console.error(`[${probeName}] FAILED (${status}):`, errorMessage);
    }

    const durationMs = Date.now() - startedAt;
    const runId = await writeTelemetry({ probeName, status, durationMs, errorCode, errorMessage });

    if (status === 'pass') {
        console.log(`[${probeName}] passed in ${durationMs}ms`);
        await closeIssueIfOpen({
            title: issueTitle(probeName),
            comment: recoveryBody({ probeName }),
        });
        process.exit(0);
    } else {
        await openOrUpdateIssue({
            title: issueTitle(probeName),
            body: failureBody({ probeName, durationMs, errorMessage, runId }),
            labels: alertLabels,
        });
        process.exit(1);
    }
}
