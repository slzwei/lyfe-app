import EmptyState from '@/components/EmptyState';
import LeadCard from '@/components/LeadCard';
import LoadingState from '@/components/LoadingState';
import ScreenHeader from '@/components/ScreenHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useViewMode } from '@/contexts/ViewModeContext';
import { fetchLeads } from '@/lib/leads';
import type { Lead, LeadStatus } from '@/types/lead';
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
import { MOCK_AGENT_NAME_MAP, MOCK_LEAD_ACTIVITIES, MOCK_LEADS } from '@/lib/mockData';

// Re-export for detail screen (mock mode only)
export { MOCK_LEAD_ACTIVITIES as MOCK_ACTIVITIES, MOCK_LEADS } from '@/lib/mockData';

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
    const MOCK_OTP = isMockMode();
    const { colors } = useTheme();
    const { user } = useAuth();
    const { viewMode, canToggle } = useViewMode();
    const router = useRouter();
    const isManagerView = canToggle && viewMode === 'manager';

    const [search, setSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState<LeadStatus | 'all'>('all');
    const [refreshing, setRefreshing] = useState(false);
    const [leads, setLeads] = useState<Lead[]>([]);
    const [isLoading, setIsLoading] = useState(!MOCK_OTP);
    const [error, setError] = useState<string | null>(null);

    // Fetch leads from Supabase (or use mock data)
    const loadLeads = useCallback(async () => {
        if (MOCK_OTP) {
            // Mock mode: use hardcoded data
            if (isManagerView) {
                setLeads(MOCK_LEADS);
            } else {
                setLeads(MOCK_LEADS.filter(l => l.assigned_to === 'me'));
            }
            return;
        }

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

    const filteredLeads = leads.filter((lead) => {
        if (search.trim()) {
            const q = search.toLowerCase();
            const matchesName = lead.full_name.toLowerCase().includes(q);
            const matchesPhone = lead.phone?.includes(q);
            if (!matchesName && !matchesPhone) return false;
        }
        if (activeFilter !== 'all' && lead.status !== activeFilter) return false;
        return true;
    }).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    const counts: Record<string, number> = { all: leads.length };
    leads.forEach((l) => { counts[l.status] = (counts[l.status] || 0) + 1; });

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
                        onPress={() => router.push('/leads/add')}
                        accessibilityLabel="Add new lead"
                    >
                        <Ionicons name="add" size={20} color="#FFFFFF" />
                        <Text style={styles.addButtonText}>Add</Text>
                    </TouchableOpacity>
                ) : undefined}
            />

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
                ListHeaderComponent={
                    <View style={styles.headerContainer}>
                        {/* Search */}
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

                        {/* Error Banner */}
                        {error && (
                            <TouchableOpacity
                                style={[styles.errorBanner, { backgroundColor: colors.dangerLight }]}
                                onPress={loadLeads}
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
                        icon="search-outline"
                        title="No leads found"
                        subtitle={search.trim() ? `No results for "${search}"` : 'No leads match this filter'}
                    />
                }
                renderItem={({ item }) => {
                    // In mock mode, use mock activities for last activity preview
                    const mockActs = MOCK_OTP ? (MOCK_LEAD_ACTIVITIES[item.id] || []) : [];
                    const lastAct = mockActs.length > 0
                        ? mockActs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
                        : null;
                    const agentLabel = isManagerView && item.assigned_to !== 'me' && MOCK_OTP
                        ? MOCK_AGENT_NAME_MAP[item.assigned_to] || item.assigned_to
                        : undefined;
                    return (
                        <LeadCard
                            lead={item}
                            onPress={() => router.push(`/leads/${item.id}`)}
                            lastActivity={lastAct?.description ? lastAct.description.substring(0, 40) : undefined}
                            agentName={agentLabel}
                        />
                    );
                }}
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
        marginHorizontal: -16,
        marginBottom: 8,
    },
    filterRow: {
        gap: 8,
        paddingHorizontal: 16,
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
        padding: 16,
        paddingTop: 16,
    },
});
