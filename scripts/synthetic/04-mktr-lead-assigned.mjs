/**
 * R1b — MKTR `lead.assigned` webhook probe.
 *
 * Creates a lead via lead.created, then reassigns it to a second agent via
 * lead.assigned. Asserts the new assigned_to and the reassignment activity.
 */
import { runProbe } from './_lib/run.mjs';
import { stagingServiceRoleClient, assertStagingMarker } from './_lib/supabase.mjs';
import {
    PROBE_AGENT_EMAIL,
    PROBE_AGENT2_EMAIL,
    buildPayload,
    cleanupSyntheticLeads,
    lookupProbeUserId,
    makeExternalId,
    postSignedWebhook,
    receiveMktrLeadUrl,
} from './_lib/mktr.mjs';

await runProbe(
    'mktr-lead-assigned',
    async () => {
        const client = stagingServiceRoleClient();
        await assertStagingMarker(client);

        const preCleanup = await cleanupSyntheticLeads(client);
        if (preCleanup > 0) console.log(`[mktr-lead-assigned] self-healed ${preCleanup} orphan lead(s)`);

        const agent1Id = await lookupProbeUserId(client, PROBE_AGENT_EMAIL);
        const agent2Id = await lookupProbeUserId(client, PROBE_AGENT2_EMAIL);
        const externalId = makeExternalId('assigned');

        // Step 1: create the lead on agent 1.
        const createRes = await postSignedWebhook({
            url: receiveMktrLeadUrl(),
            payload: buildPayload({ event: 'lead.created', externalId, agentId: agent1Id }),
            secret: process.env.MKTR_WEBHOOK_SECRET_STAGING,
        });
        if (createRes.status !== 200 || !createRes.body.leadId) {
            throw new Error(`create step failed: ${createRes.status} ${JSON.stringify(createRes.body).slice(0, 400)}`);
        }
        const leadId = createRes.body.leadId;

        // Step 2: reassign to agent 2.
        const assignRes = await postSignedWebhook({
            url: receiveMktrLeadUrl(),
            payload: buildPayload({ event: 'lead.assigned', externalId, agentId: agent2Id }),
            secret: process.env.MKTR_WEBHOOK_SECRET_STAGING,
        });
        if (assignRes.status !== 200) {
            throw new Error(`assign step failed: ${assignRes.status} ${JSON.stringify(assignRes.body).slice(0, 400)}`);
        }
        if (!assignRes.body.reassigned) {
            throw new Error(`expected reassigned=true, got ${JSON.stringify(assignRes.body)}`);
        }

        // Assert assigned_to flipped.
        const { data: lead } = await client.from('leads').select('assigned_to').eq('id', leadId).single();
        if (!lead) throw new Error(`lead ${leadId} gone after reassign`);
        if (lead.assigned_to !== agent2Id) {
            throw new Error(`expected assigned_to=${agent2Id.slice(0, 8)}…, got ${lead.assigned_to}`);
        }

        // Assert a reassignment activity was logged.
        const { data: activities } = await client
            .from('lead_activities')
            .select('type, user_id')
            .eq('lead_id', leadId);
        if (!activities?.some((a) => a.type === 'reassignment' && a.user_id === agent2Id)) {
            throw new Error(`no 'reassignment' activity attributed to agent2`);
        }

        console.log(`[mktr-lead-assigned] reassigned ${leadId} to ${agent2Id.slice(0, 8)}… OK`);

        await cleanupSyntheticLeads(client);
    },
    { alertLabels: ['mktr', 'P1'] },
);
