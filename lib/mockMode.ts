/**
 * Mock mode — DEPRECATED.
 *
 * Auth now always goes through real Supabase OTP.
 * Dev/test phone numbers are whitelisted in the custom-sms-hook edge function
 * (OTP_WHITELIST_PHONES env secret) so they skip SMS but still get a real session.
 *
 * isMockMode() is kept as a stub returning false so existing screen-level imports
 * don't break. Those mock-data branches are dead code and will be removed incrementally.
 */

/** @deprecated Always returns false. Will be removed once all screens are cleaned up. */
export function isMockMode(): boolean {
    return false;
}

/** @deprecated No-op. */
export async function initMockMode(): Promise<void> {}

/** @deprecated No-op. */
export async function setMockMode(_value: boolean): Promise<void> {}
