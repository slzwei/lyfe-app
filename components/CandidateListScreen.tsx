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
import { fetchPAManagerIds } from '@/lib/recruitment/pa-helpers';
import {
    CANDIDATE_FILTER_GROUPS,
    candidateMatchesFilter,
    getCandidateFilterCounts,
    getCandidateFilterLabel,
    type CandidateFilterKey,
} from '@/lib/recruitment/candidateFilters';
import { compareByUrgency, type NextStep } from '@/lib/recruitment/pipeline';
import { CANDIDATE_STATUS_CONFIG, type CandidateStatus, type RecruitmentCandidate } from '@/types/recruitment';
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

type SortMode = 'urgency' | 'updated' | 'added' | 'alpha' | 'status';

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

const SORT_MODES: SortMode[] = ['urgency', 'updated', 'added', 'alpha', 'status'];

const SORT_LABELS: Record<SortMode, string> = {
    urgency: 'Pipeline urgency',
    updated: 'Recently updated',
    added: 'Recently added',
    alpha: 'Name (A→Z)',
    status: 'By status',
};

const SORT_DESCRIPTIONS: Record<SortMode, string> = {
    urgency: 'Who needs attention now',
    updated: 'Most recent activity first',
    added: 'Newest candidates first',
    alpha: 'Alphabetical',
    status: 'Grouped by pipeline stage',
};

const SORT_ICONS: Record<SortMode, React.ComponentProps<typeof Ionicons>['name']> = {
    urgency: 'flash-outline',
    updated: 'time-outline',
    added: 'sparkles-outline',
    alpha: 'text-outline',
    status: 'list-outline',
};

function isSortMode(value: unknown): value is SortMode {
    return typeof value === 'string' && (SORT_MODES as string[]).includes(value);
}

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
    const [showSortSheet, setShowSortSheet] = useState(false);
    const [sortMode, setSortMode] = useState<SortMode>(() => defaultSortModeForRole(user?.role));

    // Cheap directory fetch — powers every sort except 'urgency', which uses the
    // heavier useCandidatePipeline hook below.
    const [directoryCandidates, setDirectoryCandidates] = useState<RecruitmentCandidate[]>([]);
    const [isLoadingDirectory, setIsLoadingDirectory] = useState(true);
    const [errorDirectory, setErrorDirectory] = useState<string | null>(null);

    // Role-derived scoping. PAs see candidates of their bound manager(s);
    // ROs see all candidates (treated as manager-view). Other roles fall
    // through to the caller-supplied `isManagerView`.
    const role = user?.role;
    const isPa = role === 'pa';
    const isRo = role === 'ro';
    const [paManagerScope, setPaManagerScope] = useState<string[] | null>(null);
    const isResolvingPaScope = isPa && paManagerScope === null;

    useEffect(() => {
        if (!isPa || !user?.id) return;
        let cancelled = false;
        fetchPAManagerIds(user.id).then((ids) => {
            if (!cancelled) setPaManagerScope(ids);
        });
        return () => {
            cancelled = true;
        };
    }, [isPa, user?.id]);

    const effectiveIsManagerView = isRo ? true : isManagerView;
    const effectiveManagerScope = isPa ? (paManagerScope ?? []) : undefined;

    // Viewing the Archived filter switches the fetch to archived candidates;
    // every other filter shows the active pipeline.
    const archiveMode = activeFilter === 'archived' ? 'archived' : 'active';

    const sortStorageKey = `${SORT_STORAGE_KEY}:${user?.role ?? 'default'}`;

    useEffect(() => {
        let mounted = true;
        Promise.resolve()
            .then(() => AsyncStorage.getItem(sortStorageKey))
            .then((saved) => {
                if (!mounted) return;
                if (isSortMode(saved)) {
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

    const loadDirectory = useCallback(async () => {
        if (!user?.id) return;
        // Don't fire while PA scope is still resolving — fetchCandidates would
        // momentarily see an empty scope and flash a "no candidates" state.
        if (isResolvingPaScope) return;
        setErrorDirectory(null);
        const { data, error: fetchError } = await fetchCandidates(
            user.id,
            effectiveIsManagerView,
            undefined,
            undefined,
            effectiveManagerScope,
            archiveMode,
        );
        if (fetchError) setErrorDirectory(fetchError);
        else setDirectoryCandidates(data);
        setIsLoadingDirectory(false);
    }, [user?.id, effectiveIsManagerView, effectiveManagerScope, isResolvingPaScope, archiveMode]);

    useFocusEffect(
        useCallback(() => {
            if (sortMode !== 'urgency') loadDirectory();
        }, [loadDirectory, sortMode]),
    );

    useCandidateRealtime(
        useCallback(() => {
            if (sortMode !== 'urgency') loadDirectory();
        }, [loadDirectory, sortMode]),
    );

    // Pipeline path — bulk fetch with computed next steps.
    const {
        rows: pipelineRows,
        isLoading: pipelineLoading,
        error: pipelineError,
        refresh: refreshPipeline,
    } = useCandidatePipeline({
        isManagerView: effectiveIsManagerView,
        managerScope: effectiveManagerScope,
        enabled: sortMode === 'urgency' && !isResolvingPaScope,
        archiveMode,
    });

    const candidates: RecruitmentCandidate[] =
        sortMode === 'urgency' ? pipelineRows.map((row) => row.candidate) : directoryCandidates;

    const nextStepByCandidateId: Record<string, NextStep> = useMemo(() => {
        if (sortMode !== 'urgency') return {};
        const out: Record<string, NextStep> = {};
        for (const row of pipelineRows) out[row.candidate.id] = row.nextStep;
        return out;
    }, [pipelineRows, sortMode]);

    const isLoading = sortMode === 'urgency' ? pipelineLoading : isLoadingDirectory;
    const error = sortMode === 'urgency' ? pipelineError : errorDirectory;
    const counts = useMemo(() => getCandidateFilterCounts(candidates), [candidates]);

    const filteredCandidates = useMemo(() => {
        let list = candidates.filter((candidate) => searchMatches(candidate, search));
        list = list.filter((candidate) => candidateMatchesFilter(candidate, activeFilter));

        if (sortMode === 'urgency') {
            // Urgency mode intentionally hides "quiet" candidates so the list
            // surfaces only who needs attention now.
            if (!isClosedFilter(activeFilter) && activeFilter !== 'archived') {
                list = list.filter((candidate) => nextStepByCandidateId[candidate.id]?.urgency !== 'hidden');
            }
            list = [...list].sort((a, b) => {
                const nextA = nextStepByCandidateId[a.id];
                const nextB = nextStepByCandidateId[b.id];
                if (!nextA || !nextB) return 0;
                return compareByUrgency(nextA, nextB);
            });
        } else if (sortMode === 'updated') {
            list = [...list].sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at));
        } else if (sortMode === 'added') {
            list = [...list].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
        } else if (sortMode === 'status') {
            list = [...list].sort((a, b) => {
                const oa = CANDIDATE_STATUS_CONFIG[a.status]?.order ?? 99;
                const ob = CANDIDATE_STATUS_CONFIG[b.status]?.order ?? 99;
                if (oa !== ob) return oa - ob;
                return a.name.localeCompare(b.name);
            });
        } else {
            list = [...list].sort((a, b) => a.name.localeCompare(b.name));
        }

        return list;
    }, [activeFilter, candidates, nextStepByCandidateId, search, sortMode]);

    const activeFilterLabel = getCandidateFilterLabel(activeFilter, statusLabel);

    const summaryText = useMemo(() => {
        const count = filteredCandidates.length;
        const plural = count === 1 ? '' : 's';
        if (search.trim()) return `${count} search result${plural}`;
        if (activeFilter === 'open') return `${count} open candidate${plural}`;
        return `${count} ${activeFilterLabel.toLowerCase()} candidate${plural}`;
    }, [activeFilter, activeFilterLabel, filteredCandidates.length, search]);

    const emptySubtitle = useMemo(() => {
        if (search.trim()) return `No results for "${search}"`;
        if (sortMode === 'urgency' && activeFilter === 'open') return 'Pipeline is clear today.';
        if (activeFilter === 'open') return 'New candidates appear here once added or assigned.';
        return `No ${activeFilterLabel.toLowerCase()} candidates right now.`;
    }, [activeFilter, activeFilterLabel, search, sortMode]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        if (sortMode === 'urgency') await refreshPipeline();
        else await loadDirectory();
        setRefreshing(false);
    }, [sortMode, refreshPipeline, loadDirectory]);

    if (isLoading) {
        return <LoadingState />;
    }

    return (
        <View style={styles.body}>
            <View style={[styles.stickyHeader, embedded && styles.stickyHeaderEmbedded]}>
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

                <View style={styles.summaryRow}>
                    <Text style={[styles.summaryText, { color: colors.textTertiary }]} numberOfLines={1}>
                        {summaryText}
                    </Text>
                    <TouchableOpacity
                        style={styles.sortPill}
                        onPress={() => setShowSortSheet(true)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityRole="button"
                        accessibilityLabel={`Sort by ${SORT_LABELS[sortMode]}. Tap to change.`}
                        testID="candidates-sort-pill"
                    >
                        <Text style={[styles.sortPillLabel, { color: colors.textTertiary }]} numberOfLines={1}>
                            Sort:{' '}
                            <Text style={[styles.sortPillValue, { color: colors.textPrimary }]}>
                                {SORT_LABELS[sortMode]}
                            </Text>
                        </Text>
                        <Ionicons name="chevron-down" size={12} color={colors.textTertiary} />
                    </TouchableOpacity>
                </View>
            </View>

            {error && (
                <View style={styles.errorWrap}>
                    <ErrorBanner message={error} onRetry={sortMode === 'urgency' ? refreshPipeline : loadDirectory} />
                </View>
            )}

            <FlatList
                testID="candidates-list"
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

            <SortSheet
                visible={showSortSheet}
                activeMode={sortMode}
                onSelect={(mode) => {
                    if (mode !== sortMode) {
                        saveSortMode(mode);
                        pipelineAnalytics.sortModeChanged(mode);
                    }
                    setShowSortSheet(false);
                }}
                onClose={() => setShowSortSheet(false)}
            />
        </View>
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

function SortSheet({
    visible,
    activeMode,
    onSelect,
    onClose,
}: {
    visible: boolean;
    activeMode: SortMode;
    onSelect: (mode: SortMode) => void;
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
                        <View style={styles.sheetTitleWrap}>
                            <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
                                Sort <Text style={[styles.sheetTitleAccent, { color: colors.accent }]}>by</Text>
                            </Text>
                            <Text style={[styles.sheetSubtitle, { color: colors.textTertiary }]}>
                                Pick how candidates are ordered.
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={[styles.sheetClose, { backgroundColor: colors.surfaceSecondary }]}
                            onPress={onClose}
                            accessibilityRole="button"
                            accessibilityLabel="Close sort options"
                        >
                            <Ionicons name="close" size={18} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        data={SORT_MODES}
                        keyExtractor={(item) => item}
                        scrollEnabled={false}
                        renderItem={({ item }) => {
                            const active = activeMode === item;
                            return (
                                <TouchableOpacity
                                    style={[styles.sortRow, { borderTopColor: colors.borderLight }]}
                                    onPress={() => onSelect(item)}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Sort by ${SORT_LABELS[item]}`}
                                    accessibilityState={{ selected: active }}
                                    testID={`candidates-sort-option-${item}`}
                                >
                                    <View
                                        style={[
                                            styles.sortRowIcon,
                                            { backgroundColor: active ? colors.accentLight : colors.surfaceSecondary },
                                        ]}
                                    >
                                        <Ionicons
                                            name={SORT_ICONS[item]}
                                            size={16}
                                            color={active ? colors.accent : colors.textSecondary}
                                        />
                                    </View>
                                    <View style={styles.sortRowText}>
                                        <Text
                                            style={[
                                                styles.sortRowLabel,
                                                {
                                                    color: colors.textPrimary,
                                                    fontFamily: active ? Fonts.sansSemibold : Fonts.sans,
                                                },
                                            ]}
                                        >
                                            {SORT_LABELS[item]}
                                        </Text>
                                        <Text style={[styles.sortRowDesc, { color: colors.textTertiary }]}>
                                            {SORT_DESCRIPTIONS[item]}
                                        </Text>
                                    </View>
                                    {active && <Ionicons name="checkmark" size={18} color={colors.accent} />}
                                </TouchableOpacity>
                            );
                        }}
                    />
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
    filterList: {
        flex: 1,
        flexGrow: 0,
        marginHorizontal: -16,
        marginBottom: 6,
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
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        paddingBottom: 2,
    },
    summaryText: {
        flexShrink: 1,
        fontFamily: Fonts.sans,
        fontSize: 13,
        lineHeight: 18,
    },
    sortPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4,
        paddingLeft: 4,
    },
    sortPillLabel: {
        fontFamily: Fonts.sans,
        fontSize: 13,
        lineHeight: 18,
        letterSpacing: letterSpacing(-0.1),
    },
    sortPillValue: {
        fontFamily: Fonts.sansSemibold,
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
    sheetTitleWrap: {
        flex: 1,
    },
    sheetTitle: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 18,
        lineHeight: 24,
    },
    sheetTitleAccent: {
        fontFamily: Fonts.serifItalic,
        fontWeight: '500',
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
    sortRow: {
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingVertical: 8,
    },
    sortRowIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sortRowText: {
        flex: 1,
    },
    sortRowLabel: {
        fontSize: 15,
        lineHeight: 20,
        letterSpacing: letterSpacing(-0.1),
    },
    sortRowDesc: {
        fontFamily: Fonts.sans,
        fontSize: 12,
        lineHeight: 16,
        marginTop: 2,
    },
});
