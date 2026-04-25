/**
 * R1a — MKTR `lead.created` webhook probe.
 *
 * Signs + POSTs a synthetic lead.created payload to staging's
 * receive-mktr-lead edge function, asserts the full downstream chain
 * (leads row + lead_activities row + notifications row), then cleans up.
 *
 * Self-heals any orphans from a previous failed run at both start and end.
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
    'mktr-lead-created',
    async () => {
        const client = stagingServiceRoleClient();
        await assertStagingMarker(client);

        // Self-heal before writing.
        const preCleanup = await cleanupSyntheticLeads(client);
        if (preCleanup > 0) console.log(`[mktr-lead-created] self-healed ${preCleanup} orphan lead(s)`);

        const agentId = await lookupProbeUserId(client, PROBE_AGENT_EMAIL);
        const externalId = makeExternalId('created');

        const { status, body } = await postSignedWebhook({
            url: receiveMktrLeadUrl(),
            payload: buildPayload({ event: 'lead.created', externalId, agentId }),
            secret: process.env.MKTR_WEBHOOK_SECRET_STAGING,
        });

        if (status !== 200) {
            throw new Error(`edge fn returned ${status}: ${JSON.stringify(body).slice(0, 500)}`);
        }
        if (!body.success || !body.leadId) {
            throw new Error(`edge fn did not ack success: ${JSON.stringify(body).slice(0, 500)}`);
        }

        const leadId = body.leadId;

        // Assert the lead row.
        const { data: lead, error: leadErr } = await client
            .from('leads')
            .select('id, status, assigned_to, source_name, external_id')
            .eq('id', leadId)
            .single();
        if (leadErr || !lead) throw new Error(`lead ${leadId} not found after insert: ${leadErr?.message}`);
        if (lead.source_name !== 'mktr') throw new Error(`expected source_name=mktr, got ${lead.source_name}`);
        if (lead.assigned_to !== agentId)
            throw new Error(`expected assigned_to=probe agent, got ${lead.assigned_to}`);
        if (lead.status !== 'new') throw new Error(`expected status=new, got ${lead.status}`);

        // Assert the activity row.
        const { data: activities } = await client
            .from('lead_activities')
            .select('type')
            .eq('lead_id', leadId);
        if (!activities?.some((a) => a.type === 'created')) {
            throw new Error(`no 'created' activity logged for lead ${leadId}`);
        }

        // Assert a notification was queued for the agent.
        const { data: notifs } = await client
            .from('notifications')
            .select('id, type, title')
            .eq('user_id', agentId)
            .eq('type', 'new_lead')
            .filter('data->>leadId', 'eq', leadId);
        if (!notifs?.length) throw new Error(`no new_lead notification queued for lead ${leadId}`);

        console.log(`[mktr-lead-created] leadId=${leadId} agent=${agentId.slice(0, 8)}… all downstream rows present`);

        // Cleanup.
        await cleanupSyntheticLeads(client);
    },
    { alertLabels: ['mktr', 'P1'] },
);
