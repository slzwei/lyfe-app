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
    userRole: string | undefined;
    fullName: string | undefined;
}

// ---------------------------------------------------------------------------
// Sub-hook: Note input UI state + save handler
// ---------------------------------------------------------------------------

interface UseLeadNoteParams {
    lead: Lead | null;
    userId: string | undefined;
    setActivities: React.Dispatch<React.SetStateAction<LeadActivity[]>>;
    setError: React.Dispatch<React.SetStateAction<string | null>>;
}

function useLeadNote({ lead, userId, setActivities, setError }: UseLeadNoteParams) {
    const [showNoteInput, setShowNoteInput] = useState(false);
    const [noteText, setNoteText] = useState('');
    const { isSubmitting: isSavingNote, guard: noteGuard } = useSubmitGuard();

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
        [noteGuard, noteText, userId, lead, setActivities, setError],
    );

    return { showNoteInput, setShowNoteInput, noteText, setNoteText, isSavingNote, handleAddNote };
}

// ---------------------------------------------------------------------------
// Sub-hook: Status picker UI state + optimistic update
// ---------------------------------------------------------------------------

interface UseLeadStatusParams {
    lead: Lead | null;
    userId: string | undefined;
    currentStatus: LeadStatus;
    setCurrentStatus: React.Dispatch<React.SetStateAction<LeadStatus>>;
    setActivities: React.Dispatch<React.SetStateAction<LeadActivity[]>>;
    setError: React.Dispatch<React.SetStateAction<string | null>>;
}

function useLeadStatus({
    lead,
    userId,
    currentStatus,
    setCurrentStatus,
    setActivities,
    setError,
}: UseLeadStatusParams) {
    const [showStatusPicker, setShowStatusPicker] = useState(false);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

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
        [lead, currentStatus, userId, setCurrentStatus, setActivities, setError],
    );

    return { showStatusPicker, setShowStatusPicker, isUpdatingStatus, handleChangeStatus };
}

// ---------------------------------------------------------------------------
// Sub-hook: Reassignment modal + agent fetch + optimistic update
// ---------------------------------------------------------------------------

interface UseLeadReassignParams {
    lead: Lead | null;
    userId: string | undefined;
    userRole: string | undefined;
    fullName: string | undefined;
    setActivities: React.Dispatch<React.SetStateAction<LeadActivity[]>>;
}

function useLeadReassign({ lead, userId, userRole, fullName, setActivities }: UseLeadReassignParams) {
    const [showReassignModal, setShowReassignModal] = useState(false);
    const [reassignAgents, setReassignAgents] = useState<{ id: string; full_name: string }[]>([]);
    const [isReassigning, setIsReassigning] = useState(false);

    const handleOpenReassign = useCallback(async () => {
        if (userId && lead) {
            const { data } = await fetchTeamAgents(userId, userRole);
            setReassignAgents(data.filter((a) => a.id !== lead.assigned_to));
        }
        setShowReassignModal(true);
    }, [userId, userRole, lead]);

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
        [lead, userId, fullName, setActivities],
    );

    return {
        showReassignModal,
        setShowReassignModal,
        reassignAgents,
        isReassigning,
        handleOpenReassign,
        handleReassign,
    };
}

// ---------------------------------------------------------------------------
// Main hook — composes sub-hooks, single public import point
// ---------------------------------------------------------------------------

export function useLeadDetail({ leadId, userId, userRole, fullName }: UseLeadDetailParams) {
    const [lead, setLead] = useState<Lead | null>(null);
    const [activities, setActivities] = useState<LeadActivity[]>([]);
    const [currentStatus, setCurrentStatus] = useState<LeadStatus>('new');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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

    const noteState = useLeadNote({ lead, userId, setActivities, setError });
    const statusState = useLeadStatus({ lead, userId, currentStatus, setCurrentStatus, setActivities, setError });
    const reassignState = useLeadReassign({ lead, userId, userRole, fullName, setActivities });

    return {
        lead,
        activities,
        currentStatus,
        isLoading,
        error,
        setError,
        loadData,
        logActivity,
        handleChangeStatus: statusState.handleChangeStatus,
        handleAddNote: noteState.handleAddNote,
        handleOpenReassign: reassignState.handleOpenReassign,
        handleReassign: reassignState.handleReassign,
        showReassignModal: reassignState.showReassignModal,
        setShowReassignModal: reassignState.setShowReassignModal,
        reassignAgents: reassignState.reassignAgents,
        isReassigning: reassignState.isReassigning,
        showNoteInput: noteState.showNoteInput,
        setShowNoteInput: noteState.setShowNoteInput,
        noteText: noteState.noteText,
        setNoteText: noteState.setNoteText,
        isSavingNote: noteState.isSavingNote,
        showStatusPicker: statusState.showStatusPicker,
        setShowStatusPicker: statusState.setShowStatusPicker,
        isUpdatingStatus: statusState.isUpdatingStatus,
    };
}
