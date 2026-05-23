/**
 * Singapore mobile phone helpers for lyfe-app.
 *
 * Storage contract (matches the create-candidate / create-member-invitation
 * edge functions, the handle_new_user trigger, and the web-side helper at
 * lyfe-sg/src/lib/member-invitations/phone.ts): `65XXXXXXXX` — 10 digits,
 * no `+`. SG mobiles start with 8 or 9.
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
 * Display helper: format a stored phone as `+65 XXXX XXXX`.
 * Returns `—` for empty input and the raw value if it can't be formatted.
 * Accepts 8-digit local numbers and 65-prefixed numbers so existing call
 * sites (lead/candidate cards, emergency contacts) keep working.
 */
export function formatSgPhone(raw: string | null | undefined): string {
    if (!raw) return '—';
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 10 && digits.startsWith('65')) {
        return `+65 ${digits.slice(2, 6)} ${digits.slice(6)}`;
    }
    if (digits.length === 8) {
        return `+65 ${digits.slice(0, 4)} ${digits.slice(4)}`;
    }
    return raw;
}
