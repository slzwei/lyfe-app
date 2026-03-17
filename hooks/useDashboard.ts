import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    fetchLeadStats,
    fetchManagerDashboardStats,
    fetchRecentActivities,
    type LeadPipelineStats,
    type ManagerDashboardStats,
} from '@/lib/leads';
import { timeAgo } from '@/lib/dateTime';
import { fetchUpcomingEvents } from '@/lib/events';
import { fetchCandidateRoadmap } from '@/lib/roadmap';
import { fetchPAManagerIds, fetchPACandidateCount, fetchPAInterviewCount } from '@/lib/recruitment';
import type { AgencyEvent } from '@/types/event';
import type { ProgrammeWithModules } from '@/types/roadmap';
import { ACTIVITY_ICONS, type LeadActivity } from '@/types/lead';

export function formatActivities(
    activities: (LeadActivity & { lead_name?: string })[],
): { id: string; type: string; leadName: string; detail: string; time: string; icon: string }[] {
    return activities.map((a) => {
        let detail = a.description || '';
        if (a.type === 'status_change' && a.metadata) {
            const from = a.metadata.from_status || '?';
            const to = a.metadata.to_status || '?';
            detail = `${from.charAt(0).toUpperCase() + from.slice(1)} \u2192 ${to.charAt(0).toUpperCase() + to.slice(1)}`;
        } else if (a.type === 'created') {
            detail = detail || 'Lead created';
        } else if (a.type === 'note') {
            detail = a.description
                ? `Note: ${a.description.substring(0, 40)}${a.description.length > 40 ? '...' : ''}`
                : 'Added a note';
        }
        return {
            id: a.id,
            type: a.type,
            leadName: a.lead_name || 'Unknown',
            detail,
            time: timeAgo(a.created_at),
            icon: ACTIVITY_ICONS[a.type]?.icon || 'ellipse',
        };
    });
}

interface UseDashboardParams {
    userId: string | undefined;
    role: string | undefined;
    isManagerView: boolean;
    isAdminRole: boolean;
}

export function useDashboard({ userId, role, isManagerView, isAdminRole }: UseDashboardParams) {
    const [stats, setStats] = useState<LeadPipelineStats | null>(null);
    const [recentActivities, setRecentActivities] = useState<(LeadActivity & { lead_name?: string })[]>([]);
    const [managerStats, setManagerStats] = useState<ManagerDashboardStats | null>(null);
    const [paStats, setPaStats] = useState<{ candidateCount: number; interviewCount: number; events: AgencyEvent[] }>({
        candidateCount: 0,
        interviewCount: 0,
        events: [],
    });
    const [agentEvents, setAgentEvents] = useState<AgencyEvent[]>([]);
    const [candidateRoadmap, setCandidateRoadmap] = useState<ProgrammeWithModules[]>([]);
    const [candidateEvents, setCandidateEvents] = useState<AgencyEvent[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const isCandidate = role === 'candidate';
    const isPa = role === 'pa';

    const loadDashboardData = useCallback(async () => {
        if (!userId) return;
        try {
            setError(null);
            if (isCandidate) {
                const [roadmapResult, eventsResult] = await Promise.all([
                    fetchCandidateRoadmap(userId),
                    fetchUpcomingEvents(userId, 3),
                ]);
                if (roadmapResult.data) setCandidateRoadmap(roadmapResult.data);
                setCandidateEvents(eventsResult.data);
                return;
            }
            if (isPa) {
                const managerIds = await fetchPAManagerIds(userId);
                const [total, interviews, eventsResult] = await Promise.all([
                    fetchPACandidateCount(managerIds),
                    fetchPAInterviewCount(managerIds),
                    fetchUpcomingEvents(userId, 5),
                ]);
                setPaStats({
                    candidateCount: total ?? 0,
                    interviewCount: interviews ?? 0,
                    events: eventsResult.data,
                });
                return;
            }
            const isManagerLike = isManagerView || isAdminRole;
            const [statsResult, activitiesResult, managerStatsResult, eventsResult] = await Promise.all([
                fetchLeadStats(userId, isManagerLike),
                fetchRecentActivities(userId, isManagerLike, 5),
                isManagerLike && role
                    ? fetchManagerDashboardStats(userId, role)
                    : Promise.resolve({ data: null as ManagerDashboardStats | null, error: null }),
                !isManagerLike ? fetchUpcomingEvents(userId, 5) : Promise.resolve({ data: [] as AgencyEvent[] }),
            ]);
            if (statsResult.data) setStats(statsResult.data);
            if (activitiesResult.data) setRecentActivities(activitiesResult.data);
            if (managerStatsResult.data) setManagerStats(managerStatsResult.data);
            if (eventsResult.data) setAgentEvents(eventsResult.data);
            if (statsResult.error) setError('Failed to load dashboard data');
        } catch {
            setError('Failed to load dashboard data');
        } finally {
            setIsLoading(false);
        }
    }, [userId, isCandidate, isPa, isManagerView, isAdminRole, role]);

    useEffect(() => {
        loadDashboardData();
    }, [loadDashboardData]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadDashboardData();
        setRefreshing(false);
    }, [loadDashboardData]);

    const displayActivities = useMemo(
        () => (recentActivities.length > 0 ? formatActivities(recentActivities) : []),
        [recentActivities, isManagerView],
    );

    return {
        stats,
        recentActivities,
        managerStats,
        paStats,
        agentEvents,
        candidateRoadmap,
        candidateEvents,
        error,
        setError,
        isLoading,
        refreshing,
        loadDashboardData,
        onRefresh,
        displayActivities,
    };
}
