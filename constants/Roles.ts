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

/** Tabs each role can see */
export const ROLE_TABS: Record<UserRole, string[]> = {
    admin: ['home', 'admin', 'profile'],
    director: ['home', 'leads', 'team', 'profile'],
    manager: ['home', 'leads', 'team', 'profile'],
    agent: ['home', 'leads', 'profile'],
    pa: ['home', 'team', 'profile'],
    candidate: ['exams', 'profile'],
};

/** Check if a role can hold agents (act as a superior in the hierarchy) */
export function canHoldAgents(role: UserRole): boolean {
    return role === 'director' || role === 'manager';
}

/** Check if a role can reassign leads */
export function canReassignLeads(role: UserRole): boolean {
    return role === 'admin' || role === 'director' || role === 'manager';
}

/** Check if a role can reassign leads system-wide (not just within team) */
export function canReassignLeadsGlobally(role: UserRole): boolean {
    return role === 'admin';
}

/** Check if a role can invite agents */
export function canInviteAgents(role: UserRole): boolean {
    return role === 'admin' || role === 'director' || role === 'manager';
}

/** Check if a role can create candidates */
export function canCreateCandidates(role: UserRole): boolean {
    return role === 'pa';
}

/** Check if a role can schedule interviews */
export function canScheduleInterviews(role: UserRole): boolean {
    return role === 'pa';
}

/** Check if a role can access the admin panel */
export function isAdmin(role: UserRole): boolean {
    return role === 'admin';
}

/** Check if a role can view team dashboards */
export function canViewTeam(role: UserRole): boolean {
    return role === 'director' || role === 'manager';
}

/** Tab display configuration */
export const TAB_CONFIG: Record<string, { label: string; icon: string }> = {
    home: { label: 'Home', icon: 'home' },
    leads: { label: 'Leads', icon: 'people' },
    exams: { label: 'Exams', icon: 'school' },
    team: { label: 'Team', icon: 'business' },
    pa: { label: 'PA', icon: 'clipboard' },
    admin: { label: 'Admin', icon: 'settings' },
    profile: { label: 'Profile', icon: 'person' },
};
