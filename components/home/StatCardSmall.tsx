import { Fonts } from '@/constants/type';
import type { ThemeColors } from '@/types/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type StatCardSmallProps = {
    label: string;
    value: string;
    colors: ThemeColors;
    onPress?: () => void;
    accessibilityLabel?: string;
    testID?: string;
    /** Optional editorial meta line under the label (e.g. "+5 new this week"). */
    meta?: { text: string; tone: 'success' | 'muted' };
    /** Show a chevron-forward affordance top-right (for tappable tiles that drill in). */
    showChevron?: boolean;
};

const StatCardSmall = memo(function StatCardSmall({
    label,
    value,
    colors,
    onPress,
    accessibilityLabel,
    testID,
    meta,
    showChevron,
}: StatCardSmallProps) {
    const cardStyle = [
        styles.statCardSmall,
        { backgroundColor: colors.cardBackground, shadowColor: colors.textPrimary },
    ];
    const content = (
        <>
            {showChevron && (
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} style={styles.chevron} />
            )}
            <Text style={[styles.statValueSmall, { color: colors.textPrimary }]}>{value}</Text>
            <Text style={[styles.statLabelSmall, { color: colors.textTertiary }]}>{label}</Text>
            {meta && (
                <Text
                    style={[
                        styles.statMetaSmall,
                        { color: meta.tone === 'success' ? colors.success : colors.textTertiary },
                    ]}
                    numberOfLines={1}
                >
                    {meta.text}
                </Text>
            )}
        </>
    );

    const a11yLabel = accessibilityLabel ?? `${label}, ${value}${meta ? `, ${meta.text}` : ''}`;

    if (onPress) {
        return (
            <TouchableOpacity
                style={cardStyle}
                onPress={onPress}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={a11yLabel}
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
    chevron: {
        position: 'absolute',
        top: 12,
        right: 12,
    },
    statValueSmall: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 22,
        fontWeight: '600',
        marginBottom: 2,
        letterSpacing: -0.4,
    },
    statLabelSmall: { fontFamily: Fonts.sans, fontSize: 13, fontWeight: '500', lineHeight: 16 },
    statMetaSmall: { fontFamily: Fonts.sansSemibold, fontSize: 11, fontWeight: '600', marginTop: 3, lineHeight: 14 },
});
