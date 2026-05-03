#!/usr/bin/env node
/**
 * E2E bootstrap — idempotently creates the seven mock auth users and runs
 * supabase/seed-e2e.sql against the configured Supabase project.
 *
 * Required env:
 *   STAGING_SUPABASE_URL                e.g. https://ajjxkasvikeigapnzdak.supabase.co
 *   STAGING_SUPABASE_SERVICE_ROLE_KEY   service-role key (NOT the anon key)
 *   STAGING_SUPABASE_DB_URL             postgres://... — psql connection string
 *
 * Usage (locally):
 *   STAGING_SUPABASE_URL=... STAGING_SUPABASE_SERVICE_ROLE_KEY=... \
 *   STAGING_SUPABASE_DB_URL=... node scripts/e2e-bootstrap.mjs
 *
 * Usage (CI): invoked by .github/workflows/e2e-maestro.yml.
 *
 * IMPORTANT: only points at staging. Aborts if SUPABASE_URL contains
 * 'nvtedkyjwulkzjeoqjgx' (the production project ref).
 */
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROD_PROJECT_REF = 'nvtedkyjwulkzjeoqjgx';

const MOCK_USERS = [
    { phone: '+6580000001', label: 'admin' },
    { phone: '+6580000002', label: 'director' },
    { phone: '+6580000003', label: 'manager' },
    { phone: '+6580000004', label: 'agent' },
    { phone: '+6580000005', label: 'pa' },
    { phone: '+6580000006', label: 'candidate' },
    { phone: '+6590000007', label: 'e2e-candidate' },
];

const url = process.env.STAGING_SUPABASE_URL;
const serviceRoleKey = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.STAGING_SUPABASE_DB_URL;

if (!url || !serviceRoleKey || !dbUrl) {
    console.error('Missing required env: STAGING_SUPABASE_URL, STAGING_SUPABASE_SERVICE_ROLE_KEY, STAGING_SUPABASE_DB_URL');
    process.exit(1);
}

if (url.includes(PROD_PROJECT_REF)) {
    console.error(`Refusing to run E2E bootstrap against production (${PROD_PROJECT_REF}).`);
    process.exit(2);
}

const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

async function ensureUser({ phone, label }) {
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) throw new Error(`listUsers failed for ${phone}: ${error.message}`);

    const existing = data?.users?.find((u) => u.phone === phone.replace('+', '') || u.phone === phone);
    if (existing) {
        console.log(`✓ ${label} (${phone}) already exists — id=${existing.id}`);
        return existing.id;
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
        phone,
        phone_confirm: true,
    });
    if (createErr) throw new Error(`createUser failed for ${phone}: ${createErr.message}`);
    console.log(`+ ${label} (${phone}) created — id=${created.user.id}`);
    return created.user.id;
}

async function main() {
    console.log(`E2E bootstrap → ${url}`);

    for (const u of MOCK_USERS) {
        await ensureUser(u);
    }

    const __dirname = dirname(fileURLToPath(import.meta.url));
    const seedPath = resolve(__dirname, '../supabase/seed-e2e.sql');
    const seedSql = readFileSync(seedPath, 'utf8');
    console.log(`Applying seed-e2e.sql (${seedSql.length} bytes)…`);

    // psql is the simplest way to run a multi-statement DO $$ block. We pipe
    // the SQL via stdin so the connection string never lands on disk.
    execSync('psql --set ON_ERROR_STOP=1 "$STAGING_SUPABASE_DB_URL"', {
        input: seedSql,
        stdio: ['pipe', 'inherit', 'inherit'],
        env: { ...process.env },
    });

    console.log('✅ E2E bootstrap complete.');
}

main().catch((err) => {
    console.error('E2E bootstrap failed:', err.message ?? err);
    process.exit(1);
});
