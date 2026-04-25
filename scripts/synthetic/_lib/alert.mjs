/**
 * GitHub Issue alerter — the primary notification sink for synthetic probes.
 *
 * Design:
 *   - openOrUpdateIssue(): creates an issue or comments on an existing open
 *     one with the same exact title. Keeps noise contained on repeated
 *     failures of the same probe.
 *   - closeIssueIfOpen(): on recovery, comments "recovered at <time>" and
 *     closes the issue. No-op if nothing is open.
 *
 * Authentication uses a fine-grained PAT stored as SYNTHETIC_GH_TOKEN, with
 * scope `issues:write` only. In GH Actions, GITHUB_TOKEN also works if the
 * workflow has `permissions: issues: write`.
 */
import { guardedFetch } from './env.mjs';

const API = 'https://api.github.com';

function authHeaders(token) {
    return {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
    };
}

async function findOpenIssue({ token, repo, title }) {
    // Use the "issues" list endpoint filtered by label + state rather than
    // free-text search — search has 30-req/min rate limits that break hourly
    // probes quickly.
    const url = `${API}/repos/${repo}/issues?state=open&labels=synthetic-monitor&per_page=100`;
    const res = await guardedFetch(url, { headers: authHeaders(token) });
    if (!res.ok) {
        console.error(`[synthetic/alert] list issues ${res.status}`);
        return null;
    }
    const issues = await res.json();
    return issues.find((i) => i.title === title) || null;
}

/**
 * Open a new issue or comment on the existing one with the exact same title.
 * Returns the issue number, or null if alerting failed.
 */
export async function openOrUpdateIssue({ title, body, labels = [] }) {
    const token = process.env.SYNTHETIC_GH_TOKEN || process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPOSITORY;
    if (!token || !repo) {
        console.error('[synthetic/alert] Missing SYNTHETIC_GH_TOKEN or GITHUB_REPOSITORY; cannot alert.');
        return null;
    }

    const allLabels = Array.from(new Set(['synthetic-monitor', ...labels]));

    const existing = await findOpenIssue({ token, repo, title });
    if (existing) {
        const res = await guardedFetch(`${API}/repos/${repo}/issues/${existing.number}/comments`, {
            method: 'POST',
            headers: authHeaders(token),
            body: JSON.stringify({ body }),
        });
        if (!res.ok) console.error(`[synthetic/alert] comment ${res.status}`);
        return existing.number;
    }

    const res = await guardedFetch(`${API}/repos/${repo}/issues`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ title, body, labels: allLabels }),
    });
    if (!res.ok) {
        console.error(`[synthetic/alert] create ${res.status}`);
        return null;
    }
    const created = await res.json();
    return created.number;
}

/**
 * Close any open issue with the exact same title, with an optional recovery
 * comment. No-op if nothing is open.
 */
export async function closeIssueIfOpen({ title, comment }) {
    const token = process.env.SYNTHETIC_GH_TOKEN || process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPOSITORY;
    if (!token || !repo) return;

    const existing = await findOpenIssue({ token, repo, title });
    if (!existing) return;

    if (comment) {
        await guardedFetch(`${API}/repos/${repo}/issues/${existing.number}/comments`, {
            method: 'POST',
            headers: authHeaders(token),
            body: JSON.stringify({ body: comment }),
        });
    }

    await guardedFetch(`${API}/repos/${repo}/issues/${existing.number}`, {
        method: 'PATCH',
        headers: authHeaders(token),
        body: JSON.stringify({ state: 'closed', state_reason: 'completed' }),
    });
}
