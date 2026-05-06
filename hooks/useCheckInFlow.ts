import { useCallback, useRef, useState } from 'react';
import { Alert, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import type { FaceCaptureResult } from '@/components/face/FaceCaptureFlow';
import { DEFAULT_PLEDGED_CLOSED, DEFAULT_PLEDGED_PITCHES, DEFAULT_PLEDGED_SITDOWNS } from '@/constants/ui';
import { verifyFace } from '@/lib/faceVerification';
import { checkEventProximity } from '@/lib/gpsVerification';
import {
    hasUserCheckedIn,
    logRoadshowActivity,
    logRoadshowAttendanceWithPledge,
    type PledgeInput,
} from '@/lib/roadshow';
import { captureError } from '@/lib/sentry';
import { supabase } from '@/lib/supabase';
import type { RoadshowConfig } from '@/types/event';

// Surfaced when the proximity check returns `permission_denied`. If the OS
// will still re-prompt (`canAskAgain` true — typically Android first-deny),
// we offer an Allow button that re-runs the flow so the system dialog
// appears. Otherwise (iOS after any deny, or Android "don't ask again"),
// the only path forward is the OS Settings screen.
function showPermissionDeniedDialog(canAskAgain: boolean | undefined, retry: () => void) {
    if (canAskAgain) {
        Alert.alert('Location Required', 'Lyfe needs your location to confirm you are at the venue.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Allow', onPress: retry },
        ]);
    } else {
        Alert.alert('Location Required', 'Location permission is disabled. Enable it in Settings to check in.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]);
    }
}

interface UseCheckInFlowParams {
    eventId: string | undefined;
    userId: string | undefined;
    userFullName: string | undefined;
    faceRegisteredAt: string | null | undefined;
    roadshowConfig: RoadshowConfig | null;
    onCheckedIn: () => void;
}

export function useCheckInFlow({
    eventId,
    userId,
    userFullName,
    faceRegisteredAt,
    roadshowConfig,
    onCheckedIn,
}: UseCheckInFlowParams) {
    const router = useRouter();
    const [showLateReason, setShowLateReason] = useState(false);
    const [lateReason, setLateReason] = useState('');
    const [showPledgeSheet, setShowPledgeSheet] = useState(false);
    const [pledgeSitdowns, setPledgeSitdowns] = useState(DEFAULT_PLEDGED_SITDOWNS);
    const [pledgePitches, setPledgePitches] = useState(DEFAULT_PLEDGED_PITCHES);
    const [pledgeClosed, setPledgeClosed] = useState(DEFAULT_PLEDGED_CLOSED);
    const [pledgeAfyc, setPledgeAfyc] = useState('');
    const [checkingIn, setCheckingIn] = useState(false);
    const [checkinError, setCheckinError] = useState<string | null>(null);
    const [faceCaptureVisible, setFaceCaptureVisible] = useState(false);
    // Distinguishes first-time check-in (writes attendance row) from
    // return-to-booth after a departure (logs check_in activity only).
    const [flowMode, setFlowMode] = useState<'initial' | 'return'>('initial');

    // Tracks whether the current face-capture session actually wrote an
    // attendance row. Read by handleFaceDismiss so we only refresh the event
    // (onCheckedIn) when the DB was touched. Set the instant the log returns
    // — NOT at function end — so any post-log throw still marks success and
    // prevents the retry overlay from firing another write on the next tap.
    const captureSucceededRef = useRef(false);

    const handleOpenCheckin = useCallback(() => {
        if (roadshowConfig) {
            setPledgeSitdowns(roadshowConfig.suggested_sitdowns);
            setPledgePitches(roadshowConfig.suggested_pitches);
            setPledgeClosed(roadshowConfig.suggested_closed);
        }
        setFlowMode('initial');
        setShowPledgeSheet(true);
    }, [roadshowConfig]);

    // Return-to-booth flow: agent has already checked in (pledged), left,
    // and now wants to come back. Runs the same proximity + face gates as
    // initial check-in but skips the pledge sheet (pledge stays as-is) and
    // only writes a `check_in` activity (no attendance row mutation).
    const handleOpenReturn = useCallback(async () => {
        if (checkingIn) return;
        setCheckingIn(true);
        setCheckinError(null);

        const proximity = await checkEventProximity(eventId!);
        if (!proximity.ok) {
            setCheckingIn(false);
            if (proximity.reason === 'permission_denied') {
                showPermissionDeniedDialog(proximity.canAskAgain, () => handleOpenReturn());
            } else {
                Alert.alert('Cannot Check In', proximity.message);
            }
            return;
        }

        if (!faceRegisteredAt) {
            setCheckingIn(false);
            Alert.alert('Face Not Registered', 'Your Lyfe ID must be registered before returning to the booth.', [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Register Now',
                    onPress: () => router.push('/(tabs)/profile/face-register'),
                },
            ]);
            return;
        }

        captureSucceededRef.current = false;
        setFlowMode('return');
        setFaceCaptureVisible(true);
    }, [checkingIn, eventId, faceRegisteredAt, router]);

    // Phase 1: pre-flight guards. Runs proximity, already-checked-in, and
    // face-registration gates. If all pass, closes the pledge sheet and opens
    // the full-screen face capture overlay. `checkingIn` stays true across
    // phases so the pledge sheet button remains disabled if the user returns
    // to it after cancelling the face flow. It's cleared in handleFaceDismiss.
    const handleConfirmPledge = useCallback(async () => {
        if (checkingIn) return;
        setCheckingIn(true);
        setCheckinError(null);

        // ── Proximity gate ──────────────────────────────────
        // Verify the user is physically at the venue before committing the
        // check-in. Failures (TBC location, denied permission, GPS error,
        // out of range) surface a structured reason + human message. Re-run
        // inside handleFacePhotoCaptured too — the liveness flow takes 10-15s
        // so the user could walk out of range between phases.
        const proximity = await checkEventProximity(eventId!);
        if (!proximity.ok) {
            setCheckingIn(false);
            if (proximity.reason === 'permission_denied') {
                showPermissionDeniedDialog(proximity.canAskAgain, () => handleConfirmPledge());
            } else {
                setCheckinError(proximity.message);
            }
            return;
        }

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

        // ── Face registration gate ──────────────────────────
        // No reference photo on file → can't verify. Offer an inline CTA so
        // the user can register straight away. We trust the cached
        // face_registered_at here; the verify edge function will reject with
        // a clear message if the cached value is stale (registered on another
        // device) or the reference file is missing from storage.
        if (!faceRegisteredAt) {
            setCheckingIn(false);
            Alert.alert(
                'Face Not Registered',
                'You need to register your Lyfe ID before checking in. This is a one-time setup.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Register Now',
                        onPress: () => {
                            setShowPledgeSheet(false);
                            router.push('/(tabs)/profile/face-register');
                        },
                    },
                ],
            );
            return;
        }

        // ── All guards passed → hand off to face capture ──
        // Pledge values stay in hook state so phase 2 can read them, and a
        // cancel returns the user to the event screen with the sheet closed
        // (tap Check-in again to re-open; values will re-seed from config).
        captureSucceededRef.current = false;
        setShowPledgeSheet(false);
        setFaceCaptureVisible(true);
    }, [checkingIn, eventId, userId, faceRegisteredAt, onCheckedIn, router]);

    // Phase 2: called by FaceCaptureFlow after liveness + photo capture.
    //
    // Flow: re-verify proximity → Rekognition compare → idempotent attendance
    // log → fire-and-forget side effects. Return value drives FaceCaptureFlow's
    // success/fail overlay; throwing surfaces the error message in the same
    // fail overlay. The success ref is set right after the DB write so any
    // post-write throw doesn't cause a duplicate row on retry.
    const handleFacePhotoCaptured = useCallback(
        async (photoPath: string): Promise<FaceCaptureResult> => {
            // Re-run proximity — the user might have walked away from the
            // venue during the liveness flow (10-15s window).
            const proximity = await checkEventProximity(eventId!);
            if (!proximity.ok) {
                return {
                    // Reuse low_face_confidence so FaceCaptureFlow's fail
                    // overlay renders; the human-readable message is what
                    // users actually see.
                    ok: false,
                    reason: 'low_face_confidence',
                    message: proximity.message,
                };
            }

            // Rekognition verify
            const result = await verifyFace(photoPath);
            if (!result.match) {
                return {
                    ok: false,
                    reason: result.reason ?? 'low_similarity',
                    message: result.message ?? 'Face not recognized',
                };
            }

            // ── Return-to-booth flow: log check_in activity, skip attendance write ──
            if (flowMode === 'return') {
                const { error: retError } = await logRoadshowActivity(eventId!, userId!, 'check_in');
                if (retError) throw new Error(`Return failed: ${retError}`);
                captureSucceededRef.current = true;
                return { ok: true };
            }

            // Idempotent attendance check — on a retry after a partial-success
            // (verify passed, log succeeded, post-log throw), the previous run
            // already wrote the row. Skip the second write to avoid a
            // duplicate pledged sitdowns/pitches leaderboard blowup.
            const { data: already, error: alreadyError } = await hasUserCheckedIn(eventId!, userId!);
            if (alreadyError) throw new Error(alreadyError);
            if (already) {
                captureSucceededRef.current = true;
                return { ok: true };
            }

            // Write the attendance row
            const pledges: PledgeInput = {
                sitdowns: pledgeSitdowns,
                pitches: pledgePitches,
                closed: pledgeClosed,
                afyc: Number(pledgeAfyc) || 0,
            };

            const { error: logError, alreadyCheckedIn } = await logRoadshowAttendanceWithPledge(
                eventId!,
                userId!,
                lateReason || null,
                pledges,
            );
            // Race recovery: the upstream hasUserCheckedIn read missed a row
            // that got inserted between the check and the insert (rapid
            // double-tap, retry after partial-success, etc). The unique
            // constraint on (event_id, user_id) is the source of truth — if
            // it fires, the user IS checked in, so treat as success.
            if (alreadyCheckedIn) {
                captureSucceededRef.current = true;
                return { ok: true };
            }
            if (logError) {
                // Throw so FaceCaptureFlow's catch-all renders the fail
                // overlay with this message. Retry will re-verify (cheap)
                // and re-attempt the log; the idempotency check above
                // protects against double-write if the first log actually
                // persisted despite returning an error.
                throw new Error(`Check-in failed: ${logError}`);
            }

            // Success — mark the ref immediately so a post-log fault still
            // counts as a successful check-in for dismiss-time refresh.
            captureSucceededRef.current = true;

            // Fire-and-forget activity log
            logRoadshowActivity(eventId!, userId!, 'check_in').catch((err) =>
                captureError(err, { context: 'useCheckInFlow.logCheckIn', eventId }),
            );

            // Fire-and-forget pledge notification to manager
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
                }).catch((err) => captureError(err, { context: 'useCheckInFlow.notifyPledge', eventId }));
            });

            return { ok: true };
        },
        [flowMode, eventId, userId, userFullName, lateReason, pledgeSitdowns, pledgePitches, pledgeClosed, pledgeAfyc],
    );

    // Called by FaceCaptureFlow on Done (success) or Cancel (fail). Clears
    // the full-screen overlay and resets checkingIn. If the ref says the DB
    // was touched, fire onCheckedIn so the parent refreshes the event detail.
    const handleFaceDismiss = useCallback(() => {
        const succeeded = captureSucceededRef.current;
        captureSucceededRef.current = false;
        setFaceCaptureVisible(false);
        setCheckingIn(false);
        setFlowMode('initial');
        if (succeeded) onCheckedIn();
    }, [onCheckedIn]);

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
        handleOpenReturn,
        handleConfirmPledge,
        faceCaptureVisible,
        handleFacePhotoCaptured,
        handleFaceDismiss,
    };
}
