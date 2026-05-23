/**
 * Shared Singapore mobile phone helpers for Supabase Edge Functions.
 *
 * Storage contract: `65XXXXXXXX` — 10 digits, no `+`. Mirrors
 * lyfe-app/lib/phone.ts, lyfe-sg/src/lib/member-invitations/phone.ts and the
 * `public.normalize_sg_phone` SQL function. SG mobiles start with 8 or 9.
 */

/**
 * Normalize an SG mobile to the canonical `65XXXXXXXX` storage form.
 * Accepts `90000000`, `+65 9000 0000`, `6590000000`.
 * Returns `null` for non-SG, malformed, or empty input (e.g. `+90000000`,
 * `61234567`, `1234`).
 */
export function normalizeSgPhone(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const digits = raw.replace(/[\s\-()]/g, '');
    if (/^\+65[89]\d{7}$/.test(digits)) return digits.slice(1);
    if (/^[89]\d{7}$/.test(digits)) return `65${digits}`;
    if (/^65[89]\d{7}$/.test(digits)) return digits;
    return null;
}

/**
 * Return the 8-digit local form (`9XXXXXXX`) of an SG mobile.
 * Returns `null` if the input is not a valid SG mobile.
 */
export function localSgPhone(raw: string | null | undefined): string | null {
    const normalized = normalizeSgPhone(raw);
    return normalized ? normalized.slice(2) : null;
}

/**
 * Display helper: format a stored SG phone as `+65 XXXX XXXX`.
 * Returns an empty string for empty input and the raw value if it can't be
 * normalized.
 */
export function formatSgPhone(raw: string | null | undefined): string {
    if (!raw) return '';
    const normalized = normalizeSgPhone(raw);
    if (!normalized) return raw;
    return `+65 ${normalized.slice(2, 6)} ${normalized.slice(6)}`;
}

/**
 * Build all stored representations a given SG phone could appear as, so a
 * duplicate check covers rows written before phone normalization landed.
 * Returns an empty array for non-SG input.
 */
export function legacyPhoneEquivalents(raw: string | null | undefined): string[] {
    const normalized = normalizeSgPhone(raw);
    if (!normalized) return [];
    const local = normalized.slice(2); // 8-digit form
    return [
        normalized, // 6590000000
        local, // 90000000
        `+${normalized}`, // +6590000000
        `+65 ${local.slice(0, 4)} ${local.slice(4)}`, // +65 9000 0000
    ];
}
