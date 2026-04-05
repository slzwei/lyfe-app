import {
    getInvitableRoles,
    canInviteMembers,
    createMemberInvitation,
    fetchMyInvitations,
    revokeInvitation,
} from '@/lib/invitations';

jest.mock('@/lib/supabase');
const mockSupabase = require('@/lib/supabase').supabase;

describe('getInvitableRoles', () => {
    it('returns correct roles for admin', () => {
        expect(getInvitableRoles('admin')).toEqual(['director', 'manager', 'agent', 'pa', 'candidate']);
    });

    it('returns correct roles for director', () => {
        expect(getInvitableRoles('director')).toEqual(['manager', 'agent', 'pa', 'candidate']);
    });

    it('returns correct roles for manager', () => {
        expect(getInvitableRoles('manager')).toEqual(['agent', 'pa', 'candidate']);
    });

    it('returns only candidate for pa', () => {
        expect(getInvitableRoles('pa')).toEqual(['candidate']);
    });

    it('returns empty for agent', () => {
        expect(getInvitableRoles('agent')).toEqual([]);
    });

    it('returns empty for candidate', () => {
        expect(getInvitableRoles('candidate')).toEqual([]);
    });
});

describe('canInviteMembers', () => {
    it('returns true for roles that can invite', () => {
        expect(canInviteMembers('admin')).toBe(true);
        expect(canInviteMembers('director')).toBe(true);
        expect(canInviteMembers('manager')).toBe(true);
        expect(canInviteMembers('pa')).toBe(true);
    });

    it('returns false for roles that cannot invite', () => {
        expect(canInviteMembers('agent')).toBe(false);
        expect(canInviteMembers('candidate')).toBe(false);
    });
});

describe('createMemberInvitation', () => {
    it('returns data on success', async () => {
        const mockInvitation = { invitation: { id: '1', full_name: 'Test' } };
        mockSupabase.functions.invoke.mockResolvedValue({ data: mockInvitation, error: null });

        const result = await createMemberInvitation({
            name: 'Test',
            phone: '91234567',
            intended_role: 'agent',
        });

        expect(result.data).toEqual(mockInvitation);
        expect(result.error).toBeNull();
    });

    it('returns error on edge function failure', async () => {
        mockSupabase.functions.invoke.mockResolvedValue({
            data: null,
            error: { message: 'Function failed' },
        });

        const result = await createMemberInvitation({
            name: 'Test',
            phone: '91234567',
            intended_role: 'agent',
        });

        expect(result.data).toBeNull();
        expect(result.error).toBe('Function failed');
    });

    it('returns error from response body', async () => {
        mockSupabase.functions.invoke.mockResolvedValue({
            data: { error: 'Phone already invited' },
            error: null,
        });

        const result = await createMemberInvitation({
            name: 'Test',
            phone: '91234567',
            intended_role: 'agent',
        });

        expect(result.data).toBeNull();
        expect(result.error).toBe('Phone already invited');
    });
});

describe('fetchMyInvitations', () => {
    it('returns invitations on success', async () => {
        const mockData = [{ id: '1', full_name: 'Test', status: 'pending' }];
        mockSupabase.from.mockReturnValue({
            select: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ data: mockData, error: null }),
            }),
        });

        const result = await fetchMyInvitations();
        expect(result.data).toEqual(mockData);
        expect(result.error).toBeNull();
    });

    it('returns empty array and error on failure', async () => {
        mockSupabase.from.mockReturnValue({
            select: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ data: null, error: { message: 'Fetch failed' } }),
            }),
        });

        const result = await fetchMyInvitations();
        expect(result.data).toEqual([]);
        expect(result.error).toBe('Fetch failed');
    });
});

describe('revokeInvitation', () => {
    it('returns null error on success', async () => {
        mockSupabase.from.mockReturnValue({
            update: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        select: jest.fn().mockResolvedValue({ data: [{ id: 'inv_1' }], error: null }),
                    }),
                }),
            }),
        });

        const result = await revokeInvitation('inv_1');
        expect(result.error).toBeNull();
    });

    it('returns error on failure', async () => {
        mockSupabase.from.mockReturnValue({
            update: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        select: jest.fn().mockResolvedValue({ data: null, error: { message: 'Update failed' } }),
                    }),
                }),
            }),
        });

        const result = await revokeInvitation('inv_1');
        expect(result.error).toBe('Update failed');
    });

    it('returns error when no rows updated (permission denied)', async () => {
        mockSupabase.from.mockReturnValue({
            update: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        select: jest.fn().mockResolvedValue({ data: [], error: null }),
                    }),
                }),
            }),
        });

        const result = await revokeInvitation('inv_1');
        expect(result.error).toBe('Unable to revoke — you may not have permission');
    });
});
