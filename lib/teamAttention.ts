import type { MemberInvitation } from '@/lib/invitations';
import type { TeamMember } from '@/lib/team';

export type TeamAttentionKind = 'stale_leads' | 'inactive_member' | 'pending_invite';
export type TeamAttentionTone = 'danger' | 'warning' | 'success' | 'neutral';

export interface TeamAttentionItem {
    id: string;
    kind: TeamAttentionKind;
    title: string;
    subtitle: string;
    signal: string;
    tone: TeamAttentionTone;
    memberId?: string;
    invitationId?: string;
}

export interface TeamHealthSummary {
    activeMembers: number;
    needsFollowUp: number;
    pendingInvites: number;
    totalLeads: number;
    avgConversion: number;
}

const INVITE_EXPIRY_WINDOW_DAYS = 3;

function plural(count: number, singular: string, pluralText = `${singular}s`): string {
    return `${count} ${count === 1 ? singular : pluralText}`;
}

export function daysUntil(iso: string, now: Date = new Date()): number {
    return Math.max(0, Math.ceil((new Date(iso).getTime() - now.getTime()) / 86400000));
}

export function getMemberSignal(member: TeamMember): { text: string; tone: TeamAttentionTone } | null {
    if (!member.isActive) {
        return { text: 'No recent activity', tone: 'warning' };
    }
    if ((member.staleLeadsCount ?? 0) > 0) {
        return { text: `${plural(member.staleLeadsCount ?? 0, 'lead')} untouched`, tone: 'danger' };
    }
    if ((member.openLeadsCount ?? 0) > 0) {
        return { text: `${plural(member.openLeadsCount ?? 0, 'open lead')} in motion`, tone: 'neutral' };
    }
    if (member.wonCount > 0) {
        return { text: `${plural(member.wonCount, 'win')} on record`, tone: 'success' };
    }
    return null;
}

export function buildTeamAttentionItems({
    members,
    invitations,
    now = new Date(),
}: {
    members: TeamMember[];
    invitations: MemberInvitation[];
    now?: Date;
}): TeamAttentionItem[] {
    const items: TeamAttentionItem[] = [];

    for (const member of members) {
        if ((member.staleLeadsCount ?? 0) > 0) {
            items.push({
                id: `member-stale-${member.id}`,
                kind: 'stale_leads',
                title: member.name,
                subtitle: `${plural(member.staleLeadsCount ?? 0, 'lead')} untouched`,
                signal: 'follow up',
                tone: 'danger',
                memberId: member.id,
            });
            continue;
        }
        if (!member.isActive) {
            items.push({
                id: `member-inactive-${member.id}`,
                kind: 'inactive_member',
                title: member.name,
                subtitle: 'No recent activity',
                signal: 'check in',
                tone: 'warning',
                memberId: member.id,
            });
        }
    }

    const pendingInvites = invitations
        .filter((inv) => inv.status === 'pending')
        .map((inv) => ({ inv, daysLeft: daysUntil(inv.expires_at, now) }))
        .filter(({ daysLeft }) => daysLeft <= INVITE_EXPIRY_WINDOW_DAYS)
        .sort((a, b) => a.daysLeft - b.daysLeft);

    for (const { inv, daysLeft } of pendingInvites) {
        items.push({
            id: `invite-${inv.id}`,
            kind: 'pending_invite',
            title: inv.full_name,
            subtitle: 'Invitation near expiry',
            signal: daysLeft === 0 ? 'expires today' : `${daysLeft}d left`,
            tone: daysLeft <= 1 ? 'danger' : 'warning',
            invitationId: inv.id,
        });
    }

    return items.slice(0, 8);
}

export function buildTeamHealthSummary({
    members,
    invitations,
    attentionItems,
}: {
    members: TeamMember[];
    invitations: MemberInvitation[];
    attentionItems: TeamAttentionItem[];
}): TeamHealthSummary {
    const activeMembers = members.filter((m) => m.isActive).length;
    const totalLeads = members.reduce((sum, member) => sum + member.leadsCount, 0);
    const totalWon = members.reduce((sum, member) => sum + member.wonCount, 0);

    return {
        activeMembers,
        needsFollowUp: attentionItems.filter((item) => item.kind !== 'pending_invite').length,
        pendingInvites: invitations.filter((inv) => inv.status === 'pending').length,
        totalLeads,
        avgConversion: totalLeads > 0 ? Math.round((totalWon / totalLeads) * 100) : 0,
    };
}
