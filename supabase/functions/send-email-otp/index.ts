/**
 * Send email verification OTP.
 * Generates a 6-digit code, stores its SHA-256 hash, and sends via AWS SES.
 *
 * Auth: Bearer JWT required
 * Body: { email: string }
 * Rate limit: 3 codes per user per 10 minutes
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function jsonResponse(body: Record<string, unknown>, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

function generateOtp(): string {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return String(arr[0] % 1000000).padStart(6, '0');
}

async function sha256(input: string): Promise<string> {
    const data = new TextEncoder().encode(input);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function sendViaSes(to: string, code: string): Promise<void> {
    const region = Deno.env.get('AWS_REGION') || 'ap-southeast-1';
    const accessKey = Deno.env.get('AWS_ACCESS_KEY_ID');
    const secretKey = Deno.env.get('AWS_SECRET_ACCESS_KEY');
    const sender = Deno.env.get('SES_SENDER_EMAIL') || 'noreply@lyfe.sg';

    if (!accessKey || !secretKey) {
        throw new Error('AWS credentials not configured');
    }

    const params = new URLSearchParams({
        Action: 'SendEmail',
        Source: sender,
        'Destination.ToAddresses.member.1': to,
        'Message.Subject.Data': 'Your Lyfe verification code',
        'Message.Body.Text.Data': `Your Lyfe email verification code is: ${code}\n\nThis code expires in 10 minutes. If you did not request this, please ignore this email.`,
        'Message.Body.Html.Data': `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
                <h2 style="color: #1a1a1a; margin-bottom: 8px;">Verify your email</h2>
                <p style="color: #666; font-size: 15px; margin-bottom: 24px;">Enter this code in the Lyfe app to verify your email address:</p>
                <div style="background: #f5f5f5; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
                    <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #1a1a1a;">${code}</span>
                </div>
                <p style="color: #999; font-size: 13px;">This code expires in 10 minutes. If you did not request this, please ignore this email.</p>
            </div>
        `.trim(),
    });

    // AWS SES v2 API with Signature Version 4
    const host = `email.${region}.amazonaws.com`;
    const url = `https://${host}/`;
    const now = new Date();
    const dateStamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const shortDate = dateStamp.slice(0, 8);

    const body = params.toString();
    const bodyHash = await sha256(body);

    const canonicalHeaders = `content-type:application/x-www-form-urlencoded\nhost:${host}\nx-amz-date:${dateStamp}\n`;
    const signedHeaders = 'content-type;host;x-amz-date';
    const canonicalRequest = `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${bodyHash}`;

    const credentialScope = `${shortDate}/${region}/ses/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${dateStamp}\n${credentialScope}\n${await sha256(canonicalRequest)}`;

    // HMAC signing chain
    const encoder = new TextEncoder();
    async function hmac(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
        const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
        return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
    }

    const kDate = await hmac(encoder.encode(`AWS4${secretKey}`).buffer, shortDate);
    const kRegion = await hmac(kDate, region);
    const kService = await hmac(kRegion, 'ses');
    const kSigning = await hmac(kService, 'aws4_request');

    const signatureBytes = new Uint8Array(await hmac(kSigning, stringToSign));
    const signature = Array.from(signatureBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

    const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Amz-Date': dateStamp,
            Authorization: authorization,
        },
        body,
    });

    if (!response.ok) {
        const text = await response.text();
        console.error('[send-email-otp] SES error:', text);
        throw new Error('Failed to send email');
    }
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
        const { email } = await req.json();
        if (!email || !isValidEmail(email)) {
            return jsonResponse({ error: 'Valid email is required' }, 400);
        }

        const normalizedEmail = email.trim().toLowerCase();

        // ── Service-role client ───────────────────────────────────
        const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

        // Check email not already used by another user
        const { data: emailOwner } = await admin
            .from('users')
            .select('id')
            .eq('email', normalizedEmail)
            .neq('id', caller.id)
            .maybeSingle();

        if (emailOwner) {
            return jsonResponse({ error: 'This email is already used by another account' }, 409);
        }

        // Rate limit: max 3 codes per 10 minutes
        const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const { count } = await admin
            .from('email_otp_codes')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', caller.id)
            .gte('created_at', tenMinAgo);

        if ((count ?? 0) >= 3) {
            return jsonResponse({ error: 'Too many attempts. Please wait a few minutes.' }, 429);
        }

        // ── Generate and store OTP ────────────────────────────────
        const code = generateOtp();
        const codeHash = await sha256(code);

        const { error: insertErr } = await admin.from('email_otp_codes').insert({
            user_id: caller.id,
            email: normalizedEmail,
            code_hash: codeHash,
        });

        if (insertErr) {
            return jsonResponse({ error: 'Failed to generate verification code' }, 500);
        }

        // ── Send email ────────────────────────────────────────────
        await sendViaSes(normalizedEmail, code);

        return jsonResponse({ success: true });
    } catch (err) {
        console.error('[send-email-otp]', err);
        return jsonResponse({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
    }
});
