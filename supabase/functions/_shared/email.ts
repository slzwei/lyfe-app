/**
 * Shared AWS SES email utility for Supabase Edge Functions.
 *
 * SES is used (not nodemailer) because Edge Functions run on Deno and the
 * SMTP-based lyfe-sg mailer is not portable here. The SigV4 signing logic is
 * the same approach proven in `send-email-otp`.
 *
 * Required environment variables (already configured for send-email-otp):
 *   - AWS_REGION             (default: ap-southeast-1)
 *   - AWS_ACCESS_KEY_ID
 *   - AWS_SECRET_ACCESS_KEY
 *   - SES_SENDER_EMAIL       (default: noreply@lyfe.sg)
 */

/** Escape a user-supplied string for safe interpolation into HTML email bodies. */
export function escapeHtml(value: string | null | undefined): string {
    if (!value) return '';
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function sha256(input: string): Promise<string> {
    const data = new TextEncoder().encode(input);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

export interface SesEmail {
    to: string;
    subject: string;
    text: string;
    html: string;
}

/** True when SES credentials are present. Callers can skip sending gracefully. */
export function isSesConfigured(): boolean {
    return !!Deno.env.get('AWS_ACCESS_KEY_ID') && !!Deno.env.get('AWS_SECRET_ACCESS_KEY');
}

/**
 * Send an email via AWS SES (SendEmail action, SigV4-signed).
 * Throws on misconfiguration or a non-2xx SES response.
 */
export async function sendEmailViaSes({ to, subject, text, html }: SesEmail): Promise<void> {
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
        'Message.Subject.Data': subject,
        'Message.Body.Text.Data': text,
        'Message.Body.Html.Data': html,
    });

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

    const abortCtl = new AbortController();
    const fetchTimeout = setTimeout(() => abortCtl.abort(), 30000);
    let response: Response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Amz-Date': dateStamp,
                Authorization: authorization,
            },
            body,
            signal: abortCtl.signal,
        });
    } finally {
        clearTimeout(fetchTimeout);
    }

    if (!response.ok) {
        const detail = await response.text();
        console.error('[email] SES error:', detail);
        // Surface the SES response (region, identity, reason) to the caller so
        // it can be logged for diagnosis — not just a generic message.
        throw new Error(`SES ${response.status}: ${detail.replace(/\s+/g, ' ').trim().slice(0, 600)}`);
    }
}

export interface CandidateInvitationEmailParams {
    to: string;
    candidateName?: string | null;
    position?: string | null;
    inviteUrl: string;
}

/**
 * Send the candidate invitation email. Mirrors the semantics of
 * lyfe-sg's `sendInvitationEmail` (subject + CTA + 14-day expiry note).
 */
export async function sendCandidateInvitationEmail({
    to,
    candidateName,
    position,
    inviteUrl,
}: CandidateInvitationEmailParams): Promise<void> {
    const greeting = candidateName ? `Hi ${escapeHtml(candidateName)},` : 'Hi,';
    const positionText = position ? ` for ${position}` : '';
    const positionLine = position
        ? `You&rsquo;ve been invited to apply for <strong>${escapeHtml(position)}</strong> at Lyfe.`
        : 'You&rsquo;ve been invited to apply at Lyfe.';

    const subject = position ? `You're invited to apply for ${position} at Lyfe` : "You're invited to apply at Lyfe";

    const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; color: #2C2925;">
            <p style="font-size: 15px; font-weight: 600; margin: 0 0 6px 0;">${greeting}</p>
            <p style="font-size: 14px; color: #57534e; line-height: 1.6; margin: 0 0 20px 0;">${positionLine}</p>
            <p style="font-size: 14px; color: #57534e; line-height: 1.6; margin: 0 0 24px 0;">
                Click the button below to start your application.
            </p>
            <a href="${escapeHtml(inviteUrl)}" style="display: inline-block; padding: 14px 32px; background-color: #ffffff; color: #f97316; font-size: 15px; font-weight: 700; text-decoration: none; border: 2px solid #f97316; border-radius: 10px;">
                Start Application &rarr;
            </a>
            <p style="font-size: 12px; color: #A09B93; line-height: 1.6; margin: 24px 0 0 0;">
                Or open this link directly:<br />
                <a href="${escapeHtml(inviteUrl)}" style="color: #f97316;">${escapeHtml(inviteUrl)}</a>
            </p>
            <p style="font-size: 12px; color: #A09B93; line-height: 1.6; margin: 16px 0 0 0;">
                This link expires in 14 days. If you have any questions, reply to this email.
            </p>
        </div>
    `.trim();

    const text = `${candidateName ? `Hi ${candidateName},` : 'Hi,'}\n\nYou've been invited to apply${positionText} at Lyfe.\n\nStart your application here:\n${inviteUrl}\n\nThis link expires in 14 days. If you have any questions, reply to this email.`;

    await sendEmailViaSes({ to, subject, text, html });
}
