/**
 * R5 — mktr-agents endpoint probe.
 *
 * Calls GET /functions/v1/mktr-agents with the staging MKTR API key. Asserts:
 *   1. Returns 200.
 *   2. Payload has agents array with ≥1 entry.
 *   3. Each returned phone is masked (contains '****') — regression guard
 *      against an accidental unmasked-phone change leaking staff phone
 *      numbers to MKTR.
 */
import { runProbe } from './_lib/run.mjs';
import { stagingServiceRoleClient, assertStagingMarker } from './_lib/supabase.mjs';
import { guardedFetch } from './_lib/env.mjs';

await runProbe(
    'mktr-agents',
    async () => {
        const client = stagingServiceRoleClient();
        await assertStagingMarker(client);

        const apiKey = process.env.MKTR_API_KEY_STAGING;
        if (!apiKey) throw new Error('MKTR_API_KEY_STAGING is not set.');

        const res = await guardedFetch(`${process.env.STAGING_SUPABASE_URL}/functions/v1/mktr-agents`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${apiKey}` },
        });

        if (res.status !== 200) {
            const txt = await res.text().catch(() => '');
            throw new Error(`expected 200, got ${res.status}: ${txt.slice(0, 400)}`);
        }

        const body = await res.json();
        if (!Array.isArray(body?.agents)) {
            throw new Error(`expected body.agents to be an array, got ${JSON.stringify(body).slice(0, 200)}`);
        }
        if (body.agents.length === 0) {
            throw new Error('expected at least 1 agent, got 0');
        }

        // Regression guard: phones must be masked (format: NNN****NNNN).
        for (const agent of body.agents) {
            if (!agent.phone) continue; // masked-null is fine
            if (!agent.phone.includes('****')) {
                throw new Error(
                    `phone leakage on agent id=${agent.id?.slice(0, 8) ?? 'unknown'}: expected masked, got a non-masked phone`,
                );
            }
        }

        console.log(`[mktr-agents] ${body.agents.length} agents returned, all phones masked`);
    },
    { alertLabels: ['mktr', 'P2'] },
);
