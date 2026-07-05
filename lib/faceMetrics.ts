/**
 * Face check-in telemetry — the field-calibration instrument.
 *
 * One session object per FaceCaptureFlow mount. Collects phase timings,
 * challenge selection, fallbacks, and failure reasons; emits a single
 * info-level Sentry event on completion. Numbers only — never image data.
 *
 * These events are what the LIVENESS_TUNING thresholds get tuned against
 * during the calibration week before broad rollout.
 */
import { Sentry } from '@/lib/sentry';

export type FaceSessionMark = 'camera_ready' | 'first_face' | 'challenge_pass' | 'capture' | 'verify_start';

export type FaceSessionOutcome = 'pass' | 'fail' | 'network' | 'timed_out' | 'cancelled';

export interface FaceMetricsSession {
    /** Record a phase timestamp (first occurrence wins). */
    mark: (name: FaceSessionMark) => void;
    /** Record which challenge ran and whether it was a fallback from blink. */
    setChallenge: (challenge: string, fellBack: boolean) => void;
    /** Record a failed verify/register attempt with its reason code. */
    recordFailure: (reason: string) => void;
    /** Emit the session summary. Safe to call multiple times — first wins. */
    complete: (outcome: FaceSessionOutcome) => void;
}

export function createFaceMetricsSession(mode: 'register' | 'verify'): FaceMetricsSession {
    const startedAt = Date.now();
    const marks: Record<string, number> = {};
    const failures: string[] = [];
    let challenge: string | null = null;
    let fellBack = false;
    let completed = false;

    return {
        mark(name) {
            if (!(name in marks)) marks[name] = Date.now() - startedAt;
        },
        setChallenge(nextChallenge, nextFellBack) {
            challenge = nextChallenge;
            fellBack = fellBack || nextFellBack;
        },
        recordFailure(reason) {
            failures.push(reason);
        },
        complete(outcome) {
            if (completed) return;
            completed = true;
            try {
                Sentry.captureMessage('face_session', {
                    level: 'info',
                    tags: {
                        face_mode: mode,
                        face_outcome: outcome,
                        face_challenge: challenge ?? 'none',
                        face_fell_back: String(fellBack),
                    },
                    extra: {
                        ...marks,
                        total_ms: Date.now() - startedAt,
                        attempts: failures.length + (outcome === 'pass' ? 1 : 0),
                        failures,
                    },
                });
            } catch {
                // Telemetry must never break the flow.
            }
        },
    };
}
