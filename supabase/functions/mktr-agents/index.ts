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
        // ── API key authentication ────────────────────────────────
        const apiKey = Deno.env.get('MKTR_API_KEY');
        if (!apiKey) {
            console.error('[mktr-agents] MKTR_API_KEY not configured');
            return jsonResponse({ error: 'Server misconfiguration' }, 500);
        }

        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ') || authHeader.slice(7) !== apiKey) {
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
                .in('role', ['agent', 'pa'])
                .eq('is_active', true)
                .single();

            if (error || !agent) {
                return jsonResponse({ error: 'Agent not found' }, 404);
            }

            return jsonResponse({
                agent: {
                    id: agent.id,
                    name: agent.full_name,
                    phone: agent.phone,
                    email: agent.email,
                    role: agent.role,
                },
            });
        }

        // ── List all active agents/PAs ────────────────────────────
        const { data: agents, error } = await supabase
            .from('users')
            .select('id, full_name, phone, email, role')
            .in('role', ['agent', 'pa'])
            .eq('is_active', true)
            .order('full_name');

        if (error) {
            console.error('[mktr-agents] Error fetching agents:', error);
            return jsonResponse({ error: 'Failed to fetch agents' }, 500);
        }

        return jsonResponse({
            agents: (agents || []).map((a: any) => ({
                id: a.id,
                name: a.full_name,
                phone: a.phone,
                email: a.email,
                role: a.role,
            })),
        });
    } catch (err) {
        console.error('[mktr-agents]', err);
        return jsonResponse({ error: 'Internal server error' }, 500);
    }
});
