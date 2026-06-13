/**
 * leads hard-DELETE access control (audit H5).
 *
 * The H5 incident: public.leads carried TWO PERMISSIVE DELETE policies for the
 * `authenticated` role — deny_delete_leads USING(false) (created by
 * 20260331080000_phase2_high_severity.sql, intent: leads are non-deletable to
 * preserve the audit trail) AND a Dashboard-created, prod-only leads_delete
 * USING(can_access_lead(assigned_to, created_by)) that lives in NO migration.
 * PostgreSQL OR-combines permissive policies for the same command, so the
 * effective DELETE filter was `false OR can_access_lead(...)` = can_access_lead,
 * and the deny was dead. Reproduced live before the fix (rolled-back
 * impersonation, role='agent'): a plain agent could hard-delete a lead it is
 * assigned to.
 *
 * This suite statically replays every CREATE/DROP POLICY touching the leads
 * DELETE surface across the committed migration chain and asserts the end state
 * has NO surviving permissive allow policy — only the deny (USING false)
 * remains, so no authenticated user can pass it. To prove the check
 * discriminates (fail-before / pass-after), the same logic runs against the
 * captured prod pre-fix DDL in __fixtures__/leads-delete-vulnerable.sql and must
 * flag the surviving leads_delete allow policy. The end-to-end behavioral proof
 * (agent DELETE denied after the fix, allowed before; service-role cascade
 * still works) was run live via the Supabase MCP and lives in
 * scripts/verify-leads-delete-rls.sh (needs PostgreSQL 17, so it is not part of
 * the Jest run).
 *
 * Set SQL_DIR to point the suite at an alternate SQL directory (used to prove
 * the suite fails against the pre-fix tree, e.g.
 * SQL_DIR=__tests__/supabase/__fixtures__).
 */
import * as fs from 'fs';
import * as path from 'path';

const SQL_DIR = process.env.SQL_DIR ?? path.join(__dirname, '..', '..', 'supabase', 'migrations');
const FIXTURE = path.join(__dirname, '__fixtures__', 'leads-delete-vulnerable.sql');

function sqlSources(dir: string): string[] {
    return fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.sql'))
        .sort()
        .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'));
}

/** Drop SQL comments so example DDL inside -- ROLLBACK notes is never parsed. */
function stripSqlComments(sql: string): string {
    return sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
}

type DeleteState = 'deny' | 'allow' | 'dropped';

/**
 * Replay every CREATE/DROP POLICY for a FOR DELETE policy on public.leads (the
 * migrations reference the table both as `leads` and `public.leads`) in version
 * order and return each DELETE policy name's final state:
 *   "deny"    — a surviving FOR DELETE policy whose USING is literally (false);
 *   "allow"   — a surviving FOR DELETE policy whose USING is anything else (it
 *               OR-combines with the deny and re-permits the delete);
 *   "dropped" — its last action was a DROP POLICY.
 * None of these policy bodies contain a literal `;`, so splitting on `;` is safe.
 */
function leadsDeletePolicyState(sources: string[]): Map<string, DeleteState> {
    const state = new Map<string, DeleteState>();
    for (const sql of sources) {
        for (const raw of stripSqlComments(sql).split(';')) {
            const stmt = raw.trim();
            if (!stmt) continue;
            const create = stmt.match(/create\s+policy\s+("[^"]+"|\w+)\s+on\s+(?:public\.)?leads\b/i);
            if (create && /\bfor\s+delete\b/i.test(stmt)) {
                const name = create[1].replace(/"/g, '').toLowerCase();
                state.set(name, /using\s*\(\s*false\s*\)/i.test(stmt) ? 'deny' : 'allow');
                continue;
            }
            const drop = stmt.match(/drop\s+policy\s+(?:if\s+exists\s+)?("[^"]+"|\w+)\s+on\s+(?:public\.)?leads\b/i);
            if (drop) {
                state.set(drop[1].replace(/"/g, '').toLowerCase(), 'dropped');
            }
        }
    }
    return state;
}

const namesInState = (sources: string[], want: DeleteState): string[] =>
    Array.from(leadsDeletePolicyState(sources).entries())
        .filter(([, s]) => s === want)
        .map(([n]) => n);

describe('leads hard-DELETE leaves no permissive allow policy (audit H5)', () => {
    const sources = sqlSources(SQL_DIR);
    const joined = stripSqlComments(sources.join('\n'));

    it('a migration drops the prod-only leads_delete allow policy', () => {
        expect(joined).toMatch(/drop\s+policy\s+if\s+exists\s+leads_delete\s+on\s+public\.leads/i);
    });

    it('leaves NO surviving permissive allow DELETE policy on leads', () => {
        expect(namesInState(sources, 'allow')).toEqual([]);
    });

    it('keeps deny_delete_leads (USING false) as the sole surviving DELETE policy', () => {
        expect(namesInState(sources, 'deny')).toEqual(['deny_delete_leads']);
    });

    // Fail-before / pass-after: the captured prod pre-fix DDL must read as
    // vulnerable (a surviving allow policy alongside the deny), proving the
    // deny-only assertions above are not vacuously true.
    describe('pre-fix fixture (prod drift) is detected as vulnerable', () => {
        const fixture = [fs.readFileSync(FIXTURE, 'utf8')];

        it('surfaces leads_delete as a surviving allow DELETE policy', () => {
            expect(namesInState(fixture, 'allow')).toContain('leads_delete');
        });

        it('shows the deny is OR-neutralised (a deny and an allow coexist)', () => {
            expect(namesInState(fixture, 'deny')).toContain('deny_delete_leads');
            expect(namesInState(fixture, 'allow').length).toBeGreaterThan(0);
        });
    });
});
