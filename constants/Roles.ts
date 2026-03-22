/**
 * User roles and permission helpers.
 * Shared capabilities re-exported from lyfe-types. Tab config stays local (uses IconName).
 */

import type { IconName } from '@/types/ui';

import type { UserRole } from '@/types/shared/roles';
import { canToggleViewMode } from '@/types/shared/roles';

// ── Re-export shared roles and capabilities ──
export type { UserRole, LifecycleStage, Capability } from '@/types/shared/roles';
export {
    STAFF_ROLES,
    ROLE_CAPABILITIES,
    hasCapability,
    canHoldAgents,
    canReassignLeads,
    canReassignLeadsGlobally,
    canInviteAgents,
    canCreateCandidates,
    canScheduleInterviews,
    isAdmin,
    canViewTeam,
    canToggleViewMode,
} from '@/types/shared/roles';

// ── Tab Configuration (local — depends on IconName) ──

export const ROLE_TABS: Record<UserRole, string[]> = {
    admin: ['home', 'leads', 'team', 'events', 'profile'],
    director: ['home', 'leads', 'team', 'events', 'profile'],
    manager: ['home', 'leads', 'team', 'events', 'profile'],
    agent: ['home', 'leads', 'events', 'profile'],
    pa: ['home', 'pa', 'events', 'profile'],
    candidate: ['home', 'roadmap', 'events', 'profile'],
};

export function getVisibleTabs(role: UserRole, viewMode?: 'agent' | 'manager'): string[] {
    if (canToggleViewMode(role) && viewMode) {
        if (viewMode === 'agent') {
            return ['home', 'leads', 'events', 'profile'];
        }
        return ['home', 'leads', 'team', 'events', 'profile'];
    }
    return ROLE_TABS[role] || ['profile'];
}

export const TAB_CONFIG: Record<string, { label: string; icon: IconName }> = {
    home: { label: 'Home', icon: 'home' },
    leads: { label: 'Leads', icon: 'people' },
    roadmap: { label: 'Roadmap', icon: 'map' },
    candidates: { label: 'Candidates', icon: 'document-text' },
    team: { label: 'Team', icon: 'business' },
    events: { label: 'Events', icon: 'calendar' },
    pa: { label: 'Candidates', icon: 'clipboard' },
    admin: { label: 'Admin', icon: 'settings' },
    profile: { label: 'Profile', icon: 'person' },
};
