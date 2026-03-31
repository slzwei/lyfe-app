/**
 * Hook encapsulating interview scheduling bottom sheet state.
 * Manages form state for creating/editing interviews, validation, and submission.
 */
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { deleteInterview, scheduleInterview, updateInterview } from '@/lib/recruitment';
import { useSubmitGuard } from '@/hooks/useSubmitGuard';
import type { Interview, InterviewRecommendation } from '@/types/recruitment';

interface UseInterviewSchedulerParams {
    candidateId: string;
    candidateManagerId: string;
    candidateInterviewCount: number;
    userId: string | undefined;
    onInterviewChanged: (action: 'created' | 'updated' | 'deleted', interview: Interview) => void;
}

interface InterviewSchedulerState {
    showScheduleSheet: boolean;
    editingInterview: Interview | null;
    scheduleStatus: Interview['status'];
    scheduleDate: Date;
    scheduleHour: number;
    scheduleMinute: number;
    scheduleAmPm: 'AM' | 'PM';
    scheduleType: 'zoom' | 'in_person';
    scheduleLink: string;
    scheduleLocation: string;
    scheduleNotes: string;
    scheduleRecommendation: InterviewRecommendation | null;
    isScheduling: boolean;
    scheduleError: string | null;
    setScheduleDate: (d: Date | ((prev: Date) => Date)) => void;
    setScheduleHour: (h: number) => void;
    setScheduleMinute: (m: number) => void;
    setScheduleAmPm: (v: 'AM' | 'PM') => void;
    setScheduleType: (t: 'zoom' | 'in_person') => void;
    setScheduleLink: (v: string) => void;
    setScheduleLocation: (v: string) => void;
    setScheduleNotes: (v: string) => void;
    setScheduleStatus: (s: Interview['status']) => void;
    setScheduleRecommendation: (r: InterviewRecommendation | null) => void;
    openNewInterview: () => void;
    openEditInterview: (interview: Interview) => void;
    closeScheduleSheet: () => void;
    dismissScheduleSheet: () => void;
    handleDeleteInterview: (interview: Interview) => void;
    handleSubmitSchedule: () => Promise<void>;
}

export function useInterviewScheduler({
    candidateId,
    candidateManagerId,
    candidateInterviewCount,
    userId,
    onInterviewChanged,
}: UseInterviewSchedulerParams): InterviewSchedulerState {
    const [showScheduleSheet, setShowScheduleSheet] = useState(false);
    const [editingInterview, setEditingInterview] = useState<Interview | null>(null);
    const [scheduleStatus, setScheduleStatus] = useState<Interview['status']>('scheduled');
    const [scheduleDate, setScheduleDate] = useState(() => {
        const d = new Date();
        d.setSeconds(0, 0);
        return d;
    });
    const [scheduleHour, setScheduleHour] = useState(10);
    const [scheduleMinute, setScheduleMinute] = useState(0);
    const [scheduleAmPm, setScheduleAmPm] = useState<'AM' | 'PM'>('AM');
    const [scheduleType, setScheduleType] = useState<'zoom' | 'in_person'>('zoom');
    const [scheduleLink, setScheduleLink] = useState('');
    const [scheduleLocation, setScheduleLocation] = useState('');
    const [scheduleNotes, setScheduleNotes] = useState('');
    const [scheduleRecommendation, setScheduleRecommendation] = useState<InterviewRecommendation | null>(null);
    const { isSubmitting: isScheduling, guard: scheduleGuard } = useSubmitGuard();
    const [scheduleError, setScheduleError] = useState<string | null>(null);

    const resetScheduleForm = useCallback(() => {
        const d = new Date();
        d.setSeconds(0, 0);
        setScheduleDate(d);
        setScheduleHour(10);
        setScheduleMinute(0);
        setScheduleAmPm('AM');
        setScheduleType('zoom');
        setScheduleLink('');
        setScheduleLocation('');
        setScheduleNotes('');
        setScheduleRecommendation(null);
        setScheduleError(null);
        setScheduleStatus('scheduled');
        setEditingInterview(null);
    }, []);

    const openNewInterview = useCallback(() => {
        resetScheduleForm();
        setShowScheduleSheet(true);
    }, [resetScheduleForm]);

    const openEditInterview = useCallback((interview: Interview) => {
        const dt = new Date(interview.datetime);
        const h24 = dt.getHours();
        const mins = dt.getMinutes();
        const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
        const ampm = h24 >= 12 ? 'PM' : 'AM';
        const nearestMin = Math.min(55, Math.round(mins / 5) * 5);
        setEditingInterview(interview);
        setScheduleDate(dt);
        setScheduleHour(h12);
        setScheduleMinute(nearestMin);
        setScheduleAmPm(ampm);
        setScheduleType(interview.type);
        setScheduleLink(interview.zoom_link || '');
        setScheduleLocation(interview.location || '');
        setScheduleNotes(interview.notes || '');
        setScheduleRecommendation(interview.recommendation ?? null);
        setScheduleStatus(interview.status);
        setScheduleError(null);
        setShowScheduleSheet(true);
    }, []);

    const closeScheduleSheet = useCallback(() => {
        setShowScheduleSheet(false);
        resetScheduleForm();
    }, [resetScheduleForm]);

    const dismissScheduleSheet = useCallback(() => {
        if (editingInterview) {
            Alert.alert('Discard changes?', 'Your edits will not be saved.', [
                { text: 'Keep editing', style: 'cancel' },
                { text: 'Discard', style: 'destructive', onPress: closeScheduleSheet },
            ]);
        } else {
            closeScheduleSheet();
        }
    }, [editingInterview, closeScheduleSheet]);

    const handleDeleteInterview = useCallback(
        (interview: Interview) => {
            Alert.alert(
                'Delete Interview',
                `Delete Round ${interview.round_number} interview? This cannot be undone.`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: async () => {
                            const { error } = await deleteInterview(interview.id);
                            if (error) {
                                Alert.alert('Error', 'Failed to delete interview.');
                                return;
                            }
                            onInterviewChanged('deleted', interview);
                        },
                    },
                ],
            );
        },
        [onInterviewChanged],
    );

    const submitSchedule = useCallback(
        (dt: Date) =>
            scheduleGuard(async () => {
                const isoDatetime = dt.toISOString();
                const loc = scheduleType === 'in_person' ? scheduleLocation.trim() || null : null;
                const link = scheduleType === 'zoom' ? scheduleLink.trim() || null : null;
                const notes = scheduleNotes.trim() || null;

                if (!userId) {
                    setScheduleError('Not authenticated');
                    return;
                }

                if (editingInterview) {
                    const { data: updated, error: updErr } = await updateInterview(editingInterview.id, {
                        type: scheduleType,
                        datetime: isoDatetime,
                        location: loc,
                        zoomLink: link,
                        notes,
                        status: scheduleStatus,
                        recommendation: scheduleRecommendation,
                    });
                    if (updErr || !updated) {
                        setScheduleError(updErr ?? 'Failed to update interview');
                        return;
                    }
                    onInterviewChanged('updated', updated);
                    closeScheduleSheet();
                    Alert.alert('Saved', 'Interview updated.');
                } else {
                    const { data: newInterview, error: schedErr } = await scheduleInterview({
                        candidateId,
                        managerId: candidateManagerId,
                        scheduledById: userId,
                        roundNumber: candidateInterviewCount + 1,
                        type: scheduleType,
                        datetime: isoDatetime,
                        location: loc,
                        zoomLink: link,
                        notes,
                    });
                    if (schedErr || !newInterview) {
                        setScheduleError(schedErr ?? 'Failed to schedule interview');
                        return;
                    }
                    onInterviewChanged('created', newInterview);
                    closeScheduleSheet();
                }
            }),
        [
            scheduleType,
            scheduleLocation,
            scheduleLink,
            scheduleNotes,
            scheduleStatus,
            scheduleRecommendation,
            userId,
            editingInterview,
            candidateId,
            candidateManagerId,
            candidateInterviewCount,
            onInterviewChanged,
            closeScheduleSheet,
            scheduleGuard,
        ],
    );

    const handleSubmitSchedule = useCallback(async () => {
        setScheduleError(null);

        if (scheduleType === 'zoom' && scheduleLink.trim() && !scheduleLink.trim().startsWith('http')) {
            setScheduleError('Zoom link must start with http:// or https://');
            return;
        }

        const dt = new Date(scheduleDate);
        const h24 =
            scheduleAmPm === 'AM'
                ? scheduleHour === 12
                    ? 0
                    : scheduleHour
                : scheduleHour === 12
                  ? 12
                  : scheduleHour + 12;
        dt.setHours(h24, scheduleMinute, 0, 0);

        if (dt < new Date()) {
            Alert.alert('Date in the past', 'The selected date and time is in the past. Continue anyway?', [
                { text: 'Go back', style: 'cancel' },
                { text: 'Continue', onPress: () => submitSchedule(dt) },
            ]);
            return;
        }

        await submitSchedule(dt);
    }, [scheduleType, scheduleLink, scheduleDate, scheduleAmPm, scheduleHour, scheduleMinute, submitSchedule]);

    return {
        showScheduleSheet,
        editingInterview,
        scheduleStatus,
        scheduleDate,
        scheduleHour,
        scheduleMinute,
        scheduleAmPm,
        scheduleType,
        scheduleLink,
        scheduleLocation,
        scheduleNotes,
        scheduleRecommendation,
        isScheduling,
        scheduleError,
        setScheduleDate,
        setScheduleHour,
        setScheduleMinute,
        setScheduleAmPm,
        setScheduleType,
        setScheduleLink,
        setScheduleLocation,
        setScheduleNotes,
        setScheduleStatus,
        setScheduleRecommendation,
        openNewInterview,
        openEditInterview,
        closeScheduleSheet,
        dismissScheduleSheet,
        handleDeleteInterview,
        handleSubmitSchedule,
    };
}
