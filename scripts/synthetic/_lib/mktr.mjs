/**
 * Shared helpers for R1 MKTR webhook probes.
 *
 * The shape of the webhook payload must match what the edge function at
 * supabase/functions/receive-mktr-lead/index.ts parses. If that function's
 * expected fields change, update buildPayload() to match.
 */
import { randomUUID } from 'node:crypto';
import { guardedFetch } from './env.mjs';
import { signHmacSha256, nowTimestampHeader } from './hmac.mjs';

export const PROBE_AGENT_EMAIL = 'probe+agent@lyfe.sg';
export const PROBE_AGENT2_EMAIL = 'probe+agent2@lyfe.sg';

/**
 * Look up a seeded probe user by email. Throws with a clear "did you run
 * seed.mjs?" hint so a freshly-wiped staging database is easy to diagnose.
 */
export async function lookupProbeUserId(client, email) {
    const { data, error } = await client.from('users').select('id, is_active, role').eq('email', email).maybeSingle();
    if (error) throw new Error(`[mktr] lookup ${email}: ${error.message}`);
    if (!data)
        throw new Error(
            `[mktr] ${email} not found in public.users. Run \`npm run seed\` in scripts/synthetic/ on staging first.`,
        );
    if (!data.is_active) throw new Error(`[mktr] ${email} is_active=false. Re-activate or re-seed.`);
    return data.id;
}

/**
 * Unique external_id for a probe-generated lead. Prefix is the cleanup key
 * in cleanup_synthetic_leads() — do not change without updating the SQL fn.
 */
export function makeExternalId(tag) {
    return `SYN-${tag}-${randomUUID()}`;
}

/**
 * Build a payload matching the receive-mktr-lead edge function's expected
 * shape. Fields mirror mktr-platform/backend/src/services/prospectHelpers.js.
 */
export function buildPayload({ event, externalId, agentId, agentPhone, previousAgentId, agentName }) {
    const base = {
        event,
        deliveryId: `syn-${randomUUID()}`,
        data: {
            lead: {
                externalId,
                firstName: 'Probe',
                lastName: 'Synthetic',
                phone: '+6580000999',
                email: 'synthetic-lead@example.com',
                company: 'Synthetic Corp',
                jobTitle: 'QA Probe',
            },
            routing: {
                mode: 'synthetic',
                agentName: agentName || 'Probe Agent',
            },
            campaign: { name: 'SyntheticProbe' },
            qrTag: null,
        },
    };
    if (agentId) base.data.routing.agentExternalId = agentId;
    if (agentPhone) base.data.routing.agentPhone = agentPhone;
    if (event === 'lead.unassigned') {
        base.data.previousAgentId = previousAgentId;
    }
    return base;
}

/**
 * Sign + POST the payload to the receive-mktr-lead edge function. Returns
 * { status, body }. The edge function's signature format is documented at
 * supabase/functions/receive-mktr-lead/index.ts:56-70.
 */
export async function postSignedWebhook({ url, payload, secret }) {
    if (!secret) throw new Error('[mktr] MKTR_WEBHOOK_SECRET_STAGING is not set.');
    const rawBody = JSON.stringify(payload);
    const res = await guardedFetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signHmacSha256(rawBody, secret),
            'X-Webhook-Timestamp': nowTimestampHeader(),
        },
        body: rawBody,
    });
    let body = {};
    try {
        body = await res.json();
    } catch {
        // non-JSON response body; leave body={}
    }
    return { status: res.status, body };
}

export function receiveMktrLeadUrl() {
    return `${process.env.STAGING_SUPABASE_URL}/functions/v1/receive-mktr-lead`;
}

/**
 * Self-heal any orphaned SYN-* leads. Called at start + end of every R1
 * probe. If the previous run crashed mid-flight, the next run cleans up.
 */
export async function cleanupSyntheticLeads(client) {
    const { data, error } = await client.rpc('cleanup_synthetic_leads');
    if (error) throw new Error(`[mktr] cleanup_synthetic_leads: ${error.message}`);
    return typeof data === 'number' ? data : 0;
}
