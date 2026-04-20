import React, { useEffect, useRef, useState } from 'react';
import { Animated, type LayoutChangeEvent, StyleSheet, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from 'react-native-svg';

export interface ShimmerOverlayProps {
    /** Hex color (no alpha) of the sweeping gradient stripe. */
    color: string;
    /** Peak stripe alpha as `NN` hex fragment — defaults to `44` (~27%). */
    intensity?: string;
    /** Full sweep duration in ms. Defaults to 3000. */
    durationMs?: number;
    /** Border radius of the parent card — clips the overlay. Defaults to 16. */
    radius?: number;
}

/**
 * CSS-shimmer equivalent for RN: a stripe the width of the card sweeps
 * left-to-right, looping indefinitely. Matches the prototype's
 * `linear-gradient(100deg, transparent 40%, terra44 50%, transparent 60%)`
 * animated via `rsShimmer 3s infinite`.
 */
export function ShimmerOverlay({ color, intensity = '44', durationMs = 3000, radius = 16 }: ShimmerOverlayProps) {
    const [width, setWidth] = useState(320);
    const translate = useRef(new Animated.Value(-1)).current;
    const alpha = Math.min(1, Math.max(0, parseInt(intensity, 16) / 255));

    useEffect(() => {
        const loop = Animated.loop(
            Animated.timing(translate, {
                toValue: 1,
                duration: durationMs,
                useNativeDriver: true,
            }),
        );
        loop.start();
        return () => loop.stop();
    }, [translate, durationMs]);

    const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

    const stripeWidth = Math.max(60, width * 0.5);
    const travel = width + stripeWidth;
    const translateX = translate.interpolate({
        inputRange: [-1, 1],
        outputRange: [-stripeWidth, travel - stripeWidth],
    });

    return (
        <Animated.View
            onLayout={onLayout}
            pointerEvents="none"
            style={[StyleSheet.absoluteFillObject, styles.clip, { borderRadius: radius } as ViewStyle]}
        >
            <Animated.View
                style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    width: stripeWidth,
                    transform: [{ translateX }, { skewX: '-18deg' }],
                }}
            >
                <Svg width="100%" height="100%">
                    <Defs>
                        <SvgLinearGradient id="rsShimmer" x1="0" y1="0" x2="1" y2="0">
                            <Stop offset="0" stopColor={color} stopOpacity="0" />
                            <Stop offset="0.5" stopColor={color} stopOpacity={alpha} />
                            <Stop offset="1" stopColor={color} stopOpacity="0" />
                        </SvgLinearGradient>
                    </Defs>
                    <Rect x="0" y="0" width="100%" height="100%" fill="url(#rsShimmer)" />
                </Svg>
            </Animated.View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    clip: { overflow: 'hidden' },
});
