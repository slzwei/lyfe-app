/**
 * Phase G: activate-agent edge function.
 *
 * Promotes a licensed candidate to an active agent. Combines:
 *   1. fn_activate_agent(candidate_id, activated_by) — atomic DB flip
 *      (candidates.status='active_agent', converted_to_agent_at=now(),
 *       public.users.role='agent'). Validates readiness gates server-side.
 *   2. auth.admin.updateUserById — flip auth.users.app_metadata.role='agent'
 *      so the JWT reflects the new role on the user's next session refresh.
 *
 * Auth: Bearer JWT; caller must hold the `activate_agent` capability
 * (admin/director/manager/pa).
 *
 * Body: { candidate_id: string }
 * Returns: { ok: true, user_id, candidate_id } on success.
 *
 * Note: MKTR agent sync is intentionally NOT called from here. The MKTR sync
 * path (sync-agent-to-mktr) is not deployed as an edge function as of Phase G.
 * When it lands, add a fire-and-forget invocation after the DB + auth flip.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STAFF_WITH_ACTIVATE = ['admin', 'director', 'manager', 'pa'];
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || 'https://lyfe.sg').split(',');

function getCorsOrigin(req: Request): string {
    const origin = req.headers.get('Origin') || '';
    return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
}

function corsHeaders(req: Request) {
    return {
        'Access-Control-Allow-Origin': getCorsOrigin(req),
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    };
}

function jsonResponse(req: Request, body: Record<string, unknown>, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    });
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders(req) });
    }

    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return jsonResponse(req, { error: 'Missing Authorization header' }, 401);
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
            return jsonResponse(req, { error: 'Unauthorized' }, 401);
        }

        const callerRole = caller.app_metadata?.role;
        if (!callerRole || !STAFF_WITH_ACTIVATE.includes(callerRole)) {
            return jsonResponse(req, { error: 'Insufficient permissions' }, 403);
        }

        const payload = await req.json().catch(() => null);
        const candidateId: unknown = payload?.candidate_id;
        if (typeof candidateId !== 'string' || !candidateId) {
            return jsonResponse(req, { error: 'candidate_id is required' }, 400);
        }

        const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

        // Atomic DB flip via PG function. Returns a single-row result table
        // with user_id + candidate_id on success, or raises on any gate.
        const { data: rpcRows, error: rpcErr } = await admin.rpc('fn_activate_agent', {
            p_candidate_id: candidateId,
            p_activated_by_user_id: caller.id,
        });

        if (rpcErr) {
            // Map known PG errors to actionable client messages.
            const msg = rpcErr.message || 'Activation failed';
            const status = rpcErr.code === 'P0002' ? 404 : 409;
            return jsonResponse(req, { error: msg }, status);
        }

        const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
        const targetUserId = row?.user_id as string | undefined;
        if (!targetUserId) {
            return jsonResponse(req, { error: 'Activation returned no user_id' }, 500);
        }

        // Flip auth.users.app_metadata.role so the next session refresh
        // reflects the new role in the JWT. Role in public.users has already
        // been updated inside the transaction; the app_metadata update is a
        // best-effort follow-up that the client can retry if needed.
        const { error: metaErr } = await admin.auth.admin.updateUserById(targetUserId, {
            app_metadata: { role: 'agent' },
        });

        if (metaErr) {
            // DB state is already flipped — surface this so the caller can
            // show the user that they may need to log out/in to refresh.
            return jsonResponse(
                req,
                {
                    ok: true,
                    user_id: targetUserId,
                    candidate_id: candidateId,
                    app_metadata_updated: false,
                    warning: `Role updated in DB but auth metadata update failed: ${metaErr.message}. The user may need to sign out and back in.`,
                },
                200,
            );
        }

        return jsonResponse(req, {
            ok: true,
            user_id: targetUserId,
            candidate_id: candidateId,
            app_metadata_updated: true,
        });
    } catch (err) {
        console.error('[activate-agent]', err);
        return jsonResponse(req, { error: 'Activation failed. Please try again.' }, 500);
    }
});
