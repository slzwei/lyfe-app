/**
 * Edge function: send roadshow summary after event ends.
 *
 * Can be called manually or by cron (checks for yesterday's roadshow events).
 * Input (optional): { eventId: string } — if omitted, processes all roadshows from yesterday.
 *
 * Notifies: event creator (manager) + all attendees with their performance stats.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    for (let i = 0; i < arrA.length; i++) result |= arrA[i] ^ arrB[i];
    return result === 0;
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204 });
    }

    // ── Cron authentication (timing-safe) — accept CRON_SECRET or service role key ──
    const cronSecret = Deno.env.get('CRON_SECRET');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const authorized =
        token &&
        ((cronSecret && (await timingSafeEqual(token, cronSecret))) ||
            (serviceRoleKey && (await timingSafeEqual(token, serviceRoleKey))));
    if (!authorized) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

        let eventIds: string[] = [];

        // Check for explicit eventId or find yesterday's roadshows
        const payload = await req.json().catch(() => ({}));
        if (payload.eventId) {
            eventIds = [payload.eventId];
        } else {
            // Find roadshow events from yesterday
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const { data: events } = await supabase
                .from('events')
                .select('id')
                .eq('event_type', 'roadshow')
                .eq('event_date', yesterday);

            eventIds = (events || []).map((e: { id: string }) => e.id);
        }

        if (eventIds.length === 0) {
            return new Response(JSON.stringify({ sent: 0 }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        let totalSent = 0;

        for (const eventId of eventIds) {
            // Dedup: check if summary already sent for this event
            const { data: existing } = await supabase
                .from('notifications')
                .select('id')
                .eq('type', 'roadshow_summary')
                .contains('data', { eventId })
                .limit(1);

            if (existing && existing.length > 0) continue;

            // Fetch event details
            const { data: event } = await supabase
                .from('events')
                .select('id, title, created_by')
                .eq('id', eventId)
                .single();

            if (!event) continue;

            // Fetch aggregate activity stats
            const { data: activities } = await supabase
                .from('roadshow_activities')
                .select('type, afyc_amount')
                .eq('event_id', eventId);

            const stats = { sitdowns: 0, pitches: 0, closed: 0, afyc: 0 };
            for (const act of activities || []) {
                if (act.type === 'sitdown') stats.sitdowns++;
                if (act.type === 'pitch') stats.pitches++;
                if (act.type === 'case_closed') {
                    stats.closed++;
                    stats.afyc += Number(act.afyc_amount) || 0;
                }
            }

            const summaryBody = `S${stats.sitdowns} P${stats.pitches} C${stats.closed} AFYC $${stats.afyc.toLocaleString()}`;

            // Get all attendees + event creator
            const { data: attendees } = await supabase
                .from('event_attendees')
                .select('user_id')
                .eq('event_id', eventId);

            const recipientIds = new Set<string>();
            recipientIds.add(event.created_by);
            for (const a of attendees || []) {
                recipientIds.add(a.user_id);
            }

            const rows = [...recipientIds].map((userId) => ({
                user_id: userId,
                type: 'roadshow_summary',
                title: `Roadshow Complete: ${event.title}`,
                body: summaryBody,
                data: {
                    route: `/(tabs)/events/${eventId}`,
                    eventId,
                },
            }));

            if (rows.length > 0) {
                await supabase.from('notifications').insert(rows);
                totalSent += rows.length;
            }
        }

        return new Response(JSON.stringify({ sent: totalSent }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error('[send-roadshow-summary]', err);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
});
