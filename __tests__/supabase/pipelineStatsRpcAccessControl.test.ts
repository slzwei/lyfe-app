/**
 * Pipeline-stats RPC authorization guard (audit H2).
 *
 * The H2 incident: the home dashboard calls the 2-argument overload
 * get_lead_pipeline_stats(p_user_id uuid, p_is_manager boolean), which returns
 * a rich JSONB summary (totalLeads / conversionRate / pipeline). It is
 * SECURITY DEFINER (bypasses RLS) but performed NO authorization check, so any
 * authenticated caller — verified live with a trainee candidate — could pass
 * another manager's id with p_is_manager => true and read that manager's
 * entire team pipeline. The overload also existed only in production (in no
 * migration), so a fresh `supabase db reset` errored on the dashboard.
 *
 * This suite statically asserts the committed migration re-defines the 2-arg
 * overload WITH an authorization gate (caller is the target user, an
 * admin/director, or the target's direct manager) while preserving the JSONB
 * aggregation shape the app depends on. To prove the assertions discriminate
 * (fail-before / pass-after), the same checks are run against the captured
 * pre-fix definition in __fixtures__/pipeline-stats-vulnerable.sql and must
 * find the guard absent there. The end-to-end behavioral proof (impersonate a
 * candidate, expect a raise) was run live via the Supabase MCP against the
 * applied migration.
 *
 * Set SQL_DIR to point the suite at an alternate SQL directory.
 */
import * as fs from 'fs';
import * as path from 'path';

const SQL_DIR = process.env.SQL_DIR ?? path.join(__dirname, '..', '..', 'supabase', 'migrations');
const FIXTURE = path.join(__dirname, '__fixtures__', 'pipeline-stats-vulnerable.sql');

/**
 * Body of the LAST `CREATE OR REPLACE FUNCTION get_lead_pipeline_stats(...)`
 * whose argument list contains `p_is_manager` (the 2-arg overload), across all
 * .sql files in `dir` in version order. Returns null if none is found.
 */
function twoArgOverloadBody(dir: string): string | null {
    const files = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.sql'))
        .sort();
    return latestTwoArgBodyFromSources(files.map((f) => fs.readFileSync(path.join(dir, f), 'utf8')));
}

function latestTwoArgBodyFromSources(sources: string[]): string | null {
    const headerRe = /create\s+or\s+replace\s+function\s+(?:public\.)?get_lead_pipeline_stats\b/gi;
    let body: string | null = null;
    for (const sql of sources) {
        let m: RegExpExecArray | null;
        headerRe.lastIndex = 0;
        while ((m = headerRe.exec(sql))) {
            const rest = sql.slice(m.index);
            const dq = /\bas\s+(\$[a-z_]*\$)/i.exec(rest);
            if (!dq) continue;
            const header = rest.slice(0, dq.index); // signature, between name and `AS $$`
            if (!/p_is_manager/i.test(header)) continue; // only the 2-arg overload
            const tag = dq[1];
            const start = rest.indexOf(tag, dq.index) + tag.length;
            const end = rest.indexOf(tag, start);
            if (end === -1) continue;
            body = rest.slice(start, end); // later files / later defs overwrite — last wins
        }
    }
    return body;
}

/** The authorization gate the migration must contain. */
function hasAuthGuard(body: string): boolean {
    return (
        /auth\.uid\(\)\s+is\s+null/i.test(body) && // rejects unauthenticated
        /raise\s+exception/i.test(body) &&
        /auth\.uid\(\)\s*=\s*p_user_id/i.test(body) && // self
        /'admin'/.test(body) &&
        /'director'/.test(body) && // see-all roles
        /reports_to\s*=\s*auth\.uid\(\)/i.test(body) // direct-manager relationship
    );
}

describe('pipeline-stats RPC enforces access control (audit H2)', () => {
    const body = twoArgOverloadBody(SQL_DIR);
    const fixtureBody = latestTwoArgBodyFromSources([fs.readFileSync(FIXTURE, 'utf8')]);

    it('the 2-arg overload is defined in a migration', () => {
        expect(body).not.toBeNull();
    });

    it('gates the caller on identity + role + direct-manager relationship', () => {
        expect(body).not.toBeNull();
        expect(hasAuthGuard(body as string)).toBe(true);
    });

    it('preserves the rich JSONB shape the dashboard parses', () => {
        // Repointing the app at the lean 1-arg TABLE overload would drop these.
        expect(body).toMatch(/jsonb_build_object/i);
        expect(body).toMatch(/'totalLeads'/);
        expect(body).toMatch(/'conversionRate'/);
        expect(body).toMatch(/'pipeline'/);
    });

    it('still scopes manager rollups to active direct-report agents', () => {
        expect(body).toMatch(/reports_to\s*=\s*p_user_id/i);
        expect(body).toMatch(/role\s*=\s*'agent'/i);
        expect(body).toMatch(/is_active\s*=\s*true/i);
    });

    // Fail-before / pass-after: the captured pre-fix definition must trip the
    // guard assertion, proving the checks above are not vacuously true.
    it('detects the pre-fix definition as unguarded', () => {
        expect(fixtureBody).not.toBeNull();
        expect(hasAuthGuard(fixtureBody as string)).toBe(false);
    });
});
