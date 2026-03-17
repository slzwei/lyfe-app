import { useTheme } from '@/contexts/ThemeContext';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

interface LoadingStateProps {
    rows?: number;
}

export default function LoadingState({ rows = 3 }: LoadingStateProps) {
    const { colors } = useTheme();
    const pulse = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 0.3, duration: 800, useNativeDriver: true }),
            ]),
        );
        animation.start();
        return () => animation.stop();
    }, [pulse]);

    return (
        <View style={styles.container} accessible accessibilityLabel="Loading content" accessibilityRole="progressbar">
            {Array.from({ length: rows }).map((_, i) => (
                <Animated.View
                    key={i}
                    style={[
                        styles.card,
                        {
                            backgroundColor: colors.surfacePrimary,
                            borderColor: colors.borderLight,
                            opacity: pulse,
                        },
                    ]}
                >
                    <View style={styles.cardRow}>
                        <View style={[styles.avatar, { backgroundColor: colors.borderLight }]} />
                        <View style={styles.lines}>
                            <View style={[styles.lineShort, { backgroundColor: colors.borderLight }]} />
                            <View style={[styles.lineLong, { backgroundColor: colors.borderLight }]} />
                        </View>
                    </View>
                </Animated.View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { padding: 16, gap: 10 },
    card: {
        borderRadius: 14,
        borderWidth: 0.5,
        padding: 16,
    },
    cardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 12,
    },
    lines: { flex: 1, gap: 8 },
    lineShort: { height: 12, borderRadius: 6, width: '50%' },
    lineLong: { height: 12, borderRadius: 6, width: '80%' },
});
