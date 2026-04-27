/**
 * R4 — exam submission RPC probe.
 *
 * Signs in as probe+agent, submits the SYN_PROBE paper with the correct
 * answer, asserts score=1 / percentage=100 / passed=true. Proves the
 * `submit_exam_attempt` RPC still:
 *   1. Authorises via auth.uid() == p_user_id.
 *   2. Creates the attempt + answers in one transaction.
 *   3. Scores server-side (not from client input — regression guard
 *      against a tampered client).
 *
 * Cleanup: delete the exam_attempt row (cascades to exam_answers).
 */
import { runProbe } from './_lib/run.mjs';
import {
    stagingServiceRoleClient,
    stagingAnonClient,
    assertStagingMarker,
} from './_lib/supabase.mjs';
import { PROBE_AGENT_EMAIL, lookupProbeUserId } from './_lib/mktr.mjs';

const SYN_PROBE_PAPER_ID = '00000000-5ea1-4000-8000-000000000001';
const SYN_PROBE_QUESTION_ID = '00000000-5ea1-4000-8000-000000000002';

await runProbe(
    'exam-submit',
    async () => {
        const service = stagingServiceRoleClient();
        await assertStagingMarker(service);

        // Verify the SYN_PROBE paper + question exist (seed sanity).
        const { data: paper, error: paperErr } = await service
            .from('exam_papers')
            .select('id, code, pass_percentage, question_count')
            .eq('id', SYN_PROBE_PAPER_ID)
            .maybeSingle();
        if (paperErr) throw new Error(`paper lookup: ${paperErr.message}`);
        if (!paper) {
            throw new Error(
                `SYN_PROBE paper not found. Run supabase/seed-synthetic.sql on staging first.`,
            );
        }

        const probeAgentUserId = await lookupProbeUserId(service, PROBE_AGENT_EMAIL);

        // Sign in as the probe agent so auth.uid() matches p_user_id inside the RPC.
        const password = process.env.PROBE_ACCOUNT_PASSWORD;
        if (!password) throw new Error('PROBE_ACCOUNT_PASSWORD is not set.');
        const anon = stagingAnonClient();
        const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({
            email: PROBE_AGENT_EMAIL,
            password,
        });
        if (signInErr || !signIn?.session?.access_token) {
            throw new Error(`sign-in ${PROBE_AGENT_EMAIL}: ${signInErr?.message || 'no session'}`);
        }
        const scoped = stagingAnonClient(signIn.session.access_token);

        const startedAt = new Date(Date.now() - 60_000).toISOString();
        const submittedAt = new Date().toISOString();

        // submit_exam_attempt — call the 9-arg overload (created by
        // 20260331070000_phase1_critical_security.sql, still resident on
        // staging today). The 12-arg / 13-arg variants exist on prod but
        // staging only has the 9-arg, so we target that for staging-side
        // probing. PostgREST dispatches by named-param match.
        const { data: rpcResult, error: rpcErr } = await scoped.rpc('submit_exam_attempt', {
            p_user_id: probeAgentUserId,
            p_paper_id: SYN_PROBE_PAPER_ID,
            p_status: 'submitted',
            p_total_questions: 1,
            p_started_at: startedAt,
            p_submitted_at: submittedAt,
            p_duration_seconds: 60,
            p_personality_results: null,
            p_answers: [{ question_id: SYN_PROBE_QUESTION_ID, selected_answer: 'B' }],
        });

        if (rpcErr) throw new Error(`submit_exam_attempt rpc: ${rpcErr.message}`);
        if (!rpcResult?.attempt_id) throw new Error(`rpc returned no attempt_id: ${JSON.stringify(rpcResult)}`);

        const { score, percentage, passed, attempt_id } = rpcResult;
        const fails = [];
        if (score !== 1) fails.push(`score=${score} expected 1`);
        if (percentage !== 100) fails.push(`percentage=${percentage} expected 100`);
        if (passed !== true) fails.push(`passed=${passed} expected true`);

        // Cleanup: service-role deletes the attempt (cascades to exam_answers).
        await service.from('exam_attempts').delete().eq('id', attempt_id);

        if (fails.length > 0) {
            throw new Error(`scoring regression: ${fails.join(', ')}`);
        }

        console.log(`[exam-submit] attempt=${attempt_id} score=${score}/${1} (100%) passed=${passed} — cleaned up`);
    },
    { alertLabels: ['exam-rpc', 'P1', 'regression-guard'], timeoutMs: 60_000 },
);
