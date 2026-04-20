import { useTheme } from '@/contexts/ThemeContext';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { getRoadshowColors } from '@/constants/roadshow/tokens';

export type EventStatus = 'setup' | 'live' | 'past' | 'late' | 'on' | 'departed';

export interface EventStatusPillProps {
    status: EventStatus;
    label?: string;
    compact?: boolean;
}

const LABELS: Record<EventStatus, string> = {
    setup: 'SETUP',
    live: 'LIVE',
    past: 'PAST',
    late: 'LATE',
    on: 'ON',
    departed: 'LEFT',
};

export function EventStatusPill({ status, label, compact = false }: EventStatusPillProps) {
    const { resolved, colors } = useTheme();
    const stage = getRoadshowColors(resolved);

    const tint =
        status === 'live'
            ? stage.live
            : status === 'late'
              ? stage.late
              : status === 'on'
                ? stage.on
                : status === 'setup'
                  ? stage.setup
                  : status === 'departed'
                    ? stage.closed
                    : colors.textTertiary;

    const pulse = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        if (status !== 'live') return;
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 0.3, duration: 700, useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
            ]),
        );
        loop.start();
        return () => loop.stop();
    }, [status, pulse]);

    return (
        <View
            style={[styles.pill, compact && styles.pillCompact, { backgroundColor: tint + '1F', borderColor: tint }]}
            accessibilityLabel={`Status: ${label ?? LABELS[status]}`}
        >
            {status === 'live' ? (
                <Animated.View style={[styles.dot, { backgroundColor: tint, opacity: pulse }]} />
            ) : (
                <View style={[styles.dot, { backgroundColor: tint }]} />
            )}
            <Text style={[styles.text, { color: tint }]}>{label ?? LABELS[status]}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        borderWidth: 1,
        alignSelf: 'flex-start',
    },
    pillCompact: { paddingHorizontal: 8, paddingVertical: 2 },
    dot: { width: 6, height: 6, borderRadius: 3 },
    text: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
});
