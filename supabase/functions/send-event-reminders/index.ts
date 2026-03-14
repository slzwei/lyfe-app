/**
 * Scheduled edge function: send event reminders 24h and 1h before events.
 *
 * Called by pg_cron every 5 minutes. Deduplicates by checking for existing
 * reminder notifications before inserting.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204 });
    }

    // ── Cron secret authentication ────────────────────────────────
    const cronSecret = Deno.env.get('CRON_SECRET');
    const authHeader = req.headers.get('Authorization');
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

        const now = new Date();
        let totalSent = 0;

        // Check both 24h and 1h windows
        for (const hoursAhead of [24, 1]) {
            const windowStart = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000 - 2.5 * 60 * 1000);
            const windowEnd = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000 + 2.5 * 60 * 1000);

            // Find events starting within the window
            // Combine event_date + start_time into a comparable timestamp
            const { data: events } = await supabase
                .from('events')
                .select('id, title, event_date, start_time, location')
                .gte('event_date', windowStart.toISOString().split('T')[0])
                .lte('event_date', windowEnd.toISOString().split('T')[0]);

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
