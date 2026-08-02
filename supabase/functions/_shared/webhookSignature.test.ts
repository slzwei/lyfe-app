/**
 * The MKTR webhook signature cutover (mktr-platform P2-3).
 *
 * Run: deno test supabase/functions/_shared/webhookSignature.test.ts
 *
 * The two tests that matter are the replay pair. v1 signs the body alone, so a
 * captured delivery can be replayed forever by rewriting the timestamp — the
 * signature still validates and the 5-minute freshness check passes because the
 * attacker controls the field it reads. v2 signs `${timestamp}.${body}`, so the
 * same rewrite invalidates it.
 *
 * The other thing being proven here is that deploying this receiver AHEAD of
 * the sender flip changes nothing for live traffic: today's deliveries carry no
 * version header and must keep verifying exactly as before. If that were not
 * true, this deploy would 401 every lead in production.
 */
import { assert, assertEquals, assertFalse } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { hmacHex, signedPayload, verifySignature } from './webhookSignature.ts';

const SECRET = 'test-webhook-secret';
const BODY = JSON.stringify({ event: 'lead.unassigned', deliveryId: 'd-1', data: { previousAgentId: 'a-1' } });
const TS = '2026-08-03T00:00:00.000Z';

/** Forge a delivery the way the sender signs it. */
const signV1 = (body = BODY) => hmacHex(SECRET, body).then((h) => `sha256=${h}`);
const signV2 = (body = BODY, ts = TS) => hmacHex(SECRET, `${ts}.${body}`).then((h) => `sha256=${h}`);

Deno.test('signedPayload — v2 binds the timestamp, v1 does not', () => {
    assertEquals(signedPayload(BODY, TS, 'v2'), `${TS}.${BODY}`);
    assertEquals(signedPayload(BODY, TS, null), BODY);
    assertEquals(signedPayload(BODY, TS, 'v1'), BODY);
    // A v2 header with no timestamp cannot bind anything — fall back rather
    // than sign the string "null".
    assertEquals(signedPayload(BODY, null, 'v2'), BODY);
});

Deno.test('a live v1 delivery still verifies — this deploy is a no-op for today’s traffic', async () => {
    const sig = await signV1();
    assert(await verifySignature(BODY, sig, SECRET, TS, null));
});

Deno.test('a v2 delivery verifies', async () => {
    const sig = await signV2();
    assert(await verifySignature(BODY, sig, SECRET, TS, 'v2'));
});

Deno.test('THE FIX — a v2 replay with a rewritten timestamp is rejected', async () => {
    const sig = await signV2(BODY, TS);
    const freshTs = new Date().toISOString();

    assertFalse(await verifySignature(BODY, sig, SECRET, freshTs, 'v2'));
});

Deno.test('THE VULNERABILITY — a v1 replay with a rewritten timestamp still passes', async () => {
    // Documents precisely what stays exploitable until the sender flips to v2.
    // An attacker who captured one lead.unassigned can re-send it at any time:
    // the body-only signature validates and the freshness window is satisfied
    // by the timestamp they just chose.
    const sig = await signV1();
    const freshTs = new Date().toISOString();

    assert(await verifySignature(BODY, sig, SECRET, freshTs, null));
});

Deno.test('a v2 signature presented as v1 is rejected, and vice versa', async () => {
    const v2sig = await signV2();
    const v1sig = await signV1();

    assertFalse(await verifySignature(BODY, v2sig, SECRET, TS, null));
    assertFalse(await verifySignature(BODY, v1sig, SECRET, TS, 'v2'));
});

Deno.test('a tampered body is rejected under both schemes', async () => {
    const tampered = BODY.replace('a-1', 'attacker-agent');

    assertFalse(await verifySignature(tampered, await signV1(), SECRET, TS, null));
    assertFalse(await verifySignature(tampered, await signV2(), SECRET, TS, 'v2'));
});

Deno.test('a wrong secret is rejected under both schemes', async () => {
    const wrong = `sha256=${await hmacHex('not-the-secret', BODY)}`;
    const wrong2 = `sha256=${await hmacHex('not-the-secret', `${TS}.${BODY}`)}`;

    assertFalse(await verifySignature(BODY, wrong, SECRET, TS, null));
    assertFalse(await verifySignature(BODY, wrong2, SECRET, TS, 'v2'));
});

Deno.test('a header without the sha256= prefix is rejected outright', async () => {
    assertFalse(await verifySignature(BODY, await hmacHex(SECRET, BODY), SECRET, TS, null));
    assertFalse(await verifySignature(BODY, '', SECRET, TS, null));
    assertFalse(await verifySignature(BODY, 'md5=abc', SECRET, TS, null));
});

Deno.test('a signature of the wrong length is rejected without a comparison', async () => {
    assertFalse(await verifySignature(BODY, 'sha256=deadbeef', SECRET, TS, null));
});
