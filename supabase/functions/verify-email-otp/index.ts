/**
 * Verify email OTP and mark user's email as verified.
 *
 * Auth: Bearer JWT required
 * Body: { email: string, code: string }
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGINS')?.split(',')[0] || 'https://lyfe.sg',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
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
        return new Response(null, { status: 204, headers: CORS_HEADERS });
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
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        if (!supabaseUrl || !serviceKey) {
            return jsonResponse({ error: 'Server misconfiguration' }, 500);
        }
        const admin = createClient(supabaseUrl, serviceKey);

        // Brute-force ceiling on the most recent valid OTP. Each wrong guess
        // bumps failed_attempts on that row; once we cross MAX_ATTEMPTS we
        // refuse all further verifies for that code (user must request a new
        // OTP, which is itself rate-limited to 3 sends per 10 min).
        const MAX_ATTEMPTS = 5;

        // Look up the most recent valid OTP for this user + email
        const { data: otpRecord } = await admin
            .from('email_otp_codes')
            .select('id, code_hash, failed_attempts')
            .eq('user_id', caller.id)
            .eq('email', normalizedEmail)
            .gte('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (!otpRecord) {
            return jsonResponse({ error: 'No valid verification code found. Please request a new one.' }, 400);
        }

        if ((otpRecord.failed_attempts ?? 0) >= MAX_ATTEMPTS) {
            // Burn the code so the attacker can't keep trying. The user can
            // request a new OTP — that path is itself rate-limited.
            await admin.from('email_otp_codes').delete().eq('id', otpRecord.id);
            return jsonResponse({ error: 'Too many incorrect attempts. Please request a new verification code.' }, 429);
        }

        if (!(await timingSafeEqual(otpRecord.code_hash, submittedHash))) {
            await admin
                .from('email_otp_codes')
                .update({ failed_attempts: (otpRecord.failed_attempts ?? 0) + 1 })
                .eq('id', otpRecord.id);
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
