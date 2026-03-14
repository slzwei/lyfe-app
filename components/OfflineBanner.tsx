import { useTheme } from '@/contexts/ThemeContext';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, { SlideInUp, SlideOutUp } from 'react-native-reanimated';

type BannerState = 'hidden' | 'offline' | 'syncing' | 'synced';

export default function OfflineBanner() {
    const { colors } = useTheme();
    const { isConnected, syncStatus } = useNetworkStatus();
    const [bannerState, setBannerState] = useState<BannerState>('hidden');
    const syncedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevPendingRef = useRef(syncStatus.pending);

    useEffect(() => {
        if (!isConnected) {
            if (syncedTimerRef.current) {
                clearTimeout(syncedTimerRef.current);
                syncedTimerRef.current = null;
            }
            setBannerState('offline');
        } else if (syncStatus.pending > 0) {
            setBannerState('syncing');
        } else if (prevPendingRef.current > 0 && syncStatus.pending === 0) {
            // Just finished syncing — show success briefly
            setBannerState('synced');
            syncedTimerRef.current = setTimeout(() => {
                setBannerState('hidden');
                syncedTimerRef.current = null;
            }, 2000);
        } else {
            setBannerState('hidden');
        }
        prevPendingRef.current = syncStatus.pending;
    }, [isConnected, syncStatus.pending]);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (syncedTimerRef.current) clearTimeout(syncedTimerRef.current);
        };
    }, []);

    if (bannerState === 'hidden') return null;

    const config = getBannerConfig(bannerState, syncStatus.pending, colors);

    return (
        <Animated.View
            entering={SlideInUp.duration(300)}
            exiting={SlideOutUp.duration(300)}
            style={[styles.banner, { backgroundColor: config.bgColor }]}
        >
            <View style={styles.content}>
                {config.showSpinner ? (
                    <ActivityIndicator size="small" color={config.textColor} />
                ) : (
                    <Ionicons name={config.icon} size={16} color={config.textColor} />
                )}
                <Text style={[styles.text, { color: config.textColor }]}>{config.message}</Text>
            </View>
        </Animated.View>
    );
}

function getBannerConfig(
    state: BannerState,
    pending: number,
    colors: ReturnType<typeof useTheme>['colors'],
): {
    bgColor: string;
    textColor: string;
    icon: keyof typeof Ionicons.glyphMap;
    message: string;
    showSpinner: boolean;
} {
    switch (state) {
        case 'offline':
            return {
                bgColor: colors.warningLight,
                textColor: colors.warning,
                icon: 'cloud-offline-outline',
                message: "You're offline. Changes will sync when you're back online.",
                showSpinner: false,
            };
        case 'syncing':
            return {
                bgColor: colors.infoLight,
                textColor: colors.info,
                icon: 'sync-outline',
                message: `Syncing ${pending} change${pending !== 1 ? 's' : ''}...`,
                showSpinner: true,
            };
        case 'synced':
            return {
                bgColor: colors.successLight,
                textColor: colors.success,
                icon: 'checkmark-circle-outline',
                message: 'All changes synced',
                showSpinner: false,
            };
        default:
            return {
                bgColor: colors.warningLight,
                textColor: colors.warning,
                icon: 'cloud-offline-outline',
                message: '',
                showSpinner: false,
            };
    }
}

const styles = StyleSheet.create({
    banner: {
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    text: {
        flex: 1,
        fontSize: 13,
        fontWeight: '500',
    },
});
