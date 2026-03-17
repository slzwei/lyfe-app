import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { DEFAULT_PLEDGED_CLOSED, DEFAULT_PLEDGED_PITCHES, DEFAULT_PLEDGED_SITDOWNS } from '@/constants/ui';
import {
    hasUserCheckedIn,
    logRoadshowActivity,
    logRoadshowAttendanceWithPledge,
    type PledgeInput,
} from '@/lib/roadshow';
import { supabase } from '@/lib/supabase';
import type { RoadshowConfig } from '@/types/event';

interface UseCheckInFlowParams {
    eventId: string | undefined;
    userId: string | undefined;
    userFullName: string | undefined;
    roadshowConfig: RoadshowConfig | null;
    onCheckedIn: () => void;
}

export function useCheckInFlow({ eventId, userId, userFullName, roadshowConfig, onCheckedIn }: UseCheckInFlowParams) {
    const [showLateReason, setShowLateReason] = useState(false);
    const [lateReason, setLateReason] = useState('');
    const [showPledgeSheet, setShowPledgeSheet] = useState(false);
    const [pledgeSitdowns, setPledgeSitdowns] = useState(DEFAULT_PLEDGED_SITDOWNS);
    const [pledgePitches, setPledgePitches] = useState(DEFAULT_PLEDGED_PITCHES);
    const [pledgeClosed, setPledgeClosed] = useState(DEFAULT_PLEDGED_CLOSED);
    const [pledgeAfyc, setPledgeAfyc] = useState('');
    const [checkingIn, setCheckingIn] = useState(false);
    const [checkinError, setCheckinError] = useState<string | null>(null);

    const handleOpenCheckin = useCallback(() => {
        if (roadshowConfig) {
            setPledgeSitdowns(roadshowConfig.suggested_sitdowns);
            setPledgePitches(roadshowConfig.suggested_pitches);
            setPledgeClosed(roadshowConfig.suggested_closed);
        }
        setShowPledgeSheet(true);
    }, [roadshowConfig]);

    const handleConfirmPledge = useCallback(async () => {
        if (checkingIn) return;
        setCheckingIn(true);
        setCheckinError(null);

        // Check for existing attendance (manager may have checked in already)
        const { data: alreadyCheckedIn, error: checkError } = await hasUserCheckedIn(eventId!, userId!);
        if (checkError) {
            setCheckinError(checkError);
            setCheckingIn(false);
            return;
        }
        if (alreadyCheckedIn) {
            setCheckingIn(false);
            setShowPledgeSheet(false);
            Alert.alert('Already Checked In', 'You were already checked in by your manager.');
            onCheckedIn();
            return;
        }

        const pledges: PledgeInput = {
            sitdowns: pledgeSitdowns,
            pitches: pledgePitches,
            closed: pledgeClosed,
            afyc: Number(pledgeAfyc) || 0,
        };

        const { error } = await logRoadshowAttendanceWithPledge(eventId!, userId!, lateReason || null, pledges);
        if (error) {
            setCheckinError(error);
            setCheckingIn(false);
            return;
        }

        // Log check_in activity (fire-and-forget)
        logRoadshowActivity(eventId!, userId!, 'check_in').catch(() => {});

        // Fire-and-forget push notification
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) return;
            fetch(`${supabaseUrl}/functions/v1/notify-roadshow-pledge`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    eventId,
                    agentId: userId,
                    agentName: userFullName,
                    pledgedSitdowns: pledges.sitdowns,
                    pledgedPitches: pledges.pitches,
                    pledgedClosed: pledges.closed,
                    pledgedAfyc: pledges.afyc,
                }),
            }).catch(() => {});
        });

        setShowPledgeSheet(false);
        setCheckingIn(false);
        onCheckedIn();
    }, [
        checkingIn,
        eventId,
        userId,
        userFullName,
        lateReason,
        pledgeSitdowns,
        pledgePitches,
        pledgeClosed,
        pledgeAfyc,
        onCheckedIn,
    ]);

    return {
        showLateReason,
        setShowLateReason,
        lateReason,
        setLateReason,
        showPledgeSheet,
        setShowPledgeSheet,
        pledgeSitdowns,
        setPledgeSitdowns,
        pledgePitches,
        setPledgePitches,
        pledgeClosed,
        setPledgeClosed,
        pledgeAfyc,
        setPledgeAfyc,
        checkingIn,
        checkinError,
        handleOpenCheckin,
        handleConfirmPledge,
    };
}
