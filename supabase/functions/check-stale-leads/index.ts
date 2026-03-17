/**
 * Scheduled edge function: check for stale leads (no activity in 14 days).
 *
 * Called by pg_cron daily at 9am SGT. Notifies the agent's manager.
 * Deduplicates by checking if a stale notification was already sent for the
 * same lead in the last 7 days.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STALE_DAYS = 14;
const DEDUP_DAYS = 7;

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204 });
    }

    // ── Cron authentication — accept CRON_SECRET or service role key ──
    const cronSecret = Deno.env.get('CRON_SECRET');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token || (token !== cronSecret && token !== serviceRoleKey)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

        const staleDate = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000).toISOString();
        const dedupSince = new Date(Date.now() - DEDUP_DAYS * 24 * 60 * 60 * 1000).toISOString();

        // Find leads with no update in STALE_DAYS and not already won/lost
        const { data: staleLeads } = await supabase
            .from('leads')
            .select('id, full_name, assigned_to, updated_at')
            .lt('updated_at', staleDate)
            .not('status', 'in', '("won","lost")');

        if (!staleLeads || staleLeads.length === 0) {
            return new Response(JSON.stringify({ sent: 0 }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Get recently sent stale notifications to dedup
        const leadIds = staleLeads.map((l: { id: string }) => l.id);
        const { data: recentNotifs } = await supabase
            .from('notifications')
            .select('data')
            .eq('type', 'lead_stale')
            .gte('created_at', dedupSince);

        const recentlyNotified = new Set(
            (recentNotifs || [])
                .map((n: { data: Record<string, unknown> }) => (n.data as Record<string, string>)?.leadId)
                .filter(Boolean),
        );

        // Filter out already-notified leads
        const newStaleLeads = staleLeads.filter((l: { id: string }) => !recentlyNotified.has(l.id));
        if (newStaleLeads.length === 0) {
            return new Response(JSON.stringify({ sent: 0 }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Look up managers for each agent
        const agentIds = [...new Set(newStaleLeads.map((l: { assigned_to: string }) => l.assigned_to))];
        const { data: agents } = await supabase.from('users').select('id, reports_to').in('id', agentIds);

        const agentManagerMap = new Map<string, string>();
        for (const agent of agents || []) {
            if (agent.reports_to) agentManagerMap.set(agent.id, agent.reports_to);
        }

        let totalSent = 0;
        const rows: Array<{
            user_id: string;
            type: string;
            title: string;
            body: string;
            data: Record<string, unknown>;
        }> = [];

        for (const lead of newStaleLeads) {
            const managerId = agentManagerMap.get(lead.assigned_to);
            if (!managerId) continue;

            const daysSince = Math.floor((Date.now() - new Date(lead.updated_at).getTime()) / (1000 * 60 * 60 * 24));

            rows.push({
                user_id: managerId,
                type: 'lead_stale',
                title: 'Stale Lead',
                body: `${lead.full_name} has had no activity for ${daysSince} days`,
                data: {
                    route: `/(tabs)/leads/${lead.id}`,
                    leadId: lead.id,
                },
            });
        }

        if (rows.length > 0) {
            await supabase.from('notifications').insert(rows);
            totalSent = rows.length;
        }

        return new Response(JSON.stringify({ sent: totalSent }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error('[check-stale-leads]', err);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
});
