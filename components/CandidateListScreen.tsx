import CandidateCard from '@/components/CandidateCard';
import EmptyState from '@/components/EmptyState';
import ErrorBanner from '@/components/ErrorBanner';
import LoadingState from '@/components/LoadingState';
import ScreenHeader from '@/components/ScreenHeader';
import { letterSpacing } from '@/constants/platform';
import { Fonts } from '@/constants/type';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useCandidatePipeline } from '@/hooks/useCandidatePipeline';
import { useCandidateRealtime } from '@/hooks/useCandidateRealtime';
import { useTypedRouter } from '@/hooks/useTypedRouter';
import { pipelineAnalytics } from '@/lib/analytics';
import { fetchCandidates } from '@/lib/recruitment';
import {
    CANDIDATE_FILTER_GROUPS,
    candidateMatchesFilter,
    getCandidateFilterCounts,
    getCandidateFilterLabel,
    isCandidateFilterGroup,
    type CandidateFilterKey,
} from '@/lib/recruitment/candidateFilters';
import { compareByUrgency, type NextStep } from '@/lib/recruitment/pipeline';
import {
    CANDIDATE_STATUSES,
    CANDIDATE_STATUS_CONFIG,
    type CandidateStatus,
    type RecruitmentCandidate,
} from '@/types/recruitment';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    FlatList,
    Modal,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
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
const SORT_STORAGE_KEY = 'lyfe_candidate_sort_mode';

function defaultSortModeForRole(role?: string | null): SortMode {
    return role === 'admin' || role === 'director' || role === 'manager' ? 'urgency' : 'alpha';
}

function isClosedFilter(filter: CandidateFilterKey) {
    return filter === 'closed' || filter === 'on_hold' || filter === 'rejected';
}

function statusLabel(status: CandidateStatus) {
    return CANDIDATE_STATUS_CONFIG[status].label;
}

function searchMatches(candidate: RecruitmentCandidate, search: string) {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return CANDIDATE_SEARCH_FIELDS.some((field) => {
        const value = candidate[field];
        return typeof value === 'string' && value.toLowerCase().includes(q);
    });
}

/**
 * Embeddable candidate list body — search, grouped filters, list, loading/error.
 * No SafeAreaView or ScreenHeader, so it can be dropped inside another screen.
 */
export function CandidateList({ candidateRoute, isManagerView = false, embedded = false }: CandidateListProps) {
    const { colors } = useTheme();
    const { user } = useAuth();
    const router = useTypedRouter();

    const [search, setSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState<CandidateFilterKey>('open');
    const [refreshing, setRefreshing] = useState(false);
    const [showStatusSheet, setShowStatusSheet] = useState(false);
    const [sortMode, setSortMode] = useState<SortMode>(() => defaultSortModeForRole(user?.role));

    // Directory path — cheap, candidates only.
    const [candidatesAlpha, setCandidatesAlpha] = useState<RecruitmentCandidate[]>([]);
    const [isLoadingAlpha, setIsLoadingAlpha] = useState(true);
    const [errorAlpha, setErrorAlpha] = useState<string | null>(null);

    const sortStorageKey = `${SORT_STORAGE_KEY}:${user?.role ?? 'default'}`;

    useEffect(() => {
        let mounted = true;
        Promise.resolve()
            .then(() => AsyncStorage.getItem(sortStorageKey))
            .then((saved) => {
                if (!mounted) return;
                if (saved === 'alpha' || saved === 'urgency') {
                    setSortMode(saved);
                } else {
                    setSortMode(defaultSortModeForRole(user?.role));
                }
            })
            .catch(() => {
                if (mounted) setSortMode(defaultSortModeForRole(user?.role));
            });
        return () => {
            mounted = false;
        };
    }, [sortStorageKey, user?.role]);

    const saveSortMode = useCallback(
        (nextMode: SortMode) => {
            setSortMode(nextMode);
            AsyncStorage.setItem(sortStorageKey, nextMode).catch(() => {});
        },
        [sortStorageKey],
    );

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

    useCandidateRealtime(
        useCallback(() => {
            if (sortMode === 'alpha') loadAlpha();
        }, [loadAlpha, sortMode]),
    );

    // Pipeline path — bulk fetch with computed next steps.
    const {
        rows: pipelineRows,
        isLoading: pipelineLoading,
        error: pipelineError,
        refresh: refreshPipeline,
    } = useCandidatePipeline({
        isManagerView,
        enabled: sortMode === 'urgency',
    });

    const candidates: RecruitmentCandidate[] =
        sortMode === 'urgency' ? pipelineRows.map((row) => row.candidate) : candidatesAlpha;

    const nextStepByCandidateId: Record<string, NextStep> = useMemo(() => {
        if (sortMode !== 'urgency') return {};
        const out: Record<string, NextStep> = {};
        for (const row of pipelineRows) out[row.candidate.id] = row.nextStep;
        return out;
    }, [pipelineRows, sortMode]);

    const isLoading = sortMode === 'urgency' ? pipelineLoading : isLoadingAlpha;
    const error = sortMode === 'urgency' ? pipelineError : errorAlpha;
    const counts = useMemo(() => getCandidateFilterCounts(candidates), [candidates]);

    const filteredCandidates = useMemo(() => {
        let list = candidates.filter((candidate) => searchMatches(candidate, search));
        list = list.filter((candidate) => candidateMatchesFilter(candidate, activeFilter));

        if (sortMode === 'urgency') {
            if (!isClosedFilter(activeFilter)) {
                list = list.filter((candidate) => nextStepByCandidateId[candidate.id]?.urgency !== 'hidden');
            }
            list = [...list].sort((a, b) => {
                const nextA = nextStepByCandidateId[a.id];
                const nextB = nextStepByCandidateId[b.id];
                if (!nextA || !nextB) return 0;
                return compareByUrgency(nextA, nextB);
            });
        }

        return list;
    }, [activeFilter, candidates, nextStepByCandidateId, search, sortMode]);

    const activeFilterLabel = getCandidateFilterLabel(activeFilter, statusLabel);
    const granularFilterActive = !isCandidateFilterGroup(activeFilter);

    const summaryText = useMemo(() => {
        const count = filteredCandidates.length;
        const plural = count === 1 ? '' : 's';
        if (search.trim()) return `${count} search result${plural}`;
        if (sortMode === 'urgency' && activeFilter === 'open') {
            return `${count} candidate${plural} sorted by who needs attention.`;
        }
        if (activeFilter === 'open') return `${count} open candidate${plural}`;
        return `${count} ${activeFilterLabel.toLowerCase()} candidate${plural}`;
    }, [activeFilter, activeFilterLabel, filteredCandidates.length, search, sortMode]);

    const emptySubtitle = useMemo(() => {
        if (search.trim()) return `No results for "${search}"`;
        if (sortMode === 'urgency' && activeFilter === 'open') return 'Pipeline is clear today.';
        if (activeFilter === 'open') return 'New candidates appear here once added or assigned.';
        return `No ${activeFilterLabel.toLowerCase()} candidates right now.`;
    }, [activeFilter, activeFilterLabel, search, sortMode]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        if (sortMode === 'urgency') await refreshPipeline();
        else await loadAlpha();
        setRefreshing(false);
    }, [sortMode, refreshPipeline, loadAlpha]);

    if (isLoading) {
        return <LoadingState />;
    }

    return (
        <View style={styles.body}>
            <View style={[styles.stickyHeader, embedded && styles.stickyHeaderEmbedded]}>
                <View
                    style={[
                        styles.sortSegments,
                        embedded && styles.sortSegmentsCompact,
                        { backgroundColor: colors.surfaceSecondary },
                    ]}
                >
                    <SortSegment
                        label="Directory"
                        active={sortMode === 'alpha'}
                        onPress={() => {
                            if (sortMode !== 'alpha') {
                                saveSortMode('alpha');
                                pipelineAnalytics.sortModeChanged('alpha');
                            }
                        }}
                        accessibilityLabel="View candidates as a directory"
                    />
                    <SortSegment
                        label="Pipeline"
                        active={sortMode === 'urgency'}
                        onPress={() => {
                            if (sortMode !== 'urgency') {
                                saveSortMode('urgency');
                                pipelineAnalytics.sortModeChanged('urgency');
                            }
                        }}
                        accessibilityLabel="View candidates by pipeline urgency"
                    />
                </View>

                <View
                    style={[styles.searchBar, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                >
                    <Ionicons name="search" size={18} color={colors.textTertiary} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.textPrimary }]}
                        placeholder="Search candidates"
                        placeholderTextColor={colors.textTertiary}
                        value={search}
                        onChangeText={setSearch}
                        returnKeyType="search"
                        accessibilityLabel="Search candidates"
                        accessibilityHint="Search by candidate name or phone number"
                    />
                    {search.length > 0 && (
                        <TouchableOpacity
                            onPress={() => setSearch('')}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            accessibilityRole="button"
                            accessibilityLabel="Clear candidate search"
                        >
                            <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.filterWrap}>
                    <FlatList
                        data={CANDIDATE_FILTER_GROUPS}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        keyExtractor={(item) => item.key}
                        style={[styles.filterList, embedded && styles.filterListEmbedded]}
                        contentContainerStyle={[styles.filterRow, embedded && styles.filterRowEmbedded]}
                        renderItem={({ item }) => {
                            const isActive = activeFilter === item.key;
                            return (
                                <FilterChip
                                    label={item.label}
                                    count={counts[item.key] || 0}
                                    active={isActive}
                                    onPress={() => setActiveFilter(item.key)}
                                    accessibilityLabel={`Filter by ${item.label}`}
                                />
                            );
                        }}
                    />
                    <TouchableOpacity
                        style={[
                            styles.statusFilterButton,
                            {
                                backgroundColor: granularFilterActive ? colors.accent : colors.cardBackground,
                                borderColor: granularFilterActive ? colors.accent : colors.border,
                            },
                        ]}
                        onPress={() => setShowStatusSheet(true)}
                        accessibilityRole="button"
                        accessibilityLabel="Open detailed status filters"
                    >
                        <Ionicons
                            name="options-outline"
                            size={15}
                            color={granularFilterActive ? colors.textInverse : colors.textSecondary}
                        />
                        <Text
                            style={[
                                styles.statusFilterText,
                                { color: granularFilterActive ? colors.textInverse : colors.textSecondary },
                            ]}
                            numberOfLines={1}
                        >
                            {granularFilterActive ? activeFilterLabel : 'Status'}
                        </Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.summaryRow}>
                    <Text style={[styles.summaryText, { color: colors.textTertiary }]}>{summaryText}</Text>
                </View>
            </View>

            {error && (
                <View style={styles.errorWrap}>
                    <ErrorBanner message={error} onRetry={sortMode === 'urgency' ? refreshPipeline : loadAlpha} />
                </View>
            )}

            <FlatList
                data={filteredCandidates}
                keyExtractor={(item) => item.id}
                contentContainerStyle={[styles.listContent, embedded && styles.listContentEmbedded]}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
                }
                removeClippedSubviews={true}
                maxToRenderPerBatch={10}
                windowSize={5}
                initialNumToRender={10}
                ListEmptyComponent={
                    <EmptyState icon="people-outline" title="No candidates found" subtitle={emptySubtitle} />
                }
                renderItem={({ item }) => (
                    <CandidateCard
                        candidate={item}
                        mode={sortMode === 'urgency' ? 'pipeline' : 'directory'}
                        onPress={() => {
                            if (sortMode === 'urgency') {
                                const nextStep = nextStepByCandidateId[item.id];
                                if (nextStep) pipelineAnalytics.flaggedRowOpened(item.id, nextStep.urgency);
                            }
                            router.push(candidateRoute(item.id));
                        }}
                        nextStep={sortMode === 'urgency' ? nextStepByCandidateId[item.id] : undefined}
                    />
                )}
            />

            <StatusFilterSheet
                visible={showStatusSheet}
                activeFilter={activeFilter}
                counts={counts}
                onSelect={(status) => {
                    setActiveFilter(status);
                    setShowStatusSheet(false);
                }}
                onClear={() => {
                    setActiveFilter('open');
                    setShowStatusSheet(false);
                }}
                onClose={() => setShowStatusSheet(false)}
            />
        </View>
    );
}

function SortSegment({
    label,
    active,
    onPress,
    accessibilityLabel,
}: {
    label: string;
    active: boolean;
    onPress: () => void;
    accessibilityLabel: string;
}) {
    const { colors } = useTheme();
    return (
        <TouchableOpacity
            style={[styles.sortSeg, active && { backgroundColor: colors.cardBackground }]}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            accessibilityState={{ selected: active }}
        >
            <Text
                style={[
                    styles.sortSegText,
                    {
                        color: active ? colors.textPrimary : colors.textSecondary,
                        fontFamily: active ? Fonts.sansSemibold : Fonts.sans,
                    },
                ]}
            >
                {label}
            </Text>
        </TouchableOpacity>
    );
}

function FilterChip({
    label,
    count,
    active,
    onPress,
    accessibilityLabel,
}: {
    label: string;
    count: number;
    active: boolean;
    onPress: () => void;
    accessibilityLabel: string;
}) {
    const { colors } = useTheme();
    return (
        <TouchableOpacity
            style={[
                styles.filterChip,
                {
                    backgroundColor: active ? colors.accent : colors.cardBackground,
                    borderColor: active ? colors.accent : colors.border,
                },
            ]}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            accessibilityState={{ selected: active }}
        >
            <Text style={[styles.filterChipText, { color: active ? colors.textInverse : colors.textSecondary }]}>
                {label}
            </Text>
            <Text
                style={[
                    styles.filterChipCount,
                    {
                        color: active ? colors.textInverse : colors.textTertiary,
                        opacity: active ? 0.8 : 1,
                    },
                ]}
            >
                {count}
            </Text>
        </TouchableOpacity>
    );
}

function StatusFilterSheet({
    visible,
    activeFilter,
    counts,
    onSelect,
    onClear,
    onClose,
}: {
    visible: boolean;
    activeFilter: CandidateFilterKey;
    counts: Record<CandidateFilterKey | 'all', number>;
    onSelect: (status: CandidateStatus) => void;
    onClear: () => void;
    onClose: () => void;
}) {
    const { colors } = useTheme();
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.sheetBackdrop} onPress={onClose}>
                <Pressable
                    style={[styles.sheet, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                    onPress={(event) => event.stopPropagation()}
                >
                    <View style={styles.sheetHeader}>
                        <View>
                            <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>Status</Text>
                            <Text style={[styles.sheetSubtitle, { color: colors.textTertiary }]}>
                                Choose an exact recruitment stage.
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={[styles.sheetClose, { backgroundColor: colors.surfaceSecondary }]}
                            onPress={onClose}
                            accessibilityRole="button"
                            accessibilityLabel="Close status filters"
                        >
                            <Ionicons name="close" size={18} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        data={CANDIDATE_STATUSES}
                        keyExtractor={(item) => item}
                        scrollEnabled={false}
                        renderItem={({ item }) => {
                            const active = activeFilter === item;
                            const config = CANDIDATE_STATUS_CONFIG[item];
                            return (
                                <TouchableOpacity
                                    style={[styles.statusRow, { borderTopColor: colors.borderLight }]}
                                    onPress={() => onSelect(item)}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: active }}
                                >
                                    <View
                                        style={[
                                            styles.statusDot,
                                            {
                                                backgroundColor: active ? colors.accent : config.color,
                                            },
                                        ]}
                                    />
                                    <Text style={[styles.statusLabel, { color: colors.textPrimary }]}>
                                        {config.label}
                                    </Text>
                                    <Text style={[styles.statusCount, { color: colors.textTertiary }]}>
                                        {counts[item] || 0}
                                    </Text>
                                    {active && <Ionicons name="checkmark" size={18} color={colors.accent} />}
                                </TouchableOpacity>
                            );
                        }}
                    />

                    <TouchableOpacity
                        style={[styles.clearStatusButton, { backgroundColor: colors.surfaceSecondary }]}
                        onPress={onClear}
                        accessibilityRole="button"
                        accessibilityLabel="Clear detailed status filter"
                    >
                        <Text style={[styles.clearStatusText, { color: colors.textSecondary }]}>Back to Open</Text>
                    </TouchableOpacity>
                </Pressable>
            </Pressable>
        </Modal>
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
                        accessibilityRole="button"
                        accessibilityLabel="Add new candidate"
                        testID="candidates-add-button"
                    >
                        <Ionicons name="person-add" size={20} color={colors.textInverse} />
                    </TouchableOpacity>
                }
            />
            <CandidateList candidateRoute={candidateRoute} isManagerView={isManagerView} />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    body: { flex: 1 },
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
    stickyHeaderEmbedded: {
        paddingTop: 0,
    },
    sortSegments: {
        flexDirection: 'row',
        borderRadius: 10,
        padding: 3,
        marginBottom: 12,
    },
    sortSegmentsCompact: {
        width: 216,
        alignSelf: 'flex-start',
        marginBottom: 10,
    },
    sortSeg: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 8,
    },
    sortSegText: {
        fontSize: 13,
        lineHeight: 17,
        letterSpacing: letterSpacing(-0.1),
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginBottom: 12,
    },
    searchInput: {
        flex: 1,
        fontFamily: Fonts.sans,
        fontSize: 15,
        lineHeight: 20,
        padding: 0,
    },
    filterWrap: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        marginBottom: 6,
    },
    filterList: {
        flex: 1,
        flexGrow: 0,
        marginHorizontal: -16,
    },
    filterListEmbedded: {
        marginBottom: 0,
    },
    filterRow: {
        gap: 8,
        paddingHorizontal: 16,
        paddingBottom: 8,
    },
    filterRowEmbedded: {
        paddingBottom: 6,
    },
    filterChip: {
        minHeight: 36,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 18,
        borderWidth: 1,
    },
    filterChipText: { fontFamily: Fonts.sansSemibold, fontSize: 13, lineHeight: 17 },
    filterChipCount: { fontFamily: Fonts.sans, fontSize: 12, lineHeight: 16 },
    statusFilterButton: {
        minHeight: 36,
        maxWidth: 128,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 18,
        borderWidth: 1,
        marginRight: 0,
    },
    statusFilterText: {
        flexShrink: 1,
        fontFamily: Fonts.sansSemibold,
        fontSize: 13,
        lineHeight: 17,
    },
    summaryRow: {
        paddingBottom: 2,
    },
    summaryText: {
        fontFamily: Fonts.sans,
        fontSize: 13,
        lineHeight: 18,
    },
    errorWrap: {
        paddingHorizontal: 16,
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 40,
        paddingTop: 8,
        flexGrow: 1,
    },
    listContentEmbedded: {
        paddingBottom: 24,
    },
    sheetBackdrop: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(20, 19, 16, 0.42)',
    },
    sheet: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 18,
        paddingTop: 18,
        paddingBottom: 28,
    },
    sheetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 16,
        marginBottom: 12,
    },
    sheetTitle: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 18,
        lineHeight: 24,
    },
    sheetSubtitle: {
        fontFamily: Fonts.sans,
        fontSize: 14,
        lineHeight: 20,
        marginTop: 2,
    },
    sheetClose: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusRow: {
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statusLabel: {
        flex: 1,
        fontFamily: Fonts.sans,
        fontSize: 15,
        lineHeight: 21,
    },
    statusCount: {
        fontFamily: Fonts.mono,
        fontSize: 12,
        lineHeight: 16,
    },
    clearStatusButton: {
        minHeight: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 14,
    },
    clearStatusText: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 14,
        lineHeight: 19,
    },
});
