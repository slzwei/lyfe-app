/**
 * Liveness detection via head turn gesture (VisionCamera v5 ScannedFace).
 *
 * State machine:
 *   waiting → face_detected → turn_left → turn_right → passed
 *
 * The user must turn their head left (yaw < TURN_LEFT_THRESHOLD) then
 * turn right (yaw > TURN_RIGHT_THRESHOLD) within the timeout window.
 *
 * Note: VisionCamera v5's ScannedFace provides yaw + roll but not pitch,
 * so we use a head turn instead of a nod for liveness detection.
 */
import { useCallback, useRef, useState } from 'react';

// ── Thresholds ──────────────────────────────────────────────

/** Yaw angle (degrees) the user must reach turning left. Negative = left. */
const TURN_LEFT_THRESHOLD = -15;

/** Yaw angle (degrees) the user must reach turning right. Positive = right. */
const TURN_RIGHT_THRESHOLD = 15;

/** Timeout in ms for the entire liveness challenge. */
const TIMEOUT_MS = 15_000;

/** Maximum gap in ms between face detections before resetting. */
const MAX_GAP_MS = 2_000;

// ── Types ───────────────────────────────────────────────────

export type LivenessState = 'waiting' | 'face_detected' | 'turn_left' | 'turn_right' | 'passed' | 'timeout';

export interface FaceFrame {
    yawAngle: number;
    rollAngle: number;
    hasYawAngle: boolean;
    hasRollAngle: boolean;
    faceID: number;
}

const PROMPTS: Record<LivenessState, string> = {
    waiting: 'Position your face in the frame',
    face_detected: 'Face detected. Slowly turn your head left.',
    turn_left: 'Good. Now turn your head right.',
    turn_right: 'Verifying...',
    passed: 'Liveness check passed!',
    timeout: 'Timed out. Please try again.',
};

// ── Hook ────────────────────────────────────────────────────

export function useLivenessDetection() {
    const [state, setState] = useState<LivenessState>('waiting');
    const [prompt, setPrompt] = useState(PROMPTS.waiting);
    const [yawAngle, setYawAngle] = useState(0);

    const startTimeRef = useRef<number>(0);
    const lastFaceTimeRef = useRef<number>(0);
    const stateRef = useRef<LivenessState>('waiting');

    const transition = useCallback((newState: LivenessState) => {
        stateRef.current = newState;
        setState(newState);
        setPrompt(PROMPTS[newState]);
    }, []);

    /** Call this when faces are scanned by VisionCamera v5. */
    const onFaceDetected = useCallback(
        (face: FaceFrame) => {
            const now = Date.now();
            const current = stateRef.current;

            if (current === 'passed' || current === 'timeout') return;

            // Normalize yaw from 0°–360° to -180°–+180°, negate for front camera
            let yaw = face.yawAngle;
            if (yaw > 180) yaw -= 360;
            yaw = -yaw; // Front camera mirrors left/right

            if (face.hasYawAngle || yaw !== 0) {
                setYawAngle(Math.round(yaw * 10) / 10);
            }

            // Check timeout
            if (startTimeRef.current > 0 && now - startTimeRef.current > TIMEOUT_MS) {
                transition('timeout');
                return;
            }

            // Check face gap
            if (lastFaceTimeRef.current > 0 && now - lastFaceTimeRef.current > MAX_GAP_MS && current !== 'waiting') {
                transition('waiting');
                startTimeRef.current = 0;
            }

            lastFaceTimeRef.current = now;

            // Skip if no yaw data at all
            if (yaw === 0 && !face.hasYawAngle) return;

            switch (current) {
                case 'waiting':
                    startTimeRef.current = now;
                    transition('face_detected');
                    break;

                case 'face_detected':
                    if (yaw < TURN_LEFT_THRESHOLD) {
                        transition('turn_left');
                    }
                    break;

                case 'turn_left':
                    if (yaw > TURN_RIGHT_THRESHOLD) {
                        transition('turn_right');
                        setTimeout(() => {
                            if (stateRef.current === 'turn_right') {
                                transition('passed');
                            }
                        }, 300);
                    }
                    break;
            }
        },
        [transition],
    );

    const reset = useCallback(() => {
        startTimeRef.current = 0;
        lastFaceTimeRef.current = 0;
        transition('waiting');
    }, [transition]);

    return {
        state,
        prompt,
        yawAngle,
        onFaceDetected,
        reset,
    };
}
