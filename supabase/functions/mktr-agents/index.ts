import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const allowedOrigin = Deno.env.get('ADMIN_ORIGIN') || 'https://admin.lyfe.app';

const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function maskPhone(phone: string): string {
    if (phone.length < 7) return '***';
    return phone.slice(0, 3) + '****' + phone.slice(-4);
}

function maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    return local[0] + '***@' + domain;
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

function jsonResponse(body: Record<string, unknown>, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // ── API key authentication (timing-safe) ────────────────────
        const apiKey = Deno.env.get('MKTR_API_KEY');
        if (!apiKey) {
            console.error('[mktr-agents] MKTR_API_KEY not configured');
            return jsonResponse({ error: 'Server misconfiguration' }, 500);
        }

        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ') || !(await timingSafeEqual(authHeader.slice(7), apiKey))) {
            return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        // ── Service-role client ───────────────────────────────────
        const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

        // ── Check for single agent query ──────────────────────────
        const url = new URL(req.url);
        const agentId = url.searchParams.get('id');

        if (agentId) {
            const { data: agent, error } = await supabase
                .from('users')
                .select('id, full_name, phone, email, role')
                .eq('id', agentId)
                .in('role', ['agent', 'director', 'manager'])
                .eq('is_active', true)
                .single();

            if (error || !agent) {
                return jsonResponse({ error: 'Agent not found' }, 404);
            }

            return jsonResponse({
                agent: {
                    id: agent.id,
                    name: agent.full_name,
                    phone: maskPhone(agent.phone || ''),
                    email: agent.email ? maskEmail(agent.email) : null,
                    role: agent.role,
                },
            });
        }

        // ── List all active agents/PAs ────────────────────────────
        const { data: agents, error } = await supabase
            .from('users')
            .select('id, full_name, phone, email, role')
            .in('role', ['agent', 'director', 'manager'])
            .eq('is_active', true)
            .order('full_name')
            .limit(500);

        if (error) {
            console.error('[mktr-agents] Error fetching agents:', error);
            return jsonResponse({ error: 'Failed to fetch agents' }, 500);
        }

        return jsonResponse({
            agents: (agents || []).map((a: any) => ({
                id: a.id,
                name: a.full_name,
                phone: maskPhone(a.phone || ''),
                email: a.email ? maskEmail(a.email) : null,
                role: a.role,
            })),
        });
    } catch (err) {
        console.error('[mktr-agents]', err);
        return jsonResponse({ error: 'Internal server error' }, 500);
    }
});
