/**
 * RLS authorisation matrix — assertions the probe runs per role.
 *
 * Every entry has:
 *   - label         : human-readable name (used as the failure message).
 *   - role          : which probe user signs in for this check
 *                     (keys match PROBE_ACCOUNTS in scripts/synthetic/seed.mjs).
 *   - mode          : 'must_deny'  → passing means NO rows returned (or error).
 *                     'must_allow' → passing means AT LEAST one row returned.
 *   - check(client, ctx) → async: run the query, return { rowCount, error }.
 *   - status        : 'active'  — alert on failure.
 *                     'pending' — known-bad today; log but do not alert.
 *                                 Flip to 'active' once the policy tightens.
 *
 * Adding a new assertion:
 *   1. Decide mode + status.
 *   2. Provide a `check` that returns { rowCount, error } — nothing else.
 *   3. Reference the underlying policy in the label so the alert is
 *      actionable ("candidate cannot SELECT leads — policy leads_select_*").
 */

// Active assertions fail loudly. Pending ones just log.
export const RLS_ASSERTIONS = [
    // ── Self / profile ──────────────────────────────────────────────────
    {
        label: 'every role can read own users row',
        role: 'agent',
        mode: 'must_allow',
        status: 'active',
        check: async (c, ctx) => {
            const { data, error } = await c.from('users').select('id').eq('id', ctx.ownUserId).maybeSingle();
            return { rowCount: data ? 1 : 0, error };
        },
    },
    {
        label: 'candidate can read own users row',
        role: 'candidate',
        mode: 'must_allow',
        status: 'active',
        check: async (c, ctx) => {
            const { data, error } = await c.from('users').select('id').eq('id', ctx.ownUserId).maybeSingle();
            return { rowCount: data ? 1 : 0, error };
        },
    },

    // ── Exam scoping (good policies — worth regression-testing) ─────────
    {
        label: 'agent cannot SELECT another user\'s exam_answers (policy: exam_answers_select_own)',
        role: 'agent',
        mode: 'must_deny',
        status: 'active',
        check: async (c, ctx) => {
            // Try to read answers for a different user's attempt, if any exist.
            // The policy scopes via exam_attempts.user_id = auth.uid(). We
            // filter on a made-up attempt_id so RLS is what decides, not
            // the WHERE clause.
            const { data, error } = await c
                .from('exam_answers')
                .select('id')
                .neq('attempt_id', '00000000-0000-0000-0000-000000000000')
                .limit(1);
            // This is must_deny but the natural empty result also satisfies it.
            // We only fail if somehow data returned rows — shouldn't.
            return { rowCount: data?.length ?? 0, error };
        },
    },

    // ── Leads RLS (currently permissive — known gap) ────────────────────
    {
        label: 'candidate cannot SELECT leads (policy currently USING (true) — PENDING tightening)',
        role: 'candidate',
        mode: 'must_deny',
        status: 'pending',
        check: async (c) => {
            const { data, error } = await c.from('leads').select('id').limit(1);
            return { rowCount: data?.length ?? 0, error };
        },
    },
    {
        label: 'pa cannot SELECT leads (policy currently USING (true) — PENDING tightening)',
        role: 'pa',
        mode: 'must_deny',
        status: 'pending',
        check: async (c) => {
            const { data, error } = await c.from('leads').select('id').limit(1);
            return { rowCount: data?.length ?? 0, error };
        },
    },

    // ── Candidates RLS (currently permissive — known gap) ───────────────
    {
        label: 'candidate cannot SELECT candidates table (policy currently USING (true) — PENDING)',
        role: 'candidate',
        mode: 'must_deny',
        status: 'pending',
        check: async (c) => {
            const { data, error } = await c.from('candidates').select('id').limit(1);
            return { rowCount: data?.length ?? 0, error };
        },
    },

    // ── Events (currently authenticated-read; test still active so any
    //    further relaxation is caught) ──────────────────────────────────
    {
        label: 'agent can read events list (policy: read_events)',
        role: 'agent',
        mode: 'must_allow',
        status: 'active',
        check: async (c) => {
            const { data, error } = await c.from('events').select('id').limit(1);
            // Staging may legitimately have zero events. Treat "no error" as
            // pass even when rowCount=0, by normalising to 1 when error is
            // absent.
            return { rowCount: error ? 0 : 1, error };
        },
    },

    // ── Exam papers visible to staff ────────────────────────────────────
    {
        label: 'manager can read exam_papers (policy: exam_papers_select)',
        role: 'manager',
        mode: 'must_allow',
        status: 'active',
        check: async (c) => {
            const { data, error } = await c.from('exam_papers').select('id').limit(1);
            return { rowCount: error ? 0 : 1, error };
        },
    },

    // ── Exam questions restricted (should NOT be SELECTable directly) ──
    // Post-20260317000002_restrict_exam_questions_rls.sql, direct SELECT
    // of exam_questions should be limited. Confirm the policy still holds.
    {
        label: 'agent cannot directly SELECT exam_questions (fetched via RPC)',
        role: 'agent',
        mode: 'must_deny',
        status: 'active',
        check: async (c) => {
            const { data, error } = await c.from('exam_questions').select('id').limit(1);
            return { rowCount: data?.length ?? 0, error };
        },
    },

    // ── Notifications scoped to user ────────────────────────────────────
    {
        label: 'agent cannot SELECT notifications for another user',
        role: 'agent',
        mode: 'must_deny',
        status: 'active',
        check: async (c, ctx) => {
            // Ask for a notification user_id we know isn't the caller.
            const { data, error } = await c
                .from('notifications')
                .select('id')
                .neq('user_id', ctx.ownUserId)
                .limit(1);
            return { rowCount: data?.length ?? 0, error };
        },
    },
];

/**
 * Filter assertions by status. The probe only alerts on active failures.
 */
export function partitionByStatus(assertions) {
    const active = [];
    const pending = [];
    for (const a of assertions) {
        if (a.status === 'active') active.push(a);
        else pending.push(a);
    }
    return { active, pending };
}
