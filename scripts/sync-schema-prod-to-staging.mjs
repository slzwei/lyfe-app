#!/usr/bin/env node
/**
 * Sync missing schema objects from prod → staging.
 *
 * Uses the Supabase Management API's /database/query endpoint to extract DDL
 * from prod via pg_catalog introspection, then applies it to staging.
 *
 * Handles, in order:
 *   1. Extensions (pg_trgm)
 *   2. Missing tables (with columns, NOT NULL/DEFAULT, PRIMARY KEYs)
 *   3. Indexes on those tables
 *   4. FK constraints on those tables
 *   5. Missing functions (via pg_get_functiondef — full CREATE FUNCTION text)
 *   6. Triggers on missing tables + newly-created functions that trigger off existing tables
 *   7. RLS enablement + policies on missing tables
 *
 * Required env:
 *   SUPABASE_ACCESS_TOKEN — personal access token
 *
 * Usage:
 *   node scripts/sync-schema-prod-to-staging.mjs            # dry-run
 *   node scripts/sync-schema-prod-to-staging.mjs --execute  # apply
 */

const PROD_REF = 'nvtedkyjwulkzjeoqjgx';
const STAGING_REF = 'ajjxkasvikeigapnzdak';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!TOKEN) {
    console.error('ERROR: set SUPABASE_ACCESS_TOKEN env var.');
    process.exit(1);
}

const DRY_RUN = !process.argv.includes('--execute');

async function sql(ref, query) {
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
    });
    const text = await res.text();
    if (!res.ok) {
        throw new Error(`SQL on ${ref} failed: ${res.status} ${text}\nQuery: ${query.slice(0, 200)}`);
    }
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

async function exec(ref, statement, label) {
    if (DRY_RUN) {
        console.log(`  [dry] ${label}`);
        return { ok: true };
    }
    try {
        await sql(ref, statement.replace(/"/g, '\\"').replace(/\n/g, ' '));
        console.log(`  ✓ ${label}`);
        return { ok: true };
    } catch (e) {
        console.warn(`  ! ${label}: ${String(e).slice(0, 300)}`);
        return { ok: false, error: String(e) };
    }
}

// Escape a SQL block for JSON transport. Management API takes JSON-escaped text.
function jsonSafe(q) {
    return q;
}

// Wrapper that sends raw SQL without our hand-coded escape hack.
async function execRaw(ref, statement, label) {
    if (DRY_RUN) {
        console.log(`  [dry] ${label}`);
        return { ok: true };
    }
    try {
        const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: statement }),
        });
        const text = await res.text();
        if (!res.ok) {
            if (isExpected(text)) {
                console.log(`  ~ ${label} (already present)`);
                return { ok: true, skipped: true };
            }
            throw new Error(`${res.status} ${text.slice(0, 300)}`);
        }
        console.log(`  ✓ ${label}`);
        return { ok: true };
    } catch (e) {
        const msg = String(e);
        if (isExpected(msg)) {
            console.log(`  ~ ${label} (already present)`);
            return { ok: true, skipped: true };
        }
        console.warn(`  ! ${label}: ${msg.slice(0, 300)}`);
        return { ok: false, error: msg };
    }
}

// ── Helpers to quiet expected errors ───────────────────────────────────────
const EXPECTED_ERRORS = [
    'already exists',
    'already enabled',
    'duplicate_object',
];
function isExpected(msg) {
    return EXPECTED_ERRORS.some((p) => msg.toLowerCase().includes(p));
}

// ── Step 0: Missing enum types ─────────────────────────────────────────────

async function syncTypes() {
    console.log('\n── Types (enums) ──');
    const prod = await sql(
        PROD_REF,
        `SELECT t.typname,
                array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
         FROM pg_type t
         JOIN pg_enum e ON e.enumtypid = t.oid
         JOIN pg_namespace n ON n.oid = t.typnamespace
         WHERE n.nspname = 'public'
         GROUP BY t.typname`,
    );
    const staging = await sql(
        STAGING_REF,
        `SELECT t.typname FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typtype='e'`,
    );
    const stagingSet = new Set(staging.map((r) => r.typname));
    const missing = prod.filter((r) => !stagingSet.has(r.typname));
    if (!missing.length) {
        console.log('  no missing types');
        return;
    }
    for (const r of missing) {
        let labels = r.labels;
        if (typeof labels === 'string') {
            // Postgres array literal like "{a,b,c}" — strip braces + split.
            labels = labels.replace(/^\{|\}$/g, '').split(',').filter(Boolean);
        }
        if (!Array.isArray(labels)) labels = [];
        const values = labels.map((l) => `'${String(l).replace(/'/g, "''")}'`).join(', ');
        await execRaw(STAGING_REF, `CREATE TYPE public."${r.typname}" AS ENUM (${values})`, `TYPE ${r.typname}`);
    }
}

// ── Step 1: Extensions ─────────────────────────────────────────────────────

async function syncExtensions() {
    console.log('\n── Extensions ──');
    const prodExt = await sql(PROD_REF, "SELECT extname FROM pg_extension WHERE extname NOT IN ('plpgsql') ORDER BY extname");
    const stagingExt = await sql(STAGING_REF, "SELECT extname FROM pg_extension WHERE extname NOT IN ('plpgsql') ORDER BY extname");
    const prodSet = new Set(prodExt.map((r) => r.extname));
    const stagingSet = new Set(stagingExt.map((r) => r.extname));
    const missing = [...prodSet].filter((e) => !stagingSet.has(e));
    if (!missing.length) {
        console.log('  all extensions present');
        return;
    }
    for (const ext of missing) {
        await execRaw(STAGING_REF, `CREATE EXTENSION IF NOT EXISTS "${ext}"`, `CREATE EXTENSION ${ext}`);
    }
}

// ── Step 2: Missing tables — extract + apply CREATE TABLE DDL ─────────────

async function getMissingTables() {
    const prod = await sql(PROD_REF, "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'");
    const staging = await sql(STAGING_REF, "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'");
    const prodSet = new Set(prod.map((r) => r.table_name));
    const stagingSet = new Set(staging.map((r) => r.table_name));
    return [...prodSet].filter((t) => !stagingSet.has(t)).sort();
}

// Build CREATE TABLE DDL from pg_catalog introspection. Columns, defaults,
// NOT NULL. Primary key. Unique constraints + FKs applied later so we can
// respect ordering.
async function buildTableDDL(tableName) {
    const cols = await sql(
        PROD_REF,
        `SELECT column_name, data_type, udt_name, is_nullable, column_default, character_maximum_length, numeric_precision, numeric_scale
         FROM information_schema.columns
         WHERE table_schema='public' AND table_name='${tableName}'
         ORDER BY ordinal_position`,
    );
    const pk = await sql(
        PROD_REF,
        `SELECT kcu.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
         WHERE tc.constraint_type='PRIMARY KEY' AND tc.table_schema='public' AND tc.table_name='${tableName}'
         ORDER BY kcu.ordinal_position`,
    );

    const colDefs = cols.map((c) => {
        // Prefer the underlying udt_name for USER-DEFINED types (enums etc.)
        let type = c.data_type;
        if (type === 'USER-DEFINED' || type === 'ARRAY') type = c.udt_name;
        if (type === 'character varying' && c.character_maximum_length) {
            type = `varchar(${c.character_maximum_length})`;
        }
        if (type === 'numeric' && c.numeric_precision) {
            type = `numeric(${c.numeric_precision}${c.numeric_scale ? `,${c.numeric_scale}` : ''})`;
        }
        const parts = [`"${c.column_name}" ${type}`];
        if (c.column_default) parts.push(`DEFAULT ${c.column_default}`);
        if (c.is_nullable === 'NO') parts.push('NOT NULL');
        return parts.join(' ');
    });

    if (pk.length) {
        colDefs.push(`PRIMARY KEY (${pk.map((r) => `"${r.column_name}"`).join(', ')})`);
    }

    return `CREATE TABLE IF NOT EXISTS public."${tableName}" (\n  ${colDefs.join(',\n  ')}\n)`;
}

async function syncMissingTables() {
    console.log('\n── Missing tables ──');
    const missing = await getMissingTables();
    if (!missing.length) {
        console.log('  no missing tables');
        return [];
    }
    for (const t of missing) {
        console.log(`  · ${t}`);
        const ddl = await buildTableDDL(t);
        await execRaw(STAGING_REF, ddl, `CREATE TABLE ${t}`);
    }
    return missing;
}

// ── Step 3: Indexes on (previously) missing tables ─────────────────────────

async function syncIndexes(tables) {
    if (!tables.length) return;
    console.log('\n── Indexes ──');
    for (const t of tables) {
        const defs = await sql(
            PROD_REF,
            `SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='${t}' AND indexname NOT LIKE '%_pkey'`,
        );
        for (const d of defs) {
            // pg_indexes.indexdef already includes IF NOT EXISTS conceptually via CREATE INDEX CONCURRENTLY... actually no, add IF NOT EXISTS ourselves.
            const stmt = d.indexdef.replace(/^CREATE (UNIQUE )?INDEX /, 'CREATE $1INDEX IF NOT EXISTS ');
            await execRaw(STAGING_REF, stmt, `${t}: ${stmt.slice(0, 80)}...`);
        }
    }
}

// ── Step 4: FK + CHECK + UNIQUE constraints on (previously) missing tables ─

async function syncConstraints(tables) {
    if (!tables.length) return;
    console.log('\n── Constraints (FK / CHECK / UNIQUE) ──');
    for (const t of tables) {
        const defs = await sql(
            PROD_REF,
            `SELECT conname, pg_get_constraintdef(c.oid) AS def, contype
             FROM pg_constraint c
             JOIN pg_class cl ON c.conrelid = cl.oid
             JOIN pg_namespace n ON cl.relnamespace = n.oid
             WHERE n.nspname='public' AND cl.relname='${t}' AND c.contype IN ('f','u','c')`,
        );
        for (const d of defs) {
            const stmt = `ALTER TABLE public."${t}" ADD CONSTRAINT "${d.conname}" ${d.def}`;
            await execRaw(STAGING_REF, stmt, `${t}.${d.conname}`);
        }
    }
}

// ── Step 5: Functions ──────────────────────────────────────────────────────

async function syncFunctions() {
    console.log('\n── Functions ──');
    // Only sync functions that are not built-in. pg_proc.prokind='f' = normal function, 'a' = agg, 'w' = window.
    // We only want user-written functions in public schema that have bodies (not built-ins).
    const prod = await sql(
        PROD_REF,
        `SELECT p.proname, pg_get_functiondef(p.oid) AS def
         FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
         WHERE n.nspname='public' AND p.prokind='f'`,
    );
    const staging = await sql(
        STAGING_REF,
        `SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f'`,
    );
    const stagingSet = new Set(staging.map((r) => r.proname));

    // Skip functions that already exist on staging. Skip ones that come from
    // the pg_trgm extension (those are recreated by CREATE EXTENSION).
    const skipExtensionFns = new Set([
        'gin_extract_query_trgm', 'gin_extract_value_trgm', 'gin_trgm_consistent', 'gin_trgm_triconsistent',
        'gtrgm_compress', 'gtrgm_consistent', 'gtrgm_decompress', 'gtrgm_distance', 'gtrgm_in',
        'gtrgm_options', 'gtrgm_out', 'gtrgm_penalty', 'gtrgm_picksplit', 'gtrgm_same', 'gtrgm_union',
        'set_limit', 'show_limit', 'show_trgm', 'similarity', 'similarity_dist', 'similarity_op',
        'strict_word_similarity', 'strict_word_similarity_commutator_op', 'strict_word_similarity_dist_commutator_op',
        'strict_word_similarity_dist_op', 'strict_word_similarity_op', 'word_similarity',
        'word_similarity_commutator_op', 'word_similarity_dist_commutator_op', 'word_similarity_dist_op',
        'word_similarity_op',
    ]);

    const missing = prod.filter((r) => !stagingSet.has(r.proname) && !skipExtensionFns.has(r.proname));
    if (!missing.length) {
        console.log('  no missing functions');
        return;
    }
    for (const r of missing) {
        await execRaw(STAGING_REF, r.def, `fn ${r.proname}`);
    }
}

// ── Step 6: Triggers on missing tables ─────────────────────────────────────

async function syncTriggers(tables) {
    if (!tables.length) return;
    console.log('\n── Triggers on (previously) missing tables ──');
    for (const t of tables) {
        const defs = await sql(
            PROD_REF,
            `SELECT tgname, pg_get_triggerdef(tg.oid) AS def
             FROM pg_trigger tg JOIN pg_class cl ON tg.tgrelid=cl.oid JOIN pg_namespace n ON cl.relnamespace=n.oid
             WHERE n.nspname='public' AND cl.relname='${t}' AND NOT tg.tgisinternal`,
        );
        for (const d of defs) {
            await execRaw(STAGING_REF, d.def, `${t}.${d.tgname}`);
        }
    }
}

// ── Step 7: RLS enable + policies on missing tables ────────────────────────

async function syncRls(tables) {
    if (!tables.length) return;
    console.log('\n── RLS + Policies on (previously) missing tables ──');
    for (const t of tables) {
        const rls = await sql(
            PROD_REF,
            `SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='${t}'`,
        );
        if (rls[0]?.relrowsecurity) {
            await execRaw(STAGING_REF, `ALTER TABLE public."${t}" ENABLE ROW LEVEL SECURITY`, `${t}: enable RLS`);
        }
        const policies = await sql(
            PROD_REF,
            `SELECT policyname, cmd, permissive, roles, qual, with_check
             FROM pg_policies WHERE schemaname='public' AND tablename='${t}'`,
        );
        for (const p of policies) {
            // pg_policies.roles is a name[] array; comes back serialized. Normalize.
            let roleList = p.roles;
            if (typeof roleList === 'string') {
                // e.g. "{authenticated,anon}" or "{public}"
                roleList = roleList.replace(/^\{|\}$/g, '').split(',').filter(Boolean);
            }
            if (!Array.isArray(roleList)) roleList = [];
            const roles = roleList.length > 0
                ? roleList.map((r) => r === 'public' ? 'public' : `"${r}"`).join(', ')
                : 'public';
            const parts = [
                `CREATE POLICY "${p.policyname}" ON public."${t}"`,
                p.permissive === 'RESTRICTIVE' ? 'AS RESTRICTIVE' : '',
                `FOR ${p.cmd}`,
                `TO ${roles}`,
                p.qual ? `USING (${p.qual})` : '',
                p.with_check ? `WITH CHECK (${p.with_check})` : '',
            ].filter(Boolean).join(' ');
            await execRaw(STAGING_REF, parts, `${t}: policy ${p.policyname}`);
        }
    }
}

// ── Main ───────────────────────────────────────────────────────────────────

// Tables the sync-schema script manages. Idempotent; safe to re-run against
// tables that already exist — inner steps use IF NOT EXISTS / isExpected().
const MANAGED_TABLES = [
    'audit_log',
    'candidate_profiles',
    'disc_responses',
    'disc_results',
    'invitations',
    'jobs',
    'pipeline_stages',
    'progress_signals',
    'stage_transitions',
];

async function main() {
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'EXECUTE'}`);
    await syncExtensions();
    await syncTypes();
    await syncMissingTables();
    // Run all downstream steps against the full managed-tables list so tables
    // that existed from a prior partial run still get their constraints,
    // triggers, and policies applied.
    await syncIndexes(MANAGED_TABLES);
    await syncConstraints(MANAGED_TABLES);
    await syncFunctions();
    await syncTriggers(MANAGED_TABLES);
    await syncRls(MANAGED_TABLES);
    console.log('\nDone.');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
