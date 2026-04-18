import { Fonts } from '@/constants/type';
import { letterSpacing } from '@/constants/platform';
import { useTheme } from '@/contexts/ThemeContext';
import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

interface SectionHeadingProps {
    /** The roman (non-italic) prefix — e.g. "Nudges" */
    roman?: string;
    /** The italic accent word — e.g. "not nags." */
    italic?: string;
    /** Trailing roman text after the italic */
    trailing?: string;
    /**
     * Alternative: pass a single `children` string and the component will
     * try to render it straight (no italic highlight).
     */
    children?: React.ReactNode;
    /** Optional eyebrow label above the heading — "THIS WEEK" etc. */
    eyebrow?: string;
    /** Override the italic color. Defaults to accent (terracotta). */
    accentColor?: string;
    style?: ViewStyle;
}

/**
 * The Tropic Office signature heading pattern:
 *
 *    THIS WEEK              ← eyebrow (eyebrow caps, tracked)
 *    Nudges, not nags.      ← serif with italic on "Nudges"
 *
 * Usage:
 *   <SectionHeading roman="Nudges," italic="not nags." />
 *   <SectionHeading eyebrow="THIS WEEK" roman="" italic="Focus" trailing=" first." />
 *
 * Keep to ONE of these per screen — it's a punctuation device, not furniture.
 */
export default function SectionHeading({
    roman,
    italic,
    trailing,
    children,
    eyebrow,
    accentColor,
    style,
}: SectionHeadingProps) {
    const { colors } = useTheme();
    const italicColor = accentColor ?? colors.accent;

    return (
        <View style={[styles.wrap, style]}>
            {eyebrow && <Text style={[styles.eyebrow, { color: colors.textTertiary }]}>{eyebrow}</Text>}
            <Text style={[styles.heading, { color: colors.textPrimary }]}>
                {children ? (
                    children
                ) : (
                    <>
                        {roman ? <Text>{roman} </Text> : null}
                        {italic && <Text style={{ fontFamily: Fonts.serifItalic, color: italicColor }}>{italic}</Text>}
                        {trailing ? <Text>{trailing}</Text> : null}
                    </>
                )}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        gap: 4,
    },
    eyebrow: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: letterSpacing(1),
        textTransform: 'uppercase',
    },
    heading: {
        fontFamily: Fonts.serif,
        fontSize: 20,
        fontWeight: '500',
        lineHeight: 24,
        letterSpacing: letterSpacing(-0.3),
    },
});
