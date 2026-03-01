import CandidateCard from '@/components/CandidateCard';
import EmptyState from '@/components/EmptyState';
import ScreenHeader from '@/components/ScreenHeader';
import { useTheme } from '@/contexts/ThemeContext';
import { CANDIDATE_STATUSES, CANDIDATE_STATUS_CONFIG, MOCK_CANDIDATES, type CandidateStatus } from '@/types/recruitment';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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

const FILTER_TABS: { key: CandidateStatus | 'all'; label: string }[] = [
    { key: 'all', label: 'All' },
    ...CANDIDATE_STATUSES.map((status) => ({
        key: status,
        label: CANDIDATE_STATUS_CONFIG[status].label,
    })),
];

export default function CandidatesScreen() {
    const { colors } = useTheme();
    const router = useRouter();

    const [search, setSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState<CandidateStatus | 'all'>('all');
    const [refreshing, setRefreshing] = useState(false);

    const filteredCandidates = MOCK_CANDIDATES.filter((candidate) => {
        // Search
        if (search.trim()) {
            const q = search.toLowerCase();
            const matchesName = candidate.name.toLowerCase().includes(q);
            const matchesPhone = candidate.phone?.includes(q);
            if (!matchesName && !matchesPhone) return false;
        }
        // Filter
        if (activeFilter !== 'all' && candidate.status !== activeFilter) return false;
        return true;
    }).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    const counts: Record<string, number> = { all: MOCK_CANDIDATES.length };
    MOCK_CANDIDATES.forEach((c) => { counts[c.status] = (counts[c.status] || 0) + 1; });

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        setTimeout(() => setRefreshing(false), 800);
    }, []);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScreenHeader
                title="Candidates"
                subtitle={`${MOCK_CANDIDATES.length} total · ${counts.applied || 0} applied`}
                rightAction={
                    <TouchableOpacity
                        style={[styles.addButton, { backgroundColor: colors.accent }]}
                        onPress={() => { }}
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
