import { buildTeamAttentionItems, buildTeamHealthSummary, getMemberSignal } from '@/lib/teamAttention';
import type { MemberInvitation } from '@/lib/invitations';
import type { TeamMember } from '@/lib/team';

function member(overrides: Partial<TeamMember>): TeamMember {
    return {
        id: 'agent-1',
        name: 'Siti Rahman',
        role: 'agent',
        phone: '+6591111111',
        email: null,
        avatarUrl: null,
        isActive: true,
        joinedDate: '2026-01-01T00:00:00Z',
        leadsCount: 4,
        openLeadsCount: 3,
        staleLeadsCount: 0,
        wonCount: 1,
        conversionRate: 25,
        lastLeadUpdatedAt: '2026-04-24T00:00:00Z',
        currentManagerId: null,
        currentManagerName: null,
        ...overrides,
    };
}

function invite(overrides: Partial<MemberInvitation>): MemberInvitation {
    return {
        id: 'invite-1',
        phone: '+6592222222',
        full_name: 'Raj Kumar',
        intended_role: 'agent',
        status: 'pending',
        invited_by_id: 'mgr-1',
        assigned_manager_id: 'mgr-1',
        notes: null,
        accepted_by_id: null,
        accepted_at: null,
        expires_at: '2026-04-28T00:00:00Z',
        created_at: '2026-04-20T00:00:00Z',
        inviter: { full_name: 'Priya Selvaraj' },
        manager: { full_name: 'Priya Selvaraj' },
        ...overrides,
    };
}

describe('teamAttention helpers', () => {
    it('builds health summary without making pending invites look like members', () => {
        const members = [
            member({ id: 'agent-1' }),
            member({ id: 'agent-2', isActive: false, leadsCount: 0, openLeadsCount: 0, wonCount: 0 }),
        ];
        const invitations = [invite({ id: 'invite-1' })];
        const attentionItems = buildTeamAttentionItems({
            members,
            invitations,
            now: new Date('2026-04-26T00:00:00Z'),
        });

        const summary = buildTeamHealthSummary({ members, invitations, attentionItems });

        expect(summary.activeMembers).toBe(1);
        expect(summary.pendingInvites).toBe(1);
        expect(summary.totalLeads).toBe(4);
        expect(summary.avgConversion).toBe(25);
    });

    it('prioritizes conservative member and invite attention rules', () => {
        const items = buildTeamAttentionItems({
            members: [member({ staleLeadsCount: 2 })],
            invitations: [invite({ expires_at: '2026-04-27T00:00:00Z' })],
            now: new Date('2026-04-26T00:00:00Z'),
        });

        expect(items.map((item) => item.kind)).toEqual(['stale_leads', 'pending_invite']);
        expect(items[0].subtitle).toBe('2 leads untouched');
        expect(items[1].signal).toBe('1d left');
    });

    it('returns one primary signal for a member card', () => {
        expect(getMemberSignal(member({ staleLeadsCount: 3 }))?.text).toBe('3 leads untouched');
        expect(getMemberSignal(member({ isActive: false }))?.text).toBe('No recent activity');
        expect(getMemberSignal(member({ staleLeadsCount: 0, openLeadsCount: 2 }))?.text).toBe('2 open leads in motion');
    });

    it('returns null when an active member has no meaningful signal to surface', () => {
        expect(getMemberSignal(member({ staleLeadsCount: 0, openLeadsCount: 0, wonCount: 0 }))).toBeNull();
    });
});
