import { Fonts } from '@/constants/type';
import { useTheme } from '@/contexts/ThemeContext';
import { useFonts } from 'expo-font';
import React from 'react';
import { StyleSheet, Text, type TextStyle } from 'react-native';

interface LyfeLogoProps {
    size?: 'sm' | 'md' | 'lg';
    color?: string;
    /** Render the inked period after "lyfe" — default true for brand consistency */
    withPeriod?: boolean;
}

// Tropic wordmark sizing — Fraunces has normal metrics, no Android clipping workaround needed
const SIZES: Record<string, TextStyle> = {
    sm: { fontSize: 20, lineHeight: 24 },
    md: { fontSize: 32, lineHeight: 36 },
    lg: { fontSize: 48, lineHeight: 52 },
};

/**
 * Lyfe wordmark — Tropic Office style.
 *
 * Replaces the Pacifico cursive with a confident serif treatment:
 *   "ly" (regular roman) + "fe" (italic) + "." (terracotta period)
 *
 * The italic "fe" is the brand gesture — carry this pattern into section
 * headings where ONE italic accent word sits next to roman text.
 */
export default function LyfeLogo({ size = 'md', color, withPeriod = true }: LyfeLogoProps) {
    const { colors } = useTheme();
    const [fontsLoaded] = useFonts({
        Fraunces: require('@/assets/fonts/Fraunces-Regular.ttf'),
        'Fraunces-Italic': require('@/assets/fonts/Fraunces-Italic.ttf'),
    });

    if (!fontsLoaded) return null;

    const baseColor = color || colors.textPrimary;
    const accentColor = color || colors.accent;

    return (
        <Text style={[styles.logo, SIZES[size], { color: baseColor }]} allowFontScaling={false}>
            <Text style={{ fontFamily: Fonts.serif, fontWeight: '500' }}>ly</Text>
            <Text style={{ fontFamily: Fonts.serifItalic, fontWeight: '500', color: accentColor }}>fe</Text>
            {withPeriod && <Text style={{ color: accentColor, fontFamily: Fonts.serif }}>.</Text>}
        </Text>
    );
}

const styles = StyleSheet.create({
    logo: {
        letterSpacing: -0.5,
    },
});
