/**
 * Camera-side of the liveness flow. Owns the MLKit face-detector CameraOutput
 * (react-native-vision-camera-face-detector) and feeds per-frame `FaceSignal`s
 * into the pure reducer in `lib/liveness.ts`.
 *
 * Design notes:
 * - The detector output is created ONCE per viewfinder size via
 *   `createFaceDetectorOutput` directly (not the library's `useFaceDetectorOutput`,
 *   whose useMemo dep is a fresh rest-object every render — it would rebuild the
 *   native output on each render and churn the camera session).
 * - Detections arrive as nitro hybrid `Face` objects. Only primitive fields are
 *   read off them, one property access each — hybrid objects must never be
 *   spread/destructured or retained.
 * - The authoritative liveness state lives in a ref; React state only updates
 *   when a display-relevant field actually changes, so 15-30fps detection does
 *   not re-render the capture sheet at camera rate.
 * - Frame lifecycle is fully native inside the plugin's output — no JS-side
 *   frame handling or disposal is involved on this path.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import type { CameraOutput } from 'react-native-vision-camera';
import { createFaceDetectorOutput, type Face } from 'react-native-vision-camera-face-detector';
import {
    createLivenessConfig,
    initialLivenessState,
    livenessReducer,
    resetLivenessState,
    type FaceSignal,
    type GuidanceKey,
    type LivenessChallenge,
    type LivenessPhase,
    type LivenessState,
} from '@/lib/liveness';
import { captureError } from '@/lib/sentry';

/**
 * Yaw sign normalization so that positive = the user turned toward THEIR
 * right, matching the prompts. Device-verified on iPhone (2026-07-05): with
 * -1 (the old snapshot pipeline's convention) the turn prompts were inverted
 * — "turn right" only registered on a left turn — so MLKit via this plugin
 * already reports yaw in prompt-space for the front camera. Re-verify on the
 * Android device pass; branch per-platform if it disagrees (OTA-safe).
 */
const YAW_SIGN = 1;

export interface LivenessDebugSnapshot {
    phase: LivenessPhase;
    yaw: number;
    leftEye: number | null;
    rightEye: number | null;
    baseline: number | null;
    armingSamples: number;
    faceCount: number;
    fps: number;
}

export interface UseFaceLivenessResult {
    /** Attach to the Camera's `outputs` alongside the photo output. Null until layout is known. */
    frameOutput: CameraOutput | null;
    phase: LivenessPhase;
    challenge: LivenessChallenge | null;
    guidance: GuidanceKey;
    /** 0-1 ring fill. */
    progress: number;
    /** Arming saw mostly-null eye data — surface a "remove sunglasses?" hint. */
    eyeDataMissing: boolean;
    /** Blink timeouts so far (≥ maxBlinkTimeouts ⇒ the session demoted to head-turn). */
    blinkTimeouts: number;
    /** Restart the challenge. `preserveLadder` keeps the blink→turn demotion. */
    reset: (opts?: { preserveLadder?: boolean }) => void;
    /** Live signal values for the dev debug overlay (poll, don't subscribe). */
    getDebugSnapshot: () => LivenessDebugSnapshot;
}

interface DisplayState {
    phase: LivenessPhase;
    challenge: LivenessChallenge | null;
    guidance: GuidanceKey;
    progress: number;
    eyeDataMissing: boolean;
    blinkTimeouts: number;
}

function toDisplay(state: LivenessState): DisplayState {
    return {
        phase: state.phase,
        challenge: state.challenge,
        guidance: state.guidance,
        // Quantize so ring updates don't re-render the sheet at camera rate.
        progress: Math.round(state.progress * 50) / 50,
        eyeDataMissing: state.eyeDataMissing,
        blinkTimeouts: state.blinkTimeouts,
    };
}

function displayChanged(a: DisplayState, b: DisplayState): boolean {
    return (
        a.phase !== b.phase ||
        a.challenge !== b.challenge ||
        a.guidance !== b.guidance ||
        a.progress !== b.progress ||
        a.eyeDataMissing !== b.eyeDataMissing ||
        a.blinkTimeouts !== b.blinkTimeouts
    );
}

export function useFaceLiveness({
    enabled,
    viewfinderWidth,
    viewfinderHeight,
    forceTurnChallenge = false,
}: {
    enabled: boolean;
    viewfinderWidth: number;
    viewfinderHeight: number;
    /** Dev/QA: skip blink and always run the head-turn challenge. */
    forceTurnChallenge?: boolean;
}): UseFaceLivenessResult {
    const config = useMemo(
        () => ({
            ...createLivenessConfig(Platform.OS === 'android' ? 'android' : 'ios'),
            forceTurnChallenge,
        }),
        [forceTurnChallenge],
    );

    const stateRef = useRef<LivenessState>(initialLivenessState());
    const [display, setDisplay] = useState<DisplayState>(() => toDisplay(stateRef.current));

    const enabledRef = useRef(enabled);
    enabledRef.current = enabled;

    // Debug instrumentation (read via getDebugSnapshot — no re-renders).
    const lastSignalRef = useRef<FaceSignal | null>(null);
    const frameTimesRef = useRef<number[]>([]);
    const errorReportedRef = useRef(false);

    const handleFaces = useCallback(
        (faces: Face[]) => {
            if (!enabledRef.current) return;
            const t = Date.now();

            // fps tracking for the debug overlay (last ~2s window)
            const times = frameTimesRef.current;
            times.push(t);
            while (times.length > 0 && t - times[0] > 2000) times.shift();

            // Pick the largest face; read hybrid-object fields once, primitives only.
            let signal: FaceSignal;
            if (faces.length === 0) {
                signal = { faceCount: 0, trackingId: null, yaw: 0, leftEye: null, rightEye: null, box: null, t };
            } else {
                let primary = faces[0];
                if (faces.length > 1) {
                    let bestArea = 0;
                    for (const face of faces) {
                        const b = face.bounds;
                        const area = b.width * b.height;
                        if (area > bestArea) {
                            bestArea = area;
                            primary = face;
                        }
                    }
                }
                const bounds = primary.bounds; // viewfinder coords (autoMode)
                signal = {
                    faceCount: faces.length,
                    trackingId: primary.trackingId ?? null,
                    yaw: YAW_SIGN * primary.yawAngle,
                    leftEye: primary.leftEyeOpenProbability ?? null,
                    rightEye: primary.rightEyeOpenProbability ?? null,
                    box: {
                        cx: (bounds.x + bounds.width / 2) / viewfinderWidth,
                        cy: (bounds.y + bounds.height / 2) / viewfinderHeight,
                        w: bounds.width / viewfinderWidth,
                        h: bounds.height / viewfinderHeight,
                    },
                    t,
                };
            }
            lastSignalRef.current = signal;

            const prev = stateRef.current;
            const nextState = livenessReducer(prev, signal, config);
            stateRef.current = nextState;

            const nextDisplay = toDisplay(nextState);
            setDisplay((current) => (displayChanged(current, nextDisplay) ? nextDisplay : current));
        },
        [config, viewfinderWidth, viewfinderHeight],
    );

    const handleFacesRef = useRef(handleFaces);
    handleFacesRef.current = handleFaces;

    const handleError = useCallback((error: Error) => {
        // MLKit hiccups on individual frames are non-fatal; report the first
        // one per mount so a systemic failure is visible in Sentry without spam.
        if (errorReportedRef.current) return;
        errorReportedRef.current = true;
        captureError(error, { context: 'useFaceLiveness.detector' });
    }, []);
    const handleErrorRef = useRef(handleError);
    handleErrorRef.current = handleError;

    const frameOutput = useMemo<CameraOutput | null>(() => {
        if (viewfinderWidth <= 0 || viewfinderHeight <= 0) return null;
        return createFaceDetectorOutput({
            performanceMode: 'fast',
            runClassifications: true, // eye-open probabilities (blink signal)
            trackingEnabled: true, // continuity hint (never with runContours)
            runLandmarks: false,
            runContours: false,
            minFaceSize: 0.15,
            cameraFacing: 'front',
            // Native-side scaling of bounds into viewfinder coordinates. The
            // Camera fills the viewfinder with cover-fit, which is exactly the
            // mapping autoMode performs against the given window size.
            autoMode: true,
            windowWidth: viewfinderWidth,
            windowHeight: viewfinderHeight,
            outputResolution: 'preview',
            onFacesDetected: (faces) => handleFacesRef.current(faces),
            onError: (error) => handleErrorRef.current(error),
        });
    }, [viewfinderWidth, viewfinderHeight]);

    const reset = useCallback((opts?: { preserveLadder?: boolean }) => {
        stateRef.current = resetLivenessState(stateRef.current, opts?.preserveLadder ?? true);
        setDisplay(toDisplay(stateRef.current));
    }, []);

    const getDebugSnapshot = useCallback((): LivenessDebugSnapshot => {
        const signal = lastSignalRef.current;
        const times = frameTimesRef.current;
        const windowMs = times.length >= 2 ? times[times.length - 1] - times[0] : 0;
        return {
            phase: stateRef.current.phase,
            yaw: signal ? Math.round(signal.yaw * 10) / 10 : 0,
            leftEye: signal?.leftEye ?? null,
            rightEye: signal?.rightEye ?? null,
            baseline: stateRef.current.baseline,
            armingSamples: stateRef.current.armingSamples.length,
            faceCount: signal?.faceCount ?? 0,
            fps: windowMs > 0 ? Math.round(((times.length - 1) / windowMs) * 1000) : 0,
        };
    }, []);

    return {
        frameOutput,
        phase: display.phase,
        challenge: display.challenge,
        guidance: display.guidance,
        progress: display.progress,
        eyeDataMissing: display.eyeDataMissing,
        blinkTimeouts: display.blinkTimeouts,
        reset,
        getDebugSnapshot,
    };
}
