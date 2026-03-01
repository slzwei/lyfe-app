import CandidateCard from '@/components/CandidateCard';
import EmptyState from '@/components/EmptyState';
import { useTheme } from '@/contexts/ThemeContext';
import {
    CANDIDATE_STATUSES,
    CANDIDATE_STATUS_CONFIG,
    MOCK_CANDIDATES,
    type CandidateStatus,
} from '@/types/recruitment';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
    FlatList,
    RefreshControl,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

type TabView = 'candidates' | 'team';

export default function TeamScreen() {
    const { colors } = useTheme();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<TabView>('candidates');
    const [activeFilter, setActiveFilter] = useState<CandidateStatus | 'all'>('all');
    const [refreshing, setRefreshing] = useState(false);

    const filteredCandidates = useMemo(() => {
        if (activeFilter === 'all') return MOCK_CANDIDATES;
        return MOCK_CANDIDATES.filter((c) => c.status === activeFilter);
    }, [activeFilter]);

    const counts: Record<string, number> = useMemo(() => {
        const result: Record<string, number> = { all: MOCK_CANDIDATES.length };
        MOCK_CANDIDATES.forEach((c) => {
            result[c.status] = (result[c.status] || 0) + 1;
        });
        return result;
    }, []);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        setTimeout(() => setRefreshing(false), 800);
    }, []);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerRow}>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>Team</Text>
                    {activeTab === 'candidates' && (
                        <TouchableOpacity
                            style={[styles.addBtn, { backgroundColor: colors.accent }]}
                            onPress={() => router.push('/(tabs)/team/add-candidate' as any)}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="add" size={18} color="#FFFFFF" />
                            <Text style={styles.addBtnText}>Add</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Segment Control */}
                <View style={[styles.segmentControl, { backgroundColor: colors.surfacePrimary }]}>
                    <TouchableOpacity
                        style={[
                            styles.segmentBtn,
                            activeTab === 'candidates' && { backgroundColor: colors.cardBackground },
                        ]}
                        onPress={() => setActiveTab('candidates')}
                    >
                        <Text
                            style={[
                                styles.segmentText,
                                { color: activeTab === 'candidates' ? colors.accent : colors.textSecondary },
                            ]}
                        >
                            Candidates
                        </Text>
                        <View style={[styles.segmentBadge, { backgroundColor: colors.accent + '18' }]}>
                            <Text style={[styles.segmentBadgeText, { color: colors.accent }]}>
                                {MOCK_CANDIDATES.length}
                            </Text>
                        </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.segmentBtn,
                            activeTab === 'team' && { backgroundColor: colors.cardBackground },
                        ]}
                        onPress={() => setActiveTab('team')}
                    >
                        <Text
                            style={[
                                styles.segmentText,
                                { color: activeTab === 'team' ? colors.accent : colors.textSecondary },
                            ]}
                        >
                            My Team
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {activeTab === 'candidates' ? (
                <>
                    {/* Status Filter Chips */}
                    <FlatList
                        horizontal
                        data={[
                            { key: 'all' as const, label: 'All' },
                            ...CANDIDATE_STATUSES.map((s) => ({
                                key: s,
                                label: CANDIDATE_STATUS_CONFIG[s].label,
                            })),
                        ]}
                        showsHorizontalScrollIndicator={false}
                        keyExtractor={(item) => item.key}
                        contentContainerStyle={styles.filterRow}
                        renderItem={({ item }) => {
                            const isActive = activeFilter === item.key;
                            const count = counts[item.key] || 0;
                            const chipColor =
                                item.key === 'all'
                                    ? colors.accent
                                    : CANDIDATE_STATUS_CONFIG[item.key as CandidateStatus].color;
                            return (
                                <TouchableOpacity
                                    style={[
                                        styles.filterChip,
                                        {
                                            backgroundColor: isActive ? chipColor : colors.surfacePrimary,
                                            borderColor: isActive ? chipColor : colors.borderLight,
                                        },
                                    ]}
                                    onPress={() => setActiveFilter(item.key as CandidateStatus | 'all')}
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
                                            styles.filterCount,
                                            { color: isActive ? '#FFFFFF' : colors.textTertiary },
                                        ]}
                                    >
                                        {count}
                                    </Text>
                                </TouchableOpacity>
                            );
                        }}
                    />

                    {/* Candidate List */}
                    <FlatList
                        data={filteredCandidates}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={onRefresh}
                                tintColor={colors.accent}
                            />
                        }
                        ListEmptyComponent={
                            <EmptyState
                                icon="people-outline"
                                title="No candidates"
                                subtitle="Add a candidate to start building your team"
                                actionLabel="Add Candidate"
                                onAction={() => router.push('/(tabs)/team/add-candidate' as any)}
                            />
                        }
                        renderItem={({ item }) => (
                            <CandidateCard
                                candidate={item}
                                onPress={() => router.push(`/(tabs)/team/candidate/${item.id}` as any)}
                            />
                        )}
                    />
                </>
            ) : (
                /* My Team placeholder */
                <EmptyState
                    icon="people-outline"
                    title="Team Overview"
                    subtitle="Agent performance cards and team analytics coming soon"
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 8,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
    addBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 10,
    },
    addBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
    segmentControl: {
        flexDirection: 'row',
        borderRadius: 10,
        padding: 3,
    },
    segmentBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        borderRadius: 8,
        gap: 6,
    },
    segmentText: { fontSize: 14, fontWeight: '600' },
    segmentBadge: {
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 6,
    },
    segmentBadgeText: { fontSize: 11, fontWeight: '700' },
    filterRow: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 6,
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 0.5,
    },
    filterChipText: { fontSize: 12, fontWeight: '600' },
    filterCount: { fontSize: 11, fontWeight: '500' },
    listContent: { padding: 4, paddingTop: 4 },
});
