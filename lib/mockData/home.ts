/**
 * Centralized mock data for the home screen dashboard.
 */
import type { LeadStatus } from '@/types/lead';

export const MOCK_AGENT_STATS = {
    totalLeads: 8,
    newThisWeek: 3,
    conversionRate: 25,
    activeFollowUps: 4,
};

export const MOCK_MANAGER_STATS = {
    teamLeads: 24,
    activeCandidates: 6,
    agentsManaged: 4,
    pendingInterviews: 3,
};

export const MOCK_ACTIVITIES = [
    { id: '1', type: 'status_change' as const, leadName: 'Sarah Tan', detail: 'New \u2192 Contacted', time: '2h ago', icon: 'swap-horizontal' as const },
    { id: '2', type: 'note' as const, leadName: 'David Lim', detail: 'Added follow-up note', time: '3h ago', icon: 'create' as const },
    { id: '3', type: 'call' as const, leadName: 'Amanda Lee', detail: 'Outbound call (5 min)', time: '5h ago', icon: 'call' as const },
    { id: '4', type: 'new_lead' as const, leadName: 'Michael Wong', detail: 'New lead from referral', time: '1d ago', icon: 'person-add' as const },
    { id: '5', type: 'status_change' as const, leadName: 'Jessica Ng', detail: 'Proposed \u2192 Won', time: '2d ago', icon: 'trophy' as const },
];

export const MOCK_MANAGER_ACTIVITIES = [
    { id: '1', type: 'candidate' as const, leadName: 'Jason Teo', detail: 'Applied to join team', time: '1h ago', icon: 'person-add' as const },
    { id: '2', type: 'reassign' as const, leadName: 'Sarah Tan', detail: 'Lead reassigned to Alice', time: '3h ago', icon: 'swap-horizontal' as const },
    { id: '3', type: 'interview' as const, leadName: 'Priya Sharma', detail: 'Interview completed', time: '5h ago', icon: 'checkmark-circle' as const },
    { id: '4', type: 'exam' as const, leadName: 'Wei Ming Chen', detail: 'Exam Prep started', time: '1d ago', icon: 'school' as const },
];

export const MOCK_LEAD_PIPELINE: { status: LeadStatus; count: number }[] = [
    { status: 'new', count: 2 },
    { status: 'contacted', count: 2 },
    { status: 'qualified', count: 1 },
    { status: 'proposed', count: 2 },
    { status: 'won', count: 1 },
    { status: 'lost', count: 0 },
];

export const PA_MOCK_CANDIDATE_COUNT = 3;
export const PA_MOCK_INTERVIEW_COUNT = 1;
