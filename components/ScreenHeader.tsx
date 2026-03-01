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
    /** Primary title — iOS Large Title style (34px, 800 weight) */
    title: string;
    /** Optional subtitle below the title */
    subtitle?: string;
    /** Greeting line above the title (e.g. "Good afternoon") */
    greeting?: string;
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
    /** If true, render without the bar surface (transparent background, no border) */
    transparent?: boolean;
}

export default function ScreenHeader({
    title,
    subtitle,
    greeting,
    rightAction,
    showBack,
    backLabel,
    onBack,
    banner,
    transparent,
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
                !transparent && {
                    backgroundColor: colors.surfacePrimary,
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

            {/* Back Navigation */}
            {showBack && (
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
            )}

            {/* Title Row */}
            <View style={styles.titleRow}>
                <View style={styles.titleCol}>
                    {greeting && (
                        <Text style={[styles.greeting, { color: colors.textTertiary }]}>
                            {greeting}
                        </Text>
                    )}
                    <Text
                        style={[
                            showBack ? styles.detailTitle : styles.title,
                            { color: colors.textPrimary },
                        ]}
                        numberOfLines={1}
                    >
                        {title}
                    </Text>
                    {subtitle && (
                        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                            {subtitle}
                        </Text>
                    )}
                </View>
                {rightAction && <View style={styles.rightAction}>{rightAction}</View>}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 14,
    },
    banner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        marginBottom: 8,
    },
    bannerText: {
        fontSize: 12,
        fontWeight: '500',
        flex: 1,
    },
    backBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        height: 32,
        marginLeft: -8,
        marginBottom: 4,
    },
    backLabel: {
        fontSize: 16,
        fontWeight: '500',
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    titleCol: {
        flex: 1,
        marginRight: 12,
    },
    greeting: {
        fontSize: 15,
        fontWeight: '400',
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    detailTitle: {
        fontSize: 20,
        fontWeight: '800',
        letterSpacing: -0.3,
    },
    subtitle: {
        fontSize: 14,
        marginTop: 2,
    },
    rightAction: {
        flexShrink: 0,
    },
});
