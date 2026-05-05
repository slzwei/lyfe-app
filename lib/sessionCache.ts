/**
 * Module-level cache for the user's current access_token.
 *
 * Why this exists: `supabase.auth.getSession()` in React Native with the
 * chunked SecureStore adapter can return `null` between auth events even
 * though we just received a valid SIGNED_IN. Empirically observed in CI:
 * fetchUserProfile gets a token at T+0s, then fetchLeads at T+13s gets
 * `has_session=false`. Likely cause: supabase-js's `autoRefreshToken`
 * timer re-reads storage and the chunked adapter returns incomplete
 * data, so the SDK clears the in-memory session.
 *
 * AuthContext keeps this cache fresh on every auth state change. Hot-path
 * lib functions (fetchUserProfile, fetchLeads, etc.) read from here
 * instead of trusting `supabase.auth.getSession()`.
 */

let accessToken: string | null = null;
let userId: string | null = null;

export function setCachedSession(input: { access_token: string | null; user_id: string | null }) {
    accessToken = input.access_token;
    userId = input.user_id;
}

export function getCachedAccessToken(): string | null {
    return accessToken;
}

export function getCachedUserId(): string | null {
    return userId;
}

export function clearCachedSession() {
    accessToken = null;
    userId = null;
}
