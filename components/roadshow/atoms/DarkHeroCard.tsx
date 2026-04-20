import { useTheme } from '@/contexts/ThemeContext';
import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

type GlowColor = 'terra' | 'sage' | 'cobalt' | 'pink' | 'butter';

export interface DarkHeroCardProps {
    children: React.ReactNode;
    /** Renders behind content but above the glow — for shimmer overlays etc. */
    overlay?: React.ReactNode;
    glow?: GlowColor;
    glowSize?: 'sm' | 'md' | 'lg';
    glowPosition?: 'tr' | 'bl' | 'center-tr';
    radius?: number;
    style?: ViewStyle;
}

/**
 * Dark ink hero card with a radial-style glow accent in the corner.
 * React Native lacks radial-gradient, so we fake it with a large blurred circle
 * positioned off-edge — equivalent to the prototype's `radial-gradient(circle at 85% 15%, X, transparent)`.
 */
export function DarkHeroCard({
    children,
    overlay,
    glow = 'terra',
    glowSize = 'md',
    glowPosition = 'tr',
    radius = 16,
    style,
}: DarkHeroCardProps) {
    const { colors, resolved } = useTheme();
    const ink = resolved === 'dark' ? colors.surfaceElevated : '#1B1A17';

    const glowColor =
        glow === 'terra'
            ? '#C85A2F'
            : glow === 'sage'
              ? '#7A8C6B'
              : glow === 'cobalt'
                ? '#3C5A8A'
                : glow === 'pink'
                  ? '#D88A93'
                  : '#E8C668';

    const glowDim = glowSize === 'lg' ? 140 : glowSize === 'sm' ? 90 : 110;
    const glowOffset = glowSize === 'lg' ? -36 : glowSize === 'sm' ? -22 : -28;

    const glowStyle: ViewStyle =
        glowPosition === 'bl'
            ? { left: glowOffset, bottom: glowOffset }
            : glowPosition === 'center-tr'
              ? { right: -40, top: -10 }
              : { right: glowOffset, top: glowOffset };

    return (
        <View style={[styles.card, { backgroundColor: ink, borderRadius: radius }, style]}>
            <View
                style={[
                    styles.glow,
                    {
                        width: glowDim,
                        height: glowDim,
                        borderRadius: glowDim / 2,
                        backgroundColor: glowColor + '55',
                    },
                    glowStyle,
                ]}
            />
            {overlay ? (
                <View pointerEvents="none" style={styles.overlay}>
                    {overlay}
                </View>
            ) : null}
            <View style={styles.content}>{children}</View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        paddingVertical: 16,
        paddingHorizontal: 18,
        overflow: 'hidden',
        position: 'relative',
    },
    glow: {
        position: 'absolute',
        opacity: 0.5,
    },
    content: {
        position: 'relative',
        zIndex: 2,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1,
    },
});
