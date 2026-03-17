/**
 * Team service — Supabase queries for team members with lead stats
 */
import type { Lead } from '@/types/lead';
import { captureError } from './sentry';
import { supabase } from './supabase';

/** 7-day invite token expiry (milliseconds) */
const INVITE_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

// ── Types ────────────────────────────────────────────────────

export interface TeamMember {
    id: string;
    name: string;
    role: 'manager' | 'agent' | 'director' | 'admin' | 'pa' | 'candidate';
    phone: string | null;
    email: string | null;
    avatarUrl: string | null;
    isActive: boolean;
    joinedDate: string;
    leadsCount: number;
    wonCount: number;
    conversionRate: number;
}

// ── Team Members ─────────────────────────────────────────────

/**
 * Fetch team members visible to a user based on role hierarchy.
 * Director → sees managers + agents
 * Manager  → sees agents who report to them
 */
export async function fetchTeamMembers(
    userId: string,
    userRole: string,
): Promise<{ data: TeamMember[]; error: string | null }> {
    try {
        let query = supabase
            .from('users')
            .select('id, full_name, role, phone, email, avatar_url, is_active, created_at')
            .in('role', ['manager', 'agent'])
            .order('full_name', { ascending: true });

        // Manager only sees their direct reports
        if (userRole === 'manager') {
            query = query.eq('reports_to', userId);
        }
        // Director/Admin sees all managers + agents (no extra filter needed)

        const { data: users, error } = await query;
        if (error) return { data: [], error: error.message };

        if (!users || users.length === 0) {
            return { data: [], error: null };
        }

        // Fetch lead stats for all members in a single query
        const userIds = (users as { id: string }[]).map((u) => u.id);
        const { data: leads } = await supabase.from('leads').select('assigned_to, status').in('assigned_to', userIds);

        // Aggregate stats per user
        const statsMap: Record<string, { total: number; won: number }> = {};
        ((leads || []) as { assigned_to: string; status: string }[]).forEach((lead) => {
            if (!statsMap[lead.assigned_to]) {
                statsMap[lead.assigned_to] = { total: 0, won: 0 };
            }
            statsMap[lead.assigned_to].total++;
            if (lead.status === 'won') {
                statsMap[lead.assigned_to].won++;
            }
        });

        const members: TeamMember[] = (
            users as {
                id: string;
                full_name: string;
                role: string;
                phone: string | null;
                email: string | null;
                avatar_url: string | null;
                is_active: boolean;
                created_at: string;
            }[]
        ).map((u) => {
            const stats = statsMap[u.id] || { total: 0, won: 0 };
            return {
                id: u.id,
                name: u.full_name,
                role: u.role as TeamMember['role'],
                phone: u.phone,
                email: u.email,
                avatarUrl: u.avatar_url,
                isActive: u.is_active ?? true,
                joinedDate: u.created_at,
                leadsCount: stats.total,
                wonCount: stats.won,
                conversionRate: stats.total > 0 ? Math.round((stats.won / stats.total) * 100) : 0,
            };
        });

        return { data: members, error: null };
    } catch (err) {
        captureError(err, { fn: 'getTeamMembers' });
        return { data: [], error: err instanceof Error ? err.message : 'Unknown error fetching team members' };
    }
}

/**
 * Fetch a single team member by ID with their assigned leads.
 */
export async function fetchTeamMember(
    memberId: string,
): Promise<{ member: TeamMember | null; leads: Lead[]; error: string | null }> {
    try {
        // Fetch user
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, full_name, role, phone, email, avatar_url, is_active, created_at')
            .eq('id', memberId)
            .single();

        if (userError) return { member: null, leads: [], error: userError.message };

        // Fetch their leads
        const { data: memberLeads, error: leadsError } = await supabase
            .from('leads')
            .select(
                'id, assigned_to, created_by, full_name, phone, email, source, source_name, external_id, status, product_interest, notes, updated_at, created_at',
            )
            .eq('assigned_to', memberId)
            .order('updated_at', { ascending: false });

        if (leadsError) return { member: null, leads: [], error: leadsError.message };

        const leadsList = (memberLeads || []) as Lead[];
        const wonCount = leadsList.filter((l) => l.status === 'won').length;

        const member: TeamMember = {
            id: user.id,
            name: user.full_name,
            role: user.role as TeamMember['role'],
            phone: user.phone,
            email: user.email,
            avatarUrl: user.avatar_url,
            isActive: user.is_active ?? true,
            joinedDate: user.created_at ?? '',
            leadsCount: leadsList.length,
            wonCount,
            conversionRate: leadsList.length > 0 ? Math.round((wonCount / leadsList.length) * 100) : 0,
        };

        return { member, leads: leadsList, error: null };
    } catch (err) {
        captureError(err, { fn: 'getTeamMemberDetail' });
        return { member: null, leads: [], error: err instanceof Error ? err.message : 'Unknown error fetching member' };
    }
}

// ── Team Workflow Functions ───────────────────────────────────

export interface AgentPerformance {
    agentId: string;
    agentName: string;
    leadsClosed: number;
    leadsWon: number;
    leadsLost: number;
    activitiesLogged: number;
}

export interface TeamPerformanceResult {
    agents: AgentPerformance[];
    totalClosed: number;
    totalActivities: number;
}

/**
 * Get performance metrics for all agents under a manager within a date range.
 * Returns leads closed (won + lost) and activities logged per agent.
 *
 * @param managerId - The manager's user ID
 * @param dateRange - Start and end dates (YYYY-MM-DD). Start must be before or equal to end.
 * @returns Performance metrics per agent, or an error message
 */
export async function getTeamPerformance(
    managerId: string,
    dateRange: { start: string; end: string },
): Promise<{ data: TeamPerformanceResult; error: string | null }> {
    const emptyResult: TeamPerformanceResult = { agents: [], totalClosed: 0, totalActivities: 0 };

    try {
        // Validate date range: start must be <= end
        if (dateRange.start > dateRange.end) {
            return { data: emptyResult, error: 'Invalid date range: start must be before or equal to end' };
        }
        // Get team agents
        const { data: agents, error: agentsError } = await supabase
            .from('users')
            .select('id, full_name')
            .eq('reports_to', managerId)
            .eq('is_active', true);

        if (agentsError) return { data: emptyResult, error: agentsError.message };

        const agentList = (agents || []) as { id: string; full_name: string }[];
        if (agentList.length === 0) return { data: emptyResult, error: null };

        const agentIds = agentList.map((a) => a.id);

        // Fetch leads closed in the date range
        const { data: leads, error: leadsError } = await supabase
            .from('leads')
            .select('assigned_to, status')
            .in('assigned_to', agentIds)
            .in('status', ['won', 'lost'])
            .gte('updated_at', dateRange.start)
            .lte('updated_at', dateRange.end);

        if (leadsError) return { data: emptyResult, error: leadsError.message };

        // Fetch activities in the date range
        const { data: activities, error: activitiesError } = await supabase
            .from('lead_activities')
            .select('user_id')
            .in('user_id', agentIds)
            .gte('created_at', dateRange.start)
            .lte('created_at', dateRange.end);

        if (activitiesError) return { data: emptyResult, error: activitiesError.message };

        const leadsList = (leads || []) as { assigned_to: string; status: string }[];
        const activityList = (activities || []) as { user_id: string }[];

        // Aggregate per agent
        const agentPerf: AgentPerformance[] = agentList.map((agent) => {
            const agentLeads = leadsList.filter((l) => l.assigned_to === agent.id);
            const agentActivities = activityList.filter((a) => a.user_id === agent.id);

            return {
                agentId: agent.id,
                agentName: agent.full_name,
                leadsClosed: agentLeads.length,
                leadsWon: agentLeads.filter((l) => l.status === 'won').length,
                leadsLost: agentLeads.filter((l) => l.status === 'lost').length,
                activitiesLogged: agentActivities.length,
            };
        });

        return {
            data: {
                agents: agentPerf,
                totalClosed: leadsList.length,
                totalActivities: activityList.length,
            },
            error: null,
        };
    } catch (err) {
        captureError(err, { fn: 'getTeamPerformance' });
        return { data: emptyResult, error: err instanceof Error ? err.message : 'Unknown error fetching performance' };
    }
}

/**
 * Send an invite to an agent to join a manager's team.
 * Creates an invite_tokens record that the agent can use to register.
 *
 * @param email - Valid email address for the agent to invite
 * @param managerId - The manager's user ID sending the invite
 * @returns The generated invite token, or an error message
 */
export async function inviteAgent(
    email: string,
    managerId: string,
): Promise<{ data: { token: string } | null; error: string | null }> {
    try {
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
            return { data: null, error: 'Invalid email format' };
        }
        // Generate a cryptographically secure token
        const randomBytes = new Uint8Array(24);
        crypto.getRandomValues(randomBytes);
        const hex = Array.from(randomBytes, (b) => b.toString(16).padStart(2, '0')).join('');
        const token = `inv_${hex}`;
        const expiresAt = new Date(Date.now() + INVITE_TOKEN_EXPIRY_MS).toISOString();

        const { data, error } = await supabase
            .from('invite_tokens')
            .insert({
                token,
                created_by: managerId,
                assigned_manager_id: managerId,
                intended_role: 'agent',
                expires_at: expiresAt,
            })
            .select('token')
            .single();

        if (error) return { data: null, error: error.message };
        return { data: { token: (data as { token: string }).token }, error: null };
    } catch (err) {
        captureError(err, { fn: 'sendTeamInvite' });
        return { data: null, error: err instanceof Error ? err.message : 'Unknown error sending invite' };
    }
}
