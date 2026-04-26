/**
 * Team service — Supabase queries for team members with lead stats
 */
import type { Lead } from '@/types/lead';
import type { CandidateStatus } from '@/types/recruitment';
import { captureError } from './sentry';
import { supabase } from './supabase';

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
    openLeadsCount: number;
    staleLeadsCount: number;
    wonCount: number;
    conversionRate: number;
    lastLeadUpdatedAt: string | null;
    currentManagerId: string | null;
    currentManagerName: string | null;
    teamSize?: number;
    outstandingCandidatesCount?: number;
}

const TERMINAL_CANDIDATE_STATUSES = new Set(['licensed', 'active_agent', 'rejected']);

export interface ReassignableManager {
    id: string;
    fullName: string;
    role: 'manager' | 'director';
}

export interface AgentForReassign {
    id: string;
    fullName: string;
    email: string | null;
    currentManagerId: string | null;
    currentManagerName: string | null;
}

// ── Team Members ─────────────────────────────────────────────

/**
 * Fetch team members visible to a user based on role hierarchy.
 * Director → sees managers reporting to them + those managers' agents
 * Manager  → sees agents who report to them
 * Admin    → sees all managers + agents
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

        if (userRole === 'manager') {
            // Manager: only their direct reports
            query = query.eq('reports_to', userId);
        } else if (userRole === 'director') {
            // Director: only managers reporting to them + agents reporting to those managers
            const { data: directReports, error: reportsErr } = await supabase
                .from('users')
                .select('id')
                .eq('role', 'manager')
                .eq('reports_to', userId);
            if (reportsErr) return { data: [], error: reportsErr.message };

            const managerIds = ((directReports || []) as { id: string }[]).map((r) => r.id);
            if (managerIds.length === 0) return { data: [], error: null };

            const { data: agentRows, error: agentsErr } = await supabase
                .from('users')
                .select('id')
                .in('reports_to', managerIds);
            if (agentsErr) return { data: [], error: agentsErr.message };

            const agentIds = ((agentRows || []) as { id: string }[]).map((r) => r.id);
            query = query.in('id', [...managerIds, ...agentIds]);
        }
        // Admin: no filter — sees all managers + agents

        const { data: users, error } = await query;
        if (error) return { data: [], error: error.message };

        if (!users || users.length === 0) {
            return { data: [], error: null };
        }

        // Fetch lead stats for all members in a single query
        const userIds = (users as { id: string }[]).map((u) => u.id);
        const { data: leads } = await supabase
            .from('leads')
            .select('assigned_to, status, updated_at')
            .in('assigned_to', userIds);

        // Aggregate stats per user
        const staleCutoff = Date.now() - 7 * 86400000;
        const statsMap: Record<
            string,
            { total: number; open: number; stale: number; won: number; lastUpdatedAt: string | null }
        > = {};
        ((leads || []) as { assigned_to: string; status: string; updated_at: string | null }[]).forEach((lead) => {
            if (!statsMap[lead.assigned_to]) {
                statsMap[lead.assigned_to] = { total: 0, open: 0, stale: 0, won: 0, lastUpdatedAt: null };
            }
            statsMap[lead.assigned_to].total++;
            if (lead.status === 'won') {
                statsMap[lead.assigned_to].won++;
            }
            if (lead.status !== 'won' && lead.status !== 'lost') {
                statsMap[lead.assigned_to].open++;
                if (lead.updated_at && new Date(lead.updated_at).getTime() < staleCutoff) {
                    statsMap[lead.assigned_to].stale++;
                }
            }
            if (
                lead.updated_at &&
                (!statsMap[lead.assigned_to].lastUpdatedAt ||
                    new Date(lead.updated_at).getTime() >
                        new Date(statsMap[lead.assigned_to].lastUpdatedAt ?? '').getTime())
            ) {
                statsMap[lead.assigned_to].lastUpdatedAt = lead.updated_at;
            }
        });

        const typedUsers = users as {
            id: string;
            full_name: string;
            role: string;
            phone: string | null;
            email: string | null;
            avatar_url: string | null;
            is_active: boolean;
            created_at: string;
        }[];

        // Manager-specific stats: count of agents reporting to them + outstanding candidates
        const managerIds = typedUsers.filter((u) => u.role === 'manager').map((u) => u.id);
        const teamSizeMap: Record<string, number> = {};
        const outstandingCandidatesMap: Record<string, number> = {};

        if (managerIds.length > 0) {
            const [agentRowsResult, candidateRowsResult] = await Promise.all([
                supabase
                    .from('users')
                    .select('reports_to')
                    .in('reports_to', managerIds)
                    .eq('role', 'agent')
                    .eq('is_active', true),
                supabase.from('candidates').select('assigned_manager_id, status').in('assigned_manager_id', managerIds),
            ]);

            ((agentRowsResult.data || []) as { reports_to: string }[]).forEach((row) => {
                if (row.reports_to) {
                    teamSizeMap[row.reports_to] = (teamSizeMap[row.reports_to] ?? 0) + 1;
                }
            });

            ((candidateRowsResult.data || []) as { assigned_manager_id: string; status: string }[]).forEach((row) => {
                if (row.assigned_manager_id && !TERMINAL_CANDIDATE_STATUSES.has(row.status)) {
                    outstandingCandidatesMap[row.assigned_manager_id] =
                        (outstandingCandidatesMap[row.assigned_manager_id] ?? 0) + 1;
                }
            });
        }

        const members: TeamMember[] = typedUsers.map((u) => {
            const stats = statsMap[u.id] || { total: 0, open: 0, stale: 0, won: 0, lastUpdatedAt: null };
            const isManager = u.role === 'manager';
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
                openLeadsCount: stats.open,
                staleLeadsCount: stats.stale,
                wonCount: stats.won,
                conversionRate: stats.total > 0 ? Math.round((stats.won / stats.total) * 100) : 0,
                lastLeadUpdatedAt: stats.lastUpdatedAt,
                currentManagerId: null,
                currentManagerName: null,
                teamSize: isManager ? (teamSizeMap[u.id] ?? 0) : undefined,
                outstandingCandidatesCount: isManager ? (outstandingCandidatesMap[u.id] ?? 0) : undefined,
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
        // Fetch user and their leads in parallel (independent queries)
        const [userResult, leadsResult] = await Promise.all([
            supabase
                .from('users')
                .select('id, full_name, role, phone, email, avatar_url, is_active, created_at, reports_to')
                .eq('id', memberId)
                .single(),
            supabase
                .from('leads')
                .select(
                    'id, assigned_to, created_by, full_name, phone, email, source, source_name, external_id, status, product_interest, notes, updated_at, created_at',
                )
                .eq('assigned_to', memberId)
                .order('updated_at', { ascending: false }),
        ]);

        const { data: user, error: userError } = userResult;
        const { data: memberLeads, error: leadsError } = leadsResult;

        if (userError) return { member: null, leads: [], error: userError.message };
        if (leadsError) return { member: null, leads: [], error: leadsError.message };

        // Resolve current manager name if any
        let currentManagerName: string | null = null;
        if (user.reports_to) {
            const { data: mgr } = await supabase.from('users').select('full_name').eq('id', user.reports_to).single();
            currentManagerName = (mgr as { full_name: string } | null)?.full_name ?? null;
        }

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
            openLeadsCount: leadsList.filter((l) => l.status !== 'won' && l.status !== 'lost').length,
            staleLeadsCount: leadsList.filter((l) => {
                if (l.status === 'won' || l.status === 'lost') return false;
                return new Date(l.updated_at).getTime() < Date.now() - 7 * 86400000;
            }).length,
            wonCount,
            conversionRate: leadsList.length > 0 ? Math.round((wonCount / leadsList.length) * 100) : 0,
            lastLeadUpdatedAt: leadsList[0]?.updated_at ?? null,
            currentManagerId: user.reports_to ?? null,
            currentManagerName,
        };

        return { member, leads: leadsList, error: null };
    } catch (err) {
        captureError(err, { fn: 'getTeamMemberDetail' });
        return { member: null, leads: [], error: err instanceof Error ? err.message : 'Unknown error fetching member' };
    }
}

/**
 * Fetch the list of active managers/directors that an agent can be reassigned to.
 * Optionally excludes the current manager id so the picker doesn't offer a no-op.
 */
export async function fetchReassignableManagers(
    excludeId?: string | null,
): Promise<{ data: ReassignableManager[]; error: string | null }> {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('id, full_name, role')
            .in('role', ['manager', 'director'])
            .eq('is_active', true)
            .order('full_name', { ascending: true });
        if (error) return { data: [], error: error.message };

        const rows = (data || []) as { id: string; full_name: string; role: 'manager' | 'director' }[];
        const filtered = excludeId ? rows.filter((r) => r.id !== excludeId) : rows;
        return {
            data: filtered.map((r) => ({ id: r.id, fullName: r.full_name, role: r.role })),
            error: null,
        };
    } catch (err) {
        captureError(err, { fn: 'fetchReassignableManagers' });
        return { data: [], error: err instanceof Error ? err.message : 'Unknown error fetching managers' };
    }
}

/**
 * Reassign an agent's upline. Uses the SECURITY DEFINER RPC so callers with
 * the reassign_agents capability (admin/director/pa) can perform the update
 * without direct RLS UPDATE rights on the users table.
 */
export async function reassignAgent(agentId: string, newManagerId: string | null): Promise<{ error: string | null }> {
    try {
        const { error } = await supabase.rpc('reassign_agent_upline', {
            p_agent_id: agentId,
            p_new_manager_id: newManagerId,
        });
        if (error) return { error: error.message };
        return { error: null };
    } catch (err) {
        captureError(err, { fn: 'reassignAgent' });
        return { error: err instanceof Error ? err.message : 'Unknown error reassigning agent' };
    }
}

/**
 * Return every active agent together with their current upline — for the
 * reassign-agents picker screen. PAs can't SELECT users directly via RLS so
 * this wraps a SECURITY DEFINER RPC that enforces the reassign_agents
 * capability on the caller.
 */
export async function fetchAgentsForReassign(): Promise<{
    data: AgentForReassign[];
    error: string | null;
}> {
    try {
        const { data, error } = await supabase.rpc('list_agents_for_reassign');
        if (error) return { data: [], error: error.message };
        const rows = (data || []) as {
            id: string;
            full_name: string;
            email: string | null;
            reports_to: string | null;
            reports_to_name: string | null;
        }[];
        return {
            data: rows.map((r) => ({
                id: r.id,
                fullName: r.full_name,
                email: r.email,
                currentManagerId: r.reports_to,
                currentManagerName: r.reports_to_name,
            })),
            error: null,
        };
    } catch (err) {
        captureError(err, { fn: 'fetchAgentsForReassign' });
        return { data: [], error: err instanceof Error ? err.message : 'Unknown error fetching agents' };
    }
}

// ── Manager Overview ─────────────────────────────────────────

export interface ManagerCandidatePipelineRow {
    id: string;
    name: string;
    status: CandidateStatus;
    daysSinceLastUpdate: number;
    lastUpdatedAt: string | null;
}

export interface ManagerOverview {
    manager: TeamMember;
    candidatePipeline: {
        outstandingTotal: number;
        byStage: Partial<Record<CandidateStatus, number>>;
        recentlyUpdated: ManagerCandidatePipelineRow[];
    };
    teamPerformance: {
        periodDays: number;
        activitiesLogged: number;
        leadsClosed: number;
        leadsWon: number;
        winRate: number;
    };
    teamRoster: {
        id: string;
        name: string;
        isActive: boolean;
        openLeadsCount: number;
        staleLeadsCount: number;
        wonCount: number;
    }[];
}

/**
 * Fetch the director-facing snapshot of a manager: profile, recruitment
 * pipeline (outstanding by stage + 5 oldest by stage_entered_at),
 * team performance (last N days), and team roster with lead signals.
 *
 * Uses parallel queries — one round-trip's worth from the caller's perspective.
 */
export async function fetchManagerOverview(
    managerId: string,
    periodDays = 30,
    now: Date = new Date(),
): Promise<{ data: ManagerOverview | null; error: string | null }> {
    try {
        const periodStart = new Date(now.getTime() - periodDays * 86400000).toISOString();
        const staleCutoff = now.getTime() - 7 * 86400000;

        const [managerResult, candidatesResult, agentsResult] = await Promise.all([
            supabase
                .from('users')
                .select('id, full_name, role, phone, email, avatar_url, is_active, created_at, reports_to')
                .eq('id', managerId)
                .single(),
            supabase
                .from('candidates')
                .select('id, name, status, stage_entered_at, updated_at')
                .eq('assigned_manager_id', managerId),
            supabase.from('users').select('id, full_name, is_active').eq('reports_to', managerId).eq('role', 'agent'),
        ]);

        if (managerResult.error) return { data: null, error: managerResult.error.message };
        if (!managerResult.data) return { data: null, error: 'Manager not found' };
        if (candidatesResult.error) return { data: null, error: candidatesResult.error.message };
        if (agentsResult.error) return { data: null, error: agentsResult.error.message };

        const managerRow = managerResult.data as {
            id: string;
            full_name: string;
            role: string;
            phone: string | null;
            email: string | null;
            avatar_url: string | null;
            is_active: boolean | null;
            created_at: string | null;
            reports_to: string | null;
        };

        // Resolve upline name (best-effort; null if missing)
        let currentManagerName: string | null = null;
        if (managerRow.reports_to) {
            const { data: uplineRow } = await supabase
                .from('users')
                .select('full_name')
                .eq('id', managerRow.reports_to)
                .single();
            currentManagerName = (uplineRow as { full_name: string } | null)?.full_name ?? null;
        }

        // ── Candidate pipeline ──
        const candidateRows = (candidatesResult.data || []) as {
            id: string;
            name: string;
            status: CandidateStatus;
            stage_entered_at: string | null;
            updated_at: string | null;
        }[];

        const byStage: Partial<Record<CandidateStatus, number>> = {};
        const outstandingRows: ManagerCandidatePipelineRow[] = [];

        for (const c of candidateRows) {
            if (TERMINAL_CANDIDATE_STATUSES.has(c.status)) continue;
            byStage[c.status] = (byStage[c.status] ?? 0) + 1;
            const lastUpdatedAt = c.stage_entered_at ?? c.updated_at;
            const daysSinceLastUpdate = lastUpdatedAt
                ? Math.max(0, Math.floor((now.getTime() - new Date(lastUpdatedAt).getTime()) / 86400000))
                : 0;
            outstandingRows.push({
                id: c.id,
                name: c.name,
                status: c.status,
                daysSinceLastUpdate,
                lastUpdatedAt,
            });
        }

        const recentlyUpdated = outstandingRows
            .slice()
            .sort((a, b) => b.daysSinceLastUpdate - a.daysSinceLastUpdate)
            .slice(0, 5);

        // ── Team performance + roster ──
        const agentRows = Array.isArray(agentsResult.data)
            ? (agentsResult.data as {
                  id: string;
                  full_name: string;
                  is_active: boolean | null;
              }[])
            : [];

        const agentIds = agentRows.map((a) => a.id);
        let activitiesLogged = 0;
        let leadsClosed = 0;
        let leadsWon = 0;
        const leadStatsMap: Record<string, { open: number; stale: number; won: number }> = {};

        if (agentIds.length > 0) {
            const [activitiesResult, allLeadsResult, periodLeadsResult] = await Promise.all([
                supabase
                    .from('lead_activities')
                    .select('user_id')
                    .in('user_id', agentIds)
                    .gte('created_at', periodStart),
                supabase.from('leads').select('assigned_to, status, updated_at').in('assigned_to', agentIds),
                supabase
                    .from('leads')
                    .select('status')
                    .in('assigned_to', agentIds)
                    .in('status', ['won', 'lost'])
                    .gte('updated_at', periodStart),
            ]);

            activitiesLogged = ((activitiesResult.data || []) as unknown[]).length;

            const periodLeads = (periodLeadsResult.data || []) as { status: string }[];
            leadsClosed = periodLeads.length;
            leadsWon = periodLeads.filter((l) => l.status === 'won').length;

            (
                (allLeadsResult.data || []) as { assigned_to: string; status: string; updated_at: string | null }[]
            ).forEach((lead) => {
                if (!leadStatsMap[lead.assigned_to]) {
                    leadStatsMap[lead.assigned_to] = { open: 0, stale: 0, won: 0 };
                }
                if (lead.status === 'won') {
                    leadStatsMap[lead.assigned_to].won++;
                }
                if (lead.status !== 'won' && lead.status !== 'lost') {
                    leadStatsMap[lead.assigned_to].open++;
                    if (lead.updated_at && new Date(lead.updated_at).getTime() < staleCutoff) {
                        leadStatsMap[lead.assigned_to].stale++;
                    }
                }
            });
        }

        const winRate = leadsClosed > 0 ? Math.round((leadsWon / leadsClosed) * 100) : 0;

        const teamRoster = agentRows.map((a) => {
            const stats = leadStatsMap[a.id] ?? { open: 0, stale: 0, won: 0 };
            return {
                id: a.id,
                name: a.full_name,
                isActive: a.is_active ?? true,
                openLeadsCount: stats.open,
                staleLeadsCount: stats.stale,
                wonCount: stats.won,
            };
        });

        const manager: TeamMember = {
            id: managerRow.id,
            name: managerRow.full_name,
            role: managerRow.role as TeamMember['role'],
            phone: managerRow.phone,
            email: managerRow.email,
            avatarUrl: managerRow.avatar_url,
            isActive: managerRow.is_active ?? true,
            joinedDate: managerRow.created_at ?? '',
            leadsCount: 0,
            openLeadsCount: 0,
            staleLeadsCount: 0,
            wonCount: 0,
            conversionRate: 0,
            lastLeadUpdatedAt: null,
            currentManagerId: managerRow.reports_to ?? null,
            currentManagerName,
            teamSize: agentRows.length,
            outstandingCandidatesCount: outstandingRows.length,
        };

        return {
            data: {
                manager,
                candidatePipeline: {
                    outstandingTotal: outstandingRows.length,
                    byStage,
                    recentlyUpdated,
                },
                teamPerformance: {
                    periodDays,
                    activitiesLogged,
                    leadsClosed,
                    leadsWon,
                    winRate,
                },
                teamRoster,
            },
            error: null,
        };
    } catch (err) {
        captureError(err, { fn: 'fetchManagerOverview' });
        return {
            data: null,
            error: err instanceof Error ? err.message : 'Unknown error fetching manager overview',
        };
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

        // Fetch leads and activities in parallel (independent queries)
        const [leadsResult, activitiesResult] = await Promise.all([
            supabase
                .from('leads')
                .select('assigned_to, status')
                .in('assigned_to', agentIds)
                .in('status', ['won', 'lost'])
                .gte('updated_at', dateRange.start)
                .lte('updated_at', dateRange.end),
            supabase
                .from('lead_activities')
                .select('user_id')
                .in('user_id', agentIds)
                .gte('created_at', dateRange.start)
                .lte('created_at', dateRange.end),
        ]);

        const { data: leads, error: leadsError } = leadsResult;
        const { data: activities, error: activitiesError } = activitiesResult;

        if (leadsError) return { data: emptyResult, error: leadsError.message };
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
