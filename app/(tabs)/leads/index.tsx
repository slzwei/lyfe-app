import EmptyState from '@/components/EmptyState';
import ErrorBanner from '@/components/ErrorBanner';
import LeadCard from '@/components/LeadCard';
import LoadingState from '@/components/LoadingState';
import ScreenHeader from '@/components/ScreenHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useViewMode } from '@/contexts/ViewModeContext';
import { fetchLeads } from '@/lib/leads';
import type { Lead, LeadStatus } from '@/types/lead';
import { useFilteredList } from '@/hooks/useFilteredList';
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
const LEAD_SEARCH_FIELDS: (keyof Lead)[] = ['full_name', 'phone'];

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
    const { colors } = useTheme();
    const { user } = useAuth();
    const { viewMode, canToggle } = useViewMode();
    const router = useRouter();
    const isManagerView = canToggle && viewMode === 'manager';

    const [search, setSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState<LeadStatus | 'all'>('all');
    const [refreshing, setRefreshing] = useState(false);
    const [leads, setLeads] = useState<Lead[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch leads from Supabase
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

    // Re-fetch on focus (e.g., after adding a lead)
    useFocusEffect(
        useCallback(() => {
            loadLeads();
        }, [loadLeads])
    );

    const { filtered: filteredLeads, counts } = useFilteredList(
        leads, search, activeFilter, 'status', LEAD_SEARCH_FIELDS,
    );

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadLeads();
        setRefreshing(false);
    }, [loadLeads]);

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <ScreenHeader title="Leads" />
                <LoadingState />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <ScreenHeader
                title="Leads"
                rightAction={!isManagerView ? (
                    <TouchableOpacity
                        style={[styles.addButton, { backgroundColor: colors.accent }]}
                        onPress={() => router.push('/(tabs)/leads/add')}
                        accessibilityLabel="Add new lead"
                    >
                        <Ionicons name="add" size={20} color="#FFFFFF" />
                        <Text style={styles.addButtonText}>Add</Text>
                    </TouchableOpacity>
                ) : undefined}
            />

            {/* Search */}
            <View style={styles.stickyHeader}>
                <View style={[styles.searchBar, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                    <Ionicons name="search" size={18} color={colors.textTertiary} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.textPrimary }]}
                        placeholder="Search by name or phone..."
                        placeholderTextColor={colors.textTertiary}
                        value={search}
                        onChangeText={setSearch}
                        returnKeyType="search"
                    />
                    {search.length > 0 && (
                        <TouchableOpacity
                            onPress={() => setSearch('')}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            accessibilityLabel="Clear search"
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
            {error && <View style={{ paddingHorizontal: 16 }}><ErrorBanner message={error} onRetry={loadLeads} /></View>}

            {/* Lead List */}
            <FlatList
                data={filteredLeads}
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
                        icon="search-outline"
                        title="No leads found"
                        subtitle={search.trim() ? `No results for "${search}"` : 'No leads match this filter'}
                    />
                }
                renderItem={({ item }) => (
                    <LeadCard
                        lead={item}
                        onPress={() => router.push(`/(tabs)/leads/${item.id}`)}
                    />
                )}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 20,
    },
    addButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
    stickyHeader: {
        paddingHorizontal: 16,
        paddingTop: 16,
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
        marginHorizontal: -16,
    },
    filterRow: {
        gap: 8,
        paddingHorizontal: 16,
        paddingBottom: 4,
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
        paddingTop: 8,
        paddingBottom: 16,
        flexGrow: 1,
    },
});
