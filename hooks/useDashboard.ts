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
import { type LeadActivity, type LeadActivityType } from '@/types/lead';

const ACTIVITY_ICONS: Record<LeadActivityType, string> = {
    created: 'person-add',
    note: 'create',
    call: 'call',
    whatsapp: 'logo-whatsapp',
    status_change: 'swap-horizontal',
    reassignment: 'swap-horizontal',
    email: 'mail',
    meeting: 'calendar',
    follow_up: 'time',
};

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
            icon: ACTIVITY_ICONS[a.type] || 'ellipse',
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
            const promises: Promise<any>[] = [
                fetchLeadStats(userId, isManagerLike),
                fetchRecentActivities(userId, isManagerLike, 5),
            ];
            if (isManagerLike && role) promises.push(fetchManagerDashboardStats(userId, role));
            const results = await Promise.all(promises);
            if (results[0].data) setStats(results[0].data);
            if (results[1].data) setRecentActivities(results[1].data);
            if (results[2]?.data) setManagerStats(results[2].data);
            if (results[0].error) setError('Failed to load dashboard data');
            if (!isManagerLike) {
                const eventsResult = await fetchUpcomingEvents(userId, 5);
                setAgentEvents(eventsResult.data);
            }
        } catch {
            setError('Failed to load dashboard data');
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
        refreshing,
        loadDashboardData,
        onRefresh,
        displayActivities,
    };
}
