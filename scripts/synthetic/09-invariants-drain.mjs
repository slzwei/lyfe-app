/**
 * R6 — DB-invariants drain.
 *
 * Reads public.synthetic_invariant_violations on staging. For each row, opens
 * (or comments on) a GitHub issue. When a row disappears between runs — the
 * underlying violation has been fixed — the drain auto-closes the matching
 * issue.
 *
 * The sweep itself happens via pg_cron on staging (:17 past the hour). This
 * drain runs :30 past the hour — gives the sweeper 13 minutes to settle.
 *
 * We do NOT use the standard runProbe() failure behaviour here: a violation
 * is not a probe failure, it's a legitimate DB finding that gets its own
 * issue. The drain itself only fails if the sweep/query machinery is broken.
 */
import { stagingServiceRoleClient, assertStagingMarker } from './_lib/supabase.mjs';
import { openOrUpdateIssue, closeIssueIfOpen } from './_lib/alert.mjs';
import { guardedFetch } from './_lib/env.mjs';

function issueTitleFor(violation) {
    return `[invariant] ${violation.invariant_name}: ${violation.subject_id ?? '(no subject)'}`;
}

function issueBodyFor(violation) {
    return [
        `**Invariant:** \`${violation.invariant_name}\``,
        `**Subject:** ${violation.subject_type} \`${violation.subject_id}\``,
        `**First detected:** ${violation.detected_at}`,
        '',
        '**Details:**',
        '```json',
        JSON.stringify(violation.details ?? {}, null, 2),
        '```',
        '',
        '_Auto-closes when the sweeper no longer finds this violation._',
    ].join('\n');
}

/**
 * Fetch all open GitHub issues currently labelled `invariant` so we can
 * compare against today's violation set and close any that resolved.
 */
async function listOpenInvariantIssues() {
    const token = process.env.SYNTHETIC_GH_TOKEN || process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPOSITORY;
    if (!token || !repo) return [];
    const url = `https://api.github.com/repos/${repo}/issues?state=open&labels=invariant&per_page=100`;
    const res = await guardedFetch(url, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
        },
    });
    if (!res.ok) {
        console.error(`[invariants-drain] list issues ${res.status}`);
        return [];
    }
    return res.json();
}

async function main() {
    const service = stagingServiceRoleClient();
    await assertStagingMarker(service);

    const { data: violations, error } = await service
        .from('synthetic_invariant_violations')
        .select('invariant_name, subject_id, subject_type, detected_at, resolved_at, details')
        .is('resolved_at', null)
        .order('invariant_name');
    if (error) {
        console.error(`[invariants-drain] select failed: ${error.message}`);
        process.exit(1);
    }

    const openIssues = await listOpenInvariantIssues();
    const openByTitle = new Map(openIssues.map((i) => [i.title, i]));

    const violationTitles = new Set();

    for (const v of violations ?? []) {
        const title = issueTitleFor(v);
        violationTitles.add(title);

        if (openByTitle.has(title)) {
            // Already open. Skip comment-on-repeat to avoid daily spam;
            // presence of the unresolved row is enough context.
            continue;
        }

        await openOrUpdateIssue({
            title,
            body: issueBodyFor(v),
            labels: ['invariant', v.invariant_name],
        });
    }

    // Auto-close issues whose violations no longer appear.
    let closed = 0;
    for (const issue of openIssues) {
        if (violationTitles.has(issue.title)) continue;
        // Only close issues we own (dedupable by the `invariant` label).
        await closeIssueIfOpen({
            title: issue.title,
            comment: `Invariant resolved — no longer detected as of ${new Date().toISOString()}. Auto-closing.`,
        });
        closed += 1;
    }

    console.log(
        `[invariants-drain] ${violations?.length ?? 0} open violations, ${openIssues.length} matching issues, ${closed} auto-closed.`,
    );
}

main().catch((err) => {
    console.error('[invariants-drain] fatal:', err);
    process.exit(1);
});
