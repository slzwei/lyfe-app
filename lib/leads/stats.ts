/**
 * Lead stats & dashboard aggregations
 */
import { LEAD_STATUSES, type LeadActivity, type LeadStatus } from '@/types/lead';
import { captureError } from '../sentry';
import { supabase } from '../supabase';
import { resolveTeamDataScope } from '../teamDataScope';

export interface LeadPipelineStats {
    totalLeads: number;
    newThisWeek: number;
    conversionRate: number;
    activeFollowUps: number;
    pipeline: { status: LeadStatus; count: number }[];
}

export interface ManagerDashboardStats {
    activeCandidates: number;
    agentsManaged: number;
}

/**
 * Fetch aggregate pipeline stats for the home dashboard.
 * Uses the get_lead_pipeline_stats RPC to compute all aggregations server-side
 * in a single round-trip instead of fetching every lead row into JS.
 */
export async function fetchLeadStats(
    userId: string,
    isManager: boolean,
): Promise<{ data: LeadPipelineStats; error: string | null }> {
    const emptyData: LeadPipelineStats = {
        totalLeads: 0,
        newThisWeek: 0,
        conversionRate: 0,
        activeFollowUps: 0,
        pipeline: [],
    };

    const { data, error } = await supabase.rpc('get_lead_pipeline_stats', {
        p_user_id: userId,
        p_is_manager: isManager,
    });

    if (error) {
        return { data: emptyData, error: error.message };
    }

    if (!data) {
        return { data: emptyData, error: null };
    }

    // The RPC returns JSONB — parse into our LeadPipelineStats shape
    const result = data as {
        totalLeads: number;
        newThisWeek: number;
        conversionRate: number;
        activeFollowUps: number;
        pipeline: { status: string; count: number }[];
    };

    return {
        data: {
            totalLeads: result.totalLeads ?? 0,
            newThisWeek: result.newThisWeek ?? 0,
            conversionRate: result.conversionRate ?? 0,
            activeFollowUps: result.activeFollowUps ?? 0,
            pipeline: (result.pipeline || []).map((p) => ({
                status: p.status as LeadStatus,
                count: p.count ?? 0,
            })),
        },
        error: null,
    };
}

/**
 * Fetch recent activities across all leads for the home dashboard.
 */
export async function fetchRecentActivities(
    userId: string,
    isManager: boolean,
    limit = 5,
    includeTestData?: boolean,
): Promise<{ data: (LeadActivity & { lead_name?: string })[]; error: string | null }> {
    // Scope lead IDs at the query level instead of post-fetch filtering
    let leadIdFilter: string[] | null = null;

    if (!isManager) {
        const { data: userLeads } = await supabase.from('leads').select('id').eq('assigned_to', userId);
        leadIdFilter = ((userLeads || []) as { id: string }[]).map((l) => l.id);
    } else {
        const teamDataScope = includeTestData ?? (await resolveTeamDataScope(userId));
        const { data: agents } = await supabase
            .from('users')
            .select('id')
            .eq('reports_to', userId)
            .eq('role', 'agent')
            .eq('is_active', true)
            .eq('is_test_data', teamDataScope);
        const agentIds = ((agents || []) as { id: string }[]).map((a) => a.id);
        const { data: teamLeads } = await supabase
            .from('leads')
            .select('id')
            .in('assigned_to', [...agentIds, userId]);
        leadIdFilter = ((teamLeads || []) as { id: string }[]).map((l) => l.id);
    }

    if (!leadIdFilter || leadIdFilter.length === 0) return { data: [], error: null };

    let query = supabase
        .from('lead_activities')
        .select('*, leads!lead_activities_lead_id_fkey(full_name)')
        .in('lead_id', leadIdFilter)
        .order('created_at', { ascending: false })
        .limit(limit);

    const { data, error } = await query;
    if (error) return { data: [], error: error.message };

    type RecentActivityRow = {
        id: string;
        lead_id: string;
        user_id: string;
        type: string;
        description: string | null;
        metadata: Record<string, unknown> | null;
        created_at: string;
        leads: { full_name: string } | null;
    };
    const typedRecentData = (data || []) as RecentActivityRow[];

    const activities = typedRecentData.map((item) => ({
        id: item.id,
        lead_id: item.lead_id,
        user_id: item.user_id,
        type: item.type,
        description: item.description,
        metadata: item.metadata,
        created_at: item.created_at,
        lead_name: item.leads?.full_name || 'Unknown',
    }));

    return { data: activities as unknown as (LeadActivity & { lead_name?: string })[], error: null };
}

/**
 * Manager dashboard view: count of leads by stage plus recent activity for the team.
 */
export async function getTeamLeadSummary(
    managerId: string,
    includeTestData?: boolean,
): Promise<{
    data: {
        byStage: { stage: LeadStatus; count: number }[];
        recentActivity: { lead_id: string; lead_name: string; type: string; created_at: string }[];
        totalLeads: number;
    };
    error: string | null;
}> {
    const emptyResult = {
        data: { byStage: [], recentActivity: [], totalLeads: 0 },
        error: null as string | null,
    };

    try {
        const teamDataScope = includeTestData ?? (await resolveTeamDataScope(managerId));
        const { data: agents, error: agentsError } = await supabase
            .from('users')
            .select('id')
            .eq('reports_to', managerId)
            .eq('role', 'agent')
            .eq('is_active', true)
            .eq('is_test_data', teamDataScope);

        if (agentsError) return { ...emptyResult, error: agentsError.message };

        const agentIds = ((agents || []) as { id: string }[]).map((a) => a.id);
        if (agentIds.length === 0) return emptyResult;

        const { data: leads, error: leadsError } = await supabase
            .from('leads')
            .select('id, status, full_name')
            .in('assigned_to', agentIds);

        if (leadsError) return { ...emptyResult, error: leadsError.message };

        const allLeads = (leads || []) as { id: string; status: LeadStatus; full_name: string }[];

        const stageCounts: Record<string, number> = {};
        allLeads.forEach((l) => {
            stageCounts[l.status] = (stageCounts[l.status] || 0) + 1;
        });

        const byStage = LEAD_STATUSES.map((s) => ({ stage: s, count: stageCounts[s] || 0 }));

        const leadIds = allLeads.map((l) => l.id);
        const leadNameMap: Record<string, string> = {};
        allLeads.forEach((l) => {
            leadNameMap[l.id] = l.full_name;
        });

        let recentActivity: { lead_id: string; lead_name: string; type: string; created_at: string }[] = [];

        if (leadIds.length > 0) {
            const { data: activities } = await supabase
                .from('lead_activities')
                .select('lead_id, type, created_at')
                .in('lead_id', leadIds)
                .order('created_at', { ascending: false })
                .limit(10);

            recentActivity = ((activities || []) as { lead_id: string; type: string; created_at: string }[]).map(
                (a) => ({
                    lead_id: a.lead_id,
                    lead_name: leadNameMap[a.lead_id] || 'Unknown',
                    type: a.type,
                    created_at: a.created_at,
                }),
            );
        }

        return {
            data: { byStage, recentActivity, totalLeads: allLeads.length },
            error: null,
        };
    } catch (err) {
        captureError(err, { fn: 'getTeamLeadSummary' });
        return { ...emptyResult, error: err instanceof Error ? err.message : 'Unknown error fetching team summary' };
    }
}

/**
 * Fetch extra stats for the manager dashboard (candidate count, agent count).
 */
export async function fetchManagerDashboardStats(
    userId: string,
    userRole: string,
    includeTestData?: boolean,
): Promise<{ data: ManagerDashboardStats; error: string | null }> {
    const teamDataScope = includeTestData ?? (await resolveTeamDataScope(userId));

    let candidateQuery = supabase
        .from('candidates')
        .select('id', { count: 'exact', head: true })
        .in('status', ['applied', 'interview_scheduled', 'interviewed', 'approved', 'exam_prep']);

    if (userRole === 'manager') {
        candidateQuery = candidateQuery.eq('assigned_manager_id', userId);
    }

    const { count: candidateCount } = await candidateQuery;

    let agentQuery = supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'agent')
        .eq('is_active', true)
        .eq('is_test_data', teamDataScope);

    if (userRole === 'manager') {
        agentQuery = agentQuery.eq('reports_to', userId);
    }

    const { count: agentCount } = await agentQuery;

    return {
        data: {
            activeCandidates: candidateCount || 0,
            agentsManaged: agentCount || 0,
        },
        error: null,
    };
}
