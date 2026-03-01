import EmptyState from '@/components/EmptyState';
import LeadCard from '@/components/LeadCard';
import LoadingState from '@/components/LoadingState';
import ScreenHeader from '@/components/ScreenHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useViewMode } from '@/contexts/ViewModeContext';
import { fetchLeads } from '@/lib/leads';
import type { Lead, LeadActivity, LeadStatus } from '@/types/lead';
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

const MOCK_OTP = process.env.EXPO_PUBLIC_MOCK_OTP === 'true';

// ── Mock data (dev only) ───────────────────────────────────
const now = Date.now();
const h = (hours: number) => new Date(now - hours * 3600000).toISOString();

const MOCK_LEADS: Lead[] = [
    { id: 'l1', assigned_to: 'me', created_by: 'me', full_name: 'Sarah Tan', phone: '+65 9123 4567', email: 'sarah.tan@gmail.com', source: 'referral', status: 'new', product_interest: 'life', notes: 'Referred by existing client James Lim', updated_at: h(0.5), created_at: h(2) },
    { id: 'l2', assigned_to: 'me', created_by: 'me', full_name: 'Michael Wong', phone: '+65 8234 5678', email: 'michael.wong@outlook.com', source: 'online', status: 'new', product_interest: 'health', notes: null, updated_at: h(3), created_at: h(8) },
    { id: 'l3', assigned_to: 'me', created_by: 'me', full_name: 'Amanda Lee', phone: '+65 9345 6789', email: null, source: 'event', status: 'contacted', product_interest: 'ilp', notes: 'Met at MAS career fair', updated_at: h(6), created_at: h(48) },
    { id: 'l4', assigned_to: 'me', created_by: 'me', full_name: 'David Chen', phone: '+65 8456 7890', email: 'david.chen@company.sg', source: 'cold_call', status: 'contacted', product_interest: 'life', notes: null, updated_at: h(12), created_at: h(72) },
    { id: 'l5', assigned_to: 'me', created_by: 'me', full_name: 'Rachel Koh', phone: '+65 9567 8901', email: 'rachel@koh.sg', source: 'referral', status: 'qualified', product_interest: 'general', notes: 'High net worth, interested in portfolio review', updated_at: h(24), created_at: h(120) },
    { id: 'l6', assigned_to: 'me', created_by: 'me', full_name: 'Kevin Lim', phone: '+65 8678 9012', email: 'kevin.lim@work.com', source: 'walk_in', status: 'proposed', product_interest: 'health', notes: 'Sent proposal for Integrated Shield Plan', updated_at: h(48), created_at: h(240) },
    { id: 'l7', assigned_to: 'me', created_by: 'me', full_name: 'Jessica Ng', phone: '+65 9789 0123', email: 'jessica@ng.me', source: 'referral', status: 'won', product_interest: 'life', notes: 'Signed whole life policy $200k SA', updated_at: h(72), created_at: h(360) },
    { id: 'l8', assigned_to: 'me', created_by: 'me', full_name: 'Tony Yap', phone: '+65 8890 1234', email: null, source: 'cold_call', status: 'lost', product_interest: 'ilp', notes: 'Went with competitor offer', updated_at: h(96), created_at: h(480) },
    // T1 Agent leads (visible only in Manager View)
    { id: 'l9', assigned_to: 'agent-alice', created_by: 'agent-alice', full_name: 'Ethan Goh', phone: '+65 9111 2222', email: 'ethan.goh@mail.com', source: 'referral', status: 'new', product_interest: 'life', notes: 'Interested in term life', updated_at: h(1), created_at: h(4) },
    { id: 'l10', assigned_to: 'agent-alice', created_by: 'agent-alice', full_name: 'Mei Lin Ong', phone: '+65 8222 3333', email: null, source: 'event', status: 'contacted', product_interest: 'health', notes: 'Career fair lead', updated_at: h(5), created_at: h(24) },
    { id: 'l11', assigned_to: 'agent-bob', created_by: 'agent-bob', full_name: 'Raj Kumar', phone: '+65 9333 4444', email: 'raj.k@outlook.sg', source: 'online', status: 'qualified', product_interest: 'ilp', notes: 'High priority - large portfolio', updated_at: h(8), created_at: h(72) },
    { id: 'l12', assigned_to: 'agent-charlie', created_by: 'agent-charlie', full_name: 'Sophia Teo', phone: '+65 8444 5555', email: 'sophia.t@company.sg', source: 'cold_call', status: 'proposed', product_interest: 'general', notes: 'Awaiting client response', updated_at: h(15), created_at: h(120) },
];

const MOCK_ACTIVITIES: Record<string, LeadActivity[]> = {
    l1: [
        { id: 'a1', lead_id: 'l1', user_id: 'me', type: 'created', description: 'Lead created from referral', metadata: {}, created_at: h(2) },
        { id: 'a2', lead_id: 'l1', user_id: 'me', type: 'note', description: 'Referred by James Lim — interested in whole life coverage for newborn', metadata: {}, created_at: h(0.5) },
    ],
    l2: [{ id: 'a3', lead_id: 'l2', user_id: 'me', type: 'created', description: 'Lead submitted via website form', metadata: {}, created_at: h(8) }],
    l3: [
        { id: 'a4', lead_id: 'l3', user_id: 'me', type: 'created', description: 'Met at MAS career fair booth', metadata: {}, created_at: h(48) },
        { id: 'a5', lead_id: 'l3', user_id: 'me', type: 'call', description: 'Intro call — discussed ILP options, interested in growth funds', metadata: {}, created_at: h(24) },
        { id: 'a6', lead_id: 'l3', user_id: 'me', type: 'status_change', description: null, metadata: { from_status: 'new', to_status: 'contacted' }, created_at: h(24) },
    ],
    l5: [
        { id: 'a10', lead_id: 'l5', user_id: 'me', type: 'created', description: 'Referral from Rachel\'s colleague', metadata: {}, created_at: h(120) },
        { id: 'a11', lead_id: 'l5', user_id: 'me', type: 'call', description: 'Detailed needs analysis — high net worth, diversified portfolio', metadata: {}, created_at: h(72) },
        { id: 'a12', lead_id: 'l5', user_id: 'me', type: 'status_change', description: null, metadata: { from_status: 'contacted', to_status: 'qualified' }, created_at: h(48) },
    ],
    l7: [
        { id: 'a17', lead_id: 'l7', user_id: 'me', type: 'created', description: 'Referral from Jessica\'s husband', metadata: {}, created_at: h(360) },
        { id: 'a18', lead_id: 'l7', user_id: 'me', type: 'status_change', description: null, metadata: { from_status: 'proposed', to_status: 'won' }, created_at: h(96) },
    ],
    l8: [
        { id: 'a20', lead_id: 'l8', user_id: 'me', type: 'created', description: 'Cold call lead', metadata: {}, created_at: h(480) },
        { id: 'a21', lead_id: 'l8', user_id: 'me', type: 'status_change', description: null, metadata: { from_status: 'proposed', to_status: 'lost' }, created_at: h(120) },
    ],
};

// Export for detail screen (mock mode only)
export { MOCK_ACTIVITIES, MOCK_LEADS };

const FILTER_TABS: { key: LeadStatus | 'all'; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'new', label: 'New' },
    { key: 'contacted', label: 'Contacted' },
    { key: 'qualified', label: 'Qualified' },
    { key: 'proposed', label: 'Proposed' },
    { key: 'won', label: 'Won' },
    { key: 'lost', label: 'Lost' },
];

const AGENT_NAME_MAP: Record<string, string> = {
    'me': 'You',
    'agent-alice': 'Alice Tan',
    'agent-bob': 'Bob Lee',
    'agent-charlie': 'Charlie Lim',
};

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
                subtitle={`${leads.length} total · ${counts.new || 0} new`}
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
                                style={[styles.errorBanner, { backgroundColor: '#FEE2E2' }]}
                                onPress={loadLeads}
                            >
                                <Ionicons name="alert-circle" size={16} color="#DC2626" />
                                <Text style={styles.errorText}>{error}</Text>
                                <Text style={styles.retryText}>Tap to retry</Text>
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
                    const mockActs = MOCK_OTP ? (MOCK_ACTIVITIES[item.id] || []) : [];
                    const lastAct = mockActs.length > 0
                        ? mockActs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
                        : null;
                    const agentLabel = isManagerView && item.assigned_to !== 'me' && MOCK_OTP
                        ? AGENT_NAME_MAP[item.assigned_to] || item.assigned_to
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
    errorText: { flex: 1, fontSize: 13, color: '#DC2626' },
    retryText: { fontSize: 12, fontWeight: '600', color: '#DC2626' },
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
