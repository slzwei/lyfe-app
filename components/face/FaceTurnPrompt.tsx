/**
 * Animated face prompt for the liveness flow.
 *
 * Drives off two props:
 *   - direction: 'straight' | 'left' | 'right' → pulses matching chevrons and
 *     compresses the face horizontally (scaleX) to cue a head turn.
 *   - morphStage: 'live' | 'ring' | 'tick' → true SVG path interpolation that
 *     morphs the four corner brackets into a closed ring, then collapses
 *     two of the ring quadrants into a green checkmark (visually inspired by
 *     Apple's Face ID enrollment animation, though our feature is "Lyfe ID",
 *     a separate face-based check-in — not the Apple Face ID biometric).
 *
 * Each of the four brackets is a single cubic bezier path whose 8 control
 * coordinates are interpolated across three keyframe states. The TR and BL
 * quadrants continue morphing into the long/short strokes of the checkmark;
 * the TL and BR quadrants fade to 0 opacity in the tick stage.
 */
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    Easing,
    interpolate,
    interpolateColor,
    useAnimatedProps,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G, Path } from 'react-native-svg';

type Direction = 'straight' | 'left' | 'right';
type MorphStage = 'live' | 'ring' | 'tick';

type Props = {
    direction: Direction;
    size?: number;
    color?: string;
    morphStage?: MorphStage;
};

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);
const TURN_DEGREES = 35;

// Morph stage → progress number for `interpolate` keyframes.
const STAGE_LIVE = 0;
const STAGE_RING = 1;
const STAGE_TICK = 2;

export function FaceTurnPrompt({ direction, size = 120, color = '#FF7600', morphStage = 'live' }: Props) {
    const rotation = useSharedValue(0);
    const leftPulse = useSharedValue(0);
    const rightPulse = useSharedValue(0);
    const morph = useSharedValue(STAGE_LIVE);
    const liveOpacity = useSharedValue(1);

    // Morph stage transitions (brackets ↔ ring ↔ tick).
    useEffect(() => {
        const target = morphStage === 'live' ? STAGE_LIVE : morphStage === 'ring' ? STAGE_RING : STAGE_TICK;
        morph.value = withTiming(target, { duration: 600, easing: Easing.inOut(Easing.ease) });
        liveOpacity.value = withTiming(morphStage === 'live' ? 1 : 0, {
            duration: 300,
            easing: Easing.inOut(Easing.ease),
        });
    }, [morphStage, morph, liveOpacity]);

    // Head-turn rotation + chevron pulse. Chevrons stay idle once the prompt
    // has morphed past the live stage.
    useEffect(() => {
        const target = direction === 'left' ? -TURN_DEGREES : direction === 'right' ? TURN_DEGREES : 0;
        rotation.value = withTiming(target, { duration: 500, easing: Easing.inOut(Easing.ease) });

        if (morphStage !== 'live') {
            leftPulse.value = withTiming(0, { duration: 200 });
            rightPulse.value = withTiming(0, { duration: 200 });
            return;
        }

        if (direction === 'left') {
            leftPulse.value = withRepeat(
                withSequence(
                    withTiming(1, { duration: 450, easing: Easing.inOut(Easing.ease) }),
                    withTiming(0.15, { duration: 450, easing: Easing.inOut(Easing.ease) }),
                ),
                -1,
                true,
            );
            rightPulse.value = withTiming(0, { duration: 200 });
        } else if (direction === 'right') {
            rightPulse.value = withRepeat(
                withSequence(
                    withTiming(1, { duration: 450, easing: Easing.inOut(Easing.ease) }),
                    withTiming(0.15, { duration: 450, easing: Easing.inOut(Easing.ease) }),
                ),
                -1,
                true,
            );
            leftPulse.value = withTiming(0, { duration: 200 });
        } else {
            leftPulse.value = withTiming(0, { duration: 200 });
            rightPulse.value = withTiming(0, { duration: 200 });
        }
    }, [direction, morphStage, leftPulse, rightPulse, rotation]);

    // ── Morphing path props (one per quadrant) ───────────────
    //
    // Each path is a single cubic bezier with 8 coordinates. We build the
    // `d` string on the UI thread from per-coordinate `interpolate` calls
    // across [live, ring, tick] keyframes. Cubic approximation of the
    // circle uses the magic constant 22.09 = 40 * 0.5522847498.

    // TL: corner bracket → top-left ring quadrant → stays at ring shape and fades
    const tlPathProps = useAnimatedProps(() => {
        const p = morph.value;
        const sx = interpolate(p, [STAGE_LIVE, STAGE_RING, STAGE_TICK], [15, 10, 10]);
        const sy = interpolate(p, [STAGE_LIVE, STAGE_RING, STAGE_TICK], [30, 50, 50]);
        const c1x = interpolate(p, [STAGE_LIVE, STAGE_RING, STAGE_TICK], [15, 10, 10]);
        const c1y = interpolate(p, [STAGE_LIVE, STAGE_RING, STAGE_TICK], [20, 27.91, 27.91]);
        const c2x = interpolate(p, [STAGE_LIVE, STAGE_RING, STAGE_TICK], [20, 27.91, 27.91]);
        const c2y = interpolate(p, [STAGE_LIVE, STAGE_RING, STAGE_TICK], [15, 10, 10]);
        const ex = interpolate(p, [STAGE_LIVE, STAGE_RING, STAGE_TICK], [30, 50, 50]);
        const ey = interpolate(p, [STAGE_LIVE, STAGE_RING, STAGE_TICK], [15, 10, 10]);
        const opacity = interpolate(p, [STAGE_LIVE, STAGE_RING, STAGE_TICK], [1, 1, 0]);
        return {
            d: `M${sx} ${sy} C${c1x} ${c1y} ${c2x} ${c2y} ${ex} ${ey}`,
            opacity,
        };
    });

    // TR: corner bracket → top-right ring quadrant → tick long stroke (42,68)→(72,38)
    const trPathProps = useAnimatedProps(() => {
        const p = morph.value;
        const sx = interpolate(p, [STAGE_LIVE, STAGE_RING, STAGE_TICK], [70, 50, 42]);
        const sy = interpolate(p, [STAGE_LIVE, STAGE_RING, STAGE_TICK], [15, 10, 68]);
        const c1x = interpolate(p, [STAGE_LIVE, STAGE_RING, STAGE_TICK], [80, 72.09, 52]);
        const c1y = interpolate(p, [STAGE_LIVE, STAGE_RING, STAGE_TICK], [15, 10, 58]);
        const c2x = interpolate(p, [STAGE_LIVE, STAGE_RING, STAGE_TICK], [85, 90, 62]);
        const c2y = interpolate(p, [STAGE_LIVE, STAGE_RING, STAGE_TICK], [20, 27.91, 48]);
        const ex = interpolate(p, [STAGE_LIVE, STAGE_RING, STAGE_TICK], [85, 90, 72]);
        const ey = interpolate(p, [STAGE_LIVE, STAGE_RING, STAGE_TICK], [30, 50, 38]);
        return {
            d: `M${sx} ${sy} C${c1x} ${c1y} ${c2x} ${c2y} ${ex} ${ey}`,
        };
    });

    // BR: corner bracket → bottom-right ring quadrant → stays and fades
    const brPathProps = useAnimatedProps(() => {
        const p = morph.value;
        const sx = interpolate(p, [STAGE_LIVE, STAGE_RING, STAGE_TICK], [85, 90, 90]);
        const sy = interpolate(p, [STAGE_LIVE, STAGE_RING, STAGE_TICK], [70, 50, 50]);
        const c1x = interpolate(p, [STAGE_LIVE, STAGE_RING, STAGE_TICK], [85, 90, 90]);
        const c1y = interpolate(p, [STAGE_LIVE, STAGE_RING, STAGE_TICK], [80, 72.09, 72.09]);
        const c2x = interpolate(p, [STAGE_LIVE, STAGE_RING, STAGE_TICK], [80, 72.09, 72.09]);
        const c2y = interpolate(p, [STAGE_LIVE, STAGE_RING, STAGE_TICK], [85, 90, 90]);
        const ex = interpolate(p, [STAGE_LIVE, STAGE_RING, STAGE_TICK], [70, 50, 50]);
        const ey = interpolate(p, [STAGE_LIVE, STAGE_RING, STAGE_TICK], [85, 90, 90]);
        const opacity = interpolate(p, [STAGE_LIVE, STAGE_RING, STAGE_TICK], [1, 1, 0]);
        return {
            d: `M${sx} ${sy} C${c1x} ${c1y} ${c2x} ${c2y} ${ex} ${ey}`,
            opacity,
        };
    });

    // BL: corner bracket → bottom-left ring quadrant → tick short stroke (25,55)→(42,68)
    const blPathProps = useAnimatedProps(() => {
        const p = morph.value;
        const sx = interpolate(p, [STAGE_LIVE, STAGE_RING, STAGE_TICK], [30, 50, 25]);
        const sy = interpolate(p, [STAGE_LIVE, STAGE_RING, STAGE_TICK], [85, 90, 55]);
        const c1x = interpolate(p, [STAGE_LIVE, STAGE_RING, STAGE_TICK], [20, 27.91, 30.67]);
        const c1y = interpolate(p, [STAGE_LIVE, STAGE_RING, STAGE_TICK], [85, 90, 59.33]);
        const c2x = interpolate(p, [STAGE_LIVE, STAGE_RING, STAGE_TICK], [15, 10, 36.33]);
        const c2y = interpolate(p, [STAGE_LIVE, STAGE_RING, STAGE_TICK], [80, 72.09, 63.67]);
        const ex = interpolate(p, [STAGE_LIVE, STAGE_RING, STAGE_TICK], [15, 10, 42]);
        const ey = interpolate(p, [STAGE_LIVE, STAGE_RING, STAGE_TICK], [70, 50, 68]);
        return {
            d: `M${sx} ${sy} C${c1x} ${c1y} ${c2x} ${c2y} ${ex} ${ey}`,
        };
    });

    // Interpolate stroke color from the base color to green when we reach
    // the tick stage, inherited by all four paths in the group.
    const groupProps = useAnimatedProps(() => ({
        stroke: interpolateColor(morph.value, [STAGE_LIVE, STAGE_RING, STAGE_TICK], [color, color, '#34C759']),
    }));

    const leftChevronProps = useAnimatedProps(() => ({ opacity: leftPulse.value }));
    const rightChevronProps = useAnimatedProps(() => ({ opacity: rightPulse.value }));

    // 2D-only transform (scaleX) instead of perspective+rotateY. A 3D transform
    // creates an iOS compositing layer that can render beyond its parent bounds
    // and cover sibling UI (step dots, prompt text, cancel button).
    const faceStyle = useAnimatedStyle(() => ({
        transform: [{ scaleX: interpolate(rotation.value, [-TURN_DEGREES, 0, TURN_DEGREES], [0.6, 1, 0.6]) }],
        opacity: liveOpacity.value,
    }));

    const liveLayerStyle = useAnimatedStyle(() => ({
        opacity: liveOpacity.value,
    }));

    return (
        <View style={{ width: size, height: size, overflow: 'hidden' }}>
            {/* Morphing paths: 4 cubic beziers that smoothly interpolate from
                corner brackets → closed ring → checkmark across stage keyframes. */}
            <Svg viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
                <AnimatedG
                    animatedProps={groupProps}
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                >
                    <AnimatedPath animatedProps={tlPathProps} />
                    <AnimatedPath animatedProps={trPathProps} />
                    <AnimatedPath animatedProps={brPathProps} />
                    <AnimatedPath animatedProps={blPathProps} />
                </AnimatedG>
            </Svg>

            {/* Chevron pulse layer — fades out once we leave the live stage. */}
            <Animated.View style={[StyleSheet.absoluteFill, liveLayerStyle]}>
                <Svg viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
                    <G stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none">
                        <AnimatedPath animatedProps={leftChevronProps} d="M28 43 L21 50 L28 57" />
                        <AnimatedPath animatedProps={leftChevronProps} d="M20 43 L13 50 L20 57" />
                        <AnimatedPath animatedProps={leftChevronProps} d="M12 43 L5 50 L12 57" />

                        <AnimatedPath animatedProps={rightChevronProps} d="M72 43 L79 50 L72 57" />
                        <AnimatedPath animatedProps={rightChevronProps} d="M80 43 L87 50 L80 57" />
                        <AnimatedPath animatedProps={rightChevronProps} d="M88 43 L95 50 L88 57" />
                    </G>
                </Svg>
            </Animated.View>

            {/* Rotating face (eyes / nose / mouth) — fades out once we leave live. */}
            <Animated.View style={[StyleSheet.absoluteFill, faceStyle]}>
                <Svg viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
                    <Circle cx={35} cy={42} r={3.5} fill={color} />
                    <Circle cx={65} cy={42} r={3.5} fill={color} />
                    <G stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none">
                        <Path d="M51 40 L47 55 H55" />
                        <Path d="M38 62 C 38 70, 62 70, 62 62" />
                    </G>
                </Svg>
            </Animated.View>
        </View>
    );
}
