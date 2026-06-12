/**
 * Migration-chain rebuild guard (audit C3).
 *
 * The C3 incident: four core tables (candidate_profiles, disc_results,
 * disc_responses, invitations) were created by hand in the Supabase
 * Dashboard, referenced by ~30 migrations, but CREATE'd in none — so
 * `supabase db reset` could never rebuild the database from the repo.
 *
 * This suite statically parses every migration and asserts that any table a
 * migration's DDL touches (ALTER TABLE, CREATE INDEX/POLICY/TRIGGER ON,
 * DROP POLICY/TRIGGER ON, ALTER PUBLICATION ... ADD TABLE, REFERENCES)
 * is CREATE'd by a migration with an earlier-or-equal version. It fails
 * the moment a new Dashboard-only table sneaks into the chain.
 *
 * Set MIGRATIONS_DIR to point the suite at an alternate snapshot of the
 * migrations directory (used to prove the suite fails on the pre-fix tree).
 */
import * as fs from 'fs';
import * as path from 'path';

const MIGRATIONS_DIR = process.env.MIGRATIONS_DIR ?? path.join(__dirname, '..', '..', 'supabase', 'migrations');

/** Schemas whose objects the Supabase platform owns — not created by this repo's chain. */
const PLATFORM_SCHEMAS = new Set([
    'auth',
    'storage',
    'cron',
    'net',
    'vault',
    'extensions',
    'realtime',
    'supabase_functions',
    'supabase_migrations',
    'pg_catalog',
    'information_schema',
]);

interface TableRef {
    table: string;
    version: string;
    file: string;
    via: string;
}

function stripComments(sql: string): string {
    return sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

/** "public"."users" / public.users / users → 'users' (or null when platform-owned). */
function normalizeTable(raw: string): string | null {
    const cleaned = raw.replace(/"/g, '').trim().toLowerCase().replace(/;$/, '');
    const parts = cleaned.split('.');
    if (parts.length === 2) {
        if (PLATFORM_SCHEMAS.has(parts[0])) return null;
        if (parts[0] !== 'public') return null;
        return parts[1];
    }
    return parts[0] || null;
}

const IDENT = String.raw`(?:"[^"]+"|[a-z0-9_]+)(?:\s*\.\s*(?:"[^"]+"|[a-z0-9_]+))?`;

function collectMigrationFacts(dir: string) {
    const files = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.sql'))
        .sort();

    const createdAt = new Map<string, string>(); // table -> earliest creating version
    const refs: TableRef[] = [];

    for (const file of files) {
        const version = file.split('_')[0];
        const sql = stripComments(fs.readFileSync(path.join(dir, file), 'utf8'));

        for (const m of sql.matchAll(
            new RegExp(String.raw`create\s+table\s+(?:if\s+not\s+exists\s+)?(${IDENT})`, 'gi'),
        )) {
            const t = normalizeTable(m[1]);
            if (t && !createdAt.has(t)) createdAt.set(t, version);
        }

        const refPatterns: [string, RegExp][] = [
            ['ALTER TABLE', new RegExp(String.raw`alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(${IDENT})`, 'gi')],
            [
                'CREATE INDEX ON',
                new RegExp(
                    String.raw`create\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?${IDENT}\s+on\s+(${IDENT})`,
                    'gi',
                ),
            ],
            ['CREATE POLICY ON', new RegExp(String.raw`create\s+policy\s+${IDENT}\s+on\s+(${IDENT})`, 'gi')],
            [
                'DROP POLICY ON',
                new RegExp(String.raw`drop\s+policy\s+(?:if\s+exists\s+)?${IDENT}\s+on\s+(${IDENT})`, 'gi'),
            ],
            [
                'CREATE TRIGGER ON',
                new RegExp(
                    String.raw`create\s+(?:or\s+replace\s+)?(?:constraint\s+)?trigger\s+${IDENT}[\s\S]*?\bon\s+(${IDENT})`,
                    'gi',
                ),
            ],
            [
                'DROP TRIGGER ON',
                new RegExp(String.raw`drop\s+trigger\s+(?:if\s+exists\s+)?${IDENT}\s+on\s+(${IDENT})`, 'gi'),
            ],
            ['REFERENCES', new RegExp(String.raw`references\s+(${IDENT})\s*\(`, 'gi')],
        ];

        for (const [via, pattern] of refPatterns) {
            for (const m of sql.matchAll(pattern)) {
                const t = normalizeTable(m[1]);
                if (t) refs.push({ table: t, version, file, via });
            }
        }

        for (const m of sql.matchAll(/alter\s+publication\s+supabase_realtime\s+add\s+table\s+([^;]+);/gi)) {
            for (const rawName of m[1].split(',')) {
                const t = normalizeTable(rawName);
                if (t) refs.push({ table: t, version, file, via: 'ALTER PUBLICATION ADD TABLE' });
            }
        }
    }

    return { files, createdAt, refs };
}

describe('supabase/migrations — the repo can rebuild the database (audit C3)', () => {
    const { files, createdAt, refs } = collectMigrationFacts(MIGRATIONS_DIR);

    it('parses a sane migration set', () => {
        expect(files.length).toBeGreaterThan(150);
        expect(refs.length).toBeGreaterThan(300);
        // The chain itself must create core tables (guards regex rot: if the
        // CREATE TABLE pattern ever stops matching, this fails loudly rather
        // than letting the orphan check pass vacuously).
        for (const t of ['users', 'leads', 'candidates', 'events', 'notifications']) {
            expect(createdAt.has(t)).toBe(true);
        }
    });

    it('every table referenced by migration DDL is created by an earlier-or-same migration', () => {
        const problems: string[] = [];
        const reported = new Set<string>();

        for (const ref of refs) {
            const created = createdAt.get(ref.table);
            const key = created === undefined ? ref.table : `${ref.table}@${ref.file}`;
            if (created === undefined) {
                if (!reported.has(key)) {
                    reported.add(key);
                    problems.push(
                        `"${ref.table}" is referenced (${ref.via} in ${ref.file}) but CREATE TABLE'd in no migration — Dashboard-only table; a db reset cannot rebuild it`,
                    );
                }
            } else if (created > ref.version) {
                if (!reported.has(key)) {
                    reported.add(key);
                    problems.push(
                        `"${ref.table}" is referenced (${ref.via} in ${ref.file}) before its CREATE TABLE at ${created} — replay order is broken`,
                    );
                }
            }
        }

        expect(problems).toEqual([]);
    });

    it('the four C3 tables are created by the baseline migration', () => {
        // Regression pin for the original audit finding.
        for (const t of ['candidate_profiles', 'disc_results', 'disc_responses', 'invitations']) {
            expect(createdAt.get(t)).toBe('20260320173000');
        }
    });
});
