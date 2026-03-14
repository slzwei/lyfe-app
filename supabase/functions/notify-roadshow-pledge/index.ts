import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface PledgePayload {
    eventId: string;
    agentId: string;
    agentName: string;
    pledgedSitdowns: number;
    pledgedPitches: number;
    pledgedClosed: number;
    pledgedAfyc: number;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204 });
    }

    try {
        // ── Auth check ─────────────────────────────────────────────
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ error: 'Missing or invalid Authorization header' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const token = authHeader.replace('Bearer ', '');
        const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
            global: { headers: { Authorization: `Bearer ${token}` } },
        });

        const {
            data: { user: caller },
            error: authError,
        } = await userClient.auth.getUser();
        if (authError || !caller) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // ── Input validation ───────────────────────────────────────
        const payload: PledgePayload = await req.json();
        const { eventId, agentId, agentName, pledgedSitdowns, pledgedPitches, pledgedClosed, pledgedAfyc } = payload;

        if (!eventId || !UUID_RE.test(eventId)) {
            return new Response(JSON.stringify({ error: 'Invalid eventId' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        if (!agentId || !UUID_RE.test(agentId)) {
            return new Response(JSON.stringify({ error: 'Invalid agentId' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        if (!agentName || typeof agentName !== 'string') {
            return new Response(JSON.stringify({ error: 'Invalid agentName' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        if (typeof pledgedSitdowns !== 'number' || pledgedSitdowns < 0) {
            return new Response(JSON.stringify({ error: 'pledgedSitdowns must be a non-negative number' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        if (typeof pledgedPitches !== 'number' || pledgedPitches < 0) {
            return new Response(JSON.stringify({ error: 'pledgedPitches must be a non-negative number' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        if (typeof pledgedClosed !== 'number' || pledgedClosed < 0) {
            return new Response(JSON.stringify({ error: 'pledgedClosed must be a non-negative number' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        if (typeof pledgedAfyc !== 'number' || pledgedAfyc < 0) {
            return new Response(JSON.stringify({ error: 'pledgedAfyc must be a non-negative number' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // ── Service-role client for cross-user data lookups ────────
        const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

        // Get the event to find creator (T2 manager)
        const { data: event } = await supabase.from('events').select('created_by, title').eq('id', eventId).single();

        if (!event) {
            return new Response(JSON.stringify({ error: 'Event not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // ── Authorization: caller must be an attendee or the event creator ──
        const isCreator = caller.id === event.created_by;
        if (!isCreator) {
            const { data: attendance } = await supabase
                .from('event_attendees')
                .select('id')
                .eq('event_id', eventId)
                .eq('user_id', caller.id)
                .single();
            if (!attendance) {
                return new Response(JSON.stringify({ error: 'Not authorized for this event' }), {
                    status: 403,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
        }

        // Get T2 (manager) and T3 (director = manager's reports_to)
        const { data: manager } = await supabase
            .from('users')
            .select('id, reports_to')
            .eq('id', event.created_by)
            .single();

        const recipientIds: string[] = [];
        if (manager && manager.id !== agentId) recipientIds.push(manager.id);

        if (manager?.reports_to && manager.reports_to !== agentId) {
            const { data: director } = await supabase.from('users').select('id').eq('id', manager.reports_to).single();
            if (director && !recipientIds.includes(director.id)) {
                recipientIds.push(director.id);
            }
        }

        if (recipientIds.length === 0) {
            return new Response(JSON.stringify({ sent: 0 }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Persist in-app notification rows (push handled by send-push-notification dispatcher)
        const notificationRows = recipientIds.map((id) => ({
            user_id: id,
            type: 'roadshow_pledge',
            title: `${agentName} pledged for ${event.title}`,
            body: `S${pledgedSitdowns} P${pledgedPitches} C${pledgedClosed} AFYC $${pledgedAfyc.toLocaleString()}`,
            data: { route: `/(tabs)/events/${eventId}`, eventId, agentId },
        }));
        await supabase.from('notifications').insert(notificationRows);

        return new Response(JSON.stringify({ sent: recipientIds.length }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error('[notify-roadshow-pledge]', err);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
});
