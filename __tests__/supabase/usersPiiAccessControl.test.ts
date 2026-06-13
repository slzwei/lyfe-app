/**
 * User-PII read scoping + push_token lockdown (audit H3).
 *
 * The H3 incident: a permissive `users_select_authenticated USING (true)`
 * policy on public.users let EVERY authenticated role — including a trainee
 * candidate — read all 137 user rows: everyone's phone, email, and Expo
 * push_token. (Reproduced live before the fix.) The policy existed only in
 * production, like the H1/H2 objects — it was never in the migration chain,
 * which already ships a correctly-scoped policy set.
 *
 * This suite statically asserts:
 *   1. A migration removes the blanket policy and never re-creates it.
 *   2. push_token is locked to service_role: anon/authenticated lose the
 *      table-wide SELECT and are re-granted column SELECT that omits push_token.
 *   3. The lyfe-app self-profile fetch no longer uses `select=*` (which would
 *      403 against the column grant) and never pulls push_token to the client.
 *
 * The end-to-end behavioral proof (a candidate scoped to their own row, staff
 * directory intact, push_token denied to the authenticated role) lives in
 * scripts/verify-users-pii-rls.sh (needs PostgreSQL 17, so it is not part of
 * the Jest run).
 *
 * Set SQL_DIR to point the suite at an alternate SQL directory (used to prove
 * the suite fails against the pre-fix tree).
 */
import * as fs from 'fs';
import * as path from 'path';

const SQL_DIR = process.env.SQL_DIR ?? path.join(__dirname, '..', '..', 'supabase', 'migrations');

function allMigrationSql(): { file: string; sql: string }[] {
    return fs
        .readdirSync(SQL_DIR)
        .filter((f) => f.endsWith('.sql'))
        .sort()
        .map((f) => ({ file: f, sql: fs.readFileSync(path.join(SQL_DIR, f), 'utf8') }));
}

/** The column list of the `GRANT SELECT (...) ON public.users TO ...` statement, lowercased. */
function grantedUserSelectColumns(): string[] | null {
    for (const { sql } of allMigrationSql()) {
        const m = /grant\s+select\s*\(([\s\S]*?)\)\s*on\s+public\.users\s+to\b/i.exec(sql);
        if (m) {
            return m[1]
                .split(',')
                .map((c) => c.trim().toLowerCase())
                .filter(Boolean);
        }
    }
    return null;
}

describe('user PII reads are scoped + push_token locked (audit H3)', () => {
    const migrations = allMigrationSql();
    const joined = migrations.map((m) => m.sql).join('\n');

    it('a migration drops the blanket users_select_authenticated policy', () => {
        expect(joined).toMatch(/drop\s+policy\s+if\s+exists\s+users_select_authenticated\s+on\s+public\.users/i);
    });

    it('no migration re-creates the blanket USING(true) policy (it is prod-only drift)', () => {
        // The policy must never enter the canonical chain; CREATE POLICY for it
        // would re-open the hole on a fresh rebuild.
        expect(joined).not.toMatch(/create\s+policy\s+"?users_select_authenticated"?/i);
    });

    it('revokes the table-wide SELECT on users from anon and authenticated', () => {
        const revoke = /revoke\s+select\s+on\s+public\.users\s+from\s+([^;]+);/i.exec(joined);
        expect(revoke).not.toBeNull();
        const targets = revoke![1].toLowerCase();
        expect(targets).toContain('anon');
        expect(targets).toContain('authenticated');
    });

    describe('column-level SELECT re-grant', () => {
        const cols = grantedUserSelectColumns();

        it('exists and targets the client roles', () => {
            expect(cols).not.toBeNull();
            const grant = /grant\s+select\s*\([\s\S]*?\)\s*on\s+public\.users\s+to\s+([^;]+);/i.exec(joined);
            expect(grant).not.toBeNull();
            const targets = grant![1].toLowerCase();
            expect(targets).toContain('anon');
            expect(targets).toContain('authenticated');
        });

        it('NEVER grants push_token (the leaked spoofing capability)', () => {
            expect(cols).not.toContain('push_token');
        });

        it('still grants the columns the app legitimately reads', () => {
            for (const needed of ['id', 'email', 'phone', 'full_name', 'role', 'reports_to', 'avatar_url']) {
                expect(cols).toContain(needed);
            }
        });
    });
});

describe('lyfe-app self-profile fetch never pulls push_token (audit H3)', () => {
    const authSrc = fs.readFileSync(path.join(__dirname, '..', '..', 'contexts', 'AuthContext.tsx'), 'utf8');

    it('does not use select=* on the users REST endpoint (would 403 on the column grant)', () => {
        expect(authSrc).not.toMatch(/\/rest\/v1\/users\?[^`]*select=\*/);
    });

    it('fetches via an explicit USER_PROFILE_COLUMNS list', () => {
        expect(authSrc).toMatch(/select=\$\{USER_PROFILE_COLUMNS\}/);
        expect(authSrc).toMatch(/export const USER_PROFILE_COLUMNS\s*=/);
    });

    it('USER_PROFILE_COLUMNS omits push_token but keeps contact fields', () => {
        const block = /USER_PROFILE_COLUMNS\s*=\s*\[([\s\S]*?)\]/.exec(authSrc);
        expect(block).not.toBeNull();
        const list = block![1].toLowerCase();
        expect(list).not.toContain('push_token');
        expect(list).toContain("'email'");
        expect(list).toContain("'phone'");
        expect(list).toContain("'full_name'");
    });
});
