import { useCallback, useEffect, useState } from 'react';
import { useSubmitGuard } from '@/hooks/useSubmitGuard';
import {
    addLeadActivity,
    addLeadNote,
    fetchLead,
    fetchLeadActivities,
    fetchTeamAgents,
    reassignLead,
    updateLeadStatus,
} from '@/lib/leads';
import type { Lead } from '@/types/lead';
import type { LeadActivity, LeadStatus } from '@/types/lead';

interface UseLeadDetailParams {
    leadId: string | undefined;
    userId: string | undefined;
    fullName: string | undefined;
}

export function useLeadDetail({ leadId, userId, fullName }: UseLeadDetailParams) {
    const [lead, setLead] = useState<Lead | null>(null);
    const [activities, setActivities] = useState<LeadActivity[]>([]);
    const [currentStatus, setCurrentStatus] = useState<LeadStatus>('new');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [showNoteInput, setShowNoteInput] = useState(false);
    const [noteText, setNoteText] = useState('');
    const { isSubmitting: isSavingNote, guard: noteGuard } = useSubmitGuard();

    const [showStatusPicker, setShowStatusPicker] = useState(false);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

    const [showReassignModal, setShowReassignModal] = useState(false);
    const [reassignAgents, setReassignAgents] = useState<{ id: string; full_name: string }[]>([]);
    const [isReassigning, setIsReassigning] = useState(false);

    const loadData = useCallback(async () => {
        if (!leadId) return;

        try {
            setError(null);
            const [leadResult, activitiesResult] = await Promise.all([fetchLead(leadId), fetchLeadActivities(leadId)]);

            if (leadResult.data) {
                setLead(leadResult.data);
                setCurrentStatus(leadResult.data.status);
            }
            if (leadResult.error) {
                setError('Failed to load lead details');
            }
            if (activitiesResult.data) {
                setActivities(activitiesResult.data);
            }
        } catch {
            setError('Failed to load lead details');
        }
        setIsLoading(false);
    }, [leadId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const logActivity = useCallback(
        (type: 'call' | 'whatsapp', description: string, metadata: Record<string, any>) => {
            if (!lead) return;
            const optimistic: LeadActivity = {
                id: `a_${Date.now()}`,
                lead_id: lead.id,
                user_id: userId || 'me',
                type,
                description,
                metadata,
                created_at: new Date().toISOString(),
                actor_name: fullName || undefined,
            };
            setActivities((prev) => [optimistic, ...prev]);
            if (userId) {
                addLeadActivity(lead.id, userId, type, description, metadata);
            }
        },
        [lead, userId, fullName],
    );

    const handleChangeStatus = useCallback(
        async (newStatus: LeadStatus) => {
            if (!lead || newStatus === currentStatus || !userId) return;

            const previousStatus = currentStatus;

            setCurrentStatus(newStatus);
            setShowStatusPicker(false);
            setIsUpdatingStatus(true);

            const { error } = await updateLeadStatus(lead.id, newStatus, previousStatus, userId);
            setIsUpdatingStatus(false);

            if (!error) {
                const { data: updatedActivities } = await fetchLeadActivities(lead.id);
                if (updatedActivities) setActivities(updatedActivities);
            } else {
                setCurrentStatus(previousStatus);
                setError('Failed to update status');
                if (__DEV__) console.error('Failed to update status:', error);
            }
        },
        [lead, currentStatus, userId],
    );

    const handleAddNote = useCallback(
        () =>
            noteGuard(async () => {
                if (!noteText.trim() || !userId || !lead) return;

                const { data, error } = await addLeadNote(lead.id, noteText.trim(), userId);

                if (data) {
                    setActivities((prev) => [data, ...prev]);
                    setNoteText('');
                    setShowNoteInput(false);
                } else if (error) {
                    setError('Failed to add note');
                    if (__DEV__) console.error('Failed to add note:', error);
                }
            }),
        [noteGuard, noteText, userId, lead],
    );

    const handleOpenReassign = useCallback(async () => {
        if (userId && lead) {
            const { data } = await fetchTeamAgents(userId);
            setReassignAgents(data.filter((a) => a.id !== lead.assigned_to));
        }
        setShowReassignModal(true);
    }, [userId, lead]);

    const handleReassign = useCallback(
        async (toAgent: { id: string; full_name: string }) => {
            if (!lead || !userId) return;
            const fromId = lead.assigned_to;
            const fromName = fromId;

            const newActivity: LeadActivity = {
                id: `a_${Date.now()}`,
                lead_id: lead.id,
                user_id: userId,
                type: 'reassignment',
                description: null,
                metadata: {
                    from_agent_id: fromId,
                    to_agent_id: toAgent.id,
                    from_agent_name: fromName,
                    to_agent_name: toAgent.full_name,
                },
                created_at: new Date().toISOString(),
                actor_name: fullName || undefined,
            };

            setShowReassignModal(false);

            setIsReassigning(true);
            const { error } = await reassignLead(lead.id, toAgent.id, fromId, fromName, toAgent.full_name, userId);
            setIsReassigning(false);
            if (!error) {
                setActivities((prev) => [newActivity, ...prev]);
            } else {
                if (__DEV__) console.error('Failed to reassign:', error);
            }
        },
        [lead, userId, fullName],
    );

    return {
        lead,
        activities,
        currentStatus,
        isLoading,
        error,
        setError,
        loadData,
        logActivity,
        handleChangeStatus,
        handleAddNote,
        handleOpenReassign,
        handleReassign,
        showReassignModal,
        setShowReassignModal,
        reassignAgents,
        isReassigning,
        showNoteInput,
        setShowNoteInput,
        noteText,
        setNoteText,
        isSavingNote,
        showStatusPicker,
        setShowStatusPicker,
        isUpdatingStatus,
    };
}
