/**
 * Centralized mock team data for dev/demo mode.
 */
import type { TeamMember } from '@/lib/team';

export const MOCK_AGENTS: TeamMember[] = [
    { id: 'a1', name: 'Alice Tan', role: 'agent', phone: '+65 9111 2222', email: 'alice.tan@lyfe.sg', avatarUrl: null, isActive: true, joinedDate: '2024-09-15', leadsCount: 12, wonCount: 4, conversionRate: 33 },
    { id: 'a2', name: 'Bob Lee', role: 'agent', phone: '+65 8222 3333', email: 'bob.lee@lyfe.sg', avatarUrl: null, isActive: true, joinedDate: '2024-11-01', leadsCount: 8, wonCount: 2, conversionRate: 25 },
    { id: 'a3', name: 'Charlie Lim', role: 'agent', phone: '+65 9333 4444', email: null, avatarUrl: null, isActive: true, joinedDate: '2025-01-10', leadsCount: 5, wonCount: 1, conversionRate: 20 },
    { id: 'a4', name: 'Diana Ng', role: 'agent', phone: '+65 8444 5555', email: 'diana.ng@lyfe.sg', avatarUrl: null, isActive: false, joinedDate: '2024-08-20', leadsCount: 3, wonCount: 0, conversionRate: 0 },
];

export const MOCK_MANAGERS: TeamMember[] = [
    { id: 'm1', name: 'Emily Koh', role: 'manager', phone: '+65 9555 6666', email: 'emily.koh@lyfe.sg', avatarUrl: null, isActive: true, joinedDate: '2024-03-01', leadsCount: 24, wonCount: 8, conversionRate: 33 },
    { id: 'm2', name: 'Frank Goh', role: 'manager', phone: '+65 8666 7777', email: 'frank.goh@lyfe.sg', avatarUrl: null, isActive: true, joinedDate: '2024-06-15', leadsCount: 18, wonCount: 5, conversionRate: 28 },
];

export interface AssignedManager {
    id: string;
    full_name: string;
    role: string;
}

export const MOCK_ASSIGNED_MANAGERS: AssignedManager[] = [
    { id: 'm1', full_name: 'David Lim', role: 'manager' },
    { id: 'm2', full_name: 'Emily Koh', role: 'manager' },
];
