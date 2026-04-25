import CandidateCard from '@/components/CandidateCard';
import EmptyState from '@/components/EmptyState';
import ErrorBanner from '@/components/ErrorBanner';
import LoadingState from '@/components/LoadingState';
import ScreenHeader from '@/components/ScreenHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useCandidateRealtime } from '@/hooks/useCandidateRealtime';
import { useCandidatePipeline } from '@/hooks/useCandidatePipeline';
import { pipelineAnalytics } from '@/lib/analytics';
import { fetchCandidates } from '@/lib/recruitment';
import { compareByUrgency, type NextStep } from '@/lib/recruitment/pipeline';
import {
    CANDIDATE_STATUSES,
    CANDIDATE_STATUS_CONFIG,
    type CandidateStatus,
    type RecruitmentCandidate,
} from '@/types/recruitment';
import { Ionicons } from '@expo/vector-icons';
import { useFilteredList } from '@/hooks/useFilteredList';
import { useTypedRouter } from '@/hooks/useTypedRouter';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type SortMode = 'alpha' | 'urgency';

export interface CandidateListProps {
    /** Builds the path for the candidate detail screen given a candidate id. */
    candidateRoute: (id: string) => string;
    /** When true, fetches candidates in manager-view scope. Defaults to false. */
    isManagerView?: boolean;
    /** When true, removes top padding so the search bar sits flush with the parent's sticky header. */
    embedded?: boolean;
}

export interface CandidateListScreenProps extends CandidateListProps {
    /** Path to navigate to when the "add candidate" button is pressed. */
    addRoute: string;
}

const CANDIDATE_SEARCH_FIELDS: (keyof RecruitmentCandidate)[] = ['name', 'phone'];

const FILTER_TABS: { key: CandidateStatus | 'all'; label: string }[] = [
    { key: 'all', label: 'All' },
    ...CANDIDATE_STATUSES.map((status) => ({
        key: status,
        label: CANDIDATE_STATUS_CONFIG[status].label,
    })),
];

/**
 * Embeddable candidate list body — search, filter chips, list, loading/error.
 * No SafeAreaView or ScreenHeader, so it can be dropped inside another screen
 * (e.g. the Team tab's Candidates segment).
 */
export function CandidateList({ candidateRoute, isManagerView = false, embedded = false }: CandidateListProps) {
    const { colors } = useTheme();
    const { user } = useAuth();
    const router = useTypedRouter();

    const [search, setSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState<CandidateStatus | 'all'>('all');
    const [refreshing, setRefreshing] = useState(false);
    const [sortMode, setSortMode] = useState<SortMode>('alpha');

    // A–Z path — cheap, candidates only
    const [candidatesAlpha, setCandidatesAlpha] = useState<RecruitmentCandidate[]>([]);
    const [isLoadingAlpha, setIsLoadingAlpha] = useState(true);
    const [errorAlpha, setErrorAlpha] = useState<string | null>(null);

    const loadAlpha = useCallback(async () => {
        if (!user?.id) return;
        setErrorAlpha(null);
        const { data, error: fetchError } = await fetchCandidates(user.id, isManagerView);
        if (fetchError) setErrorAlpha(fetchError);
        else setCandidatesAlpha(data);
        setIsLoadingAlpha(false);
    }, [user?.id, isManagerView]);

    useFocusEffect(
        useCallback(() => {
            if (sortMode === 'alpha') loadAlpha();
        }, [loadAlpha, sortMode]),
    );

    // Realtime for A–Z mode
    useCandidateRealtime(
        useCallback(() => {
            if (sortMode === 'alpha') loadAlpha();
        }, [loadAlpha, sortMode]),
    );

    // Pipeline path — bulk fetch with computed next-steps. Only active when urgency selected.
    const pipeline = useCandidatePipeline({
        isManagerView,
        enabled: sortMode === 'urgency',
    });

    // Reconcile the two paths into one rendering dataset.
    const candidates: RecruitmentCandidate[] =
        sortMode === 'urgency' ? pipeline.rows.map((r) => r.candidate) : candidatesAlpha;
    const nextStepByCandidateId: Record<string, NextStep> = (() => {
        if (sortMode !== 'urgency') return {};
        const out: Record<string, NextStep> = {};
        for (const r of pipeline.rows) out[r.candidate.id] = r.nextStep;
        return out;
    })();
    const isLoading = sortMode === 'urgency' ? pipeline.isLoading : isLoadingAlpha;
    const error = sortMode === 'urgency' ? pipeline.error : errorAlpha;

    const { filtered: filteredRaw, counts } = useFilteredList(
        candidates,
        search,
        activeFilter,
        'status',
        CANDIDATE_SEARCH_FIELDS,
    );
    // Phase F: on the "All" tab, hide rejected candidates by default. Users
    // can still see them via the dedicated "Rejected" filter chip, which is
    // unaffected by this pre-filter.
    const filteredCandidates = (() => {
        let list = activeFilter === 'all' ? filteredRaw.filter((c) => c.status !== 'rejected') : filteredRaw;

        if (sortMode === 'urgency') {
            // Hide candidates whose pipeline engine returns 'hidden' (rejected/on-hold).
            // Then sort by urgency (at-risk → this-week → ready → on-track).
            list = list.filter((c) => nextStepByCandidateId[c.id]?.urgency !== 'hidden');
            list = [...list].sort((a, b) => {
                const na = nextStepByCandidateId[a.id];
                const nb = nextStepByCandidateId[b.id];
                if (!na || !nb) return 0;
                return compareByUrgency(na, nb);
            });
        }
        return list;
    })();
    // Reflect the hidden-rejected behavior in the "All" chip count.
    const displayedCounts: Record<string, number> = {
        ...counts,
        all: (counts.all ?? 0) - (counts.rejected ?? 0),
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        if (sortMode === 'urgency') await pipeline.refresh();
        else await loadAlpha();
        setRefreshing(false);
    }, [sortMode, pipeline, loadAlpha]);

    if (isLoading) {
        return <LoadingState />;
    }

    return (
        <View style={{ flex: 1 }}>
            {/* Pinned Search + Filters */}
            <View style={[styles.stickyHeader, embedded && { paddingTop: 0 }]}>
                {/* Sort-mode segment — A–Z (default) / Pipeline (urgency-sorted) */}
                <View style={[styles.sortSegments, { backgroundColor: colors.surfaceSecondary }]}>
                    <TouchableOpacity
                        style={[
                            styles.sortSeg,
                            sortMode === 'alpha' && {
                                backgroundColor: colors.cardBackground,
                            },
                        ]}
                        onPress={() => {
                            if (sortMode !== 'alpha') {
                                setSortMode('alpha');
                                pipelineAnalytics.sortModeChanged('alpha');
                            }
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Sort A–Z"
                        accessibilityState={{ selected: sortMode === 'alpha' }}
                    >
                        <Text
                            style={[
                                styles.sortSegText,
                                {
                                    color: sortMode === 'alpha' ? colors.textPrimary : colors.textSecondary,
                                    fontWeight: sortMode === 'alpha' ? '600' : '500',
                                },
                            ]}
                        >
                            A–Z
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.sortSeg,
                            sortMode === 'urgency' && {
                                backgroundColor: colors.cardBackground,
                            },
                        ]}
                        onPress={() => {
                            if (sortMode !== 'urgency') {
                                setSortMode('urgency');
                                pipelineAnalytics.sortModeChanged('urgency');
                            }
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Sort by pipeline urgency"
                        accessibilityState={{ selected: sortMode === 'urgency' }}
                    >
                        <Text
                            style={[
                                styles.sortSegText,
                                {
                                    color: sortMode === 'urgency' ? colors.textPrimary : colors.textSecondary,
                                    fontWeight: sortMode === 'urgency' ? '600' : '500',
                                },
                            ]}
                        >
                            Pipeline
                        </Text>
                    </TouchableOpacity>
                </View>

                <View
                    style={[styles.searchBar, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                >
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
                        const count = displayedCounts[item.key] || 0;
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

            {/* Error Banner */}
            {error && (
                <View style={{ paddingHorizontal: 16 }}>
                    <ErrorBanner message={error} onRetry={sortMode === 'urgency' ? pipeline.refresh : loadAlpha} />
                </View>
            )}

            <FlatList
                data={filteredCandidates}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
                }
                removeClippedSubviews={true}
                maxToRenderPerBatch={10}
                windowSize={5}
                initialNumToRender={10}
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
                        onPress={() => {
                            if (sortMode === 'urgency') {
                                const ns = nextStepByCandidateId[item.id];
                                if (ns) pipelineAnalytics.flaggedRowOpened(item.id, ns.urgency);
                            }
                            router.push(candidateRoute(item.id));
                        }}
                        nextStep={sortMode === 'urgency' ? nextStepByCandidateId[item.id] : undefined}
                    />
                )}
            />
        </View>
    );
}

export default function CandidateListScreen({
    candidateRoute,
    addRoute,
    isManagerView = false,
}: CandidateListScreenProps) {
    const { colors } = useTheme();
    const router = useTypedRouter();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <ScreenHeader
                title="Candidates"
                rightAction={
                    <TouchableOpacity
                        style={[styles.addButton, { backgroundColor: colors.accent }]}
                        onPress={() => router.push(addRoute)}
                        accessibilityLabel="Add new candidate"
                    >
                        <Ionicons name="person-add" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                }
            />
            <CandidateList candidateRoute={candidateRoute} isManagerView={isManagerView} />
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
    stickyHeader: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 4,
    },
    sortSegments: {
        flexDirection: 'row',
        borderRadius: 10,
        padding: 3,
        marginBottom: 12,
    },
    sortSeg: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 8,
    },
    sortSegText: {
        fontSize: 13,
        letterSpacing: -0.1,
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
        paddingTop: 8,
        flexGrow: 1,
    },
});
