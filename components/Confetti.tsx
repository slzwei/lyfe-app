import React, { useEffect, useMemo } from 'react';
import { Dimensions, View } from 'react-native';
import Animated, {
    cancelAnimation,
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

const { width: W, height: H } = Dimensions.get('window');

export const CONFETTI_DURATION = 2600;

const COUNT = 40;
// Tropic-warm confetti palette. Previously a dozen AI-default hex (indigo, violet,
// hot magenta, tailwind blues) — replaced 2026-04-22 so every celebration beat
// stays inside the Tropic brand. Shawn specifically locked in "terracotta confetti,
// never indigo" during /impeccable:teach.
const COLORS = [
    '#D6552B', // terracotta — flagship
    '#E27A4E', // warm coral (dark-mode accent)
    '#C89B3C', // ochre / butter
    '#B89556', // muted ochre
    '#9C5E6B', // dusty rose
    '#B27AAE', // dusty plum
    '#7A8C6B', // sage (cool relief for visual variety)
    '#A5623C', // clay
    '#C07A60', // persimmon
    '#B06B45', // burnt sienna
    '#EADBA8', // cream-gold (for light specks)
    '#F7E7DC', // accent-light tint (bright sparkle)
];

interface Particle {
    color: string;
    sx: number; // start X (absolute)
    sy: number; // start Y (absolute)
    vx: number; // initial X velocity px/s
    vy: number; // initial Y velocity px/s — negative = upward
    g: number; // gravity px/s²
    rot: number; // total rotation in degrees
    delay: number; // stagger delay as fraction of DURATION (0–0.15)
    w: number;
    h: number;
    br: number; // border radius
}

function makeParticle(): Particle {
    const size = 6 + Math.random() * 9;
    const shape = Math.random();
    // Fan upward: -PI*0.9 to -PI*0.1 (mostly up, slight horizontal spread)
    const angle = -Math.PI * 0.9 + Math.random() * Math.PI * 0.8;
    const speed = 550 + Math.random() * 950;
    return {
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        sx: W * 0.1 + Math.random() * W * 0.8,
        sy: H * 0.87,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        g: 1300 + Math.random() * 500,
        rot: (Math.random() - 0.5) * 1080,
        delay: Math.random() * 0.15,
        w: size,
        h: shape < 0.4 ? size : shape < 0.72 ? size * 0.42 : size,
        br: shape < 0.72 ? 2 : size / 2,
    };
}

function ConfettiParticle({ p, progress }: { p: Particle; progress: SharedValue<number> }) {
    const style = useAnimatedStyle(() => {
        'worklet';
        const raw = progress.value;
        // Apply per-particle delay
        const local = raw <= p.delay ? 0 : Math.min(1, (raw - p.delay) / (1 - p.delay));
        const t = local * CONFETTI_DURATION * 0.001; // seconds

        const tx = p.vx * t;
        const ty = p.vy * t + 0.5 * p.g * t * t; // arc upward then fall
        const rotate = local * p.rot;
        // Fade out in the last 35%
        const opacity = local < 0.65 ? 1 : Math.max(0, 1 - (local - 0.65) / 0.35);

        return {
            transform: [{ translateX: tx }, { translateY: ty }, { rotate: `${rotate}deg` }],
            opacity,
        };
    });

    return (
        <Animated.View
            style={[
                {
                    position: 'absolute',
                    left: p.sx - p.w / 2,
                    top: p.sy - p.h / 2,
                    width: p.w,
                    height: p.h,
                    backgroundColor: p.color,
                    borderRadius: p.br,
                },
                style,
            ]}
        />
    );
}

interface ConfettiProps {
    visible: boolean;
    confettiKey: number;
}

export default function Confetti({ visible, confettiKey }: ConfettiProps) {
    const progress = useSharedValue(0);
    // Re-randomize particles each time confettiKey changes
    const particles = useMemo(() => Array.from({ length: COUNT }, makeParticle), [confettiKey]);

    useEffect(() => {
        if (visible) {
            progress.value = 0;
            progress.value = withTiming(1, {
                duration: CONFETTI_DURATION,
                easing: Easing.linear,
            });
        } else {
            cancelAnimation(progress);
            progress.value = 0;
        }
    }, [visible, confettiKey]);

    if (!visible) return null;

    return (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
            {particles.map((p, i) => (
                <ConfettiParticle key={i} p={p} progress={progress} />
            ))}
        </View>
    );
}
