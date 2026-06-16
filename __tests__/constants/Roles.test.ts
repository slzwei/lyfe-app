import {
    hasCapability,
    getVisibleTabs,
    canHoldAgents,
    canReassignLeads,
    canReassignLeadsGlobally,
    canInviteAgents,
    canCreateCandidates,
    canScheduleInterviews,
    isAdmin,
    canViewTeam,
    canToggleViewMode,
    ROLE_TABS,
    TAB_CONFIG,
    type UserRole,
    type Capability,
} from '@/constants/Roles';

// ── hasCapability ──

describe('hasCapability', () => {
    it('admin has view_admin', () => {
        expect(hasCapability('admin', 'view_admin')).toBe(true);
    });

    it('agent does not have view_admin', () => {
        expect(hasCapability('agent', 'view_admin')).toBe(false);
    });

    it('pa can create candidates and schedule interviews', () => {
        expect(hasCapability('pa', 'create_candidates')).toBe(true);
        expect(hasCapability('pa', 'schedule_interviews')).toBe(true);
    });

    it('candidate has no capabilities', () => {
        expect(hasCapability('candidate', 'view_leads')).toBe(false);
        expect(hasCapability('candidate', 'hold_agents')).toBe(false);
        expect(hasCapability('candidate', 'create_candidates')).toBe(false);
    });

    it('agent can view leads but nothing else', () => {
        expect(hasCapability('agent', 'view_leads')).toBe(true);
        expect(hasCapability('agent', 'hold_agents')).toBe(false);
        expect(hasCapability('agent', 'reassign_leads')).toBe(false);
        expect(hasCapability('agent', 'invite_agents')).toBe(false);
    });

    it('manager and director have full operational capabilities', () => {
        for (const role of ['manager', 'director'] as UserRole[]) {
            expect(hasCapability(role, 'hold_agents')).toBe(true);
            expect(hasCapability(role, 'reassign_leads')).toBe(true);
            expect(hasCapability(role, 'invite_agents')).toBe(true);
            expect(hasCapability(role, 'create_candidates')).toBe(true);
            expect(hasCapability(role, 'schedule_interviews')).toBe(true);
            expect(hasCapability(role, 'view_team')).toBe(true);
            expect(hasCapability(role, 'view_leads')).toBe(true);
            expect(hasCapability(role, 'view_candidates')).toBe(true);
        }
    });

    it('only admin can reassign leads globally', () => {
        expect(hasCapability('admin', 'reassign_leads_globally')).toBe(true);
        expect(hasCapability('director', 'reassign_leads_globally')).toBe(false);
        expect(hasCapability('manager', 'reassign_leads_globally')).toBe(false);
    });
});

// ── Backward-compatible permission wrappers ──

describe('permission wrappers', () => {
    it('canHoldAgents is limited to manager and director', () => {
        expect(canHoldAgents('manager')).toBe(true);
        expect(canHoldAgents('director')).toBe(true);
        expect(canHoldAgents('admin')).toBe(false);
        expect(canHoldAgents('agent')).toBe(false);
        expect(canHoldAgents('pa')).toBe(false);
        expect(canHoldAgents('candidate')).toBe(false);
    });

    it('canReassignLeads delegates to hasCapability', () => {
        expect(canReassignLeads('manager')).toBe(true);
        expect(canReassignLeads('agent')).toBe(false);
    });

    it('canReassignLeadsGlobally is admin-only', () => {
        expect(canReassignLeadsGlobally('admin')).toBe(true);
        expect(canReassignLeadsGlobally('director')).toBe(false);
    });

    it('canInviteAgents works', () => {
        expect(canInviteAgents('manager')).toBe(true);
        expect(canInviteAgents('agent')).toBe(false);
    });

    it('canCreateCandidates includes pa', () => {
        expect(canCreateCandidates('pa')).toBe(true);
        expect(canCreateCandidates('agent')).toBe(false);
    });

    it('canScheduleInterviews includes pa', () => {
        expect(canScheduleInterviews('pa')).toBe(true);
        expect(canScheduleInterviews('candidate')).toBe(false);
    });

    it('isAdmin is admin-only', () => {
        expect(isAdmin('admin')).toBe(true);
        expect(isAdmin('director')).toBe(false);
    });

    it('canViewTeam is manager/director', () => {
        expect(canViewTeam('director')).toBe(true);
        expect(canViewTeam('manager')).toBe(true);
        expect(canViewTeam('agent')).toBe(false);
    });

    it('canToggleViewMode returns true only for roles with both hold_agents and view_leads', () => {
        expect(canToggleViewMode('manager')).toBe(true);
        expect(canToggleViewMode('director')).toBe(true);
        // admin does NOT hold agents, so the manager/agent view toggle does not apply
        expect(canToggleViewMode('admin')).toBe(false);
        expect(canToggleViewMode('agent')).toBe(false);
        expect(canToggleViewMode('pa')).toBe(false);
        expect(canToggleViewMode('candidate')).toBe(false);
    });

    it('reassign_agents is granted to admin/director/pa (distinct from hold_agents)', () => {
        expect(hasCapability('admin', 'reassign_agents')).toBe(true);
        expect(hasCapability('director', 'reassign_agents')).toBe(true);
        expect(hasCapability('pa', 'reassign_agents')).toBe(true);
        expect(hasCapability('manager', 'reassign_agents')).toBe(false);
        expect(hasCapability('agent', 'reassign_agents')).toBe(false);
        expect(hasCapability('candidate', 'reassign_agents')).toBe(false);
        // RO doesn't manage agents — only the candidate side of the pipeline.
        expect(hasCapability('ro', 'reassign_agents')).toBe(false);
    });
});

// ── RO (Recruitment Officer) capabilities ──

describe('ro capabilities', () => {
    it('can do the candidate-pipeline operations a PA can', () => {
        expect(hasCapability('ro', 'create_candidates')).toBe(true);
        expect(hasCapability('ro', 'schedule_interviews')).toBe(true);
        expect(hasCapability('ro', 'view_candidates')).toBe(true);
        expect(hasCapability('ro', 'verify_papers')).toBe(true);
        expect(hasCapability('ro', 'manage_milestones')).toBe(true);
        expect(hasCapability('ro', 'activate_agent')).toBe(true);
        expect(hasCapability('ro', 'put_on_hold')).toBe(true);
        expect(hasCapability('ro', 'reject_candidate')).toBe(true);
    });

    it('can reassign candidates between managers (unlike PA)', () => {
        expect(hasCapability('ro', 'reassign_candidates')).toBe(true);
        expect(hasCapability('pa', 'reassign_candidates')).toBe(false);
    });

    it('cannot manage agents, leads, team, or admin areas', () => {
        expect(hasCapability('ro', 'hold_agents')).toBe(false);
        expect(hasCapability('ro', 'reassign_agents')).toBe(false);
        expect(hasCapability('ro', 'reassign_leads')).toBe(false);
        expect(hasCapability('ro', 'reassign_leads_globally')).toBe(false);
        expect(hasCapability('ro', 'invite_agents')).toBe(false);
        expect(hasCapability('ro', 'view_admin')).toBe(false);
        expect(hasCapability('ro', 'view_team')).toBe(false);
        expect(hasCapability('ro', 'view_leads')).toBe(false);
    });
});

// ── getVisibleTabs ──

describe('getVisibleTabs', () => {
    it('returns base tabs when no viewMode specified', () => {
        expect(getVisibleTabs('admin')).toEqual(['home', 'candidates', 'team', 'events', 'profile']);
        expect(getVisibleTabs('agent')).toEqual(['home', 'leads', 'events', 'profile']);
        expect(getVisibleTabs('pa')).toEqual(['home', 'pa', 'events', 'profile']);
        expect(getVisibleTabs('ro')).toEqual(['home', 'pa', 'events', 'profile']);
        expect(getVisibleTabs('candidate')).toEqual(['home', 'roadmap', 'events', 'profile']);
    });

    it('returns agent view for manager in agent mode', () => {
        expect(getVisibleTabs('manager', 'agent')).toEqual(['home', 'leads', 'events', 'profile']);
    });

    it('returns manager view for manager in manager mode', () => {
        expect(getVisibleTabs('manager', 'manager')).toEqual(['home', 'candidates', 'team', 'events', 'profile']);
    });

    it('returns agent view for director in agent mode', () => {
        expect(getVisibleTabs('director', 'agent')).toEqual(['home', 'leads', 'events', 'profile']);
    });

    it('returns manager view for director in manager mode', () => {
        expect(getVisibleTabs('director', 'manager')).toEqual(['home', 'candidates', 'team', 'events', 'profile']);
    });

    it('ignores viewMode for roles that cannot toggle', () => {
        expect(getVisibleTabs('agent', 'manager')).toEqual(['home', 'leads', 'events', 'profile']);
        expect(getVisibleTabs('pa', 'manager')).toEqual(['home', 'pa', 'events', 'profile']);
        expect(getVisibleTabs('candidate', 'agent')).toEqual(['home', 'roadmap', 'events', 'profile']);
    });

    it('returns fallback for unknown role', () => {
        expect(getVisibleTabs('unknown' as UserRole)).toEqual(['profile']);
    });
});

// ── ROLE_TABS ──

describe('ROLE_TABS', () => {
    it('every role has home and profile', () => {
        const roles: UserRole[] = ['admin', 'director', 'manager', 'agent', 'pa', 'ro', 'candidate'];
        for (const role of roles) {
            // admin has home+profile, all others too
            if (role === 'admin') {
                expect(ROLE_TABS[role]).toContain('home');
                expect(ROLE_TABS[role]).toContain('profile');
            } else {
                expect(ROLE_TABS[role]).toContain('home');
                expect(ROLE_TABS[role]).toContain('profile');
            }
        }
    });

    it('only candidate has roadmap tab', () => {
        expect(ROLE_TABS.candidate).toContain('roadmap');
        expect(ROLE_TABS.agent).not.toContain('roadmap');
        expect(ROLE_TABS.manager).not.toContain('roadmap');
    });

    it('pa and ro share the pa-stack tab; non-pipeline roles do not', () => {
        expect(ROLE_TABS.pa).toContain('pa');
        expect(ROLE_TABS.ro).toContain('pa');
        expect(ROLE_TABS.agent).not.toContain('pa');
        expect(ROLE_TABS.candidate).not.toContain('pa');
    });
});

// ── TAB_CONFIG ──

describe('TAB_CONFIG', () => {
    it('has label and icon for all known tabs', () => {
        const expectedTabs = ['home', 'leads', 'roadmap', 'candidates', 'team', 'events', 'pa', 'admin', 'profile'];
        for (const tab of expectedTabs) {
            expect(TAB_CONFIG[tab]).toBeDefined();
            expect(TAB_CONFIG[tab].label).toBeTruthy();
            expect(TAB_CONFIG[tab].icon).toBeTruthy();
        }
    });
});
