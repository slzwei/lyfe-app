/**
 * Environment guard for synthetic monitoring.
 *
 * This module is the first line of defence against a misconfigured probe
 * accidentally hitting production. It is imported by EVERY probe before any
 * network or DB activity. If any of these assertions fail, the probe exits
 * loudly — never silently — and the workflow fails.
 *
 * The staging project ref is a LITERAL STRING here by design. Do not move it
 * to an env var. If it were configurable, a rotated/swapped secret could point
 * probes at prod without any source-code change. Keeping it hardcoded forces
 * a deliberate PR (reviewed by CODEOWNERS) to change targets.
 */

// STAGING ONLY. Hardcoded — do not parameterise.
export const STAGING_PROJECT_REF = 'ajjxkasvikeigapnzdak';
export const STAGING_HOSTNAME = `${STAGING_PROJECT_REF}.supabase.co`;

// Known prod ref — only used to print a more helpful error message if the
// probe is pointed at prod by mistake.
const PROD_PROJECT_REF = 'nvtedkyjwulkzjeoqjgx';

// Allowlist of non-Supabase hosts probes are allowed to reach.
// Add new entries sparingly; any host not in this list is a bug.
const ALLOWED_FOREIGN_HOSTS = new Set([
    'api.github.com', // GH Issues alerter
    'o4509.ingest.sentry.io', // placeholder — replace with real Sentry host if enabled
]);

/**
 * Mask a string that might contain a project ref or token. Used in error
 * messages so we never print full secrets in GH Actions logs.
 */
function maskSecretLike(value) {
    if (!value) return '';
    return String(value).replace(/[a-z0-9]{20,}/gi, '***');
}

/**
 * Verify every condition required to run a probe. Throws on any failure.
 * Returns { url } on success for convenience.
 */
export function guardStaging() {
    // 0. Kill switch — honoured first, before any other check.
    if (process.env.SYNTHETIC_KILL_SWITCH === 'true') {
        console.log('[synthetic] SYNTHETIC_KILL_SWITCH=true — skipping probe run.');
        process.exit(0);
    }

    const url = process.env.STAGING_SUPABASE_URL || '';
    if (!url) {
        throw new Error('[synthetic] STAGING_SUPABASE_URL is not set.');
    }

    // 1. URL must contain the hardcoded staging project ref.
    if (!url.includes(STAGING_PROJECT_REF)) {
        const hint = url.includes(PROD_PROJECT_REF)
            ? 'Detected PROD project ref — refusing. Check GitHub Actions secrets: STAGING_SUPABASE_URL must point at the staging project.'
            : `Expected URL to contain '${STAGING_PROJECT_REF}'. Got '${maskSecretLike(url)}'.`;
        throw new Error(`[synthetic] Staging guard failed: ${hint}`);
    }

    // 2. Parseable URL.
    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        throw new Error('[synthetic] STAGING_SUPABASE_URL is not a valid URL.');
    }
    if (parsed.hostname !== STAGING_HOSTNAME) {
        throw new Error(
            `[synthetic] Hostname mismatch: expected '${STAGING_HOSTNAME}', got '${parsed.hostname}'.`,
        );
    }

    // 3. Service-role key present (probes need it to read the sentinel table).
    if (!process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('[synthetic] STAGING_SUPABASE_SERVICE_ROLE_KEY is not set.');
    }

    return { url, projectRef: STAGING_PROJECT_REF, hostname: STAGING_HOSTNAME };
}

/**
 * Wrap fetch so that any attempt to reach a non-allowlisted host fails loudly.
 * Use this instead of global fetch from anywhere in the harness.
 */
export async function guardedFetch(targetUrl, init) {
    const u = new URL(targetUrl);
    const isStaging = u.hostname === STAGING_HOSTNAME;
    const isAllowedForeign = ALLOWED_FOREIGN_HOSTS.has(u.hostname);
    if (!isStaging && !isAllowedForeign) {
        throw new Error(
            `[synthetic] guardedFetch blocked non-allowlisted host: '${u.hostname}'. ` +
                `If this is an intended integration, add it to ALLOWED_FOREIGN_HOSTS in _lib/env.mjs.`,
        );
    }
    return fetch(targetUrl, init);
}
