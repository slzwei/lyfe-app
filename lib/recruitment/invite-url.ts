const LYFE_SG_DOMAIN = process.env.EXPO_PUBLIC_LYFE_SG_DOMAIN || 'lyfe.sg';

/** Build canonical invite URL pointing to lyfe-sg candidate login. */
export function getInviteUrl(token: string): string {
    return `https://${LYFE_SG_DOMAIN}/candidate/login?token=${token}`;
}
