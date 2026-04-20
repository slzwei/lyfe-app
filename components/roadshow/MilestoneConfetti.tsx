import { RoadshowRadii, getRoadshowColors } from '@/constants/roadshow/tokens';
import { TropicFonts } from '@/constants/roadshow/typography';
import { useTheme } from '@/contexts/ThemeContext';
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

export type MilestoneKind = 'sit' | 'pitch' | 'case';

export interface MilestoneConfettiProps {
    visible: boolean;
    kind?: MilestoneKind;
    onDismiss: () => void;
}

const LABELS: Record<MilestoneKind, [string, string]> = {
    case: ['Close secured.', 'Ring completed.'],
    sit: ['Sitdowns done.', 'You hit pledge.'],
    pitch: ['Pitches done.', 'You hit pledge.'],
};

/**
 * Scale-in centered alert card with falling confetti pieces.
 * Replaces the plain Confetti particle effect for milestone celebrations.
 */
export function MilestoneConfetti({ visible, kind = 'case', onDismiss }: MilestoneConfettiProps) {
    const { colors, resolved } = useTheme();
    const stage = getRoadshowColors(resolved);

    const scale = useRef(new Animated.Value(0.88)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(scale, { toValue: 1, duration: 320, useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 1, duration: 240, useNativeDriver: true }),
            ]).start();
        } else {
            scale.setValue(0.88);
            opacity.setValue(0);
        }
    }, [visible, scale, opacity]);

    const palette = useMemo(() => [stage.sitdowns, stage.closes, stage.pitches, stage.live, stage.late], [stage]);

    const { width } = Dimensions.get('window');
    const pieces = useMemo(() => Array.from({ length: 14 }), []);

    const [title, sub] = LABELS[kind];

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss} statusBarTranslucent>
            <Animated.View style={[styles.overlay, { opacity }]}>
                <Pressable style={StyleSheet.absoluteFillObject} onPress={onDismiss} accessibilityLabel="Dismiss" />

                {/* Confetti pieces falling from the top */}
                {pieces.map((_, i) => (
                    <FallingPiece
                        key={i}
                        color={palette[i % palette.length]}
                        startX={10 + ((i * 23) % 80)}
                        delay={i * 80}
                        width={width}
                    />
                ))}

                <Animated.View
                    style={[
                        styles.card,
                        {
                            backgroundColor: colors.cardBackground,
                            borderRadius: RoadshowRadii.sheet,
                            transform: [{ scale }],
                            opacity,
                        },
                    ]}
                >
                    <Text style={[styles.glyph, { color: stage.live }]}>✦</Text>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
                    <Text style={[styles.sub, { color: stage.live }]}>{sub}</Text>
                    <Pressable
                        onPress={onDismiss}
                        style={({ pressed }) => [
                            styles.cta,
                            {
                                backgroundColor: pressed ? colors.accentDark : colors.accent,
                                borderRadius: RoadshowRadii.card,
                            },
                        ]}
                        accessibilityLabel="Keep going"
                    >
                        <Text style={styles.ctaText}>Keep going</Text>
                    </Pressable>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
}

function FallingPiece({
    color,
    startX,
    delay,
    width,
}: {
    color: string;
    startX: number;
    delay: number;
    width: number;
}) {
    const translateY = useRef(new Animated.Value(-20)).current;
    const rotate = useRef(new Animated.Value(0)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.sequence([
            Animated.delay(delay),
            Animated.parallel([
                Animated.timing(translateY, { toValue: 720, duration: 1800, useNativeDriver: true }),
                Animated.timing(rotate, { toValue: 1, duration: 1800, useNativeDriver: true }),
                Animated.sequence([
                    Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
                    Animated.timing(opacity, { toValue: 0, duration: 1650, useNativeDriver: true }),
                ]),
            ]),
        ]).start();
    }, [delay, translateY, rotate, opacity]);

    const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '540deg'] });

    return (
        <Animated.View
            pointerEvents="none"
            style={[
                styles.piece,
                {
                    backgroundColor: color,
                    left: (startX / 100) * width,
                    transform: [{ translateY }, { rotate: spin }],
                    opacity,
                },
            ]}
        />
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.35)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    card: {
        width: '78%',
        paddingHorizontal: 26,
        paddingTop: 28,
        paddingBottom: 22,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 50,
        shadowOffset: { width: 0, height: 20 },
        elevation: 24,
    },
    glyph: {
        fontSize: 32,
        marginBottom: 6,
    },
    title: {
        fontSize: 22,
        fontFamily: TropicFonts.serif,
        fontWeight: '500',
        letterSpacing: -0.4,
        textAlign: 'center',
    },
    sub: {
        fontSize: 14,
        fontFamily: TropicFonts.serifItalic,
        marginTop: 4,
        textAlign: 'center',
    },
    cta: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 13,
        marginTop: 16,
        minHeight: 46,
    },
    ctaText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontFamily: TropicFonts.serif,
        fontWeight: '500',
        letterSpacing: -0.2,
    },
    piece: {
        position: 'absolute',
        top: -4,
        width: 6,
        height: 10,
        borderRadius: 1,
    },
});

export const CONFETTI_DURATION = 2600;
