/**
 * User-initiated edge function: admin sends an agency-wide announcement.
 *
 * Auth: Verifies caller is admin role.
 * Input: { title: string, body: string }
 * Creates a notification row for every active user.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204 });
    }

    try {
        // ── Auth check ───────────────────────────────────────────────
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
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

        // Service-role client for data lookups
        const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

        // Verify caller is admin via JWT claim (avoids TOCTOU with DB lookup)
        const callerRole = caller.app_metadata?.role || caller.user_metadata?.role;
        if (callerRole !== 'admin') {
            return new Response(JSON.stringify({ error: 'Only admins can send announcements' }), {
                status: 403,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // ── Input validation ─────────────────────────────────────────
        const { title, body } = await req.json();
        if (!title || typeof title !== 'string' || title.trim().length === 0) {
            return new Response(JSON.stringify({ error: 'title is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        if (body !== undefined && typeof body !== 'string') {
            return new Response(JSON.stringify({ error: 'body must be a string' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // ── Fetch all users ──────────────────────────────────────────
        const { data: users } = await supabase.from('users').select('id');

        if (!users || users.length === 0) {
            return new Response(JSON.stringify({ sent: 0 }), {
                headers: { 'Content-Type': 'application/json' },
            });
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

        const result: Record<string, unknown> = { sent: totalSent };
        if (errors.length > 0) result.failedBatches = errors.length;

        return new Response(JSON.stringify(result), {
            status: errors.length > 0 && totalSent === 0 ? 500 : 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error('[send-announcement]', err);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
});
