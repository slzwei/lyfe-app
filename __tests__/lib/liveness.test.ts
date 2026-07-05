/**
 * Unit tests for the pure liveness state machine (lib/liveness.ts).
 *
 * Every scenario drives the reducer with synthetic FaceSignals — no camera,
 * no timers. The clock is simulated by advancing `t` on each signal.
 */
import {
    createLivenessConfig,
    initialLivenessState,
    livenessReducer,
    resetLivenessState,
    type FaceSignal,
    type LivenessConfig,
    type LivenessState,
} from '@/lib/liveness';

const config: LivenessConfig = createLivenessConfig('ios'); // yawStraightMax 10

/** Centered, well-sized, frontal, eyes-open face signal. */
function makeSignal(t: number, overrides: Partial<FaceSignal> = {}): FaceSignal {
    return {
        faceCount: 1,
        trackingId: 7,
        yaw: 0,
        leftEye: 0.85,
        rightEye: 0.85,
        box: { cx: 0.5, cy: 0.44, w: 0.5, h: 0.5 },
        t,
        ...overrides,
    };
}

function noFace(t: number): FaceSignal {
    return { faceCount: 0, trackingId: null, yaw: 0, leftEye: null, rightEye: null, box: null, t };
}

/** Run a sequence of signals through the reducer. */
function run(state: LivenessState, signals: FaceSignal[]): LivenessState {
    return signals.reduce((s, sig) => livenessReducer(s, sig, config), state);
}

/**
 * Drive a fresh state to the challenge decision point.
 * Frame cadence 60ms; arming needs config.armingFramesRequired eye samples.
 */
function driveToChallenge(eyeValue: number | null = 0.85, startT = 1000): { state: LivenessState; t: number } {
    let state = initialLivenessState();
    let t = startT;
    // searching → centering
    state = livenessReducer(state, makeSignal(t), config);
    // centering → arming
    t += 60;
    state = livenessReducer(state, makeSignal(t), config);
    // collect samples until a challenge is chosen (bounded loop)
    for (let i = 0; i < config.armingFramesRequired + 5 && state.phase === 'arming'; i++) {
        t += 60;
        state = livenessReducer(state, makeSignal(t, { leftEye: eyeValue, rightEye: eyeValue }), config);
    }
    return { state, t };
}

describe('liveness reducer', () => {
    describe('happy path: blink', () => {
        it('walks searching → centering → arming → challenge_blink with a stable open-eye baseline', () => {
            const { state } = driveToChallenge(0.85);
            expect(state.phase).toBe('challenge_blink');
            expect(state.challenge).toBe('blink');
            expect(state.baseline).toBeCloseTo(0.85, 5);
            expect(state.guidance).toBe('blink');
        });

        it('detects a deliberate blink (open → closed → open) and settles into capture', () => {
            let { state, t } = driveToChallenge(0.85);

            // closed for two frames
            t += 60;
            state = livenessReducer(state, makeSignal(t, { leftEye: 0.05, rightEye: 0.05 }), config);
            expect(state.blinkClosedAt).toBe(t);
            t += 120;
            state = livenessReducer(state, makeSignal(t, { leftEye: 0.05, rightEye: 0.08 }), config);

            // reopen within the window → settling
            t += 150;
            state = livenessReducer(state, makeSignal(t), config);
            expect(state.phase).toBe('settling');

            // hold still until settleMs elapses
            t += 100;
            state = livenessReducer(state, makeSignal(t), config); // hold start
            t += 100;
            state = livenessReducer(state, makeSignal(t), config);
            t += 100;
            state = livenessReducer(state, makeSignal(t), config);
            t += 100;
            state = livenessReducer(state, makeSignal(t), config);
            expect(state.phase).toBe('capture');
            expect(state.progress).toBe(1);
            expect(state.guidance).toBe('done');
        });

        it('one eye closed (wink / photo with thumb over an eye) does not count as a blink', () => {
            let { state, t } = driveToChallenge(0.85);
            t += 60;
            state = livenessReducer(state, makeSignal(t, { leftEye: 0.05, rightEye: 0.85 }), config);
            expect(state.blinkClosedAt).toBeNull();
            expect(state.phase).toBe('challenge_blink');
        });

        it('eyes held closed past the window are invalidated until a genuine reopen', () => {
            let { state, t } = driveToChallenge(0.85);

            // closed continuously past blinkReopenWindowMs
            t += 60;
            state = livenessReducer(state, makeSignal(t, { leftEye: 0.05, rightEye: 0.05 }), config);
            const closedStart = t;
            while (t - closedStart <= config.blinkReopenWindowMs) {
                t += 200;
                state = livenessReducer(state, makeSignal(t, { leftEye: 0.05, rightEye: 0.05 }), config);
            }
            expect(state.blinkInvalidUntilOpen).toBe(true);
            expect(state.blinkClosedAt).toBeNull();

            // further closed frames must NOT re-arm while invalidated
            t += 200;
            state = livenessReducer(state, makeSignal(t, { leftEye: 0.05, rightEye: 0.05 }), config);
            expect(state.blinkClosedAt).toBeNull();
            expect(state.phase).toBe('challenge_blink');

            // reopen clears the invalidation, then a real blink passes
            t += 200;
            state = livenessReducer(state, makeSignal(t), config);
            expect(state.blinkInvalidUntilOpen).toBe(false);
            t += 100;
            state = livenessReducer(state, makeSignal(t, { leftEye: 0.05, rightEye: 0.05 }), config);
            t += 150;
            state = livenessReducer(state, makeSignal(t), config);
            expect(state.phase).toBe('settling');
        });
    });

    describe('challenge selection (glasses / sunglasses)', () => {
        it('low open-eye baseline (glasses glare) falls back to head-turn before any blink prompt', () => {
            const { state } = driveToChallenge(0.4);
            expect(state.phase).toBe('challenge_turn_left');
            expect(state.challenge).toBe('turn');
            expect(state.guidance).toBe('turn_left');
        });

        it('noisy eye signal (high variance) falls back to head-turn', () => {
            let state = initialLivenessState();
            let t = 1000;
            state = livenessReducer(state, makeSignal(t), config);
            t += 60;
            state = livenessReducer(state, makeSignal(t), config);
            // alternate 0.25/0.95 — median passes 0.65? median of alternating = ~0.6/0.95 mix;
            // spread is what disqualifies here.
            const values = [0.95, 0.25, 0.95, 0.25, 0.95, 0.25, 0.95, 0.25, 0.95, 0.25];
            for (const v of values) {
                t += 60;
                state = livenessReducer(state, makeSignal(t, { leftEye: v, rightEye: v }), config);
            }
            expect(state.phase).toBe('challenge_turn_left');
            expect(state.challenge).toBe('turn');
        });

        it('null eye data (sunglasses) times out arming into head-turn and flags eyeDataMissing', () => {
            let state = initialLivenessState();
            let t = 1000;
            state = livenessReducer(state, makeSignal(t), config);
            t += 60;
            state = livenessReducer(state, makeSignal(t), config);
            expect(state.phase).toBe('arming');
            // null-eye frontal frames until armingMaxMs forces a decision
            const armingStart = t;
            while (state.phase === 'arming' && t - armingStart < config.armingMaxMs + 500) {
                t += 200;
                state = livenessReducer(state, makeSignal(t, { leftEye: null, rightEye: null }), config);
            }
            expect(state.phase).toBe('challenge_turn_left');
            expect(state.eyeDataMissing).toBe(true);
        });
    });

    describe('blink → turn ladder', () => {
        it('demotes to head-turn after maxBlinkTimeouts blink timeouts', () => {
            let { state, t } = driveToChallenge(0.85);
            expect(state.phase).toBe('challenge_blink');

            // 1st timeout: no blink for challengeTimeoutMs → re-arm via centering
            t += config.challengeTimeoutMs + 100;
            state = livenessReducer(state, makeSignal(t), config);
            expect(state.blinkTimeouts).toBe(1);
            expect(state.phase).toBe('centering');

            // re-drive to challenge — still blink (1 < 2)
            t += 60;
            state = livenessReducer(state, makeSignal(t), config); // centering → arming
            for (let i = 0; i < config.armingFramesRequired + 2 && state.phase === 'arming'; i++) {
                t += 60;
                state = livenessReducer(state, makeSignal(t), config);
            }
            expect(state.phase).toBe('challenge_blink');

            // 2nd timeout → turn for the rest of the session
            t += config.challengeTimeoutMs + 100;
            state = livenessReducer(state, makeSignal(t), config);
            expect(state.blinkTimeouts).toBe(2);
            expect(state.phase).toBe('challenge_turn_left');
            expect(state.challenge).toBe('turn');
        });

        it('reset with preserveLadder keeps the demotion; a fresh reset clears it', () => {
            const prev: LivenessState = { ...initialLivenessState(), blinkTimeouts: 2, eyeDataMissing: true };
            const kept = resetLivenessState(prev, true);
            expect(kept.blinkTimeouts).toBe(2);
            expect(kept.eyeDataMissing).toBe(true);
            expect(kept.phase).toBe('searching');

            const fresh = resetLivenessState(prev, false);
            expect(fresh.blinkTimeouts).toBe(0);
            expect(fresh.eyeDataMissing).toBe(false);
        });

        it('after demotion, arming never selects blink again even with a perfect baseline', () => {
            let state = { ...initialLivenessState(), blinkTimeouts: config.maxBlinkTimeouts };
            let t = 1000;
            state = livenessReducer(state, makeSignal(t), config);
            t += 60;
            state = livenessReducer(state, makeSignal(t), config);
            for (let i = 0; i < config.armingFramesRequired + 2 && state.phase === 'arming'; i++) {
                t += 60;
                state = livenessReducer(state, makeSignal(t), config);
            }
            expect(state.phase).toBe('challenge_turn_left');
        });
    });

    describe('head-turn challenge', () => {
        it('completes left → right → settling → capture', () => {
            let { state, t } = driveToChallenge(0.4); // low baseline → turn
            expect(state.phase).toBe('challenge_turn_left');

            t += 200;
            state = livenessReducer(state, makeSignal(t, { yaw: -20, leftEye: 0.4, rightEye: 0.4 }), config);
            expect(state.phase).toBe('challenge_turn_right');

            t += 300;
            state = livenessReducer(state, makeSignal(t, { yaw: 22, leftEye: 0.4, rightEye: 0.4 }), config);
            expect(state.phase).toBe('settling');

            // settle frontal (turn challenge does not require an eye baseline)
            for (let i = 0; i < 5; i++) {
                t += 100;
                state = livenessReducer(state, makeSignal(t, { leftEye: 0.4, rightEye: 0.4 }), config);
            }
            expect(state.phase).toBe('capture');
        });

        it('tolerates an off-center box during the turn (relaxed containment)', () => {
            let { state, t } = driveToChallenge(0.4);
            // cx 0.72 is off_center under normal tolerance but fine while turning
            t += 200;
            state = livenessReducer(
                state,
                makeSignal(t, { yaw: -20, leftEye: 0.4, rightEye: 0.4, box: { cx: 0.72, cy: 0.44, w: 0.5, h: 0.5 } }),
                config,
            );
            expect(state.phase).toBe('challenge_turn_right');
        });

        it('turn timeout ends the session (last ladder rung)', () => {
            let { state, t } = driveToChallenge(0.4);
            t += config.challengeTimeoutMs + 100;
            state = livenessReducer(state, makeSignal(t, { leftEye: 0.4, rightEye: 0.4 }), config);
            expect(state.phase).toBe('timed_out');
        });
    });

    describe('continuity & containment', () => {
        it('short detector gap (<hard) keeps the challenge alive with hold_still coaching', () => {
            let { state, t } = driveToChallenge(0.85);
            state = run(state, [noFace(t + 700)]);
            expect(state.phase).toBe('challenge_blink');
            expect(state.guidance).toBe('hold_still');
        });

        it('long detector gap (>hard) resets to searching, preserving the ladder', () => {
            let { state, t } = driveToChallenge(0.85);
            state = { ...state, blinkTimeouts: 1 };
            state = run(state, [noFace(t + config.faceGapHardMs + 100)]);
            expect(state.phase).toBe('searching');
            expect(state.blinkTimeouts).toBe(1);
        });

        it('trackingId churn with a continuous box does NOT reset', () => {
            let { state, t } = driveToChallenge(0.85);
            t += 60;
            state = livenessReducer(state, makeSignal(t, { trackingId: 99 }), config);
            expect(state.phase).toBe('challenge_blink');
        });

        it('a large center jump means a different face → back to centering', () => {
            let { state, t } = driveToChallenge(0.85);
            t += 60;
            state = livenessReducer(state, makeSignal(t, { box: { cx: 0.92, cy: 0.44, w: 0.5, h: 0.5 } }), config);
            expect(state.phase).toBe('centering');
        });

        it('a second face mid-challenge demotes to centering with one_face guidance', () => {
            let { state, t } = driveToChallenge(0.85);
            t += 60;
            state = livenessReducer(state, makeSignal(t, { faceCount: 2 }), config);
            expect(state.phase).toBe('centering');
            expect(state.guidance).toBe('one_face');
        });

        it('drifting out of the circle during arming discards the partial baseline', () => {
            let state = initialLivenessState();
            let t = 1000;
            state = livenessReducer(state, makeSignal(t), config);
            t += 60;
            state = livenessReducer(state, makeSignal(t), config);
            expect(state.phase).toBe('arming');
            t += 60;
            state = livenessReducer(state, makeSignal(t), config);
            expect(state.armingSamples.length).toBe(1);
            // drift off-center (within centerJumpMax so it's the containment rule, not continuity)
            t += 60;
            state = livenessReducer(state, makeSignal(t, { box: { cx: 0.78, cy: 0.44, w: 0.5, h: 0.5 } }), config);
            expect(state.phase).toBe('centering');
            expect(state.armingSamples.length).toBe(0);
            expect(state.guidance).toBe('center_face');
        });
    });

    describe('positioning guidance', () => {
        it('coaches move_closer / move_back / center_face before arming', () => {
            let state = initialLivenessState();
            let t = 1000;
            state = livenessReducer(state, makeSignal(t), config); // → centering

            t += 60;
            state = livenessReducer(state, makeSignal(t, { box: { cx: 0.5, cy: 0.44, w: 0.2, h: 0.2 } }), config);
            expect(state.guidance).toBe('move_closer');

            t += 60;
            state = livenessReducer(state, makeSignal(t, { box: { cx: 0.5, cy: 0.44, w: 0.9, h: 0.9 } }), config);
            expect(state.guidance).toBe('move_back');

            t += 60;
            state = livenessReducer(state, makeSignal(t, { box: { cx: 0.8, cy: 0.44, w: 0.5, h: 0.5 } }), config);
            expect(state.guidance).toBe('center_face');
        });

        it('suggests finding light after searching with no face for a while', () => {
            let state = initialLivenessState();
            state = run(state, [noFace(1000), noFace(1000 + config.searchingLightHintMs + 200)]);
            expect(state.phase).toBe('searching');
            expect(state.guidance).toBe('face_light');
        });
    });

    describe('timeouts & terminal states', () => {
        it('times out the whole session from the first face seen', () => {
            let { state, t } = driveToChallenge(0.85);
            state = livenessReducer(state, makeSignal(t + config.sessionTimeoutMs + 100), config);
            expect(state.phase).toBe('timed_out');
        });

        it('terminal phases ignore further signals until reset', () => {
            let { state, t } = driveToChallenge(0.85);
            state = livenessReducer(state, makeSignal(t + config.sessionTimeoutMs + 100), config);
            expect(state.phase).toBe('timed_out');
            const after = livenessReducer(state, makeSignal(t + config.sessionTimeoutMs + 200), config);
            expect(after).toBe(state);
        });

        it('never settles → re-arms via centering (settleMaxMs)', () => {
            let { state, t } = driveToChallenge(0.85);
            // blink
            t += 60;
            state = livenessReducer(state, makeSignal(t, { leftEye: 0.05, rightEye: 0.05 }), config);
            t += 150;
            state = livenessReducer(state, makeSignal(t), config);
            expect(state.phase).toBe('settling');
            // keep breaking the hold with yaw wobble until settleMaxMs passes
            const settleStart = t;
            while (state.phase === 'settling' && t - settleStart < config.settleMaxMs + 500) {
                t += 300;
                state = livenessReducer(state, makeSignal(t, { yaw: 14 }), config);
            }
            expect(state.phase).toBe('centering');
        });
    });
});
