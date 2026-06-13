/**
 * Realtime publication coverage guard (audit H6).
 *
 * The H6 incident: NotificationContext + useRoadshowRealtime subscribe to
 * Supabase `postgres_changes` on `notifications`, `roadshow_activities`, and
 * `roadshow_attendance`, but none of those tables were ever added to the
 * `supabase_realtime` publication. Without publication membership Postgres
 * streams no WAL changes for a table to the Realtime server, so the client
 * subscription silently receives zero events — the unread badge never moved on
 * its own and the live roadshow leaderboard froze until a manual refresh.
 *
 * This suite derives the set of tables the app subscribes to (by scanning the
 * source for `postgres_changes` + `table: '...'`) and asserts that a migration
 * adds every one of them to the `supabase_realtime` publication. It fails the
 * moment a realtime subscription is wired up against a table the migration
 * chain never publishes — the exact root cause of H6.
 *
 * Set MIGRATIONS_DIR / SOURCE_DIR to point the suite at alternate trees.
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.join(__dirname, '..', '..');
const MIGRATIONS_DIR = process.env.MIGRATIONS_DIR ?? path.join(REPO_ROOT, 'supabase', 'migrations');
const SOURCE_DIR = process.env.SOURCE_DIR ?? REPO_ROOT;

/** Dirs that hold realtime subscriptions; keeps the scan fast + focused. */
const SOURCE_SUBDIRS = ['hooks', 'contexts', 'components', 'app', 'lib'];

function stripComments(src: string): string {
    return src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

function walk(dir: string, acc: string[] = []): string[] {
    if (!fs.existsSync(dir)) return acc;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
            walk(full, acc);
        } else if (/\.(ts|tsx)$/.test(entry.name)) {
            acc.push(full);
        }
    }
    return acc;
}

/** Tables the app subscribes to via supabase `postgres_changes`. */
function collectSubscribedTables(): Map<string, string> {
    const subscribed = new Map<string, string>(); // table -> first file it appears in
    for (const subdir of SOURCE_SUBDIRS) {
        for (const file of walk(path.join(SOURCE_DIR, subdir))) {
            const src = stripComments(fs.readFileSync(file, 'utf8'));
            if (!src.includes('postgres_changes')) continue;
            // Each postgres_changes listener carries exactly one `table: '...'`;
            // lazily grab the nearest one after each subscription.
            for (const m of src.matchAll(/postgres_changes'[\s\S]*?table:\s*'([a-z_]+)'/g)) {
                const t = m[1];
                if (!subscribed.has(t)) subscribed.set(t, path.relative(REPO_ROOT, file));
            }
        }
    }
    return subscribed;
}

/** Tables added to the supabase_realtime publication by the migration chain. */
function collectPublishedTables(): Set<string> {
    const published = new Set<string>();
    const files = fs
        .readdirSync(MIGRATIONS_DIR)
        .filter((f) => f.endsWith('.sql'))
        .sort();
    for (const file of files) {
        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8').replace(/--[^\n]*/g, '');
        for (const m of sql.matchAll(/alter\s+publication\s+supabase_realtime\s+add\s+table\s+([^;]+);/gi)) {
            for (const rawName of m[1].split(',')) {
                const t = rawName
                    .replace(/"/g, '')
                    .trim()
                    .toLowerCase()
                    .replace(/^public\./, '');
                if (t) published.add(t);
            }
        }
    }
    return published;
}

describe('supabase realtime — every subscribed table is in the publication (audit H6)', () => {
    const subscribed = collectSubscribedTables();
    const published = collectPublishedTables();

    it('discovers the app realtime subscriptions (guards against regex rot)', () => {
        // If the scan ever stops finding these known subscriptions, the coverage
        // assertion below would pass vacuously — fail loudly instead.
        for (const t of ['leads', 'progress_signals', 'notifications', 'roadshow_activities', 'roadshow_attendance']) {
            expect([...subscribed.keys()]).toContain(t);
        }
    });

    it('every postgres_changes-subscribed table is added to supabase_realtime by a migration', () => {
        const missing: string[] = [];
        for (const [table, file] of subscribed) {
            if (!published.has(table)) {
                missing.push(
                    `"${table}" is subscribed via postgres_changes (${file}) but no migration adds it to the supabase_realtime publication — the subscription receives zero events`,
                );
            }
        }
        expect(missing).toEqual([]);
    });
});
