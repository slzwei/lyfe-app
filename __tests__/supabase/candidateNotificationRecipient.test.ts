/**
 * Candidate notification-recipient guard (candidate audit #33).
 *
 * The bug: the two candidate-targeted notification triggers inserted
 * notifications.user_id = NEW.candidate_id directly via notify_insert(). But
 * notifications.user_id has an FK to users(id), and
 * candidate_programme_enrollment.candidate_id is a candidates.id — so
 * trigger_notify_roadmap_unlocked raised 23503 (notifications_user_id_fkey) and
 * rolled back the manager's manual programme unlock (verified live 2026-07-04).
 * trigger_notify_module_completed was FK-safe only by accident
 * (candidate_module_progress.candidate_id is still a users.id in prod, despite
 * the migration comment claiming candidates.id — see the cmp/cmip FK-drift item)
 * and would break the moment that drift is reconciled.
 *
 * Fix: both triggers resolve the recipient to a real users.id via
 * resolve_candidate_notify_user(), which accepts either id shape and returns
 * NULL (→ skip) when the candidate has no linked active auth user.
 *
 * This suite derives the EFFECTIVE (last-defined) body of each trigger function
 * from the migration chain and asserts it routes through the resolver and no
 * longer targets NEW.candidate_id directly. It fails against the pre-fix tree.
 *
 * Set MIGRATIONS_DIR to point the suite at an alternate tree.
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.join(__dirname, '..', '..');
const MIGRATIONS_DIR = process.env.MIGRATIONS_DIR ?? path.join(REPO_ROOT, 'supabase', 'migrations');

/** Concatenated migration SQL, in version (filename) order. */
function migrationsInOrder(): string[] {
    return fs
        .readdirSync(MIGRATIONS_DIR)
        .filter((f) => f.endsWith('.sql'))
        .sort()
        .map((f) => fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8'));
}

/**
 * Return the body of the LAST `CREATE [OR REPLACE] FUNCTION <name>(...)` in the
 * chain — i.e. the definition that actually takes effect after every migration
 * has replayed. Body = from the function header to its closing `$$;`.
 */
function lastFunctionBody(fnName: string): string | null {
    const all = migrationsInOrder().join('\n');
    const re = new RegExp(`CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+(?:public\\.)?${fnName}\\s*\\(`, 'g');
    let lastStart = -1;
    for (let m = re.exec(all); m; m = re.exec(all)) lastStart = m.index;
    if (lastStart === -1) return null;
    const end = all.indexOf('$$;', lastStart);
    return all.slice(lastStart, end === -1 ? undefined : end);
}

describe('candidate notification triggers resolve a valid users.id (audit #33)', () => {
    it('defines the resolve_candidate_notify_user() helper', () => {
        expect(lastFunctionBody('resolve_candidate_notify_user')).not.toBeNull();
    });

    for (const fn of ['trigger_notify_module_completed', 'trigger_notify_roadmap_unlocked']) {
        describe(fn, () => {
            const body = lastFunctionBody(fn);

            it('exists in the migration chain', () => {
                expect(body).not.toBeNull();
            });

            it('routes the notification recipient through resolve_candidate_notify_user()', () => {
                expect(body).toContain('resolve_candidate_notify_user(NEW.candidate_id)');
            });

            it('never inserts notifications keyed directly on NEW.candidate_id', () => {
                // notify_insert(NEW.candidate_id, ...) is the pre-fix FK-violating call.
                expect(body).not.toMatch(/notify_insert\(\s*NEW\.candidate_id/);
            });
        });
    }
});
