/**
 * HMAC-SHA256 signing for MKTR webhook probes.
 *
 * Mirrors the verification performed by
 * supabase/functions/receive-mktr-lead/index.ts:56-70. If the edge function's
 * signature format changes, update this file to match.
 */
import { createHmac } from 'node:crypto';

/**
 * Produce the X-Webhook-Signature header value for a raw JSON body.
 *
 *   "sha256=" + hex(HMAC-SHA256(secret, rawBody))
 */
export function signHmacSha256(rawBody, secret) {
    if (!secret) throw new Error('[synthetic] HMAC secret is empty.');
    const digest = createHmac('sha256', secret).update(rawBody).digest('hex');
    return `sha256=${digest}`;
}

/**
 * ISO-8601 timestamp for the X-Webhook-Timestamp header. Edge function rejects
 * anything outside a ±5-minute window from `new Date().toISOString()`.
 */
export function nowTimestampHeader() {
    return new Date().toISOString();
}
