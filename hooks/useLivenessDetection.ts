/**
 * Liveness detection via nod gesture (ML Kit Euler angles).
 *
 * State machine:
 *   waiting → face_detected → nod_down → nod_up → passed
 *
 * The user must look down (pitch < NOD_DOWN_THRESHOLD) then look
 * back up (pitch > NOD_UP_THRESHOLD) within the timeout window.
 */
import { useCallback, useRef, useState } from 'react';

// ── Thresholds ──────────────────────────────────────────────

/** Pitch angle (degrees) the user must reach looking down. Negative = down. */
const NOD_DOWN_THRESHOLD = -12;

/** Pitch angle (degrees) the user must reach looking back up. Positive = up. */
const NOD_UP_THRESHOLD = 8;

/** Maximum Euler Y (yaw) for a "frontal enough" face. */
const MAX_YAW = 25;

/** Minimum eye-open probability to consider the face valid. */
const MIN_EYE_OPEN = 0.3;

/** Timeout in ms for the entire liveness challenge. */
const TIMEOUT_MS = 15_000;

/** Maximum gap in ms between face detections before resetting. */
const MAX_GAP_MS = 1_000;

// ── Types ───────────────────────────────────────────────────

export type LivenessState = 'waiting' | 'face_detected' | 'nod_down' | 'nod_up' | 'passed' | 'timeout';

export interface FaceFrame {
    pitchAngle: number; // Euler X — up/down
    yawAngle: number; // Euler Y — left/right
    rollAngle: number; // Euler Z — tilt
    leftEyeOpenProbability?: number;
    rightEyeOpenProbability?: number;
}

const PROMPTS: Record<LivenessState, string> = {
    waiting: 'Position your face in the frame',
    face_detected: 'Face detected. Slowly look down.',
    nod_down: 'Good. Now look back up.',
    nod_up: 'Verifying...',
    passed: 'Liveness check passed!',
    timeout: 'Timed out. Please try again.',
};

// ── Hook ────────────────────────────────────────────────────

export function useLivenessDetection() {
    const [state, setState] = useState<LivenessState>('waiting');
    const [prompt, setPrompt] = useState(PROMPTS.waiting);
    const [pitchAngle, setPitchAngle] = useState(0);

    const startTimeRef = useRef<number>(0);
    const lastFaceTimeRef = useRef<number>(0);
    const stateRef = useRef<LivenessState>('waiting');

    const transition = useCallback((newState: LivenessState) => {
        stateRef.current = newState;
        setState(newState);
        setPrompt(PROMPTS[newState]);
    }, []);

    /** Call this from the frame processor each time a face is detected. */
    const onFaceDetected = useCallback(
        (face: FaceFrame) => {
            const now = Date.now();
            const current = stateRef.current;

            // Already done
            if (current === 'passed' || current === 'timeout') return;

            setPitchAngle(face.pitchAngle);

            // Check timeout
            if (startTimeRef.current > 0 && now - startTimeRef.current > TIMEOUT_MS) {
                transition('timeout');
                return;
            }

            // Check face gap — if too long since last detection, reset to waiting
            if (lastFaceTimeRef.current > 0 && now - lastFaceTimeRef.current > MAX_GAP_MS && current !== 'waiting') {
                transition('waiting');
                startTimeRef.current = 0;
            }

            lastFaceTimeRef.current = now;

            // Reject if face is too angled (not frontal enough)
            if (Math.abs(face.yawAngle) > MAX_YAW) return;

            // Reject if eyes appear closed (possible photo with glare)
            const leftEye = face.leftEyeOpenProbability ?? 1;
            const rightEye = face.rightEyeOpenProbability ?? 1;
            if (leftEye < MIN_EYE_OPEN && rightEye < MIN_EYE_OPEN) return;

            switch (current) {
                case 'waiting':
                    // Face detected and frontal — start the challenge
                    startTimeRef.current = now;
                    transition('face_detected');
                    break;

                case 'face_detected':
                    // Wait for the user to look down
                    if (face.pitchAngle < NOD_DOWN_THRESHOLD) {
                        transition('nod_down');
                    }
                    break;

                case 'nod_down':
                    // Wait for the user to look back up
                    if (face.pitchAngle > NOD_UP_THRESHOLD) {
                        transition('nod_up');
                        // Small delay then mark as passed
                        setTimeout(() => {
                            if (stateRef.current === 'nod_up') {
                                transition('passed');
                            }
                        }, 300);
                    }
                    break;

                // nod_up and passed are terminal — handled by the setTimeout above
            }
        },
        [transition],
    );

    /** Reset the state machine for a new attempt. */
    const reset = useCallback(() => {
        startTimeRef.current = 0;
        lastFaceTimeRef.current = 0;
        transition('waiting');
    }, [transition]);

    return {
        state,
        prompt,
        pitchAngle,
        onFaceDetected,
        reset,
    };
}
