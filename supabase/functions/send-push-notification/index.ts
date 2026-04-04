/**
 * Push notification dispatcher — triggered by DB webhook on notifications INSERT.
 *
 * Receives the new notification row, looks up the user's push token and preferences,
 * and sends an Expo push notification if appropriate.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface WebhookPayload {
    type: 'INSERT';
    table: 'notifications';
    record: {
        id: string;
        user_id: string;
        type: string;
        title: string;
        body: string | null;
        data: Record<string, unknown>;
        is_read: boolean;
        created_at: string;
    };
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

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204 });
    }

    // ── Webhook secret authentication (timing-safe) ────────────────
    const webhookSecret = Deno.env.get('WEBHOOK_SECRET');
    const providedSecret = req.headers.get('X-Webhook-Secret');
    if (!webhookSecret || !providedSecret || !(await timingSafeEqual(providedSecret, webhookSecret))) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const payload: WebhookPayload = await req.json();

        // Validate webhook payload
        if (payload.type !== 'INSERT' || !payload.record?.user_id) {
            return new Response(JSON.stringify({ skipped: true, reason: 'not an INSERT or missing user_id' }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const { record } = payload;

        // Service-role client for user lookup
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        if (!supabaseUrl || !serviceKey) {
            console.error('[send-push-notification] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
            return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        const supabase = createClient(supabaseUrl, serviceKey);

        // Fetch user's push token and notification preferences
        const { data: user } = await supabase
            .from('users')
            .select('push_token, notification_preferences')
            .eq('id', record.user_id)
            .single();

        if (!user?.push_token) {
            return new Response(JSON.stringify({ skipped: true, reason: 'no push token' }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Validate Expo push token format
        if (!/^ExponentPushToken\[.+\]$/.test(user.push_token)) {
            const masked = user.push_token ? user.push_token.slice(0, 15) + '...' : 'empty';
            console.error('[send-push-notification] Invalid push token format:', masked);
            return new Response(JSON.stringify({ skipped: true, reason: 'invalid push token format' }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Check if user opted out of push for this notification type
        const prefs = (user.notification_preferences as Record<string, boolean>) || {};
        if (prefs[record.type] === false) {
            return new Response(JSON.stringify({ skipped: true, reason: 'user opted out' }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Send Expo push notification
        const pushMessage = {
            to: user.push_token,
            sound: 'default',
            title: record.title,
            body: record.body || undefined,
            data: record.data || {},
        };

        const abortCtl = new AbortController();
        const timeout = setTimeout(() => abortCtl.abort(), 30000);
        let pushResponse: Response;
        try {
            pushResponse = await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(pushMessage),
                signal: abortCtl.signal,
            });
        } finally {
            clearTimeout(timeout);
        }

        const pushResult = await pushResponse.json();

        // Check for Expo push errors (e.g. DeviceNotRegistered, InvalidCredentials)
        if (pushResult?.data?.status === 'error') {
            console.error('[send-push-notification] Expo error:', pushResult.data.message);
        }

        return new Response(JSON.stringify({ sent: true }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error('[send-push-notification]', err);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
});
