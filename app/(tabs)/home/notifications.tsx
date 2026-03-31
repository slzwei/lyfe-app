import ErrorBanner from '@/components/ErrorBanner';
import ScreenHeader from '@/components/ScreenHeader';
import { useNotifications } from '@/contexts/NotificationContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { timeAgo } from '@/lib/dateTime';
import { fetchNotifications } from '@/lib/notifications';
import { NOTIFICATION_TYPE_CONFIG, type AppNotification, type NotificationType } from '@/types/notification';
import { useTypedRouter } from '@/hooks/useTypedRouter';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NotificationsScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const router = useTypedRouter();
    const { unreadCount, markAsRead, markAllAsRead } = useNotifications();

    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    const loadNotifications = useCallback(
        async (pageNum = 0, append = false) => {
            if (!user?.id) return;
            const { data, error: err, hasMore: more } = await fetchNotifications(user.id, pageNum);
            if (err) {
                setError(err);
            } else {
                setNotifications((prev) => (append ? [...prev, ...data] : data));
                setHasMore(more);
                setError(null);
            }
        },
        [user?.id],
    );

    useEffect(() => {
        setLoading(true);
        loadNotifications(0).finally(() => setLoading(false));
    }, [loadNotifications]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        setPage(0);
        await loadNotifications(0);
        setRefreshing(false);
    }, [loadNotifications]);

    const onEndReached = useCallback(async () => {
        if (!hasMore || loadingMore) return;
        setLoadingMore(true);
        const nextPage = page + 1;
        setPage(nextPage);
        await loadNotifications(nextPage, true);
        setLoadingMore(false);
    }, [hasMore, loadingMore, page, loadNotifications]);

    /** Known route patterns that notifications can navigate to */
    const ALLOWED_ROUTE_PATTERNS = [
        /^\/\(tabs\)\/home\//,
        /^\/\(tabs\)\/leads\/[^/]+$/,
        /^\/\(tabs\)\/events\/[^/]+$/,
        /^\/\(tabs\)\/pa\/candidate\/[^/]+$/,
        /^\/\(tabs\)\/team\/candidate\/[^/]+$/,
    ];

    /** Remap cross-tab routes to home tab equivalents so back navigation returns here */
    const remapRouteToHomeTab = (route: string): string | null => {
        if (!ALLOWED_ROUTE_PATTERNS.some((p) => p.test(route))) return null;
        if (route.startsWith('/(tabs)/home/')) return route;

        const leadMatch = route.match(/^\/\(tabs\)\/leads\/(.+)$/);
        if (leadMatch) return `/(tabs)/home/lead/${leadMatch[1]}`;

        const eventMatch = route.match(/^\/\(tabs\)\/events\/(.+)$/);
        if (eventMatch) return `/(tabs)/home/event/${eventMatch[1]}`;

        const paCandidateMatch = route.match(/^\/\(tabs\)\/pa\/candidate\/(.+)$/);
        if (paCandidateMatch) return `/(tabs)/home/candidate/${paCandidateMatch[1]}`;

        const teamCandidateMatch = route.match(/^\/\(tabs\)\/team\/candidate\/(.+)$/);
        if (teamCandidateMatch) return `/(tabs)/home/candidate/${teamCandidateMatch[1]}`;

        return route;
    };

    const handleTap = useCallback(
        async (notification: AppNotification) => {
            if (!notification.is_read) {
                await markAsRead(notification.id);
                setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n)));
            }
            const data = notification.data as Record<string, string> | null;
            if (typeof data?.route === 'string') {
                const resolved = remapRouteToHomeTab(data.route);
                if (resolved) router.push(resolved);
            }
        },
        [markAsRead, router],
    );

    const handleMarkAllRead = useCallback(async () => {
        await markAllAsRead();
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    }, [markAllAsRead]);

    const renderItem = useCallback(
        ({ item }: { item: AppNotification }) => {
            const typeConfig = NOTIFICATION_TYPE_CONFIG[item.type as NotificationType] || {
                icon: 'notifications-outline',
                label: 'Notification',
            };
            const data = item.data as Record<string, string> | null;
            return (
                <TouchableOpacity
                    style={[
                        styles.row,
                        {
                            backgroundColor: item.is_read ? colors.cardBackground : colors.accentLight,
                        },
                    ]}
                    onPress={() => handleTap(item)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`${typeConfig.label}: ${item.title}. ${item.body || ''} ${timeAgo(item.created_at ?? '')}${!item.is_read ? '. Unread' : ''}`}
                    accessibilityHint={data?.route ? 'Double tap to open' : undefined}
                >
                    <View
                        style={[styles.iconCircle, { backgroundColor: item.is_read ? colors.border : colors.accent }]}
                    >
                        <Ionicons
                            name={typeConfig.icon}
                            size={18}
                            color={item.is_read ? colors.accent : colors.textInverse}
                        />
                    </View>
                    <View style={styles.rowContent}>
                        <Text
                            style={[
                                styles.rowTitle,
                                { color: colors.textPrimary, fontWeight: item.is_read ? '400' : '600' },
                            ]}
                            numberOfLines={1}
                        >
                            {item.title}
                        </Text>
                        {item.body ? (
                            <Text style={[styles.rowBody, { color: colors.textSecondary }]} numberOfLines={2}>
                                {item.body}
                            </Text>
                        ) : null}
                        <Text style={[styles.rowTime, { color: colors.textTertiary }]}>
                            {timeAgo(item.created_at ?? '')}
                        </Text>
                    </View>
                    {!item.is_read && (
                        <View
                            style={[styles.unreadDot, { backgroundColor: colors.accent }]}
                            accessibilityElementsHidden
                        />
                    )}
                </TouchableOpacity>
            );
        },
        [colors, handleTap],
    );

    const keyExtractor = useCallback((item: AppNotification) => item.id, []);

    const renderSeparator = useCallback(
        () => <View style={[styles.separator, { backgroundColor: colors.border }]} />,
        [colors.border],
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <ScreenHeader
                title="Notifications"
                showBack
                backLabel="Home"
                rightAction={
                    unreadCount > 0 ? (
                        <TouchableOpacity
                            onPress={handleMarkAllRead}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            accessibilityRole="button"
                            accessibilityLabel="Mark all notifications as read"
                        >
                            <Text style={[styles.markAllBtn, { color: colors.accent }]}>Mark All Read</Text>
                        </TouchableOpacity>
                    ) : undefined
                }
            />

            {error && <ErrorBanner message={error} onRetry={onRefresh} onDismiss={() => setError(null)} />}

            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.accent} />
                </View>
            ) : (
                <FlatList
                    data={notifications}
                    renderItem={renderItem}
                    keyExtractor={keyExtractor}
                    ItemSeparatorComponent={renderSeparator}
                    contentContainerStyle={notifications.length === 0 ? styles.emptyContainer : styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
                    }
                    onEndReached={onEndReached}
                    onEndReachedThreshold={0.3}
                    removeClippedSubviews={true}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                    initialNumToRender={10}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons name="notifications-off-outline" size={48} color={colors.textTertiary} />
                            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Notifications</Text>
                            <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
                                You're all caught up! Notifications will appear here when there's something new.
                            </Text>
                        </View>
                    }
                    ListFooterComponent={
                        loadingMore ? (
                            <View style={styles.footer}>
                                <ActivityIndicator size="small" color={colors.accent} />
                            </View>
                        ) : null
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    listContent: { paddingBottom: 40 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyContainer: { flex: 1 },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
        gap: 12,
    },
    emptyTitle: { fontSize: 17, fontWeight: '600' },
    emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
    markAllBtn: { fontSize: 14, fontWeight: '600' },
    separator: {
        height: StyleSheet.hairlineWidth,
        marginLeft: 68,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowContent: { flex: 1 },
    rowTitle: { fontSize: 15 },
    rowBody: { fontSize: 13, marginTop: 2, lineHeight: 18 },
    rowTime: { fontSize: 12, marginTop: 4 },
    unreadDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    footer: { paddingVertical: 16, alignItems: 'center' },
});
