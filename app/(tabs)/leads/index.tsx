import LeadCard from '@/components/LeadCard';
import { useTheme } from '@/contexts/ThemeContext';
import type { Lead, LeadActivity, LeadStatus } from '@/types/lead';
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

// ── Mock data ──────────────────────────────────────────────
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
];

const MOCK_ACTIVITIES: Record<string, LeadActivity[]> = {
    l1: [
        { id: 'a1', lead_id: 'l1', user_id: 'me', type: 'created', description: 'Lead created from referral', metadata: {}, created_at: h(2) },
        { id: 'a2', lead_id: 'l1', user_id: 'me', type: 'note', description: 'Referred by James Lim — interested in whole life coverage for newborn', metadata: {}, created_at: h(0.5) },
    ],
    l2: [
        { id: 'a3', lead_id: 'l2', user_id: 'me', type: 'created', description: 'Lead submitted via website form', metadata: {}, created_at: h(8) },
    ],
    l3: [
        { id: 'a4', lead_id: 'l3', user_id: 'me', type: 'created', description: 'Met at MAS career fair booth', metadata: {}, created_at: h(48) },
        { id: 'a5', lead_id: 'l3', user_id: 'me', type: 'call', description: 'Intro call — discussed ILP options, interested in growth funds', metadata: {}, created_at: h(24) },
        { id: 'a6', lead_id: 'l3', user_id: 'me', type: 'status_change', description: null, metadata: { from_status: 'new', to_status: 'contacted' }, created_at: h(24) },
    ],
    l4: [
        { id: 'a7', lead_id: 'l4', user_id: 'me', type: 'created', description: 'Cold call — picked up, willing to chat', metadata: {}, created_at: h(72) },
        { id: 'a8', lead_id: 'l4', user_id: 'me', type: 'status_change', description: null, metadata: { from_status: 'new', to_status: 'contacted' }, created_at: h(48) },
        { id: 'a9', lead_id: 'l4', user_id: 'me', type: 'note', description: 'Has existing policy with AIA, reviewing options', metadata: {}, created_at: h(12) },
    ],
    l5: [
        { id: 'a10', lead_id: 'l5', user_id: 'me', type: 'created', description: 'Referral from Rachel\'s colleague', metadata: {}, created_at: h(120) },
        { id: 'a11', lead_id: 'l5', user_id: 'me', type: 'call', description: 'Detailed needs analysis — high net worth, diversified portfolio', metadata: {}, created_at: h(72) },
        { id: 'a12', lead_id: 'l5', user_id: 'me', type: 'status_change', description: null, metadata: { from_status: 'contacted', to_status: 'qualified' }, created_at: h(48) },
        { id: 'a13', lead_id: 'l5', user_id: 'me', type: 'meeting', description: 'In-person meeting at Starbucks Raffles Place — presented portfolio review', metadata: {}, created_at: h(24) },
    ],
    l6: [
        { id: 'a14', lead_id: 'l6', user_id: 'me', type: 'created', description: 'Walk-in at roadshow', metadata: {}, created_at: h(240) },
        { id: 'a15', lead_id: 'l6', user_id: 'me', type: 'status_change', description: null, metadata: { from_status: 'qualified', to_status: 'proposed' }, created_at: h(96) },
        { id: 'a16', lead_id: 'l6', user_id: 'me', type: 'email', description: 'Sent Integrated Shield Plan comparison (PRUShield vs AIA HealthShield)', metadata: {}, created_at: h(48) },
    ],
    l7: [
        { id: 'a17', lead_id: 'l7', user_id: 'me', type: 'created', description: 'Referral from Jessica\'s husband', metadata: {}, created_at: h(360) },
        { id: 'a18', lead_id: 'l7', user_id: 'me', type: 'status_change', description: null, metadata: { from_status: 'proposed', to_status: 'won' }, created_at: h(96) },
        { id: 'a19', lead_id: 'l7', user_id: 'me', type: 'note', description: 'Signed whole life policy — $200k sum assured, annual premium $4,800', metadata: {}, created_at: h(72) },
    ],
    l8: [
        { id: 'a20', lead_id: 'l8', user_id: 'me', type: 'created', description: 'Cold call lead', metadata: {}, created_at: h(480) },
        { id: 'a21', lead_id: 'l8', user_id: 'me', type: 'status_change', description: null, metadata: { from_status: 'proposed', to_status: 'lost' }, created_at: h(120) },
        { id: 'a22', lead_id: 'l8', user_id: 'me', type: 'note', description: 'Went with competitor — AIA offered lower premium', metadata: {}, created_at: h(96) },
    ],
};

// Export for detail screen
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

export default function LeadsListScreen() {
    const { colors } = useTheme();
    const router = useRouter();

    const [search, setSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState<LeadStatus | 'all'>('all');
    const [refreshing, setRefreshing] = useState(false);

    const filteredLeads = MOCK_LEADS.filter((lead) => {
        // Search
        if (search.trim()) {
            const q = search.toLowerCase();
            const matchesName = lead.full_name.toLowerCase().includes(q);
            const matchesPhone = lead.phone?.includes(q);
            if (!matchesName && !matchesPhone) return false;
        }
        // Filter
        if (activeFilter !== 'all' && lead.status !== activeFilter) return false;
        return true;
    }).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    const counts: Record<string, number> = { all: MOCK_LEADS.length };
    MOCK_LEADS.forEach((l) => { counts[l.status] = (counts[l.status] || 0) + 1; });

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        setTimeout(() => setRefreshing(false), 800);
    }, []);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerRow}>
                    <View>
                        <Text style={[styles.title, { color: colors.textPrimary }]}>Leads</Text>
                        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                            {MOCK_LEADS.length} total · {counts.new || 0} new
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.addButton, { backgroundColor: colors.accent }]}
                        onPress={() => router.push('/leads/add')}
                        accessibilityLabel="Add new lead"
                    >
                        <Ionicons name="add" size={20} color="#FFFFFF" />
                        <Text style={styles.addButtonText}>Add</Text>
                    </TouchableOpacity>
                </View>

                {/* Search */}
                <View style={[styles.searchBar, { backgroundColor: colors.surfacePrimary, borderColor: colors.borderLight }]}>
                    <Ionicons name="search" size={18} color={colors.textTertiary} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.textPrimary }]}
                        placeholder="Search by name or phone..."
                        placeholderTextColor={colors.textTertiary}
                        value={search}
                        onChangeText={setSearch}
                        returnKeyType="search"
                        clearButtonMode="while-editing"
                    />
                </View>

                {/* Filter Chips */}
                <FlatList
                    data={FILTER_TABS}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(item) => item.key}
                    contentContainerStyle={styles.filterRow}
                    renderItem={({ item }) => {
                        const isActive = activeFilter === item.key;
                        const count = counts[item.key] || 0;
                        return (
                            <TouchableOpacity
                                style={[
                                    styles.filterChip,
                                    {
                                        backgroundColor: isActive ? colors.accent : colors.surfacePrimary,
                                        borderColor: isActive ? colors.accent : colors.borderLight,
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
                renderItem={({ item }) => {
                    const activities = MOCK_ACTIVITIES[item.id] || [];
                    const lastAct = activities.length > 0
                        ? activities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
                        : null;
                    return (
                        <LeadCard
                            lead={item}
                            onPress={() => router.push(`/leads/${item.id}`)}
                            lastActivity={lastAct?.description ? lastAct.description.substring(0, 40) : undefined}
                        />
                    );
                }}
                ListEmptyComponent={() => (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="search-outline" size={48} color={colors.textTertiary} />
                        <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>No leads found</Text>
                        <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>
                            {search ? 'Try a different search term' : 'Tap + Add to create your first lead'}
                        </Text>
                    </View>
                )}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 4,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
    subtitle: { fontSize: 13, marginTop: 2 },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 10,
    },
    addButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: 10,
        borderWidth: 0.5,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        padding: 0,
    },
    filterRow: {
        gap: 6,
        paddingBottom: 8,
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 8,
        borderWidth: 0.5,
    },
    filterChipText: { fontSize: 13, fontWeight: '600' },
    filterChipCount: { fontSize: 11, fontWeight: '500' },
    listContent: {
        padding: 16,
        paddingTop: 8,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        gap: 8,
    },
    emptyTitle: { fontSize: 16, fontWeight: '600' },
    emptySubtext: { fontSize: 13, textAlign: 'center', maxWidth: 260 },
});
