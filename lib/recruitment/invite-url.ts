const LYFE_SG_URL = process.env.EXPO_PUBLIC_LYFE_SG_URL || 'https://lyfe.sg';

/** Build canonical invite URL pointing to lyfe-sg candidate login. */
export function getInviteUrl(token: string): string {
    return `${LYFE_SG_URL}/candidate/login?token=${token}`;
}
