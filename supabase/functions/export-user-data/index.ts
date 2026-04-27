/**
 * PDPA "right to access" — bundle a user's records into a JSON file,
 * upload to a private bucket, return a short-lived signed URL.
 *
 * Singapore PDPA §21 entitles individuals to request a copy of personal
 * data held about them. This endpoint provides that without requiring a
 * support handoff: a self-service button in Settings → Account → Export
 * My Data calls it, the user gets back a download link valid for 1 hour.
 *
 * Auth: Bearer JWT. The caller can ONLY export their own data. There is
 * no admin variant — admins requesting another user's data must do so
 * via a documented support process with explicit consent (out of scope).
 *
 * Tables covered:
 *   - users (own row)
 *   - candidates (where created_by_id = caller OR assigned_manager_id = caller)
 *   - candidate_profiles (where user_id = caller)
 *   - leads (assigned_to or created_by = caller)
 *   - lead_activities (user_id = caller)
 *   - candidate_activities (user_id = caller)
 *   - exam_attempts (user_id = caller)
 *   - disc_results (user_id = caller)
 *   - notifications (user_id = caller, last 90 days only — old ones aren't PII anyway)
 *   - event_attendees (user_id = caller)
 *   - roadshow_attendance (user_id = caller)
 *
 * Excluded: audit_log (operational record), storage blobs (linked via the
 * URLs in the JSON; user can fetch them separately if they want).
 *
 * Output: { url: string, expires_at: ISO timestamp, size_bytes: number }
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

function corsHeadersFor(req: Request): Record<string, string> {
    const origin = req.headers.get('Origin');
    if (!origin || ALLOWED_ORIGINS.length === 0) return {};
    if (!ALLOWED_ORIGINS.includes(origin)) return {};
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        Vary: 'Origin',
    };
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

const BUCKET = 'user-data-exports';
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeadersFor(req) });
    }

    try {
        // ── Auth ────────────────────────────────────────────────────
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return jsonResponse({ error: 'Missing Authorization header' }, 401);
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
            return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        if (!supabaseUrl || !serviceKey) {
            console.error('[export-user-data] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
            return jsonResponse({ error: 'Server misconfiguration' }, 500);
        }
        const admin = createClient(supabaseUrl, serviceKey);

        // ── Rate limit: max 3 exports per user per 24h ──────────────
        // Bundling user data is cheap individually but spammable. PDPA §21
        // allows agencies to refuse "frivolous or vexatious" repeat requests.
        const ONE_DAY_AGO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: recentExports } = await admin
            .from('audit_log')
            .select('id')
            .eq('actor_id', caller.id)
            .eq('table_name', 'user_data_export')
            .gte('created_at', ONE_DAY_AGO);
        if ((recentExports || []).length >= 3) {
            return jsonResponse(
                { error: 'You have already requested 3 exports in the last 24 hours. Try again tomorrow.' },
                429,
            );
        }

        // ── Bundle records ──────────────────────────────────────────
        const userId = caller.id;

        // Helper that swallows "no rows" / RLS-empty results to a [] / null.
        const safe = async <T>(p: Promise<{ data: T | null; error: unknown }>): Promise<T | null> => {
            try {
                const r = await p;
                return r.data ?? null;
            } catch {
                return null;
            }
        };

        const [
            userRow,
            candidateProfile,
            candidatesIOwn,
            leadsAssigned,
            leadsCreated,
            leadActivities,
            candidateActivities,
            examAttempts,
            discResults,
            notifications,
            eventAttendees,
            roadshowAttendance,
        ] = await Promise.all([
            safe(admin.from('users').select('*').eq('id', userId).maybeSingle()),
            safe(admin.from('candidate_profiles').select('*').eq('user_id', userId).maybeSingle()),
            safe(
                admin.from('candidates').select('*').or(`created_by_id.eq.${userId},assigned_manager_id.eq.${userId}`),
            ),
            safe(admin.from('leads').select('*').eq('assigned_to', userId)),
            safe(admin.from('leads').select('*').eq('created_by', userId)),
            safe(admin.from('lead_activities').select('*').eq('user_id', userId)),
            safe(admin.from('candidate_activities').select('*').eq('user_id', userId)),
            safe(admin.from('exam_attempts').select('*').eq('user_id', userId)),
            safe(admin.from('disc_results').select('*').eq('user_id', userId)),
            safe(
                admin
                    .from('notifications')
                    .select('*')
                    .eq('user_id', userId)
                    .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()),
            ),
            safe(admin.from('event_attendees').select('*').eq('user_id', userId)),
            safe(admin.from('roadshow_attendance').select('*').eq('user_id', userId)),
        ]);

        const bundle = {
            export_format_version: 1,
            exported_at: new Date().toISOString(),
            user_id: userId,
            data: {
                user: userRow,
                candidate_profile: candidateProfile,
                candidates_managed_or_created: candidatesIOwn,
                leads_assigned: leadsAssigned,
                leads_created: leadsCreated,
                lead_activities: leadActivities,
                candidate_activities: candidateActivities,
                exam_attempts: examAttempts,
                disc_results: discResults,
                notifications_last_90_days: notifications,
                event_attendees: eventAttendees,
                roadshow_attendance: roadshowAttendance,
            },
            notes: [
                'This export is your personal data held by Lyfe at the time of generation.',
                'Audit logs of administrative actions are excluded — they are operational records, not personal data.',
                'Storage blobs (avatars, candidate PDFs, face references) are linked via URL fields above; download them separately while signed in.',
            ],
        };

        const json = JSON.stringify(bundle, null, 2);
        const sizeBytes = new TextEncoder().encode(json).length;

        // ── Upload + signed URL ──────────────────────────────────────
        const objectKey = `${userId}/${Date.now()}.json`;
        const { error: uploadErr } = await admin.storage.from(BUCKET).upload(objectKey, new Blob([json]), {
            contentType: 'application/json',
            upsert: false,
        });
        if (uploadErr) {
            console.error('[export-user-data] upload failed:', uploadErr.message);
            return jsonResponse({ error: 'Failed to prepare export' }, 500);
        }

        const { data: signed, error: signErr } = await admin.storage
            .from(BUCKET)
            .createSignedUrl(objectKey, SIGNED_URL_TTL_SECONDS);
        if (signErr || !signed?.signedUrl) {
            console.error('[export-user-data] sign failed:', signErr?.message);
            return jsonResponse({ error: 'Failed to prepare export' }, 500);
        }

        // ── Audit log (best-effort) ─────────────────────────────────
        await admin
            .from('audit_log')
            .insert({
                actor_id: userId,
                table_name: 'user_data_export',
                operation: 'INSERT',
                new_data: { object_key: objectKey, size_bytes: sizeBytes },
            })
            .then((r) => {
                if (r.error) console.error('[export-user-data] audit_log:', r.error.message);
            });

        const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString();
        return jsonResponse({
            url: signed.signedUrl,
            expires_at: expiresAt,
            size_bytes: sizeBytes,
        });
    } catch (err) {
        console.error('[export-user-data]', err);
        return jsonResponse({ error: 'Internal server error' }, 500);
    }
});
