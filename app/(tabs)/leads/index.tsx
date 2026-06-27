import ErrorBanner from '@/components/ErrorBanner';
import { LeadListCard } from '@/components/leads/LeadListCard';
import { Txt, LivePill, LeadCardSkeleton, LeadsEmptyState, CompactEmpty } from '@/components/leads/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useViewMode } from '@/contexts/ViewModeContext';
import { useLeadRealtime } from '@/hooks/useLeadRealtime';
import { fetchLeads } from '@/lib/leads';
import { useLeadsTheme, spacing } from '@/lib/leads/theme';
import type { Lead, LeadStatus } from '@/types/lead';
import { useFilteredList } from '@/hooks/useFilteredList';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp, useReducedMotion } from 'react-native-reanimated';

const LEAD_SEARCH_FIELDS: (keyof Lead)[] = ['full_name', 'phone'];

// Archived/Disputed are intentionally absent until the parity plan lands the
// `archived_at` column + `disputed` enum (LYFE_LEADS_UIUX_PLAN.md §4/§6) — no dead filters.
const FILTER_TABS: { key: LeadStatus | 'all'; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'new', label: 'New' },
    { key: 'contacted', label: 'Contacted' },
    { key: 'qualified', label: 'Qualified' },
    { key: 'proposed', label: 'Proposed' },
    { key: 'won', label: 'Won' },
    { key: 'lost', label: 'Lost' },
];

export default function LeadsListScreen() {
    const { colors } = useLeadsTheme();
    const { user } = useAuth();
    const { viewMode, canToggle } = useViewMode();
    const router = useRouter();
    const reduced = useReducedMotion();
    const isManagerView = canToggle && viewMode === 'manager';
    // Track which rows have already animated, so virtualization recycle doesn't
    // re-fire FadeInUp (and leave recycled rows briefly blank) on scroll-back.
    const seenIds = useRef<Set<string>>(new Set());

    const [search, setSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState<LeadStatus | 'all'>('all');
    const [refreshing, setRefreshing] = useState(false);
    const [leads, setLeads] = useState<Lead[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Realtime: prepend new leads from MKTR (or any source)
    const handleNewLead = useCallback((newLead: Lead) => {
        setLeads((prev) => {
            if (prev.some((l) => l.id === newLead.id)) return prev;
            return [newLead, ...prev];
        });
    }, []);
    useLeadRealtime(handleNewLead);

    const loadLeads = useCallback(async () => {
        if (!user?.id) return;
        setError(null);
        const { data, error: fetchError } = await fetchLeads(user.id, isManagerView);
        if (fetchError) {
            setError(fetchError);
        } else {
            setLeads(data);
        }
        setIsLoading(false);
    }, [user?.id, isManagerView]);

    useFocusEffect(
        useCallback(() => {
            loadLeads();
        }, [loadLeads]),
    );

    const { filtered: filteredLeads, counts } = useFilteredList(
        leads,
        search,
        activeFilter,
        'status',
        LEAD_SEARCH_FIELDS,
    );

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadLeads();
        setRefreshing(false);
    }, [loadLeads]);

    // ── Header: editorial title + Add ───────────────────────────────────────
    const header = (
        <View style={styles.titleRow}>
            <Txt role="display" weight="semibold" size={30} color={colors.text} tracking={-0.5}>
                Leads
            </Txt>
            <TouchableOpacity
                style={[styles.addButton, { backgroundColor: colors.accent }]}
                onPress={() => router.push('/(tabs)/leads/add')}
                accessibilityRole="button"
                testID="leads-add-button"
                accessibilityLabel="Add new lead"
            >
                <Ionicons name="add" size={20} color={colors.textInverse} />
                <Txt role="body" weight="bold" size={14} color={colors.textInverse}>
                    Add
                </Txt>
            </TouchableOpacity>
        </View>
    );

    const controls = (
        <View>
            <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="search" size={18} color={colors.textFaint} />
                <TextInput
                    testID="leads-search-input"
                    style={[styles.searchInput, { color: colors.text }]}
                    placeholder="Search by name or phone…"
                    placeholderTextColor={colors.textFaint}
                    value={search}
                    onChangeText={setSearch}
                    returnKeyType="search"
                    accessibilityLabel="Search leads"
                    accessibilityHint="Search by name or phone number"
                />
                {search.length > 0 && (
                    <TouchableOpacity
                        onPress={() => setSearch('')}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityRole="button"
                        accessibilityLabel="Clear search"
                    >
                        <Ionicons name="close-circle" size={18} color={colors.textFaint} />
                    </TouchableOpacity>
                )}
            </View>

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
                            testID={`leads-filter-chip-${item.key}`}
                            style={[
                                styles.filterChip,
                                {
                                    backgroundColor: isActive ? colors.accent : colors.surface,
                                    borderColor: isActive ? colors.accent : colors.border,
                                },
                            ]}
                            onPress={() => setActiveFilter(item.key)}
                            accessibilityRole="button"
                            accessibilityLabel={`Filter by ${item.label}`}
                            accessibilityState={{ selected: isActive }}
                        >
                            <Txt
                                role="body"
                                weight="semibold"
                                size={13}
                                color={isActive ? colors.textInverse : colors.textMuted}
                            >
                                {item.label}
                            </Txt>
                            <Txt
                                role="body"
                                weight="semibold"
                                size={13}
                                color={isActive ? colors.textInverse : colors.textFaint}
                            >
                                {count}
                            </Txt>
                        </TouchableOpacity>
                    );
                }}
            />
        </View>
    );

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <View style={styles.stickyHeader}>
                    {header}
                    {controls}
                </View>
                <View style={styles.listContent}>
                    {[0, 1, 2, 3].map((i) => (
                        <LeadCardSkeleton key={i} opacity={1 - i * 0.18} />
                    ))}
                </View>
            </SafeAreaView>
        );
    }

    const emptyNode =
        search.trim().length > 0 ? (
            <CompactEmpty icon="search-outline" text={`No results for "${search}"`} />
        ) : leads.length === 0 ? (
            <LeadsEmptyState
                icon="flash-outline"
                title="You're all caught up"
                body="New leads land here the moment they arrive — we'll buzz your phone, so keep it close."
                footer={<LivePill label="Listening for new leads…" />}
            />
        ) : (
            <CompactEmpty icon="funnel-outline" text="No leads match this filter." />
        );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <View style={styles.stickyHeader}>
                {header}
                {controls}
            </View>

            {error && (
                <View style={{ paddingHorizontal: spacing.lg }}>
                    <ErrorBanner message={error} onRetry={loadLeads} />
                </View>
            )}

            <FlatList
                testID="leads-list"
                data={filteredLeads}
                keyExtractor={(item) => item.id}
                contentContainerStyle={filteredLeads.length === 0 ? styles.listEmpty : styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
                }
                maxToRenderPerBatch={10}
                windowSize={5}
                initialNumToRender={10}
                ListEmptyComponent={<View style={styles.emptyWrap}>{emptyNode}</View>}
                renderItem={({ item, index }) => {
                    // Animate each row only on its FIRST appearance — recycled rows
                    // (virtualization) must not re-run the entrance on scroll-back.
                    const firstSeen = !seenIds.current.has(item.id);
                    seenIds.current.add(item.id);
                    return (
                        <Animated.View
                            entering={
                                reduced || !firstSeen
                                    ? undefined
                                    : FadeInUp.duration(280).delay(Math.min(index, 6) * 55)
                            }
                        >
                            <LeadListCard lead={item} onPress={() => router.push(`/(tabs)/leads/${item.id}`)} />
                        </Animated.View>
                    );
                }}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    stickyHeader: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 20,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginBottom: spacing.md,
    },
    searchInput: { flex: 1, fontSize: 15, padding: 0 },
    filterList: { flexGrow: 0, marginHorizontal: -spacing.lg },
    filterRow: { gap: 8, paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 8,
        minHeight: 44,
        borderRadius: 20,
        borderWidth: 1,
    },
    listContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg, flexGrow: 1 },
    listEmpty: { flexGrow: 1 },
    emptyWrap: { flex: 1, minHeight: 340, alignItems: 'center', justifyContent: 'center', paddingBottom: 40 },
});
