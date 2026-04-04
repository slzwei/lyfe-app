/**
 * Scheduled edge function: send interview reminders 24h before interviews.
 *
 * Called by pg_cron every 5 minutes. Deduplicates by checking for existing
 * reminder notifications before inserting.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

async function timingSafeEqual(a: string, b: string): Promise<boolean> {
    const enc = new TextEncoder();
    const aBuf = enc.encode(a);
    const bBuf = enc.encode(b);
    if (aBuf.length !== bBuf.length) return false;
    // Use a fresh random key each call — makes offline precomputation impossible
    const key = await crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const [sigA, sigB] = await Promise.all([
        crypto.subtle.sign('HMAC', key, aBuf),
        crypto.subtle.sign('HMAC', key, bBuf),
    ]);
    const viewA = new Uint8Array(sigA);
    const viewB = new Uint8Array(sigB);
    let result = 0;
    for (let i = 0; i < viewA.length; i++) result |= viewA[i] ^ viewB[i];
    return result === 0;
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204 });
    }

    // ── Cron authentication (timing-safe) ────────────────────────
    const cronSecret = Deno.env.get('CRON_SECRET');
    if (!cronSecret) {
        console.error('[send-interview-reminders] CRON_SECRET not configured');
        return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const authorized = token && (await timingSafeEqual(token, cronSecret));
    if (!authorized) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

        const now = new Date();
        const windowStart = new Date(now.getTime() + 24 * 60 * 60 * 1000 - 2.5 * 60 * 1000);
        const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000 + 2.5 * 60 * 1000);

        // Find scheduled interviews in the 24h window
        const { data: interviews } = await supabase
            .from('interviews')
            .select('id, candidate_id, manager_id, scheduled_by_id, datetime')
            .eq('status', 'scheduled')
            .gte('datetime', windowStart.toISOString())
            .lte('datetime', windowEnd.toISOString());

        if (!interviews || interviews.length === 0) {
            return new Response(JSON.stringify({ sent: 0 }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        let totalSent = 0;

        for (const interview of interviews) {
            // Get candidate name
            const { data: candidate } = await supabase
                .from('candidates')
                .select('name')
                .eq('id', interview.candidate_id)
                .single();

            const candidateName = candidate?.name || 'a candidate';
            const dtLabel = new Date(interview.datetime).toLocaleString('en-SG', {
                timeZone: 'Asia/Singapore',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
            });

            const dedupKey = `interview_${interview.id}_24h`;

            // Collect unique recipients (manager + scheduler)
            const recipientIds = [interview.manager_id];
            if (interview.scheduled_by_id !== interview.manager_id) {
                recipientIds.push(interview.scheduled_by_id);
            }

            // Check for already-sent reminders
            const { data: existing } = await supabase
                .from('notifications')
                .select('user_id')
                .eq('type', 'interview_reminder')
                .in('user_id', recipientIds)
                .contains('data', { dedupKey });

            const alreadySent = new Set((existing || []).map((n: { user_id: string }) => n.user_id));
            const newRecipients = recipientIds.filter((uid) => !alreadySent.has(uid));

            if (newRecipients.length === 0) continue;

            const rows = newRecipients.map((userId) => ({
                user_id: userId,
                type: 'interview_reminder',
                title: 'Interview Tomorrow',
                body: `Interview with ${candidateName} on ${dtLabel}`,
                data: {
                    route: `/(tabs)/pa/candidate/${interview.candidate_id}`,
                    candidateId: interview.candidate_id,
                    interviewId: interview.id,
                    dedupKey,
                },
            }));

            await supabase.from('notifications').insert(rows);
            totalSent += rows.length;
        }

        return new Response(JSON.stringify({ sent: totalSent }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error('[send-interview-reminders]', err);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
});
