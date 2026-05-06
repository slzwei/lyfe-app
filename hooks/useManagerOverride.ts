import { useState } from 'react';
import { Alert } from 'react-native';
import { DEFAULT_PLEDGED_CLOSED, DEFAULT_PLEDGED_PITCHES, DEFAULT_PLEDGED_SITDOWNS } from '@/constants/ui';
import { logRoadshowActivity, managerCheckIn, type PledgeInput } from '@/lib/roadshow';
import { formatCheckinTime } from '@/lib/dateTime';
import type { EventAttendee, RoadshowConfig } from '@/types/event';

interface UseManagerOverrideParams {
    eventId: string | undefined;
    userId: string | undefined;
    roadshowConfig: RoadshowConfig | null;
    onOverrideComplete: () => void;
}

export function useManagerOverride({ eventId, userId, roadshowConfig, onOverrideComplete }: UseManagerOverrideParams) {
    const [overrideTarget, setOverrideTarget] = useState<EventAttendee | null>(null);
    const [overrideTime, setOverrideTime] = useState('');
    const [overrideLateReason, setOverrideLateReason] = useState('');
    const [overridePledgeSitdowns, setOverridePledgeSitdowns] = useState(DEFAULT_PLEDGED_SITDOWNS);
    const [overridePledgePitches, setOverridePledgePitches] = useState(DEFAULT_PLEDGED_PITCHES);
    const [overridePledgeClosed, setOverridePledgeClosed] = useState(DEFAULT_PLEDGED_CLOSED);
    const [overridePledgeAfyc, setOverridePledgeAfyc] = useState('');
    const [overrideSubmitting, setOverrideSubmitting] = useState(false);
    const [overrideError, setOverrideError] = useState<string | null>(null);

    const openOverride = (agent: EventAttendee) => {
        setOverrideTarget(agent);
        setOverrideTime(formatCheckinTime(new Date().toISOString()));
        setOverrideLateReason('');
        if (roadshowConfig) {
            setOverridePledgeSitdowns(roadshowConfig.suggested_sitdowns);
            setOverridePledgePitches(roadshowConfig.suggested_pitches);
            setOverridePledgeClosed(roadshowConfig.suggested_closed);
        }
        setOverridePledgeAfyc('');
        setOverrideError(null);
    };

    const handleConfirmOverride = async () => {
        if (!overrideTarget || overrideSubmitting) return;

        // Parse override time as today
        const timeParsed = overrideTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (!timeParsed) {
            setOverrideError('Enter time as HH:MM AM/PM');
            return;
        }
        let h = parseInt(timeParsed[1]);
        const mins = parseInt(timeParsed[2]);
        const ampm = timeParsed[3].toUpperCase();
        if (ampm === 'PM' && h !== 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        const checkedInAt = new Date();
        checkedInAt.setHours(h, mins, 0, 0);
        if (checkedInAt > new Date()) {
            setOverrideError('Arrival time cannot be in the future.');
            return;
        }

        Alert.alert(
            'Confirm Override',
            `Check in ${overrideTarget.full_name} at ${overrideTime}? This cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm',
                    onPress: async () => {
                        setOverrideSubmitting(true);
                        setOverrideError(null);
                        try {
                            const pledges: PledgeInput = {
                                sitdowns: overridePledgeSitdowns,
                                pitches: overridePledgePitches,
                                closed: overridePledgeClosed,
                                afyc: Number(overridePledgeAfyc) || 0,
                            };
                            const { error, alreadyCheckedIn } = await managerCheckIn(
                                eventId!,
                                overrideTarget.user_id,
                                checkedInAt.toISOString(),
                                overrideLateReason || null,
                                pledges,
                                userId!,
                            );
                            if (alreadyCheckedIn) {
                                setOverrideError(`${overrideTarget.full_name} just checked in themselves.`);
                                return;
                            }
                            if (error) {
                                setOverrideError(error);
                                return;
                            }
                            // Log check_in activity for the agent (fire-and-forget)
                            logRoadshowActivity(eventId!, overrideTarget.user_id, 'check_in').catch(() => {});
                            setOverrideTarget(null);
                            onOverrideComplete();
                        } finally {
                            setOverrideSubmitting(false);
                        }
                    },
                },
            ],
        );
    };

    return {
        overrideTarget,
        setOverrideTarget,
        overrideTime,
        setOverrideTime,
        overrideLateReason,
        setOverrideLateReason,
        overridePledgeSitdowns,
        setOverridePledgeSitdowns,
        overridePledgePitches,
        setOverridePledgePitches,
        overridePledgeClosed,
        setOverridePledgeClosed,
        overridePledgeAfyc,
        setOverridePledgeAfyc,
        overrideSubmitting,
        overrideError,
        openOverride,
        handleConfirmOverride,
    };
}
