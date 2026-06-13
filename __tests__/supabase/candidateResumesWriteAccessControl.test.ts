/**
 * candidate-resumes storage WRITE access control (audit H4).
 *
 * The H4 incident: the candidate-resumes bucket's INSERT/UPDATE/DELETE storage
 * policies (created by 20260306123638_add_resume_url_to_candidates.sql) gate on
 * bucket_id ALONE, for the `authenticated` role. The SELECT side was later
 * locked to staff (20260511130000) but the writes were not, so any
 * authenticated user — a trainee candidate included — could write to the
 * bucket. Reproduced live before the fix: a candidate INSERTed a brand-new
 * object into candidate-resumes. (Overwrite/delete of an *existing* object was
 * incidentally blocked by the staff-only SELECT policy — a candidate can't
 * locate a row it can't read — but the write policies themselves stayed
 * mis-scoped, so the protection was accidental and fragile.)
 *
 * This suite statically asserts the committed migration drops the three
 * bucket-only write policies and replaces them with role-gated ones (the same
 * staff list as "Staff can view resumes"), so a candidate cannot satisfy them.
 * To prove the gate checks discriminate (fail-before / pass-after), the same
 * checks run against the captured pre-fix DDL in
 * __fixtures__/candidate-resumes-writes-vulnerable.sql and must find it
 * un-gated. The end-to-end behavioral proof (candidate writes denied, staff
 * writes allowed) was run live via the Supabase MCP against the applied
 * migration, and lives in scripts/verify-candidate-resumes-writes-rls.sh
 * (needs PostgreSQL 17, so it is not part of the Jest run).
 *
 * Set SQL_DIR to point the suite at an alternate SQL directory (used to prove
 * the suite fails against the pre-fix tree, e.g. SQL_DIR=__tests__/supabase/__fixtures__).
 */
import * as fs from 'fs';
import * as path from 'path';

const SQL_DIR = process.env.SQL_DIR ?? path.join(__dirname, '..', '..', 'supabase', 'migrations');
const FIXTURE = path.join(__dirname, '__fixtures__', 'candidate-resumes-writes-vulnerable.sql');

const STAFF_ROLES = ['admin', 'director', 'manager', 'agent', 'pa', 'ro'];
const WRITE_CMDS = ['INSERT', 'UPDATE', 'DELETE'] as const;
type WriteCmd = (typeof WRITE_CMDS)[number];

function sqlSources(dir: string): string[] {
    return fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.sql'))
        .sort()
        .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'));
}

/**
 * The LAST CREATE POLICY statement on storage.objects for `cmd` whose body
 * mentions the candidate-resumes bucket, across `sources` in version order.
 * "Last wins" so a later migration's role-gated policy supersedes the original
 * bucket-only one. (None of these policy bodies contain a literal `;`, so a
 * naive statement split is safe.)
 */
function latestResumeWritePolicy(sources: string[], cmd: WriteCmd): string | null {
    let found: string | null = null;
    for (const sql of sources) {
        for (const stmt of sql.split(';')) {
            if (!/create\s+policy/i.test(stmt)) continue;
            if (!/storage\.objects/i.test(stmt)) continue;
            if (!/candidate-resumes/i.test(stmt)) continue;
            if (!new RegExp(`for\\s+${cmd}\\b`, 'i').test(stmt)) continue;
            found = stmt;
        }
    }
    return found;
}

/** A write policy is safe iff it requires a staff app_metadata role. */
function isRoleGated(policy: string): boolean {
    const hasRoleClaim = /app_metadata/i.test(policy) && /->>\s*'role'/i.test(policy);
    const hasFullStaffList = STAFF_ROLES.every((r) => new RegExp(`'${r}'`).test(policy));
    const excludesCandidate = !/'candidate'/.test(policy);
    return hasRoleClaim && hasFullStaffList && excludesCandidate;
}

describe('candidate-resumes writes are scoped to staff (audit H4)', () => {
    const sources = sqlSources(SQL_DIR);
    const joined = sources.join('\n');

    it('a migration drops the three bucket-only write policies', () => {
        for (const verb of ['upload', 'update', 'delete']) {
            expect(joined).toMatch(
                new RegExp(
                    `drop\\s+policy\\s+if\\s+exists\\s+"authenticated users can ${verb} resumes"\\s+on\\s+storage\\.objects`,
                    'i',
                ),
            );
        }
    });

    describe.each(WRITE_CMDS)('the %s write policy', (cmd) => {
        const policy = latestResumeWritePolicy(sources, cmd);

        it('is defined for candidate-resumes', () => {
            expect(policy).not.toBeNull();
        });

        it('requires a staff app_metadata role (a candidate cannot satisfy it)', () => {
            expect(policy).not.toBeNull();
            expect(isRoleGated(policy as string)).toBe(true);
        });

        it('still scopes to the candidate-resumes bucket', () => {
            expect(policy as string).toMatch(/bucket_id\s*=\s*'candidate-resumes'/i);
        });
    });

    // Fail-before / pass-after: the captured pre-fix DDL must read as un-gated,
    // proving the role-gate assertions above are not vacuously true.
    describe('pre-fix fixture is detected as vulnerable', () => {
        const fixture = [fs.readFileSync(FIXTURE, 'utf8')];

        it.each(WRITE_CMDS)('the %s policy in the fixture is NOT role-gated', (cmd) => {
            const policy = latestResumeWritePolicy(fixture, cmd);
            expect(policy).not.toBeNull();
            expect(isRoleGated(policy as string)).toBe(false);
        });
    });
});
