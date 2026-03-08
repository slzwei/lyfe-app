/**
 * User roles and permission helpers
 */

export type UserRole = 'admin' | 'director' | 'manager' | 'agent' | 'pa' | 'candidate';

export type LifecycleStage =
    | 'applied'
    | 'interview_scheduled'
    | 'interviewed'
    | 'approved'
    | 'exam_prep'
    | 'licensed'
    | 'active_agent';

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposed' | 'won' | 'lost';

// ── Capability-Based Permission System ──

export type Capability =
    | 'hold_agents'
    | 'reassign_leads'
    | 'reassign_leads_globally'
    | 'invite_agents'
    | 'create_candidates'
    | 'schedule_interviews'
    | 'view_admin'
    | 'view_team'
    | 'view_leads'
    | 'view_candidates';

const ROLE_CAPABILITIES: Record<UserRole, Capability[]> = {
    admin: ['hold_agents', 'reassign_leads', 'reassign_leads_globally', 'invite_agents', 'create_candidates', 'schedule_interviews', 'view_admin'],
    director: ['hold_agents', 'reassign_leads', 'invite_agents', 'create_candidates', 'schedule_interviews', 'view_team', 'view_leads', 'view_candidates'],
    manager: ['hold_agents', 'reassign_leads', 'invite_agents', 'create_candidates', 'schedule_interviews', 'view_team', 'view_leads', 'view_candidates'],
    agent: ['view_leads'],
    pa: ['create_candidates', 'schedule_interviews', 'view_candidates'],
    candidate: [],
};

/** Check if a role has a specific capability */
export function hasCapability(role: UserRole, capability: Capability): boolean {
    return ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
}

// ── Tab Configuration ──

/** Tabs each role can see (base configuration — use getVisibleTabs() for view-mode-aware tabs) */
export const ROLE_TABS: Record<UserRole, string[]> = {
    admin: ['home', 'profile'],
    director: ['home', 'leads', 'team', 'events', 'profile'],
    manager: ['home', 'leads', 'team', 'events', 'profile'],
    agent: ['home', 'leads', 'events', 'profile'],
    pa: ['home', 'pa', 'events', 'profile'],
    candidate: ['home', 'exams', 'events', 'profile'],
};

/** View-mode-aware tab resolver (FM-01, FM-03 mitigation) */
export function getVisibleTabs(role: UserRole, viewMode?: 'agent' | 'manager'): string[] {
    // Only manager/director have dual modes
    if ((role === 'manager' || role === 'director') && viewMode) {
        if (viewMode === 'agent') {
            return ['home', 'leads', 'events', 'profile'];
        }
        // manager view
        return ['home', 'leads', 'team', 'candidates', 'events', 'profile'];
    }
    return ROLE_TABS[role] || ['profile'];
}

// ── Backward-compatible permission wrappers ──

/** Check if a role can hold agents (act as a superior in the hierarchy) */
export function canHoldAgents(role: UserRole): boolean {
    return hasCapability(role, 'hold_agents');
}

/** Check if a role can reassign leads */
export function canReassignLeads(role: UserRole): boolean {
    return hasCapability(role, 'reassign_leads');
}

/** Check if a role can reassign leads system-wide (not just within team) */
export function canReassignLeadsGlobally(role: UserRole): boolean {
    return hasCapability(role, 'reassign_leads_globally');
}

/** Check if a role can invite agents */
export function canInviteAgents(role: UserRole): boolean {
    return hasCapability(role, 'invite_agents');
}

/** Check if a role can create candidates */
export function canCreateCandidates(role: UserRole): boolean {
    return hasCapability(role, 'create_candidates');
}

/** Check if a role can schedule interviews */
export function canScheduleInterviews(role: UserRole): boolean {
    return hasCapability(role, 'schedule_interviews');
}

/** Check if a role can access the admin panel */
export function isAdmin(role: UserRole): boolean {
    return hasCapability(role, 'view_admin');
}

/** Check if a role can view team dashboards */
export function canViewTeam(role: UserRole): boolean {
    return hasCapability(role, 'view_team');
}

/** Tab display configuration */
export const TAB_CONFIG: Record<string, { label: string; icon: string }> = {
    home: { label: 'Home', icon: 'home' },
    leads: { label: 'Leads', icon: 'people' },
    exams: { label: 'Exams', icon: 'school' },
    candidates: { label: 'Candidates', icon: 'document-text' },
    team: { label: 'Team', icon: 'business' },
    events: { label: 'Events', icon: 'calendar' },
    pa: { label: 'PA', icon: 'clipboard' },
    admin: { label: 'Admin', icon: 'settings' },
    profile: { label: 'Profile', icon: 'person' },
};
