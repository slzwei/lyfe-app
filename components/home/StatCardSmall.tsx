import { Fonts } from '@/constants/type';
import type { ThemeColors } from '@/types/theme';
import React, { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type StatCardSmallProps = {
    label: string;
    value: string;
    colors: ThemeColors;
    onPress?: () => void;
    accessibilityLabel?: string;
    testID?: string;
};

const StatCardSmall = memo(function StatCardSmall({
    label,
    value,
    colors,
    onPress,
    accessibilityLabel,
    testID,
}: StatCardSmallProps) {
    const cardStyle = [
        styles.statCardSmall,
        { backgroundColor: colors.cardBackground, shadowColor: colors.textPrimary },
    ];
    const content = (
        <>
            <Text style={[styles.statValueSmall, { color: colors.textPrimary }]}>{value}</Text>
            <Text style={[styles.statLabelSmall, { color: colors.textTertiary }]}>{label}</Text>
        </>
    );

    if (onPress) {
        return (
            <TouchableOpacity
                style={cardStyle}
                onPress={onPress}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={accessibilityLabel ?? `${label}, ${value}`}
                testID={testID}
            >
                {content}
            </TouchableOpacity>
        );
    }

    return <View style={cardStyle}>{content}</View>;
});

export default StatCardSmall;

const styles = StyleSheet.create({
    statCardSmall: {
        flex: 1,
        borderRadius: 16,
        padding: 16,
        justifyContent: 'center',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
        elevation: 1,
    },
    statValueSmall: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 22,
        fontWeight: '600',
        marginBottom: 2,
        letterSpacing: -0.4,
    },
    statLabelSmall: { fontFamily: Fonts.sans, fontSize: 13, fontWeight: '500', lineHeight: 16 },
});
