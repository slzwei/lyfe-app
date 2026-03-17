/**
 * Activity tracking service — log and query agent activities on leads.
 */
import type { LeadActivityType } from '@/types/lead';
import { captureError } from './sentry';
import { supabase } from './supabase';

// ── Types ────────────────────────────────────────────────────

export interface ActivitySummary {
    agentId: string;
    totalActivities: number;
    byType: { type: LeadActivityType; count: number }[];
    dateRange: { start: string; end: string };
}

// ── Functions ────────────────────────────────────────────────

/**
 * Get an activity summary for a specific agent within a date range.
 * Returns counts grouped by activity type.
 *
 * @param agentId - The agent's user ID
 * @param dateRange - Start and end dates (YYYY-MM-DD). Start must be before or equal to end.
 * @returns Activity summary with counts by type, or an error message
 */
export async function getAgentActivitySummary(
    agentId: string,
    dateRange: { start: string; end: string },
): Promise<{ data: ActivitySummary; error: string | null }> {
    const emptyResult: ActivitySummary = {
        agentId,
        totalActivities: 0,
        byType: [],
        dateRange,
    };

    try {
        // Validate date range: start must be <= end
        if (dateRange.start > dateRange.end) {
            return { data: emptyResult, error: 'Invalid date range: start must be before or equal to end' };
        }
        const { data, error } = await supabase
            .from('lead_activities')
            .select('type')
            .eq('user_id', agentId)
            .gte('created_at', dateRange.start)
            .lte('created_at', dateRange.end);

        if (error) return { data: emptyResult, error: error.message };

        const activities = (data || []) as { type: string }[];

        // Count by type
        const typeCounts: Record<string, number> = {};
        activities.forEach((a) => {
            typeCounts[a.type] = (typeCounts[a.type] || 0) + 1;
        });

        const byType = Object.entries(typeCounts).map(([type, count]) => ({
            type: type as LeadActivityType,
            count,
        }));

        return {
            data: {
                agentId,
                totalActivities: activities.length,
                byType,
                dateRange,
            },
            error: null,
        };
    } catch (err) {
        captureError(err, { fn: 'getActivitySummary' });
        return {
            data: emptyResult,
            error: err instanceof Error ? err.message : 'Unknown error fetching activity summary',
        };
    }
}

/**
 * Batch-fetch activity summaries for multiple agents in a single query.
 * Replaces the N+1 pattern of calling getAgentActivitySummary per agent.
 *
 * @param agentIds - Array of agent user IDs
 * @param dateRange - Start and end dates (ISO strings)
 * @returns One ActivitySummary per agent (same shape as getAgentActivitySummary)
 */
export async function getTeamActivitySummaries(
    agentIds: string[],
    dateRange: { start: string; end: string },
): Promise<{ data: ActivitySummary[]; error: string | null }> {
    if (agentIds.length === 0) {
        return { data: [], error: null };
    }

    try {
        if (dateRange.start > dateRange.end) {
            return { data: [], error: 'Invalid date range: start must be before or equal to end' };
        }

        // Single query fetching type + user_id for all agents at once
        const { data, error } = await supabase
            .from('lead_activities')
            .select('user_id, type')
            .in('user_id', agentIds)
            .gte('created_at', dateRange.start)
            .lte('created_at', dateRange.end);

        if (error) return { data: [], error: error.message };

        const activities = (data || []) as { user_id: string; type: string }[];

        // Aggregate: { agentId -> { type -> count } }
        const agentTypeCounts: Record<string, Record<string, number>> = {};
        const agentTotals: Record<string, number> = {};

        activities.forEach((a) => {
            if (!agentTypeCounts[a.user_id]) {
                agentTypeCounts[a.user_id] = {};
                agentTotals[a.user_id] = 0;
            }
            agentTypeCounts[a.user_id][a.type] = (agentTypeCounts[a.user_id][a.type] || 0) + 1;
            agentTotals[a.user_id]++;
        });

        // Build one ActivitySummary per agent (preserve input order)
        const summaries: ActivitySummary[] = agentIds.map((agentId) => {
            const typeCounts = agentTypeCounts[agentId] || {};
            const byType = Object.entries(typeCounts).map(([type, count]) => ({
                type: type as LeadActivityType,
                count,
            }));

            return {
                agentId,
                totalActivities: agentTotals[agentId] || 0,
                byType,
                dateRange,
            };
        });

        return { data: summaries, error: null };
    } catch (err) {
        captureError(err, { fn: 'getTeamActivitySummaries' });
        return {
            data: [],
            error: err instanceof Error ? err.message : 'Unknown error fetching team activity summaries',
        };
    }
}
