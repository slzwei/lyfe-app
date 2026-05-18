import { canInviteRole, getInvitableRoles } from '../../supabase/functions/create-member-invitation/permissions';

describe('create-member-invitation edge permissions', () => {
    it('allows admin and director to invite RO', () => {
        expect(canInviteRole('admin', 'ro')).toBe(true);
        expect(canInviteRole('director', 'ro')).toBe(true);
    });

    it('blocks lower roles from inviting RO', () => {
        for (const role of ['manager', 'pa', 'ro', 'agent', 'candidate']) {
            expect(canInviteRole(role, 'ro')).toBe(false);
        }
    });

    it('lets RO invite candidates only', () => {
        expect(getInvitableRoles('ro')).toEqual(['candidate']);
        expect(canInviteRole('ro', 'candidate')).toBe(true);

        for (const role of ['admin', 'director', 'manager', 'agent', 'pa']) {
            expect(canInviteRole('ro', role)).toBe(false);
        }
    });
});
