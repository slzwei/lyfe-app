/**
 * Animated face prompt showing the user which direction to turn their head.
 * A stylised face rotates in 3D (rotateY) and chevron arrows pulse on the
 * matching side. Drives off a `direction` prop so the parent can sync it to
 * the liveness step state.
 */
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    Easing,
    interpolate,
    useAnimatedProps,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G, Path } from 'react-native-svg';

type Direction = 'straight' | 'left' | 'right';

type Props = {
    direction: Direction;
    size?: number;
    color?: string;
};

const AnimatedPath = Animated.createAnimatedComponent(Path);
const TURN_DEGREES = 35;

export function FaceTurnPrompt({ direction, size = 120, color = '#FF7600' }: Props) {
    const rotation = useSharedValue(0);
    const leftPulse = useSharedValue(0);
    const rightPulse = useSharedValue(0);

    useEffect(() => {
        const target = direction === 'left' ? -TURN_DEGREES : direction === 'right' ? TURN_DEGREES : 0;

        rotation.value = withTiming(target, {
            duration: 500,
            easing: Easing.inOut(Easing.ease),
        });

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
    }, [direction, leftPulse, rightPulse, rotation]);

    // 2D-only transform (scaleX) instead of perspective+rotateY. A 3D transform
    // creates an iOS compositing layer that can render beyond its parent bounds
    // and cover sibling UI (step dots, prompt text, cancel button).
    const faceStyle = useAnimatedStyle(() => ({
        transform: [{ scaleX: interpolate(rotation.value, [-TURN_DEGREES, 0, TURN_DEGREES], [0.6, 1, 0.6]) }],
    }));

    const leftChevronProps = useAnimatedProps(() => ({ opacity: leftPulse.value }));
    const rightChevronProps = useAnimatedProps(() => ({ opacity: rightPulse.value }));

    return (
        <View style={{ width: size, height: size, overflow: 'hidden' }}>
            {/* Static layer: corner brackets + chevron arrows */}
            <Svg viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
                <G stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none">
                    {/* Corner brackets */}
                    <Path d="M30 15 H19 Q15 15 15 19 V30" />
                    <Path d="M70 15 H81 Q85 15 85 19 V30" />
                    <Path d="M30 85 H19 Q15 85 15 81 V70" />
                    <Path d="M70 85 H81 Q85 85 85 81 V70" />

                    {/* Left chevrons (pulse when direction === 'left') */}
                    <AnimatedPath animatedProps={leftChevronProps} d="M28 43 L21 50 L28 57" />
                    <AnimatedPath animatedProps={leftChevronProps} d="M20 43 L13 50 L20 57" />
                    <AnimatedPath animatedProps={leftChevronProps} d="M12 43 L5 50 L12 57" />

                    {/* Right chevrons (pulse when direction === 'right') */}
                    <AnimatedPath animatedProps={rightChevronProps} d="M72 43 L79 50 L72 57" />
                    <AnimatedPath animatedProps={rightChevronProps} d="M80 43 L87 50 L80 57" />
                    <AnimatedPath animatedProps={rightChevronProps} d="M88 43 L95 50 L88 57" />
                </G>
            </Svg>

            {/* Rotating layer: eyes, nose, mouth */}
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
