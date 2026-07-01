import ErrorBanner from '@/components/ErrorBanner';
import ScreenHeader from '@/components/ScreenHeader';
import { ScheduleItemRow } from '@/components/home/UpcomingScheduleCard';
import { Fonts } from '@/constants/type';
import { useTheme } from '@/contexts/ThemeContext';
import { useCandidateSchedule } from '@/hooks/useCandidateSchedule';
import type { CandidateScheduleItem } from '@/lib/recruitment/schedule';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Candidate "What's next" — the full personal agenda of upcoming recruitment
 * dates (interviews, exam sittings, prep courses, milestones). Data comes from
 * the self-scoped get_my_candidate_schedule RPC via useCandidateSchedule.
 */
export default function ScheduleScreen() {
    const { colors } = useTheme();
    const { items, isLoading, error, refresh } = useCandidateSchedule();
    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await refresh();
        setRefreshing(false);
    }, [refresh]);

    const renderItem = useCallback(
        ({ item }: { item: CandidateScheduleItem }) => (
            <View style={styles.rowWrap}>
                <ScheduleItemRow item={item} colors={colors} />
            </View>
        ),
        [colors],
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <ScreenHeader title="What's next" showBack backLabel="Home" />

            {error && <ErrorBanner message={error} onRetry={onRefresh} />}

            {isLoading && !refreshing ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.accent} />
                </View>
            ) : (
                <FlatList
                    data={items}
                    renderItem={renderItem}
                    keyExtractor={(item) => `${item.kind}:${item.id}`}
                    contentContainerStyle={items.length === 0 ? styles.emptyContainer : styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
                    }
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="calendar-outline" size={40} color={colors.textTertiary} />
                            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Nothing scheduled</Text>
                            <Text style={[styles.emptyBody, { color: colors.textTertiary }]}>
                                When your manager schedules an interview, exam sitting, or prep course, it&apos;ll show
                                up here so you always know what&apos;s coming.
                            </Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    listContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 100 },
    rowWrap: { marginBottom: 4 },
    emptyContainer: { flexGrow: 1, justifyContent: 'center' },
    empty: { alignItems: 'center', paddingHorizontal: 40, gap: 10 },
    emptyTitle: { fontFamily: Fonts.sansSemibold, fontSize: 17, fontWeight: '600', marginTop: 4 },
    emptyBody: { fontFamily: Fonts.sans, fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
