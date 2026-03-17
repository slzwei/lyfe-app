import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface EmptyStateProps {
    icon?: keyof typeof Ionicons.glyphMap;
    title: string;
    subtitle?: string;
    actionLabel?: string;
    onAction?: () => void;
}

function EmptyState({ icon = 'file-tray-outline', title, subtitle, actionLabel, onAction }: EmptyStateProps) {
    const { colors } = useTheme();

    return (
        <View style={styles.container} accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}>
            <View style={[styles.iconWrap, { backgroundColor: colors.surfacePrimary }]}>
                <Ionicons name={icon} size={40} color={colors.textTertiary} />
            </View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
            {subtitle && <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>}
            {actionLabel && onAction && (
                <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.accent }]}
                    onPress={onAction}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                >
                    <Text style={[styles.actionText, { color: colors.textInverse }]}>{actionLabel}</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

export default React.memo(EmptyState);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        paddingHorizontal: 32,
        gap: 8,
    },
    iconWrap: {
        width: 72,
        height: 72,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    title: {
        fontSize: 17,
        fontWeight: '700',
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
    actionBtn: {
        marginTop: 12,
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 10,
    },
    actionText: {
        fontSize: 14,
        fontWeight: '600',
    },
});
