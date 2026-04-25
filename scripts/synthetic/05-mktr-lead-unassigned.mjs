/**
 * R1c — MKTR `lead.unassigned` webhook probe.
 *
 * This is the probe for MKTR TRACKER B2 — the known bug where unassign used
 * to DELETE the lead instead of nulling the assignment. We create a lead
 * via lead.created, unassign via lead.unassigned, then assert:
 *   1. The lead ROW STILL EXISTS (regression guard against B2).
 *   2. lead.assigned_to IS NULL.
 *   3. An unassignment activity was logged.
 */
import { runProbe } from './_lib/run.mjs';
import { stagingServiceRoleClient, assertStagingMarker } from './_lib/supabase.mjs';
import {
    PROBE_AGENT_EMAIL,
    buildPayload,
    cleanupSyntheticLeads,
    lookupProbeUserId,
    makeExternalId,
    postSignedWebhook,
    receiveMktrLeadUrl,
} from './_lib/mktr.mjs';

await runProbe(
    'mktr-lead-unassigned',
    async () => {
        const client = stagingServiceRoleClient();
        await assertStagingMarker(client);

        const preCleanup = await cleanupSyntheticLeads(client);
        if (preCleanup > 0) console.log(`[mktr-lead-unassigned] self-healed ${preCleanup} orphan lead(s)`);

        const agentId = await lookupProbeUserId(client, PROBE_AGENT_EMAIL);
        const externalId = makeExternalId('unassigned');

        // Step 1: create.
        const createRes = await postSignedWebhook({
            url: receiveMktrLeadUrl(),
            payload: buildPayload({ event: 'lead.created', externalId, agentId }),
            secret: process.env.MKTR_WEBHOOK_SECRET_STAGING,
        });
        if (createRes.status !== 200 || !createRes.body.leadId) {
            throw new Error(`create step failed: ${createRes.status} ${JSON.stringify(createRes.body).slice(0, 400)}`);
        }
        const leadId = createRes.body.leadId;

        // Step 2: unassign.
        const unassignRes = await postSignedWebhook({
            url: receiveMktrLeadUrl(),
            payload: buildPayload({ event: 'lead.unassigned', externalId, previousAgentId: agentId }),
            secret: process.env.MKTR_WEBHOOK_SECRET_STAGING,
        });
        if (unassignRes.status !== 200) {
            throw new Error(
                `unassign step failed: ${unassignRes.status} ${JSON.stringify(unassignRes.body).slice(0, 400)}`,
            );
        }

        // Regression guard for MKTR B2: the lead must still exist.
        const { data: lead } = await client
            .from('leads')
            .select('id, assigned_to')
            .eq('id', leadId)
            .maybeSingle();
        if (!lead) {
            throw new Error(
                `REGRESSION of MKTR TRACKER B2: lead ${leadId} was DELETED by lead.unassigned instead of having assigned_to nulled.`,
            );
        }
        if (lead.assigned_to !== null) {
            throw new Error(`expected assigned_to=null after unassign, got ${lead.assigned_to}`);
        }

        // Assert an unassignment activity was logged.
        const { data: activities } = await client
            .from('lead_activities')
            .select('type')
            .eq('lead_id', leadId);
        if (!activities?.some((a) => a.type === 'unassignment')) {
            throw new Error(`no 'unassignment' activity logged for lead ${leadId}`);
        }

        console.log(`[mktr-lead-unassigned] ${leadId} assigned_to=null, activity logged OK`);

        await cleanupSyntheticLeads(client);
    },
    { alertLabels: ['mktr', 'P1', 'regression-guard'] },
);
