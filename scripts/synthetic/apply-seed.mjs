/**
 * One-shot Node seeder for synthetic monitoring on staging.
 *
 * Equivalent to applying supabase/seed-synthetic.sql, but runs through
 * supabase-js + service role instead of psql. Skips the pg_cron schedule
 * for sweep_synthetic_invariants — that gets enabled separately when R6
 * goes live (call schedule_synthetic_invariants_cron via SQL editor).
 *
 * Inserts (idempotent — re-running is safe):
 *   - synthetic_env_marker row (env='staging')
 *   - SYN_PROBE exam paper
 *   - SYN_PROBE exam question (correct answer = B)
 */
import { stagingServiceRoleClient, assertStagingMarker } from './_lib/supabase.mjs';
import { guardStaging } from './_lib/env.mjs';

const SYN_PROBE_PAPER_ID = '00000000-5ea1-4000-8000-000000000001';
const SYN_PROBE_QUESTION_ID = '00000000-5ea1-4000-8000-000000000002';

async function main() {
    guardStaging();
    const client = stagingServiceRoleClient();

    // 1. Marker — must succeed BEFORE everything else
    const { error: markerErr } = await client
        .from('synthetic_env_marker')
        .upsert({ env: 'staging' }, { onConflict: 'env' });
    if (markerErr) throw new Error(`marker upsert: ${markerErr.message}`);
    console.log("[seed] marker env='staging' upserted");

    // 2. Verify marker is now visible (assert post-insert).
    await assertStagingMarker(client);
    console.log('[seed] marker assertion passes');

    // 3. SYN_PROBE exam paper
    const { error: paperErr } = await client.from('exam_papers').upsert(
        {
            id: SYN_PROBE_PAPER_ID,
            code: 'SYN_PROBE',
            title: 'Synthetic monitoring probe paper (do not display)',
            duration_minutes: 60,
            pass_percentage: 70,
            question_count: 1,
            is_active: false,
            is_mandatory: false,
            display_order: 9999,
        },
        { onConflict: 'id' },
    );
    if (paperErr) throw new Error(`exam_papers upsert: ${paperErr.message}`);
    console.log('[seed] SYN_PROBE paper upserted');

    // 4. SYN_PROBE question
    const { error: qErr } = await client.from('exam_questions').upsert(
        {
            id: SYN_PROBE_QUESTION_ID,
            paper_id: SYN_PROBE_PAPER_ID,
            question_number: 1,
            question_text: 'Synthetic probe: answer is always B.',
            options: { A: 'Wrong', B: 'Correct', C: 'Wrong', D: 'Wrong' },
            correct_answer: 'B',
        },
        { onConflict: 'id' },
    );
    if (qErr) throw new Error(`exam_questions upsert: ${qErr.message}`);
    console.log('[seed] SYN_PROBE question upserted');

    console.log('[seed] done.');
}

main().catch((err) => {
    console.error('[seed] fatal:', err);
    process.exit(1);
});
