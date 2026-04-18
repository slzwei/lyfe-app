import { Fonts } from '@/constants/type';
import type { ThemeColors } from '@/types/theme';
import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type StatCardSmallProps = {
    label: string;
    value: string;
    colors: ThemeColors;
};

const StatCardSmall = memo(function StatCardSmall({ label, value, colors }: StatCardSmallProps) {
    return (
        <View
            style={[styles.statCardSmall, { backgroundColor: colors.cardBackground, shadowColor: colors.textPrimary }]}
        >
            <Text style={[styles.statValueSmall, { color: colors.textPrimary }]}>{value}</Text>
            <Text style={[styles.statLabelSmall, { color: colors.textTertiary }]}>{label}</Text>
        </View>
    );
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
    statValueSmall: { fontFamily: Fonts.serif, fontSize: 22, fontWeight: '500', marginBottom: 2 },
    statLabelSmall: { fontFamily: Fonts.sans, fontSize: 13, fontWeight: '500' },
});
