import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// NOTE: CORS headers retained for admin dashboard compatibility. This endpoint
// primarily serves as a machine-to-machine webhook (HMAC-authenticated).
const allowedOrigin = Deno.env.get('ADMIN_ORIGIN') || 'https://admin.lyfe.app';

const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers':
        'authorization, x-client-info, apikey, content-type, x-webhook-event, x-webhook-delivery-id, x-webhook-signature, x-webhook-timestamp',
};

function maskPhone(phone: string): string {
    if (phone.length < 7) return '***';
    return phone.slice(0, 3) + '****' + phone.slice(-4);
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}

/**
 * Timing-safe comparison of two strings.
 * Uses a fresh random HMAC key each call — makes offline precomputation impossible.
 */
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
    const enc = new TextEncoder();
    const aBuf = enc.encode(a);
    const bBuf = enc.encode(b);
    if (aBuf.length !== bBuf.length) return false;
    const key = await crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const [sigA, sigB] = await Promise.all([
        crypto.subtle.sign('HMAC', key, aBuf),
        crypto.subtle.sign('HMAC', key, bBuf),
    ]);
    const viewA = new Uint8Array(sigA);
    const viewB = new Uint8Array(sigB);
    let result = 0;
    for (let i = 0; i < viewA.length; i++) {
        result |= viewA[i] ^ viewB[i];
    }
    return result === 0;
}

/**
 * Verify HMAC-SHA256 signature from MKTR webhook.
 */
async function verifySignature(rawBody: string, signatureHeader: string, secret: string): Promise<boolean> {
    if (!signatureHeader.startsWith('sha256=')) return false;
    const receivedHex = signatureHeader.slice(7);

    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
        'sign',
    ]);
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
    const computedHex = Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

    return timingSafeEqual(receivedHex, computedHex);
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // ── Signature verification ────────────────────────────────
        const webhookSecret = Deno.env.get('MKTR_WEBHOOK_SECRET');
        if (!webhookSecret) {
            console.error('[receive-mktr-lead] MKTR_WEBHOOK_SECRET not configured');
            return jsonResponse({ error: 'Server misconfiguration' }, 500);
        }

        const signatureHeader = req.headers.get('X-Webhook-Signature');
        if (!signatureHeader) {
            return jsonResponse({ error: 'Missing signature' }, 401);
        }

        // Body-size cap before req.text() — prevents memory DoS via multi-MB payloads.
        // Real MKTR payloads are <10KB; 256KB is generous.
        const MAX_BODY_BYTES = 256 * 1024;
        const declaredLen = Number(req.headers.get('Content-Length') || '0');
        if (declaredLen > MAX_BODY_BYTES) {
            return jsonResponse({ error: 'Request body too large' }, 413);
        }

        const rawBody = await req.text();
        if (rawBody.length > MAX_BODY_BYTES) {
            return jsonResponse({ error: 'Request body too large' }, 413);
        }

        const valid = await verifySignature(rawBody, signatureHeader, webhookSecret);
        if (!valid) {
            return jsonResponse({ error: 'Invalid signature' }, 401);
        }

        // ── Replay protection (timestamp mandatory) ────────────────
        const timestampHeader = req.headers.get('X-Webhook-Timestamp');
        if (!timestampHeader) {
            return jsonResponse({ error: 'Missing timestamp' }, 401);
        }
        const ts = new Date(timestampHeader).getTime();
        const now = Date.now();
        if (isNaN(ts) || Math.abs(now - ts) > 5 * 60 * 1000) {
            return jsonResponse({ error: 'Timestamp too old or invalid' }, 401);
        }

        // ── Parse and validate payload ────────────────────────────
        interface MktrWebhookPayload {
            event: string;
            deliveryId: string;
            data: Record<string, unknown>;
        }
        let payload: MktrWebhookPayload;
        try {
            payload = JSON.parse(rawBody);
        } catch {
            return jsonResponse({ error: 'Invalid JSON' }, 400);
        }

        const { event, deliveryId, data } = payload;
        const SUPPORTED_EVENTS = ['lead.created', 'lead.assigned', 'lead.unassigned'];
        if (!SUPPORTED_EVENTS.includes(event)) {
            return jsonResponse({ error: 'Unsupported event type' }, 400);
        }
        if (!data?.lead?.externalId) {
            return jsonResponse({ error: 'Missing data.lead.externalId' }, 400);
        }

        // Truncate string fields defensively — prevents an upstream bug or
        // malicious caller from inserting megabyte-long names/emails.
        const trim = (v: unknown, max: number): string | undefined => {
            if (typeof v !== 'string') return undefined;
            return v.slice(0, max);
        };
        const rawLead = data.lead as Record<string, unknown>;
        const sanitizedLead: Record<string, unknown> = {
            ...rawLead,
            firstName: trim(rawLead.firstName, 200),
            lastName: trim(rawLead.lastName, 200),
            email: trim(rawLead.email, 320),
            phone: trim(rawLead.phone, 32),
            externalId: trim(rawLead.externalId, 200),
            source: trim(rawLead.source, 100),
            // transcript already capped to 50k below; leave that field alone here.
        };
        // Replace lead in the working set so downstream code uses sanitized values.
        data.lead = sanitizedLead;

        const { lead, routing, campaign, qrTag } = data;

        // ── Service-role client ───────────────────────────────────
        const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

        // ── lead.unassigned ───────────────────────────────────────
        if (event === 'lead.unassigned') {
            if (!data?.previousAgentId) {
                return jsonResponse({ error: 'Missing data.previousAgentId' }, 400);
            }

            const { data: existing } = await supabase
                .from('leads')
                .select('id, assigned_to')
                .eq('external_id', lead.externalId)
                .eq('source_name', 'mktr')
                .maybeSingle();

            if (!existing) {
                return jsonResponse({ success: true, message: 'Lead not found, nothing to unassign' });
            }

            if (existing.assigned_to !== data.previousAgentId) {
                return jsonResponse({ error: 'Lead is not assigned to the specified agent' }, 409);
            }

            const { error: updateError } = await supabase
                .from('leads')
                .update({ assigned_to: null })
                .eq('id', existing.id);

            if (updateError) {
                console.error('[receive-mktr-lead] Lead unassign error:', updateError);
                return jsonResponse({ error: 'Failed to unassign lead' }, 500);
            }

            // Log the unassignment activity
            await supabase.from('lead_activities').insert({
                lead_id: existing.id,
                user_id: data.previousAgentId,
                type: 'unassignment',
                description: 'Lead unassigned via MKTR',
                metadata: { source: 'mktr', delivery_id: deliveryId, previous_agent_id: data.previousAgentId },
            });

            return jsonResponse({ success: true, leadId: existing.id, unassigned: true });
        }

        // ── Resolve agent ─────────────────────────────────────────
        // lead.created matches by agentPhone, lead.assigned matches by agentExternalId
        let agentId: string;

        if (event === 'lead.created') {
            // Try matching by phone first, then fall back to agentExternalId
            if (routing?.agentPhone) {
                const normalizedPhone = routing.agentPhone.replace(/^\+/, '');
                const { data: agent } = await supabase
                    .from('users')
                    .select('id')
                    .eq('phone', normalizedPhone)
                    .maybeSingle();
                if (agent) {
                    agentId = agent.id;
                }
            }

            // Fall back to agentExternalId (handles System Agent or agents without phone)
            if (!agentId && routing?.agentExternalId) {
                const { data: agent } = await supabase
                    .from('users')
                    .select('id')
                    .eq('id', routing.agentExternalId)
                    .maybeSingle();
                if (agent) {
                    agentId = agent.id;
                }
            }

            if (!agentId) {
                const identifier = routing?.agentPhone
                    ? `phone: ${maskPhone(routing.agentPhone)}`
                    : routing?.agentExternalId
                      ? `id: ${routing.agentExternalId}`
                      : 'no routing info';
                console.warn(`[receive-mktr-lead] Agent not found (${identifier})`);
                return jsonResponse({ error: 'Agent not found for the provided routing info' }, 422);
            }
        } else {
            // lead.assigned — agentExternalId is the Supabase user UUID (returned by mktr-agents endpoint)
            if (!routing?.agentExternalId) {
                return jsonResponse({ error: 'Missing data.routing.agentExternalId' }, 400);
            }
            const { data: agent } = await supabase
                .from('users')
                .select('id')
                .eq('id', routing.agentExternalId)
                .maybeSingle();
            if (!agent) {
                console.warn(`[receive-mktr-lead] Agent not found for ID: ${routing.agentExternalId}`);
                return jsonResponse({ error: 'Agent not found for the provided ID' }, 422);
            }
            agentId = agent.id;
        }

        // ── Idempotency / upsert check ────────────────────────────
        const { data: existing } = await supabase
            .from('leads')
            .select('id')
            .eq('external_id', lead.externalId)
            .eq('source_name', 'mktr')
            .maybeSingle();

        if (existing) {
            if (event === 'lead.assigned') {
                // Reassign existing lead to new agent
                const { error: updateError } = await supabase
                    .from('leads')
                    .update({
                        assigned_to: agentId,
                        recording_url: lead.recordingUrl || null,
                        transcript: lead.transcript ? String(lead.transcript).slice(0, 50000) : null,
                    })
                    .eq('id', existing.id);

                if (updateError) {
                    console.error('[receive-mktr-lead] Lead reassign error:', updateError);
                    return jsonResponse({ error: 'Failed to reassign lead' }, 500);
                }

                const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'Unknown';

                await supabase.from('lead_activities').insert({
                    lead_id: existing.id,
                    user_id: agentId,
                    type: 'reassignment',
                    description: `Lead reassigned via MKTR to ${routing.agentName || 'agent'}`,
                    metadata: { source: 'mktr', delivery_id: deliveryId, campaign: campaign?.name || null },
                });

                await supabase.from('notifications').insert({
                    user_id: agentId,
                    type: 'new_lead',
                    title: `Lead Assigned: ${fullName}`,
                    body: `From ${campaign?.name || 'MKTR'} via MKTR`,
                    data: { route: `/(tabs)/leads/${existing.id}`, leadId: existing.id },
                });

                return jsonResponse({ success: true, leadId: existing.id, reassigned: true });
            }

            // lead.created duplicate
            return jsonResponse({ success: true, leadId: existing.id, duplicate: true });
        }

        // ── Build notes from MKTR metadata ────────────────────────
        const noteParts: string[] = [];
        if (event === 'lead.created') {
            if (lead.company) noteParts.push(`Company: ${lead.company}`);
            if (lead.jobTitle) noteParts.push(`Title: ${lead.jobTitle}`);
            if (lead.industry) noteParts.push(`Industry: ${lead.industry}`);
        } else {
            // lead.assigned — different payload shape
            if (lead.leadSource) noteParts.push(`Source: ${lead.leadSource}`);
            if (lead.tags?.length) noteParts.push(`Tags: ${lead.tags.join(', ')}`);
            if (lead.sourceMetadata?.sentiment) noteParts.push(`Sentiment: ${lead.sourceMetadata.sentiment}`);
        }
        if (campaign?.name) noteParts.push(`Campaign: ${campaign.name}`);
        if (qrTag?.slug) noteParts.push(`QR: ${qrTag.slug}`);
        const notes = noteParts.length > 0 ? noteParts.join(' | ') : null;

        // ── Insert lead ───────────────────────────────────────────
        const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'Unknown';

        const { data: newLead, error: insertError } = await supabase
            .from('leads')
            .insert({
                full_name: fullName,
                phone: lead.phone ? lead.phone.replace(/^\+/, '') : null,
                email: lead.email || null,
                source: 'online',
                source_name: 'mktr',
                external_id: lead.externalId,
                status: 'new',
                product_interest: 'general',
                notes,
                recording_url: lead.recordingUrl || null,
                transcript: lead.transcript ? String(lead.transcript).slice(0, 50000) : null,
                assigned_to: agentId,
                created_by: agentId,
            })
            .select('id')
            .single();

        if (insertError) {
            // Unique constraint violation = duplicate
            if (insertError.code === '23505') {
                return jsonResponse({ success: true, duplicate: true }, 200);
            }
            console.error('[receive-mktr-lead] Lead insert error:', insertError);
            return jsonResponse({ error: 'Failed to insert lead' }, 500);
        }

        const leadId = newLead.id;

        // ── Insert lead activity ──────────────────────────────────
        await supabase.from('lead_activities').insert({
            lead_id: leadId,
            user_id: agentId,
            type: 'created',
            description: event === 'lead.created' ? 'Lead received from MKTR' : 'Lead assigned from MKTR',
            metadata: {
                source: 'mktr',
                campaign: campaign?.name || null,
                routing_mode: routing.mode || null,
                delivery_id: deliveryId,
            },
        });

        // ── In-app notification ───────────────────────────────────
        await supabase.from('notifications').insert({
            user_id: agentId,
            type: 'new_lead',
            title: event === 'lead.created' ? `New Lead: ${fullName}` : `Lead Assigned: ${fullName}`,
            body: `From ${campaign?.name || 'MKTR'} via MKTR`,
            data: { route: `/(tabs)/leads/${leadId}`, leadId },
        });

        return jsonResponse({ success: true, leadId });
    } catch (err) {
        console.error('[receive-mktr-lead]', err);
        return jsonResponse({ error: 'Internal server error' }, 500);
    }
});
