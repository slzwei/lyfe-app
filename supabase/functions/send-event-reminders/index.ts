/**
 * Scheduled edge function: send event reminders 24h and 1h before events.
 *
 * Called by pg_cron every 5 minutes. Deduplicates by checking for existing
 * reminder notifications before inserting.
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

        const now = new Date();
        const SGT_OFFSET_MS = 8 * 60 * 60 * 1000;
        let totalSent = 0;

        // Check both 24h and 1h windows
        for (const hoursAhead of [24, 1]) {
            const windowStart = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000 - 2.5 * 60 * 1000);
            const windowEnd = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000 + 2.5 * 60 * 1000);

            // event_date is stored as a SGT calendar date, so convert window
            // bounds to SGT before extracting the date portion for filtering.
            // Without this, near the UTC/SGT day boundary (16:00–00:00 UTC)
            // the UTC date is one day behind SGT and events are missed.
            const filterDateStart = new Date(windowStart.getTime() + SGT_OFFSET_MS).toISOString().split('T')[0];
            const filterDateEnd = new Date(windowEnd.getTime() + SGT_OFFSET_MS).toISOString().split('T')[0];

            // Find events starting within the window
            // Combine event_date + start_time into a comparable timestamp
            const { data: events } = await supabase
                .from('events')
                .select('id, title, event_date, start_time, location')
                .gte('event_date', filterDateStart)
                .lte('event_date', filterDateEnd);

            if (!events || events.length === 0) continue;

            for (const event of events) {
                // Build full datetime from event_date + start_time
                const eventDateTime = new Date(`${event.event_date}T${event.start_time}+08:00`);
                if (eventDateTime < windowStart || eventDateTime > windowEnd) continue;

                // Get attendees for this event
                const { data: attendees } = await supabase
                    .from('event_attendees')
                    .select('user_id')
                    .eq('event_id', event.id);

                if (!attendees || attendees.length === 0) continue;

                const userIds = attendees.map((a: { user_id: string }) => a.user_id);
                const reminderLabel = hoursAhead === 24 ? 'tomorrow' : 'in 1 hour';
                const dedupKey = `${event.id}_${hoursAhead}h`;

                // Check for already-sent reminders (dedup)
                const { data: existing } = await supabase
                    .from('notifications')
                    .select('user_id')
                    .eq('type', 'event_reminder')
                    .in('user_id', userIds)
                    .contains('data', { dedupKey });

                const alreadySent = new Set((existing || []).map((n: { user_id: string }) => n.user_id));
                const newRecipients = userIds.filter((uid: string) => !alreadySent.has(uid));

                if (newRecipients.length === 0) continue;

                // Bulk insert notifications
                const rows = newRecipients.map((userId: string) => ({
                    user_id: userId,
                    type: 'event_reminder',
                    title: `Event ${reminderLabel}`,
                    body: `${event.title}${event.location ? ' at ' + event.location : ''}`,
                    data: {
                        route: `/(tabs)/events/${event.id}`,
                        eventId: event.id,
                        dedupKey,
                    },
                }));

                await supabase.from('notifications').insert(rows);
                totalSent += rows.length;
            }
        }

        return new Response(JSON.stringify({ sent: totalSent }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error('[send-event-reminders]', err);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
});
