/**
 * Shared role constants and permission helpers.
 * UI-specific configs (ROLE_TABS, TAB_CONFIG, getVisibleTabs) stay in each app.
 */

import type { UserRole } from './database';
export type { UserRole, LifecycleStage } from './database';

// ── Staff roles (for auth guards in both apps) ──

export const STAFF_ROLES: UserRole[] = ['pa', 'manager', 'director', 'admin'];

// ── Capability-Based Permission System ──

export type Capability =
    | 'hold_agents'
    | 'reassign_leads'
    | 'reassign_leads_globally'
    | 'reassign_candidates'
    | 'invite_agents'
    | 'create_candidates'
    | 'schedule_interviews'
    | 'view_admin'
    | 'view_team'
    | 'view_leads'
    | 'view_candidates';

export const ROLE_CAPABILITIES: Record<UserRole, Capability[]> = {
    admin: [
        'hold_agents',
        'reassign_leads',
        'reassign_leads_globally',
        'reassign_candidates',
        'invite_agents',
        'create_candidates',
        'schedule_interviews',
        'view_admin',
        'view_team',
        'view_leads',
        'view_candidates',
    ],
    director: [
        'hold_agents',
        'reassign_leads',
        'reassign_candidates',
        'invite_agents',
        'create_candidates',
        'schedule_interviews',
        'view_team',
        'view_leads',
        'view_candidates',
    ],
    manager: [
        'hold_agents',
        'reassign_leads',
        'reassign_candidates',
        'invite_agents',
        'create_candidates',
        'schedule_interviews',
        'view_team',
        'view_leads',
        'view_candidates',
    ],
    agent: ['view_leads'],
    pa: ['create_candidates', 'schedule_interviews', 'view_candidates'],
    candidate: [],
};

export function hasCapability(role: UserRole, capability: Capability): boolean {
    return ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
}

export function canHoldAgents(role: UserRole): boolean {
    return hasCapability(role, 'hold_agents');
}

export function canReassignLeads(role: UserRole): boolean {
    return hasCapability(role, 'reassign_leads');
}

export function canReassignLeadsGlobally(role: UserRole): boolean {
    return hasCapability(role, 'reassign_leads_globally');
}

export function canReassignCandidates(role: UserRole): boolean {
    return hasCapability(role, 'reassign_candidates');
}

export function canInviteAgents(role: UserRole): boolean {
    return hasCapability(role, 'invite_agents');
}

export function canCreateCandidates(role: UserRole): boolean {
    return hasCapability(role, 'create_candidates');
}

export function canScheduleInterviews(role: UserRole): boolean {
    return hasCapability(role, 'schedule_interviews');
}

export function isAdmin(role: UserRole): boolean {
    return hasCapability(role, 'view_admin');
}

export function canViewTeam(role: UserRole): boolean {
    return hasCapability(role, 'view_team');
}

export function canToggleViewMode(role: UserRole): boolean {
    return hasCapability(role, 'hold_agents') && hasCapability(role, 'view_leads');
}
