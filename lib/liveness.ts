/**
 * Liveness state machine for face check-in / registration.
 *
 * Pure TypeScript — no React Native imports — so the full challenge flow is
 * unit-testable by feeding synthetic frame signals. The camera side lives in
 * `hooks/useFaceLiveness.ts`, which converts MLKit detections into
 * `FaceSignal`s and dispatches them here.
 *
 * Flow:
 *   searching → centering → arming → challenge_blink        → settling → capture
 *                                  ↘ challenge_turn_left → challenge_turn_right ↗
 *
 * Challenge selection happens at the end of `arming`: a short window of
 * frontal frames is collected and the blink challenge is only chosen when the
 * eye-open signal is trustworthy (median ≥ `blinkBaselineMinMedian`, bounded
 * deviation). Glasses glare and sunglasses make MLKit's eye probabilities
 * swing or disappear entirely, so untrustworthy eyes fall back to the
 * head-turn challenge BEFORE the user is ever asked to blink. Two blink
 * timeouts also demote to head-turn (the in-session ladder).
 *
 * Blink thresholds are RELATIVE to the per-session baseline (codex review:
 * absolute thresholds collapse for spectacle wearers whose "open" probability
 * hovers low). Continuity between frames uses bounding-box distance, with
 * MLKit's trackingId treated as a hint only — it regenerates freely across
 * dropped frames and is not an identity signal.
 */

// ── Types ───────────────────────────────────────────────────

/** One detection tick, normalized to the viewfinder (0-1 on both axes). */
export interface FaceSignal {
    /** Number of faces in frame — exactly 1 is required to make progress. */
    faceCount: number;
    /** Largest face's tracking id, when the detector provides one. */
    trackingId: number | null;
    /** Yaw in degrees. Positive = turned to the user's right (after the hook's sign normalization). */
    yaw: number;
    /** Eye-open probabilities 0-1, null when MLKit could not compute them. */
    leftEye: number | null;
    rightEye: number | null;
    /** Face box center + size, normalized to viewfinder width/height. Null when faceCount is 0. */
    box: { cx: number; cy: number; w: number; h: number } | null;
    /** Wall-clock ms. */
    t: number;
}

export type LivenessPhase =
    | 'searching'
    | 'centering'
    | 'arming'
    | 'challenge_blink'
    | 'challenge_turn_left'
    | 'challenge_turn_right'
    | 'settling'
    | 'capture'
    | 'timed_out';

export type LivenessChallenge = 'blink' | 'turn';

export type GuidanceKey =
    | 'searching'
    | 'face_light'
    | 'one_face'
    | 'move_closer'
    | 'move_back'
    | 'center_face'
    | 'hold_still'
    | 'blink'
    | 'turn_left'
    | 'turn_right'
    | 'done';

export interface LivenessConfig {
    /** Circle geometry in viewfinder-normalized coords (x over width, y over height). */
    circle: { cx: number; cy: number; rx: number; ry: number };
    /** Face box width (fraction of viewfinder width) accepted as "in range". */
    faceWidthMin: number;
    faceWidthMax: number;
    /** Max distance of face center from circle center, as a fraction of circle radius. */
    centerTolerance: number;
    /** Containment relaxation multiplier during head-turn challenge states. */
    turnToleranceFactor: number;

    /** Arming: frontal frames required before a challenge is chosen. */
    armingFramesRequired: number;
    /** Arming: give up collecting after this long and decide with what we have. */
    armingMaxMs: number;
    /** Minimum frontal eye samples to even consider the blink challenge. */
    armingMinSamplesForBlink: number;
    /** Blink is only offered when min(median L, median R) is at least this. */
    blinkBaselineMinMedian: number;
    /** ...and per-eye standard deviation is at most this. */
    blinkBaselineMaxStd: number;

    /** Blink: eyes count as closed below max(floor, baseline × closedRatio). */
    eyeClosedFloor: number;
    eyeClosedRatio: number;
    /** Blink: eyes count as re-opened above baseline × reopenRatio. */
    eyeReopenRatio: number;
    /** Blink: closed → reopened must complete within this window. */
    blinkReopenWindowMs: number;
    /** Blink attempts that may time out before demoting to head-turn. */
    maxBlinkTimeouts: number;

    /** Yaw within ±this counts as looking straight. */
    yawStraightMax: number;
    /** Yaw beyond ±this completes a turn step. */
    yawTurnThreshold: number;

    /** Per-challenge timeout. */
    challengeTimeoutMs: number;
    /** Whole session timeout, from first face seen. */
    sessionTimeoutMs: number;
    /** No face for this long → soft coaching ("hold still"). */
    faceGapSoftMs: number;
    /** No face for this long → reset to searching. */
    faceGapHardMs: number;
    /** Center jump (normalized) between consecutive detections that means "different face". */
    centerJumpMax: number;
    /** Searching with zero faces for this long → suggest finding light. */
    searchingLightHintMs: number;

    /** Settling: conditions must hold continuously for this long before capture. */
    settleMs: number;
    /** Settling: give up and re-arm after this long. */
    settleMaxMs: number;

    /** Dev/QA: always choose the head-turn challenge, regardless of eye baseline. */
    forceTurnChallenge?: boolean;
}

export interface LivenessState {
    phase: LivenessPhase;
    challenge: LivenessChallenge | null;
    guidance: GuidanceKey;
    /** 0-1 ring fill for the progress UI. */
    progress: number;
    /** True when arming saw mostly-null eye data (sunglasses hint for the UI). */
    eyeDataMissing: boolean;
    /** Blink challenge timeouts so far this session (drives the ladder + copy). */
    blinkTimeouts: number;

    // ── internals (exposed for tests/debug overlay) ──
    sessionStartT: number | null;
    phaseStartT: number | null;
    searchingSinceT: number | null;
    lastFaceT: number | null;
    lastBox: { cx: number; cy: number } | null;
    lastTrackingId: number | null;
    armingSamples: { left: number; right: number }[];
    armingNullEyeFrames: number;
    baseline: number | null;
    blinkClosedAt: number | null;
    /** Eyes stayed closed past the blink window — a new attempt may not start until they reopen. */
    blinkInvalidUntilOpen: boolean;
    settleHoldStartT: number | null;
}

// ── Config ──────────────────────────────────────────────────

/**
 * Default tuning. Every value here is OTA-adjustable (pure JS). Field
 * calibration week may revise; see docs in each field above.
 */
export function createLivenessConfig(platform: 'ios' | 'android'): LivenessConfig {
    return {
        // Circle Ø ≈ 78% of viewfinder width, centered slightly above middle.
        // ry converts the x-radius into y-normalized units for the 3:4 box.
        circle: { cx: 0.5, cy: 0.44, rx: 0.39, ry: 0.39 * (3 / 4) },
        faceWidthMin: 0.3,
        faceWidthMax: 0.78,
        centerTolerance: 0.5,
        turnToleranceFactor: 2.2,

        armingFramesRequired: 10,
        armingMaxMs: 3000,
        armingMinSamplesForBlink: 5,
        blinkBaselineMinMedian: 0.65,
        blinkBaselineMaxStd: 0.18,

        eyeClosedFloor: 0.15,
        eyeClosedRatio: 0.45,
        eyeReopenRatio: 0.75,
        blinkReopenWindowMs: 900,
        maxBlinkTimeouts: 2,

        // Ported from the previous snapshot flow: Android MLKit yaw is noisier.
        yawStraightMax: platform === 'android' ? 18 : 10,
        yawTurnThreshold: 15,

        challengeTimeoutMs: 8000,
        sessionTimeoutMs: 30000,
        faceGapSoftMs: 600,
        faceGapHardMs: 1800,
        centerJumpMax: 0.35,
        searchingLightHintMs: 4000,

        settleMs: 250,
        settleMaxMs: 4000,
    };
}

// ── State helpers ───────────────────────────────────────────

export function initialLivenessState(): LivenessState {
    return {
        phase: 'searching',
        challenge: null,
        guidance: 'searching',
        progress: 0.05,
        eyeDataMissing: false,
        blinkTimeouts: 0,
        sessionStartT: null,
        phaseStartT: null,
        searchingSinceT: null,
        lastFaceT: null,
        lastBox: null,
        lastTrackingId: null,
        armingSamples: [],
        armingNullEyeFrames: 0,
        baseline: null,
        blinkClosedAt: null,
        blinkInvalidUntilOpen: false,
        settleHoldStartT: null,
    };
}

/**
 * Reset for a retry. `preserveLadder` keeps blinkTimeouts (and the
 * turn demotion) across retries within the same capture session.
 */
export function resetLivenessState(prev: LivenessState, preserveLadder: boolean): LivenessState {
    const fresh = initialLivenessState();
    if (preserveLadder) {
        fresh.blinkTimeouts = prev.blinkTimeouts;
        fresh.eyeDataMissing = prev.eyeDataMissing;
    }
    return fresh;
}

function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function stdDev(values: number[]): number {
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) * (v - mean), 0) / values.length;
    return Math.sqrt(variance);
}

// ── Positioning ─────────────────────────────────────────────

type PositionVerdict = 'ok' | 'too_small' | 'too_big' | 'off_center';

function classifyPosition(
    box: NonNullable<FaceSignal['box']>,
    config: LivenessConfig,
    relaxFactor: number,
): PositionVerdict {
    if (box.w < config.faceWidthMin / relaxFactor) return 'too_small';
    if (box.w > config.faceWidthMax * relaxFactor) return 'too_big';
    // Elliptical distance of the face center from the circle center, in
    // units of the circle radius (1.0 = on the ring).
    const dx = (box.cx - config.circle.cx) / config.circle.rx;
    const dy = (box.cy - config.circle.cy) / config.circle.ry;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > config.centerTolerance * relaxFactor) return 'off_center';
    return 'ok';
}

const POSITION_GUIDANCE: Record<Exclude<PositionVerdict, 'ok'>, GuidanceKey> = {
    too_small: 'move_closer',
    too_big: 'move_back',
    off_center: 'center_face',
};

// ── Reducer ─────────────────────────────────────────────────

export function livenessReducer(state: LivenessState, signal: FaceSignal, config: LivenessConfig): LivenessState {
    // Terminal phases only move via reset.
    if (state.phase === 'capture' || state.phase === 'timed_out') return state;

    const t = signal.t;
    const next: LivenessState = { ...state, armingSamples: state.armingSamples };

    // Session timeout (counted from the first face ever seen).
    if (next.sessionStartT !== null && t - next.sessionStartT > config.sessionTimeoutMs) {
        return { ...next, phase: 'timed_out', guidance: 'hold_still', progress: next.progress };
    }

    // ── No face in frame ────────────────────────────────
    if (signal.faceCount === 0 || !signal.box) {
        if (next.phase === 'searching') {
            next.searchingSinceT = next.searchingSinceT ?? t;
            next.guidance = t - next.searchingSinceT > config.searchingLightHintMs ? 'face_light' : 'searching';
            return next;
        }
        const gap = next.lastFaceT === null ? 0 : t - next.lastFaceT;
        if (gap >= config.faceGapHardMs) {
            // Face gone for real — back to square one (ladder preserved).
            return {
                ...resetLivenessState(next, true),
                sessionStartT: next.sessionStartT,
                searchingSinceT: t,
            };
        }
        if (gap >= config.faceGapSoftMs) next.guidance = 'hold_still';
        return next;
    }

    // ── Face present ────────────────────────────────────
    const box = signal.box;

    // Multiple faces: never make progress; drop active challenges back to
    // centering (a second face mid-challenge is a spoof-shaped situation).
    if (signal.faceCount > 1) {
        const demoted = next.phase !== 'centering' && next.phase !== 'searching';
        const base = demoted ? softResetToCentering(next, t) : next;
        base.guidance = 'one_face';
        base.lastFaceT = t;
        base.lastBox = { cx: box.cx, cy: box.cy };
        base.lastTrackingId = signal.trackingId;
        return base;
    }

    // Continuity: a large center jump between consecutive detections means a
    // different face took over — restart positioning. trackingId is a hint:
    // a changed id with a moderate jump also resets; id churn with a
    // continuous box does not.
    if (next.lastBox !== null) {
        const jump = Math.hypot(box.cx - next.lastBox.cx, box.cy - next.lastBox.cy);
        const idChanged =
            next.lastTrackingId !== null && signal.trackingId !== null && signal.trackingId !== next.lastTrackingId;
        if (jump > config.centerJumpMax || (idChanged && jump > config.centerJumpMax * 0.6)) {
            const base = softResetToCentering(next, t);
            base.lastFaceT = t;
            base.lastBox = { cx: box.cx, cy: box.cy };
            base.lastTrackingId = signal.trackingId;
            return base;
        }
    }

    next.sessionStartT = next.sessionStartT ?? t;
    next.lastFaceT = t;
    next.lastBox = { cx: box.cx, cy: box.cy };
    next.lastTrackingId = signal.trackingId;
    next.searchingSinceT = null;

    const inTurnChallenge = next.phase === 'challenge_turn_left' || next.phase === 'challenge_turn_right';
    const position = classifyPosition(box, config, inTurnChallenge ? config.turnToleranceFactor : 1);

    switch (next.phase) {
        case 'searching': {
            next.phase = 'centering';
            next.phaseStartT = t;
            next.guidance = position === 'ok' ? 'hold_still' : POSITION_GUIDANCE[position];
            next.progress = 0.12;
            return next;
        }

        case 'centering': {
            if (position !== 'ok') {
                next.guidance = POSITION_GUIDANCE[position];
                return next;
            }
            if (Math.abs(signal.yaw) > config.yawStraightMax) {
                next.guidance = 'hold_still';
                return next;
            }
            // Positioned and frontal → start collecting the baseline.
            next.phase = 'arming';
            next.phaseStartT = t;
            next.armingSamples = [];
            next.armingNullEyeFrames = 0;
            next.guidance = 'hold_still';
            next.progress = 0.15;
            return next;
        }

        case 'arming': {
            if (position !== 'ok') {
                // Drifted out — back to centering, throw the partial baseline away.
                const base = softResetToCentering(next, t);
                base.guidance = POSITION_GUIDANCE[position];
                return base;
            }
            const frontal = Math.abs(signal.yaw) <= config.yawStraightMax;
            if (frontal) {
                if (signal.leftEye !== null && signal.rightEye !== null) {
                    next.armingSamples = [...next.armingSamples, { left: signal.leftEye, right: signal.rightEye }];
                } else {
                    next.armingNullEyeFrames += 1;
                }
            }
            next.progress = 0.15 + 0.25 * Math.min(1, next.armingSamples.length / config.armingFramesRequired);

            const timedOut = next.phaseStartT !== null && t - next.phaseStartT > config.armingMaxMs;
            const enough = next.armingSamples.length >= config.armingFramesRequired;
            if (!enough && !timedOut) {
                next.guidance = 'hold_still';
                return next;
            }
            return chooseChallenge(next, t, config);
        }

        case 'challenge_blink': {
            if (next.phaseStartT !== null && t - next.phaseStartT > config.challengeTimeoutMs) {
                next.blinkTimeouts += 1;
                if (next.blinkTimeouts >= config.maxBlinkTimeouts) {
                    // Ladder: demote to head-turn for the rest of the session.
                    next.challenge = 'turn';
                    next.phase = 'challenge_turn_left';
                    next.phaseStartT = t;
                    next.blinkClosedAt = null;
                    next.guidance = 'turn_left';
                    next.progress = 0.45;
                    return next;
                }
                // Re-arm: lighting/pose may have shifted; rebuild the baseline.
                const base = softResetToCentering(next, t);
                base.guidance = 'blink';
                return base;
            }
            if (position !== 'ok') {
                next.guidance = POSITION_GUIDANCE[position];
                return next;
            }
            if (signal.leftEye === null || signal.rightEye === null || next.baseline === null) {
                // Eye signal dropped mid-challenge (glare flash etc.) — keep waiting.
                next.guidance = 'blink';
                return next;
            }
            const closedThr = Math.max(config.eyeClosedFloor, next.baseline * config.eyeClosedRatio);
            const reopenThr = next.baseline * config.eyeReopenRatio;
            const bothClosed = signal.leftEye < closedThr && signal.rightEye < closedThr;
            const bothOpen = signal.leftEye > reopenThr && signal.rightEye > reopenThr;

            if (next.blinkClosedAt !== null && t - next.blinkClosedAt > config.blinkReopenWindowMs) {
                // Eyes stayed shut past the window — not a blink shape (e.g. a
                // closed-eyes photo held up). Invalidate and require a genuine
                // reopen before another attempt may start, so persistent-closed
                // frames can never re-arm the detector.
                next.blinkClosedAt = null;
                next.blinkInvalidUntilOpen = true;
            }
            if (next.blinkInvalidUntilOpen) {
                if (bothOpen) next.blinkInvalidUntilOpen = false;
                next.guidance = 'blink';
                return next;
            }
            if (bothClosed) {
                next.blinkClosedAt = next.blinkClosedAt ?? t;
                next.guidance = 'blink';
                next.progress = 0.62;
                return next;
            }
            if (next.blinkClosedAt !== null && bothOpen) {
                // open → closed → open within the window: that's a blink.
                next.phase = 'settling';
                next.phaseStartT = t;
                next.settleHoldStartT = null;
                next.guidance = 'hold_still';
                next.progress = 0.75;
                return next;
            }
            next.guidance = 'blink';
            next.progress = Math.max(next.progress, 0.45);
            return next;
        }

        case 'challenge_turn_left': {
            const failed = handleTurnTimeout(next, t, config);
            if (failed) return failed;
            if (signal.yaw < -config.yawTurnThreshold) {
                next.phase = 'challenge_turn_right';
                next.phaseStartT = t;
                next.guidance = 'turn_right';
                next.progress = 0.6;
                return next;
            }
            next.guidance = 'turn_left';
            next.progress = Math.max(next.progress, 0.45);
            return next;
        }

        case 'challenge_turn_right': {
            const failed = handleTurnTimeout(next, t, config);
            if (failed) return failed;
            if (signal.yaw > config.yawTurnThreshold) {
                next.phase = 'settling';
                next.phaseStartT = t;
                next.settleHoldStartT = null;
                next.guidance = 'hold_still';
                next.progress = 0.75;
                return next;
            }
            next.guidance = 'turn_right';
            return next;
        }

        case 'settling': {
            if (next.phaseStartT !== null && t - next.phaseStartT > config.settleMaxMs) {
                // Never settled — go around again (baseline may be stale).
                const base = softResetToCentering(next, t);
                base.guidance = 'center_face';
                return base;
            }
            const frontal = Math.abs(signal.yaw) <= config.yawStraightMax;
            let eyesOk = true;
            if (next.challenge === 'blink' && next.baseline !== null) {
                eyesOk =
                    signal.leftEye !== null &&
                    signal.rightEye !== null &&
                    signal.leftEye > next.baseline * config.eyeReopenRatio &&
                    signal.rightEye > next.baseline * config.eyeReopenRatio;
            }
            const holding = position === 'ok' && frontal && eyesOk;
            if (!holding) {
                next.settleHoldStartT = null;
                next.guidance = position !== 'ok' ? POSITION_GUIDANCE[position] : 'hold_still';
                return next;
            }
            next.settleHoldStartT = next.settleHoldStartT ?? t;
            const held = t - next.settleHoldStartT;
            next.progress = 0.75 + 0.2 * Math.min(1, held / config.settleMs);
            if (held >= config.settleMs) {
                next.phase = 'capture';
                next.guidance = 'done';
                next.progress = 1;
            } else {
                next.guidance = 'hold_still';
            }
            return next;
        }

        default:
            return next;
    }
}

/** Drop back to centering, preserving session identity + the blink ladder. */
function softResetToCentering(state: LivenessState, t: number): LivenessState {
    return {
        ...state,
        phase: 'centering',
        phaseStartT: t,
        guidance: 'center_face',
        progress: 0.12,
        armingSamples: [],
        armingNullEyeFrames: 0,
        baseline: null,
        blinkClosedAt: null,
        blinkInvalidUntilOpen: false,
        settleHoldStartT: null,
    };
}

/** Decide blink vs head-turn from the collected arming samples. */
function chooseChallenge(state: LivenessState, t: number, config: LivenessConfig): LivenessState {
    const next = { ...state };
    const samples = next.armingSamples;
    const nullFrames = next.armingNullEyeFrames;

    let useBlink = false;
    if (
        !config.forceTurnChallenge &&
        next.blinkTimeouts < config.maxBlinkTimeouts &&
        samples.length >= config.armingMinSamplesForBlink
    ) {
        const left = samples.map((s) => s.left);
        const right = samples.map((s) => s.right);
        const baseline = Math.min(median(left), median(right));
        const spread = Math.max(stdDev(left), stdDev(right));
        if (baseline >= config.blinkBaselineMinMedian && spread <= config.blinkBaselineMaxStd) {
            useBlink = true;
            next.baseline = baseline;
        }
    }

    // Mostly-null eye data while frontal → likely sunglasses; let the UI hint.
    next.eyeDataMissing = nullFrames > samples.length;

    if (useBlink) {
        next.phase = 'challenge_blink';
        next.challenge = 'blink';
        next.guidance = 'blink';
    } else {
        next.phase = 'challenge_turn_left';
        next.challenge = 'turn';
        next.guidance = 'turn_left';
    }
    next.phaseStartT = t;
    next.blinkClosedAt = null;
    next.progress = 0.45;
    return next;
}

/** Turn challenge timeout → session over (turn is the last rung of the ladder). */
function handleTurnTimeout(state: LivenessState, t: number, config: LivenessConfig): LivenessState | null {
    if (state.phaseStartT !== null && t - state.phaseStartT > config.challengeTimeoutMs) {
        return { ...state, phase: 'timed_out', guidance: 'hold_still' };
    }
    return null;
}
