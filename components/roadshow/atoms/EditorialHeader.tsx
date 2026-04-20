import { RoadshowType, TropicFonts } from '@/constants/roadshow/typography';
import { useTheme } from '@/contexts/ThemeContext';
import React from 'react';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';

export interface EditorialHeaderProps {
    eyebrow: string;
    place: string;
    sub?: string;
    subTone?: 'accent' | 'muted';
    size?: 'xl' | 'lg' | 'md';
    right?: React.ReactNode;
    paddingHorizontal?: number;
}

/**
 * Magazine-style header: eyebrow + "Place name,\n<italic>sub</italic>." with Fraunces serif.
 * The italic sub-location is the brand signature — use terra for upcoming/live, muted for past.
 */
export function EditorialHeader({
    eyebrow,
    place,
    sub,
    subTone = 'accent',
    size = 'lg',
    right,
    paddingHorizontal = 20,
}: EditorialHeaderProps) {
    const { colors } = useTheme();
    const title = size === 'xl' ? RoadshowType.titleXL : size === 'md' ? RoadshowType.titleMd : RoadshowType.titleLg;

    const italicColor = subTone === 'muted' ? colors.textTertiary : colors.accent;

    const italicStyle: TextStyle = {
        ...RoadshowType.serifAccent,
        color: italicColor,
        fontFamily: TropicFonts.serifItalic,
    };

    return (
        <View style={[styles.wrap, { paddingHorizontal }]}>
            <View style={styles.topRow}>
                <Text style={[RoadshowType.eyebrow, { color: colors.textTertiary }]}>{eyebrow}</Text>
                {right ? <View>{right}</View> : null}
            </View>
            <Text style={[title, { color: colors.textPrimary }]}>
                {place}
                {sub ? ',' : ''}
                {sub ? '\n' : ''}
                {sub ? <Text style={italicStyle}>{sub}</Text> : null}
                {sub ? <Text>.</Text> : null}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { gap: 4 },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
