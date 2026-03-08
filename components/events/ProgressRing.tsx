import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

interface ProgressRingProps {
    actual: number;
    pledged: number;
    color: string;
    label: string;
    accessLabel: string;
}

export default function ProgressRing({ actual, pledged, color, label, accessLabel }: ProgressRingProps) {
    const pct = pledged > 0 ? Math.min(1, actual / pledged) : 0;
    const noPledge = pledged === 0;
    const ringW = 80;

    const fillAnim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.timing(fillAnim, { toValue: pct, duration: 600, useNativeDriver: false }).start();
    }, [pct]);

    const fillWidth = fillAnim.interpolate({ inputRange: [0, 1], outputRange: [0, ringW] });

    return (
        <View style={styles.ringContainer} accessibilityLabel={accessLabel}>
            <Text style={[styles.ringActual, { color }]}>{actual}</Text>
            {noPledge ? (
                <View style={[styles.ringTrack, { width: ringW, borderStyle: 'dashed', borderColor: '#CBD5E1' }]} />
            ) : (
                <View style={[styles.ringTrack, { width: ringW, backgroundColor: color + '22' }]}>
                    <Animated.View style={[styles.ringFill, { width: fillWidth, backgroundColor: color }]} />
                </View>
            )}
            <Text style={styles.ringLabel}>{label}</Text>
            {noPledge
                ? <Text style={styles.ringTarget}>No target</Text>
                : <Text style={styles.ringTarget}>of {pledged}</Text>
            }
        </View>
    );
}

const styles = StyleSheet.create({
    ringContainer: { alignItems: 'center', gap: 4, flexShrink: 1, minWidth: 80 },
    ringActual: { fontSize: 28, fontWeight: '800' },
    ringTrack: { height: 6, borderRadius: 3, overflow: 'hidden', borderWidth: 0 },
    ringFill: { height: 6, borderRadius: 3 },
    ringLabel: { fontSize: 11, color: '#8E8E93', fontWeight: '600' },
    ringTarget: { fontSize: 11, color: '#8E8E93' },
});
