import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

function maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    return local[0] + '***@' + domain;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}

/**
 * Timing-safe comparison of two strings.
 */
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
    const enc = new TextEncoder();
    const keyData = enc.encode('comparison-key');
    const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sigA = await crypto.subtle.sign('HMAC', key, enc.encode(a));
    const sigB = await crypto.subtle.sign('HMAC', key, enc.encode(b));
    const arrA = new Uint8Array(sigA);
    const arrB = new Uint8Array(sigB);
    if (arrA.length !== arrB.length) return false;
    let result = 0;
    for (let i = 0; i < arrA.length; i++) {
        result |= arrA[i] ^ arrB[i];
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

        const rawBody = await req.text();

        const valid = await verifySignature(rawBody, signatureHeader, webhookSecret);
        if (!valid) {
            return jsonResponse({ error: 'Invalid signature' }, 401);
        }

        // ── Replay protection ─────────────────────────────────────
        const timestampHeader = req.headers.get('X-Webhook-Timestamp');
        if (timestampHeader) {
            const ts = new Date(timestampHeader).getTime();
            const now = Date.now();
            if (isNaN(ts) || Math.abs(now - ts) > 5 * 60 * 1000) {
                return jsonResponse({ error: 'Timestamp too old or invalid' }, 401);
            }
        }

        // ── Parse and validate payload ────────────────────────────
        let payload: any;
        try {
            payload = JSON.parse(rawBody);
        } catch {
            return jsonResponse({ error: 'Invalid JSON' }, 400);
        }

        const { event, deliveryId, data } = payload;
        if (event !== 'lead.created') {
            return jsonResponse({ error: `Unsupported event: ${event}` }, 400);
        }
        if (!data?.lead?.externalId) {
            return jsonResponse({ error: 'Missing data.lead.externalId' }, 400);
        }
        if (!data?.routing?.agentPhone) {
            return jsonResponse({ error: 'Missing data.routing.agentPhone' }, 400);
        }

        const { lead, routing, campaign, qrTag } = data;

        // ── Service-role client ───────────────────────────────────
        const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

        // ── Idempotency check ─────────────────────────────────────
        const { data: existing } = await supabase
            .from('leads')
            .select('id')
            .eq('external_id', lead.externalId)
            .eq('source_name', 'mktr')
            .maybeSingle();

        if (existing) {
            return jsonResponse({ success: true, leadId: existing.id, duplicate: true });
        }

        // ── Resolve agent by phone ────────────────────────────────
        // Strip '+' prefix — DB stores phones without it (e.g. 6580000012)
        const normalizedPhone = routing.agentPhone.replace(/^\+/, '');

        const { data: agent } = await supabase
            .from('users')
            .select('id, push_token')
            .eq('phone', normalizedPhone)
            .maybeSingle();

        if (!agent) {
            console.warn(`[receive-mktr-lead] Agent not found for phone: ${maskPhone(routing.agentPhone)}`);
            return jsonResponse({ error: 'Agent not found for the provided phone number' }, 422);
        }

        const agentId = agent.id;

        // ── Build notes from MKTR metadata ────────────────────────
        const noteParts: string[] = [];
        if (lead.company) noteParts.push(`Company: ${lead.company}`);
        if (lead.jobTitle) noteParts.push(`Title: ${lead.jobTitle}`);
        if (lead.industry) noteParts.push(`Industry: ${lead.industry}`);
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
            description: 'Lead received from MKTR',
            metadata: {
                source: 'mktr',
                campaign: campaign?.name || null,
                routing_mode: routing.mode,
                delivery_id: deliveryId,
            },
        });

        // ── In-app notification (push handled by send-push-notification dispatcher) ──
        if (agentId) {
            await supabase.from('notifications').insert({
                user_id: agentId,
                type: 'new_lead',
                title: `New Lead: ${fullName}`,
                body: `From ${campaign?.name || 'MKTR'} via MKTR`,
                data: { route: `/(tabs)/leads/${leadId}`, leadId },
            });
        }

        return jsonResponse({ success: true, leadId });
    } catch (err) {
        console.error('[receive-mktr-lead]', err);
        return jsonResponse({ error: 'Internal server error' }, 500);
    }
});
