#!/usr/bin/env node
/**
 * Clone prod Supabase → staging for smoke testing.
 *
 * Usage:
 *   node scripts/clone-prod-to-staging.mjs                 # dry-run (default)
 *   node scripts/clone-prod-to-staging.mjs --execute       # actually write
 *
 * Required env vars:
 *   PROD_SERVICE_KEY       — service_role key for nvtedkyjwulkzjeoqjgx
 *   STAGING_SERVICE_KEY    — service_role key for ajjxkasvikeigapnzdak
 *   SUPABASE_ACCESS_TOKEN  — (optional) Supabase personal access token, for
 *                            cloning the Test OTPs config via Management API.
 *                            If omitted, test OTPs are not replicated.
 *
 * Idempotent: each public table upserts on primary key. Auth users upsert too
 * (existing users are skipped with a warning, not duplicated). Safe to re-run.
 *
 * Skipped: candidate_profiles, invitations, jobs, progress_signals (missing on
 * staging schema — cloning would fail). Storage buckets (pdfs/resumes/docs/
 * avatars) are not cloned — metadata lands but file URLs will 404. Triggers on
 * staging that would fire during bulk insert and reference the skipped tables
 * (e.g. trg_candidates_create_profile) must already be DISABLEd — this was
 * done during Phase A staging validation.
 */
import { createClient } from '@supabase/supabase-js';

const PROD_REF = 'nvtedkyjwulkzjeoqjgx';
const STAGING_REF = 'ajjxkasvikeigapnzdak';
const PROD_URL = `https://${PROD_REF}.supabase.co`;
const STAGING_URL = `https://${STAGING_REF}.supabase.co`;

const PROD_KEY = process.env.PROD_SERVICE_KEY;
const STAGING_KEY = process.env.STAGING_SERVICE_KEY;
const MGMT_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!PROD_KEY || !STAGING_KEY) {
    console.error('ERROR: set PROD_SERVICE_KEY and STAGING_SERVICE_KEY env vars.');
    process.exit(1);
}

const DRY_RUN = !process.argv.includes('--execute');

const prod = createClient(PROD_URL, PROD_KEY, { auth: { persistSession: false } });
const staging = createClient(STAGING_URL, STAGING_KEY, { auth: { persistSession: false } });

// ── Parents first. `users` is the root for almost every other FK chain.
// Tables that the Phase A2 migration added on staging (candidate_milestones,
// candidate_paper_completions, candidate_paper_attempts,
// candidate_prep_course_bookings) don't exist on prod yet, so they're
// naturally absent from this list.
const TABLES_IN_ORDER = [
    'users',
    'events',
    'event_attendees',
    'roadmap_programmes',
    'roadmap_modules',
    'roadmap_module_items',
    'roadmap_resources',
    'roadmap_prerequisites',
    'jobs',
    'pipeline_stages',
    'leads',
    'lead_activities',
    'candidates',
    'member_invitations',
    'invitations',
    'candidate_profiles',
    'candidate_activities',
    'candidate_documents',
    'disc_results',
    'disc_responses',
    'stage_transitions',
    'notifications',
    'pa_manager_assignments',
    'candidate_programme_enrollment',
    'candidate_module_progress',
    'candidate_module_item_progress',
    'exam_papers',
    'exam_questions',
    'exam_attempts',
    'exam_answers',
    'roadshow_configs',
    'roadshow_attendance',
    'roadshow_activities',
    'progress_signals',
    'audit_log',
];

const CHUNK = 100;

// Tables that have unique-key collisions with staging's pre-existing seed data
// (e.g. roadmap_programmes.slug). For an "exact replica" we delete staging's
// rows BEFORE inserting prod's, in reverse FK order so children drop first.
// Includes only non-sensitive tables on staging that we can safely wipe.
const FRESH_DELETE_ORDER = [
    'roadmap_module_items',
    'roadmap_modules',
    'roadmap_programmes',
];

async function wipeStagingTable(table) {
    // PostgREST refuses DELETE without a filter. Use id IS NOT NULL to match all.
    const { error } = await staging.from(table).delete().not('id', 'is', null);
    if (error) return { ok: false, message: error.message };
    return { ok: true };
}

async function listProdAuthUsers() {
    // The /auth/v1/admin/users paginated endpoint 500s on some pages for this
    // project. Workaround: read IDs from public.users (55 rows) and fetch each
    // auth user by ID individually. A few may 500 or miss and get skipped.
    const { data: pub, error } = await prod.from('users').select('id');
    if (error) throw new Error(`read public.users: ${error.message}`);
    const ids = (pub ?? []).map((r) => r.id);
    const users = [];
    const misses = [];
    for (const id of ids) {
        const res = await fetch(`${PROD_URL}/auth/v1/admin/users/${id}`, {
            headers: { apikey: PROD_KEY, Authorization: `Bearer ${PROD_KEY}` },
        });
        if (!res.ok) {
            misses.push({ id, status: res.status });
            continue;
        }
        users.push(await res.json());
    }
    if (misses.length) {
        console.warn(`    ! ${misses.length} prod auth users unreadable: ${misses.map((m) => `${m.id}(${m.status})`).join(', ')}`);
    }
    return users;
}

async function createStagingAuthUser(u) {
    // Direct POST to /auth/v1/admin/users so we can set `id`. The SDK
    // sometimes strips that field depending on version.
    const body = {
        id: u.id,
        email: u.email || undefined,
        phone: u.phone || undefined,
        email_confirm: !!u.email_confirmed_at,
        phone_confirm: !!u.phone_confirmed_at,
        user_metadata: u.user_metadata ?? {},
        app_metadata: u.app_metadata ?? {},
    };
    const res = await fetch(`${STAGING_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
            apikey: STAGING_KEY,
            Authorization: `Bearer ${STAGING_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    const text = await res.text();
    return { ok: false, status: res.status, text };
}

async function cloneAuthUsers() {
    const users = await listProdAuthUsers();
    if (DRY_RUN) return { read: users.length, wrote: 0, skipped: 0, failed: 0 };
    let wrote = 0;
    let skipped = 0;
    let failed = 0;
    for (const u of users) {
        const r = await createStagingAuthUser(u);
        if (r.ok) {
            wrote++;
        } else if (/already|duplicate|exists/i.test(r.text)) {
            skipped++;
        } else {
            failed++;
            console.warn(`    ! auth ${u.id} (${u.phone || u.email}): ${r.status} ${r.text}`);
        }
    }
    return { read: users.length, wrote, skipped, failed };
}

// Remove columns from every row. Mutates rows.
function dropColumns(rows, columns) {
    for (const r of rows) for (const c of columns) delete r[c];
}

// Parse "Could not find the 'XXX' column of 'YYY' in the schema cache" → "XXX".
function extractMissingColumn(msg) {
    const m = msg.match(/Could not find the '([^']+)' column/);
    return m ? m[1] : null;
}

// Cache staging auth.users IDs so the filter below doesn't hit the admin API
// for every row-heavy table. auth.users isn't PostgREST-queryable, so we use
// an iterative GET /admin/users/{id} against every prod public.users.id.
let _stagingAuthIds = null;
async function getStagingAuthUserIds() {
    if (_stagingAuthIds) return _stagingAuthIds;
    const { data: pub } = await prod.from('users').select('id');
    const checks = (pub ?? []).map((r) => r.id);
    const found = new Set();
    for (const id of checks) {
        const res = await fetch(`${STAGING_URL}/auth/v1/admin/users/${id}`, {
            headers: { apikey: STAGING_KEY, Authorization: `Bearer ${STAGING_KEY}` },
        });
        if (res.ok) found.add(id);
    }
    _stagingAuthIds = found;
    return found;
}

async function clonePublicTable(table) {
    const { data, error } = await prod.from(table).select('*');
    if (error) {
        console.warn(`    ! read ${table}: ${error.message}`);
        return { read: 0, wrote: 0, failed: 1, skipped: false };
    }
    let rows = data ?? [];

    // Some prod auth.users rows can't be fetched (11 return 500 from GoTrue
    // admin API). Any table with FK to users must filter out rows pointing
    // to those un-cloned IDs so the upsert doesn't fail the whole batch.
    const USER_FK_COLUMNS = {
        // FK → auth.users.id (filter against cloned auth users)
        candidate_module_progress: ['candidate_id'],
        invitations: ['user_id', 'invited_by_user_id', 'assigned_manager_id'],
        candidate_profiles: ['user_id'],
        disc_results: ['user_id'],
        disc_responses: ['user_id'],
        stage_transitions: ['moved_by'],
    };
    const CANDIDATE_FK_COLUMNS = {
        // FK → candidates.id (filter against cloned candidates table)
        candidate_module_item_progress: ['candidate_id'],
    };
    const fkCols = USER_FK_COLUMNS[table];
    if (fkCols) {
        const authIds = await getStagingAuthUserIds();
        const before = rows.length;
        rows = rows.filter((r) => fkCols.every((c) => r[c] == null || authIds.has(r[c])));
        if (rows.length < before) {
            console.warn(`    ~ ${table}: filtered ${before - rows.length} rows referencing non-cloned auth users`);
        }
    }
    const cFkCols = CANDIDATE_FK_COLUMNS[table];
    if (cFkCols) {
        const { data: cand } = await staging.from('candidates').select('id');
        const candIds = new Set((cand ?? []).map((r) => r.id));
        const before = rows.length;
        rows = rows.filter((r) => cFkCols.every((c) => r[c] == null || candIds.has(r[c])));
        if (rows.length < before) {
            console.warn(`    ~ ${table}: filtered ${before - rows.length} rows referencing non-candidate user_ids (orphan data on prod)`);
        }
    }
    if (DRY_RUN || rows.length === 0) return { read: rows.length, wrote: 0, failed: 0, skipped: false };

    const droppedCols = new Set();
    let wrote = 0;
    let failed = 0;
    let skipped = false;

    for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        // Up to 8 retries to peel off unknown columns one at a time.
        let writeErr = null;
        for (let attempt = 0; attempt < 8; attempt++) {
            const res = await staging.from(table).upsert(chunk);
            writeErr = res.error;
            if (!writeErr) break;
            if (writeErr.message.includes(`Could not find the table`)) {
                skipped = true;
                break;
            }
            const missingCol = extractMissingColumn(writeErr.message);
            if (!missingCol) break;
            droppedCols.add(missingCol);
            dropColumns(chunk, [missingCol]);
            // also strip from remaining rows so subsequent chunks avoid the same retry.
            if (i + CHUNK < rows.length) dropColumns(rows.slice(i + CHUNK), [missingCol]);
        }
        if (skipped) break;
        if (writeErr) {
            failed++;
            console.warn(`    ! write ${table} [${i}..${i + chunk.length}]: ${writeErr.message}`);
            continue;
        }
        wrote += chunk.length;
    }
    if (droppedCols.size > 0) {
        console.warn(`    ~ ${table}: stripped columns not on staging: ${[...droppedCols].join(', ')}`);
    }
    if (skipped) {
        console.warn(`    ~ ${table}: table missing on staging — skipped entirely`);
    }
    return { read: rows.length, wrote, failed, skipped };
}

async function cloneTestOtps() {
    if (!MGMT_TOKEN) {
        console.log('    (skipped — SUPABASE_ACCESS_TOKEN not set)');
        return;
    }
    const getRes = await fetch(`https://api.supabase.com/v1/projects/${PROD_REF}/config/auth`, {
        headers: { Authorization: `Bearer ${MGMT_TOKEN}` },
    });
    if (!getRes.ok) {
        console.warn(`    ! GET prod auth config: ${getRes.status} ${await getRes.text()}`);
        return;
    }
    const prodAuth = await getRes.json();
    const keys = [
        'sms_test_otp',
        'sms_test_otp_valid_until',
    ];
    const payload = {};
    for (const k of keys) if (k in prodAuth) payload[k] = prodAuth[k];
    console.log(`    prod test OTPs: ${payload.sms_test_otp || '(none)'}`);
    console.log(`    prod test OTP valid until: ${payload.sms_test_otp_valid_until || '(none)'}`);

    if (DRY_RUN) return;
    const patchRes = await fetch(`https://api.supabase.com/v1/projects/${STAGING_REF}/config/auth`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${MGMT_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!patchRes.ok) {
        console.warn(`    ! PATCH staging auth config: ${patchRes.status} ${await patchRes.text()}`);
    } else {
        console.log('    ✓ staging test OTPs updated');
    }
}

async function main() {
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'EXECUTE'}`);
    console.log(`Prod:    ${PROD_URL}`);
    console.log(`Staging: ${STAGING_URL}\n`);

    const summary = [];

    // Pre-clone: wipe staging rows in tables that have unique-key collisions
    // (FRESH_DELETE_ORDER) so the replica can insert prod's rows with prod IDs.
    if (!DRY_RUN) {
        console.log('wiping pre-existing staging rows for fresh replica');
        for (const table of FRESH_DELETE_ORDER) {
            const r = await wipeStagingTable(table);
            console.log(`    ${table.padEnd(30)} ${r.ok ? 'cleared' : `! ${r.message}`}`);
        }
        console.log('');
    }

    console.log('auth.users');
    const authRes = await cloneAuthUsers();
    console.log(`    read ${authRes.read} · wrote ${authRes.wrote} · skipped ${authRes.skipped} · failed ${authRes.failed}\n`);
    summary.push({ table: 'auth.users', ...authRes });

    for (const table of TABLES_IN_ORDER) {
        console.log(table);
        const res = await clonePublicTable(table);
        console.log(`    read ${res.read} · wrote ${res.wrote} · failed ${res.failed}\n`);
        summary.push({ table, ...res });
    }

    console.log('test OTPs (Supabase Management API)');
    await cloneTestOtps();

    console.log('\n─ Summary ─');
    for (const s of summary) {
        const tag = s.skipped ? '  SKIPPED' : s.failed ? `  FAILED=${s.failed}` : '';
        console.log(`  ${s.table.padEnd(35)} read=${String(s.read).padStart(4)}  wrote=${String(s.wrote ?? '-').padStart(4)}${tag}`);
    }

    console.log(DRY_RUN ? '\nDry run complete. Re-run with --execute to write.' : '\nDone.');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
