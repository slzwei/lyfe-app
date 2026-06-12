/**
 * Lead-mutation RPC authorization guard (audit H1).
 *
 * The H1 incident: assign_lead_with_activity() and
 * update_lead_status_with_activity() are SECURITY DEFINER (they bypass RLS)
 * but only checked auth.uid() == the acting-user argument — never the caller's
 * relationship to the lead. Any authenticated user, including a trainee
 * candidate, could reassign or change the status of ANY lead.
 *
 * This suite statically asserts the committed migration re-defines both
 * functions WITH a can_access_lead(...) gate (and, for reassignment, a
 * manager-and-above role gate), so a future edit that weakens the check fails
 * loudly. The end-to-end behavioral proof lives in
 * scripts/verify-lead-rpc-authz.sh (needs PostgreSQL 17, so it is not part of
 * the Jest run).
 *
 * Set SQL_DIR to point the suite at an alternate SQL directory (used to prove
 * the suite fails against the pre-fix definitions).
 */
import * as fs from 'fs';
import * as path from 'path';

const SQL_DIR = process.env.SQL_DIR ?? path.join(__dirname, '..', '..', 'supabase', 'migrations');

/** Body of the LAST `CREATE OR REPLACE FUNCTION <name>` across all .sql files, in version order. */
function latestFunctionBody(fnName: string): string | null {
    const files = fs
        .readdirSync(SQL_DIR)
        .filter((f) => f.endsWith('.sql'))
        .sort();
    let body: string | null = null;
    const headerRe = new RegExp(String.raw`create\s+or\s+replace\s+function\s+(?:public\.)?${fnName}\b`, 'gi');
    for (const file of files) {
        const sql = fs.readFileSync(path.join(SQL_DIR, file), 'utf8');
        let m: RegExpExecArray | null;
        headerRe.lastIndex = 0;
        while ((m = headerRe.exec(sql))) {
            const rest = sql.slice(m.index);
            // Find the dollar-quote tag that opens the body: `AS $tag$`.
            const dq = /\bas\s+(\$[a-z_]*\$)/i.exec(rest);
            if (!dq) continue;
            const tag = dq[1];
            const start = rest.indexOf(tag, dq.index) + tag.length;
            const end = rest.indexOf(tag, start);
            if (end === -1) continue;
            body = rest.slice(start, end); // later files overwrite — last wins
        }
    }
    return body;
}

describe('lead-mutation RPCs enforce access control (audit H1)', () => {
    const assignBody = latestFunctionBody('assign_lead_with_activity');
    const statusBody = latestFunctionBody('update_lead_status_with_activity');

    it('both RPCs are defined in a migration', () => {
        expect(assignBody).not.toBeNull();
        expect(statusBody).not.toBeNull();
    });

    describe('assign_lead_with_activity (reassignment)', () => {
        it('retains the acting-user identity guard', () => {
            expect(assignBody).toMatch(/auth\.uid\(\)\s+is\s+null/i);
            expect(assignBody).toMatch(/auth\.uid\(\)\s*!=\s*p_acting_user_id/i);
        });

        it('gates on can_access_lead using the lead’s stored ownership', () => {
            // Must read the lead row (not trust client args) and feed can_access_lead.
            expect(assignBody).toMatch(/select[\s\S]*\bcreated_by\b[\s\S]*from\s+leads/i);
            expect(assignBody).toMatch(/\bif\s+not\s+can_access_lead\s*\(/i);
        });

        it('requires the reassign_leads capability (manager / director / admin)', () => {
            expect(assignBody).toMatch(/'admin'/);
            expect(assignBody).toMatch(/'director'/);
            expect(assignBody).toMatch(/'manager'/);
            // The role list is a denial gate, not an allow-everyone read.
            expect(assignBody).toMatch(/not\s+in\s*\(/i);
        });
    });

    describe('update_lead_status_with_activity (status change)', () => {
        it('retains the acting-user identity guard', () => {
            expect(statusBody).toMatch(/auth\.uid\(\)\s+is\s+null/i);
            expect(statusBody).toMatch(/auth\.uid\(\)\s*!=\s*p_user_id/i);
        });

        it('gates on can_access_lead using the lead’s stored ownership', () => {
            expect(statusBody).toMatch(/select[\s\S]*\bcreated_by\b[\s\S]*from\s+leads/i);
            expect(statusBody).toMatch(/\bif\s+not\s+can_access_lead\s*\(/i);
        });
    });
});
