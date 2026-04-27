/**
 * User-initiated edge function: admin sends an agency-wide announcement.
 *
 * Auth: Verifies caller is admin role.
 * Input: { title: string, body: string }
 * Creates a notification row for every active user.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGINS')?.split(',')[0] || 'https://lyfe.sg',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    try {
        // ── Auth check ───────────────────────────────────────────────
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
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
                headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
            });
        }

        // Service-role client for data lookups
        const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

        // Verify caller is admin via JWT claim (avoids TOCTOU with DB lookup)
        const callerRole = caller.app_metadata?.role || caller.user_metadata?.role;
        if (callerRole !== 'admin') {
            return new Response(JSON.stringify({ error: 'Only admins can send announcements' }), {
                status: 403,
                headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
            });
        }

        // ── Input validation ─────────────────────────────────────────
        // is_marketing flips the recipient filter from "all active users"
        // to "active users with consent_marketing_at populated" (PDPA §36).
        // Default is false so accidental omissions stay operational-safe.
        const { title, body, is_marketing: isMarketing = false } = await req.json();
        if (!title || typeof title !== 'string' || title.trim().length === 0) {
            return new Response(JSON.stringify({ error: 'title is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
            });
        }
        if (title.trim().length > 200) {
            return new Response(JSON.stringify({ error: 'Title too long (max 200 chars)' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
            });
        }
        if (body !== undefined && typeof body !== 'string') {
            return new Response(JSON.stringify({ error: 'body must be a string' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
            });
        }
        if (body && body.trim().length > 2000) {
            return new Response(JSON.stringify({ error: 'Body too long (max 2000 chars)' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
            });
        }

        // ── Per-admin rate limit + dedup ─────────────────────────────
        // Compromised admin accounts can otherwise spray notifications to every
        // user in seconds. We cap at 1/min and 10/day per admin, and accept an
        // optional dedupKey (sha256 hex of title+body recommended) to swallow
        // accidental double-clicks of the Send button.
        const dedupKey =
            new URL(req.url).searchParams.get('dedupKey') ||
            (typeof (await req.headers.get('Idempotency-Key')) === 'string'
                ? req.headers.get('Idempotency-Key')
                : null);
        const ONE_MIN_AGO = new Date(Date.now() - 60 * 1000).toISOString();
        const ONE_DAY_AGO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const { data: recentLog } = await supabase
            .from('audit_log')
            .select('id, created_at, new_data')
            .eq('actor_id', caller.id)
            .eq('table_name', 'announcement')
            .gte('created_at', ONE_DAY_AGO)
            .order('created_at', { ascending: false })
            .limit(20);

        const last24h = (recentLog || []).length;
        const lastMin = (recentLog || []).filter((r) => r.created_at >= ONE_MIN_AGO).length;
        if (lastMin >= 1) {
            return new Response(JSON.stringify({ error: 'Rate limit exceeded — wait 60s between announcements' }), {
                status: 429,
                headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
            });
        }
        if (last24h >= 10) {
            return new Response(JSON.stringify({ error: 'Daily announcement limit (10) reached' }), {
                status: 429,
                headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
            });
        }
        // Dedup: same admin + same dedupKey within last 24h is treated as a no-op.
        if (
            dedupKey &&
            (recentLog || []).some(
                (r) =>
                    typeof r.new_data === 'object' &&
                    r.new_data !== null &&
                    (r.new_data as Record<string, unknown>).dedupKey === dedupKey,
            )
        ) {
            return new Response(JSON.stringify({ sent: 0, deduped: true }), {
                headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
            });
        }

        // ── Fetch recipients ─────────────────────────────────────────
        // Marketing announcements (is_marketing=true) go ONLY to users who
        // explicitly consented via consent_marketing_at. Operational
        // announcements go to everyone with operational push consent.
        // PDPA §36 forbids treating "no response" as consent.
        let usersQuery = supabase.from('users').select('id').eq('is_active', true);
        if (isMarketing) {
            usersQuery = usersQuery.not('consent_marketing_at', 'is', null);
        } else {
            // Even operational pushes require operational consent — grandfathered
            // users have it; brand-new users without it shouldn't get pinged
            // until they pass the consent gate.
            usersQuery = usersQuery.not('consent_operational_push_at', 'is', null);
        }
        const { data: users } = await usersQuery;

        if (!users || users.length === 0) {
            return new Response(
                JSON.stringify({ sent: 0, reason: isMarketing ? 'no_consenting_users' : 'no_active_users' }),
                { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } },
            );
        }

        // Bulk insert in batches of 500
        const BATCH_SIZE = 500;
        let totalSent = 0;

        const errors: string[] = [];
        for (let i = 0; i < users.length; i += BATCH_SIZE) {
            const batch = users.slice(i, i + BATCH_SIZE);
            const rows = batch.map((u: { id: string }) => ({
                user_id: u.id,
                type: 'agency_announcement',
                title: title.trim(),
                body: body?.trim() || null,
                data: { route: '/(tabs)/home/notifications' },
            }));

            const { error: batchError } = await supabase.from('notifications').insert(rows);
            if (batchError) {
                console.error(
                    `[send-announcement] Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`,
                    batchError.message,
                );
                errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batchError.message}`);
            } else {
                totalSent += rows.length;
            }
        }

        // Audit log: who, what, when, dedupKey, how many recipients.
        // Best-effort — don't fail the request if audit_log insert fails.
        await supabase
            .from('audit_log')
            .insert({
                actor_id: caller.id,
                table_name: 'announcement',
                operation: 'INSERT',
                new_data: {
                    title: title.trim(),
                    body: body?.trim() || null,
                    recipient_count: totalSent,
                    failed_batches: errors.length,
                    dedupKey: dedupKey || null,
                    is_marketing: isMarketing,
                },
            })
            .then((r) => {
                if (r.error) console.error('[send-announcement] audit_log insert:', r.error.message);
            });

        const result: Record<string, unknown> = { sent: totalSent };
        if (errors.length > 0) result.failedBatches = errors.length;

        return new Response(JSON.stringify(result), {
            status: errors.length > 0 && totalSent === 0 ? 500 : 200,
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
    } catch (err) {
        console.error('[send-announcement]', err);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
    }
});
