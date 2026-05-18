// Who can invite whom. Keep in sync with lyfe-app/lib/invitations.ts.
export const INVITE_PERMISSIONS: Record<string, string[]> = {
    admin: ['director', 'manager', 'agent', 'pa', 'ro', 'candidate'],
    director: ['manager', 'agent', 'pa', 'ro', 'candidate'],
    manager: ['agent', 'pa', 'candidate'],
    pa: ['candidate'],
    ro: ['candidate'],
};

export function getInvitableRoles(callerRole: string): string[] {
    return INVITE_PERMISSIONS[callerRole] ?? [];
}

export function canInviteRole(callerRole: string, intendedRole: string): boolean {
    return getInvitableRoles(callerRole).includes(intendedRole);
}
