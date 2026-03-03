import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { type ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface BannerConfig {
    text: string;
    icon?: string;
}

interface ScreenHeaderProps {
    /** Title — compact semibold style (Instagram-style nav bar) */
    title: string;
    /** Optional custom element to render instead of the title text (e.g. a logo) */
    titleElement?: ReactNode;
    /** Optional subtitle below the title (for sub-screens only) */
    subtitle?: string;
    /** Custom right-side element (button, avatar, etc.) */
    rightAction?: ReactNode;
    /** Show iOS-style back chevron */
    showBack?: boolean;
    /** Label next to back chevron (e.g. "Leads") */
    backLabel?: string;
    /** Override default router.back() */
    onBack?: () => void;
    /** Optional contextual banner above the title */
    banner?: BannerConfig;
}

export default function ScreenHeader({
    title,
    titleElement,
    subtitle,
    rightAction,
    showBack,
    backLabel,
    onBack,
    banner,
}: ScreenHeaderProps) {
    const { colors } = useTheme();
    const router = useRouter();

    const handleBack = () => {
        if (onBack) {
            onBack();
        } else {
            router.back();
        }
    };

    return (
        <View
            style={[
                styles.container,
                {
                    backgroundColor: colors.background,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.border,
                },
            ]}
        >
            {/* Banner */}
            {banner && (
                <View style={[styles.banner, { backgroundColor: colors.accentLight }]}>
                    {banner.icon && (
                        <Ionicons name={banner.icon as any} size={14} color={colors.accent} />
                    )}
                    <Text style={[styles.bannerText, { color: colors.accent }]} numberOfLines={2}>
                        {banner.text}
                    </Text>
                </View>
            )}

            {/* Main row: back / title / right action */}
            <View style={styles.row}>
                {/* Left: back button or spacer */}
                {showBack ? (
                    <TouchableOpacity
                        onPress={handleBack}
                        style={styles.backBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityRole="button"
                        accessibilityLabel={backLabel ? `Back to ${backLabel}` : 'Go back'}
                    >
                        <Ionicons name="chevron-back" size={22} color={colors.accent} />
                        {backLabel && (
                            <Text style={[styles.backLabel, { color: colors.accent }]}>{backLabel}</Text>
                        )}
                    </TouchableOpacity>
                ) : (
                    <View style={styles.leftSpacer} />
                )}

                {/* Center: title (or left-aligned when no back) */}
                <View style={[styles.titleContainer, !showBack && styles.titleContainerLeft]}>
                    {titleElement || (
                        <Text
                            style={[
                                showBack ? styles.detailTitle : styles.title,
                                { color: colors.textPrimary },
                            ]}
                            numberOfLines={1}
                        >
                            {title}
                        </Text>
                    )}
                    {subtitle && (
                        <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                            {subtitle}
                        </Text>
                    )}
                </View>

                {/* Right: action or spacer */}
                {rightAction ? (
                    <View style={styles.rightAction}>{rightAction}</View>
                ) : (
                    <View style={styles.rightSpacer} />
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        zIndex: 10,
    },
    banner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginHorizontal: 16,
        marginTop: 8,
        borderRadius: 8,
    },
    bannerText: {
        fontSize: 12,
        fontWeight: '500',
        flex: 1,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 44,
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    backBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        marginLeft: -8,
        minWidth: 44,
    },
    backLabel: {
        fontSize: 16,
        fontWeight: '500',
    },
    leftSpacer: {
        width: 0,
    },
    titleContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    titleContainerLeft: {
        alignItems: 'flex-start',
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: -0.3,
    },
    detailTitle: {
        fontSize: 17,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    subtitle: {
        fontSize: 13,
        marginTop: 1,
    },
    rightAction: {
        flexShrink: 0,
        marginLeft: 12,
    },
    rightSpacer: {
        width: 0,
    },
});
