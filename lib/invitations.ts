import { supabase } from '@/lib/supabase';
import type { UserRole } from '@/types/shared/roles';

export interface CreateInvitationInput {
    name: string;
    phone: string;
    intended_role: UserRole;
    assigned_manager_id?: string;
    notes?: string;
}

export interface MemberInvitation {
    id: string;
    phone: string;
    full_name: string;
    intended_role: UserRole;
    status: string;
    invited_by_id: string;
    assigned_manager_id: string | null;
    notes: string | null;
    accepted_by_id: string | null;
    accepted_at: string | null;
    expires_at: string;
    created_at: string;
    inviter?: { full_name: string } | null;
    manager?: { full_name: string } | null;
}

/** Permission matrix: who can invite which roles */
const INVITABLE_ROLES: Record<string, UserRole[]> = {
    admin: ['director', 'manager', 'agent', 'pa', 'candidate'],
    director: ['manager', 'agent', 'pa', 'candidate'],
    manager: ['agent', 'pa', 'candidate'],
    pa: ['candidate'],
};

export function getInvitableRoles(callerRole: UserRole): UserRole[] {
    return INVITABLE_ROLES[callerRole] ?? [];
}

export function canInviteMembers(callerRole: UserRole): boolean {
    return (INVITABLE_ROLES[callerRole]?.length ?? 0) > 0;
}

export async function createMemberInvitation(
    input: CreateInvitationInput,
): Promise<{ data: { invitation: MemberInvitation; invite_url?: string } | null; error: string | null }> {
    const res = await supabase.functions.invoke('create-member-invitation', {
        body: input,
    });

    if (res.error) return { data: null, error: res.error.message };
    if (res.data?.error) return { data: null, error: res.data.error };
    return { data: res.data, error: null };
}

export async function fetchMyInvitations(): Promise<{
    data: MemberInvitation[];
    error: string | null;
}> {
    const { data, error } = await supabase
        .from('member_invitations')
        .select('*, inviter:users!invited_by_id(full_name), manager:users!assigned_manager_id(full_name)')
        .order('created_at', { ascending: false });

    if (error) return { data: [], error: error.message };
    return { data: (data ?? []) as MemberInvitation[], error: null };
}

export async function revokeInvitation(invitationId: string): Promise<{ error: string | null }> {
    const { data, error } = await supabase
        .from('member_invitations')
        .update({ status: 'revoked' })
        .eq('id', invitationId)
        .eq('status', 'pending')
        .select('id');

    if (error) return { error: error.message };
    if (!data || data.length === 0) return { error: 'Unable to revoke — you may not have permission' };
    return { error: null };
}
