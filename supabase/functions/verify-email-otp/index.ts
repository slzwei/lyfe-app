/**
 * Verify email OTP and mark user's email as verified.
 *
 * Auth: Bearer JWT required
 * Body: { email: string, code: string }
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function jsonResponse(body: Record<string, unknown>, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

async function sha256(input: string): Promise<string> {
    const data = new TextEncoder().encode(input);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

async function timingSafeEqual(a: string, b: string): Promise<boolean> {
    const enc = new TextEncoder();
    const keyData = enc.encode('otp-comparison');
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

    try {
        // ── Auth ──────────────────────────────────────────────────
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

        // ── Input ─────────────────────────────────────────────────
        const { email, code } = await req.json();
        if (!email || !code) {
            return jsonResponse({ error: 'email and code are required' }, 400);
        }

        const normalizedEmail = email.trim().toLowerCase();
        const submittedHash = await sha256(code.trim());

        // ── Service-role client ───────────────────────────────────
        const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

        // Look up the most recent valid OTP for this user + email
        const { data: otpRecord } = await admin
            .from('email_otp_codes')
            .select('id, code_hash')
            .eq('user_id', caller.id)
            .eq('email', normalizedEmail)
            .gte('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (!otpRecord) {
            return jsonResponse({ error: 'No valid verification code found. Please request a new one.' }, 400);
        }

        if (!(await timingSafeEqual(otpRecord.code_hash, submittedHash))) {
            return jsonResponse({ error: 'Invalid verification code' }, 400);
        }

        // ── Mark email as verified ────────────────────────────────
        const { error: updateErr } = await admin
            .from('users')
            .update({
                email: normalizedEmail,
                email_verified: true,
            })
            .eq('id', caller.id);

        if (updateErr) {
            return jsonResponse({ error: 'Failed to update email' }, 500);
        }

        // Clean up all OTP codes for this user
        await admin.from('email_otp_codes').delete().eq('user_id', caller.id);

        return jsonResponse({ success: true });
    } catch (err) {
        console.error('[verify-email-otp]', err);
        return jsonResponse({ error: 'Internal server error' }, 500);
    }
});
