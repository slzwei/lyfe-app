/**
 * MKTR webhook signature verification — shared so it can be tested directly.
 *
 * Lives here rather than inline in receive-mktr-lead/index.ts because that file
 * calls Deno.serve at module load, so nothing inside it is reachable from a
 * test. A copy of the algorithm in a test file would prove nothing about the
 * code that actually runs; this is the code that actually runs.
 */

/**
 * Timing-safe comparison of two strings.
 * Uses a fresh random HMAC key each call — makes offline precomputation impossible.
 */
export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
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

/** What each scheme puts through the HMAC. */
export function signedPayload(rawBody: string, timestamp: string | null, version: string | null): string {
    return version === 'v2' && timestamp ? `${timestamp}.${rawBody}` : rawBody;
}

/** Hex HMAC-SHA256 of `data` under `secret`. Exported for tests to forge with. */
export async function hmacHex(secret: string, data: string): Promise<string> {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
        'sign',
    ]);
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
    return Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Verify the HMAC-SHA256 signature on a MKTR webhook delivery.
 *
 * v1 signs the raw body ALONE. Every delivery also carries X-Webhook-Timestamp
 * and the caller enforces a 5-minute window on it — but that header never
 * entered the v1 HMAC, so it is unauthenticated: capture one delivery, rewrite
 * the timestamp, and it replays forever. `lead.created` is bounded by our own
 * idempotency; `lead.unassigned` and `lead.deleted` are state-changing and are
 * not.
 *
 * v2 signs `${timestamp}.${rawBody}`, so a rewritten timestamp invalidates the
 * signature and the freshness check finally means something.
 *
 * BOTH are accepted during the cutover, selected by the version header the
 * sender already emits. A v1 delivery carries no such header and takes the
 * legacy branch unchanged — which is exactly what makes deploying this ahead of
 * the sender flip a no-op for live traffic.
 *
 * Delete the v1 branch once the sender is on v2 and has soaked. Runbook:
 * mktr-platform `docs/plans/webhook-signature-v2-cutover.md`.
 */
export async function verifySignature(
    rawBody: string,
    signatureHeader: string,
    secret: string,
    timestamp: string | null,
    version: string | null,
): Promise<boolean> {
    if (!signatureHeader.startsWith('sha256=')) return false;
    const receivedHex = signatureHeader.slice(7);

    const computedHex = await hmacHex(secret, signedPayload(rawBody, timestamp, version));

    return timingSafeEqual(receivedHex, computedHex);
}
