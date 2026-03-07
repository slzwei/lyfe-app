import CandidateCard from '@/components/CandidateCard';
import EmptyState from '@/components/EmptyState';
import LoadingState from '@/components/LoadingState';
import ScreenHeader from '@/components/ScreenHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useViewMode } from '@/contexts/ViewModeContext';
import { fetchCandidates } from '@/lib/recruitment';
import { CANDIDATE_STATUSES, CANDIDATE_STATUS_CONFIG, type CandidateStatus, type RecruitmentCandidate } from '@/types/recruitment';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    FlatList,
    RefreshControl,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { isMockMode } from '@/lib/mockMode';
import { MOCK_CANDIDATES } from '@/lib/mockData';

// Re-export for backward compatibility (pa/index.tsx imports from here)
export { MOCK_CANDIDATES } from '@/lib/mockData';

const FILTER_TABS: { key: CandidateStatus | 'all'; label: string }[] = [
    { key: 'all', label: 'All' },
    ...CANDIDATE_STATUSES.map((status) => ({
        key: status,
        label: CANDIDATE_STATUS_CONFIG[status].label,
    })),
];

export default function CandidatesScreen() {
    const MOCK_OTP = isMockMode();
    const { colors } = useTheme();
    const { user } = useAuth();
    const { viewMode, canToggle } = useViewMode();
    const router = useRouter();
    const isManagerView = canToggle && viewMode === 'manager';

    const [search, setSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState<CandidateStatus | 'all'>('all');
    const [refreshing, setRefreshing] = useState(false);
    const [candidates, setCandidates] = useState<RecruitmentCandidate[]>([]);
    const [isLoading, setIsLoading] = useState(!MOCK_OTP);
    const [error, setError] = useState<string | null>(null);

    const loadCandidates = useCallback(async () => {
        if (MOCK_OTP) {
            setCandidates(MOCK_CANDIDATES);
            return;
        }

        if (!user?.id) return;
        setError(null);
        const { data, error: fetchError } = await fetchCandidates(user.id, isManagerView);
        if (fetchError) {
            setError(fetchError);
        } else {
            setCandidates(data);
        }
        setIsLoading(false);
    }, [user?.id, isManagerView]);

    useFocusEffect(
        useCallback(() => {
            loadCandidates();
        }, [loadCandidates])
    );

    const filteredCandidates = candidates.filter((candidate) => {
        if (search.trim()) {
            const q = search.toLowerCase();
            const matchesName = candidate.name.toLowerCase().includes(q);
            const matchesPhone = candidate.phone?.includes(q);
            if (!matchesName && !matchesPhone) return false;
        }
        if (activeFilter !== 'all' && candidate.status !== activeFilter) return false;
        return true;
    }).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    const counts: Record<string, number> = { all: candidates.length };
    candidates.forEach((c) => { counts[c.status] = (counts[c.status] || 0) + 1; });

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadCandidates();
        setRefreshing(false);
    }, [loadCandidates]);

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <ScreenHeader title="Candidates" />
                <LoadingState />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScreenHeader
                title="Candidates"
                rightAction={
                    <TouchableOpacity
                        style={[styles.addButton, { backgroundColor: colors.accent }]}
                        onPress={() => router.push('/team/add-candidate' as any)}
                        accessibilityLabel="Add new candidate"
                    >
                        <Ionicons name="person-add" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                }
            />

            <FlatList
                data={filteredCandidates}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
                }
                ListHeaderComponent={
                    <View style={styles.headerContainer}>
                        {/* Search */}
                        <View style={[styles.searchBar, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                            <Ionicons name="search" size={18} color={colors.textTertiary} />
                            <TextInput
                                style={[styles.searchInput, { color: colors.textPrimary }]}
                                placeholder="Search candidates..."
                                placeholderTextColor={colors.textTertiary}
                                value={search}
                                onChangeText={setSearch}
                                returnKeyType="search"
                            />
                            {search.length > 0 && (
                                <TouchableOpacity
                                    onPress={() => setSearch('')}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Error Banner */}
                        {error && (
                            <TouchableOpacity
                                style={[styles.errorBanner, { backgroundColor: colors.dangerLight }]}
                                onPress={loadCandidates}
                            >
                                <Ionicons name="alert-circle" size={16} color={colors.danger} />
                                <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
                                <Text style={[styles.retryText, { color: colors.danger }]}>Tap to retry</Text>
                            </TouchableOpacity>
                        )}

                        {/* Filter Chips */}
                        <FlatList
                            data={FILTER_TABS}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            keyExtractor={(item) => item.key}
                            style={styles.filterList}
                            contentContainerStyle={styles.filterRow}
                            renderItem={({ item }) => {
                                const isActive = activeFilter === item.key;
                                const count = counts[item.key] || 0;
                                return (
                                    <TouchableOpacity
                                        style={[
                                            styles.filterChip,
                                            {
                                                backgroundColor: isActive ? colors.accent : colors.cardBackground,
                                                borderColor: isActive ? colors.accent : colors.border,
                                            },
                                        ]}
                                        onPress={() => setActiveFilter(item.key)}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Filter by ${item.label}`}
                                        accessibilityState={{ selected: isActive }}
                                    >
                                        <Text
                                            style={[
                                                styles.filterChipText,
                                                { color: isActive ? '#FFFFFF' : colors.textSecondary },
                                            ]}
                                        >
                                            {item.label}
                                        </Text>
                                        <Text
                                            style={[
                                                styles.filterChipCount,
                                                { color: isActive ? 'rgba(255,255,255,0.8)' : colors.textTertiary },
                                            ]}
                                        >
                                            {count}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    </View>
                }
                ListEmptyComponent={
                    <EmptyState
                        icon="people-outline"
                        title="No candidates found"
                        subtitle={search.trim() ? `No results for "${search}"` : 'No candidates match this filter'}
                    />
                }
                renderItem={({ item }) => (
                    <CandidateCard
                        candidate={item}
                        onPress={() => router.push(`/candidates/${item.id}` as any)}
                    />
                )}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    addButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerContainer: {
        paddingBottom: 4,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginBottom: 16,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        padding: 0,
    },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        borderRadius: 10,
        marginBottom: 12,
    },
    errorText: { flex: 1, fontSize: 13 },
    retryText: { fontSize: 12, fontWeight: '600' },
    filterList: {
        flexGrow: 0,
        marginBottom: 8,
    },
    filterRow: {
        gap: 8,
        paddingBottom: 8,
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
    },
    filterChipText: { fontSize: 13, fontWeight: '600' },
    filterChipCount: { fontSize: 12, fontWeight: '500' },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 40,
        paddingTop: 16,
    },
});
