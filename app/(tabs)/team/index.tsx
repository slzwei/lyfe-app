import ScreenHeader from '@/components/ScreenHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
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

// ── Types ──
interface TeamMember {
    id: string;
    name: string;
    role: 'manager' | 'agent';
    phone: string;
    email: string | null;
    leadsCount: number;
    wonCount: number;
    conversionRate: number;
    status: 'active' | 'inactive';
    joinedDate: string;
}

// ── Mock Data ──
const MOCK_AGENTS: TeamMember[] = [
    { id: 'a1', name: 'Alice Tan', role: 'agent', phone: '+65 9111 2222', email: 'alice.tan@lyfe.sg', leadsCount: 12, wonCount: 4, conversionRate: 33, status: 'active', joinedDate: '2024-09-15' },
    { id: 'a2', name: 'Bob Lee', role: 'agent', phone: '+65 8222 3333', email: 'bob.lee@lyfe.sg', leadsCount: 8, wonCount: 2, conversionRate: 25, status: 'active', joinedDate: '2024-11-01' },
    { id: 'a3', name: 'Charlie Lim', role: 'agent', phone: '+65 9333 4444', email: null, leadsCount: 5, wonCount: 1, conversionRate: 20, status: 'active', joinedDate: '2025-01-10' },
    { id: 'a4', name: 'Diana Ng', role: 'agent', phone: '+65 8444 5555', email: 'diana.ng@lyfe.sg', leadsCount: 3, wonCount: 0, conversionRate: 0, status: 'inactive', joinedDate: '2024-08-20' },
];

const MOCK_MANAGERS: TeamMember[] = [
    { id: 'm1', name: 'Emily Koh', role: 'manager', phone: '+65 9555 6666', email: 'emily.koh@lyfe.sg', leadsCount: 24, wonCount: 8, conversionRate: 33, status: 'active', joinedDate: '2024-03-01' },
    { id: 'm2', name: 'Frank Goh', role: 'manager', phone: '+65 8666 7777', email: 'frank.goh@lyfe.sg', leadsCount: 18, wonCount: 5, conversionRate: 28, status: 'active', joinedDate: '2024-06-15' },
];

const AVATAR_COLORS = ['#6366F1', '#0D9488', '#E11D48', '#F59E0B', '#8B5CF6', '#06B6D4'];

type FilterKey = 'all' | 'manager' | 'agent';

export default function TeamScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const router = useRouter();
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState<FilterKey>('all');
    const [search, setSearch] = useState('');

    const isDirector = user?.role === 'director';

    const allMembers = useMemo(() => {
        return isDirector
            ? [...MOCK_MANAGERS, ...MOCK_AGENTS]
            : [...MOCK_AGENTS];
    }, [isDirector]);

    const filteredMembers = useMemo(() => {
        let members = allMembers;
        if (filter !== 'all') {
            members = members.filter((m) => m.role === filter);
        }
        if (search.trim()) {
            const q = search.toLowerCase();
            members = members.filter((m) =>
                m.name.toLowerCase().includes(q) ||
                m.phone.includes(q) ||
                m.email?.toLowerCase().includes(q)
            );
        }
        return members;
    }, [allMembers, filter, search]);

    const counts = useMemo(() => ({
        all: allMembers.length,
        manager: allMembers.filter((m) => m.role === 'manager').length,
        agent: allMembers.filter((m) => m.role === 'agent').length,
        active: allMembers.filter((m) => m.status === 'active').length,
    }), [allMembers]);

    const totalLeads = useMemo(() => allMembers.reduce((sum, m) => sum + m.leadsCount, 0), [allMembers]);
    const totalWon = useMemo(() => allMembers.reduce((sum, m) => sum + m.wonCount, 0), [allMembers]);
    const avgConversion = allMembers.length > 0 ? Math.round(totalWon / totalLeads * 100) : 0;

    const onRefresh = () => {
        setRefreshing(true);
        setTimeout(() => setRefreshing(false), 800);
    };

    const filters: { key: FilterKey; label: string }[] = isDirector
        ? [{ key: 'all', label: 'All' }, { key: 'manager', label: 'Managers' }, { key: 'agent', label: 'Agents' }]
        : [{ key: 'all', label: 'All' }];

    const getAvatarColor = (name: string) => {
        const index = name.charCodeAt(0) % AVATAR_COLORS.length;
        return AVATAR_COLORS[index];
    };

    const renderMember = ({ item }: { item: TeamMember }) => {
        const avatarColor = getAvatarColor(item.name);
        const isManager = item.role === 'manager';

        return (
            <TouchableOpacity
                style={[styles.card, { backgroundColor: colors.cardBackground, shadowColor: colors.textPrimary }]}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`View ${item.name}'s profile`}
                onPress={() => router.push(`/(tabs)/team/agent/${item.id}` as any)}
            >
                {/* Top Row: Avatar + Info + Status */}
                <View style={styles.cardTop}>
                    <View style={[styles.avatar, { backgroundColor: avatarColor + '18' }]}>
                        <Text style={[styles.avatarText, { color: avatarColor }]}>
                            {item.name.split(' ').map(n => n[0]).join('')}
                        </Text>
                    </View>

                    <View style={styles.cardInfo}>
                        <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                            {item.name}
                        </Text>
                        <View style={styles.metaRow}>
                            <View style={[
                                styles.roleBadge,
                                { backgroundColor: isManager ? '#6366F118' : colors.accentLight }
                            ]}>
                                <View style={[
                                    styles.roleDot,
                                    { backgroundColor: isManager ? '#6366F1' : colors.accent }
                                ]} />
                                <Text style={[
                                    styles.roleText,
                                    { color: isManager ? '#6366F1' : colors.accent }
                                ]}>
                                    {isManager ? 'Manager' : 'Agent'}
                                </Text>
                            </View>
                        </View>
                    </View>

                    <View style={[
                        styles.statusPill,
                        { backgroundColor: item.status === 'active' ? colors.successLight : colors.surfaceSecondary }
                    ]}>
                        <View style={[
                            styles.statusDot,
                            { backgroundColor: item.status === 'active' ? colors.success : colors.textTertiary }
                        ]} />
                        <Text style={[
                            styles.statusText,
                            { color: item.status === 'active' ? colors.success : colors.textTertiary }
                        ]}>
                            {item.status === 'active' ? 'Active' : 'Inactive'}
                        </Text>
                    </View>
                </View>

                {/* Stats Row */}
                <View style={[styles.statsRow, { borderTopColor: colors.border }]}>
                    <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: colors.textPrimary }]}>{item.leadsCount}</Text>
                        <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Leads</Text>
                    </View>
                    <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: colors.textPrimary }]}>{item.wonCount}</Text>
                        <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Won</Text>
                    </View>
                    <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: item.conversionRate >= 30 ? colors.success : colors.textPrimary }]}>
                            {item.conversionRate}%
                        </Text>
                        <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Conv.</Text>
                    </View>
                </View>
            </TouchableOpacity >
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScreenHeader title="Team" />

            <FlatList
                data={filteredMembers}
                renderItem={renderMember}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
                }
                ListHeaderComponent={
                    <View>
                        {/* Hero Stats */}
                        <View style={styles.heroRow}>
                            <View style={[styles.heroCard, { backgroundColor: colors.accent }]}>
                                <Text style={styles.heroValue}>{counts.all}</Text>
                                <Text style={styles.heroLabel}>Members</Text>
                            </View>
                            <View style={[styles.heroCard, { backgroundColor: colors.cardBackground, shadowColor: colors.textPrimary }]}>
                                <Text style={[styles.heroValue, { color: colors.textPrimary }]}>{totalLeads}</Text>
                                <Text style={[styles.heroLabel, { color: colors.textTertiary }]}>Total Leads</Text>
                            </View>
                            <View style={[styles.heroCard, { backgroundColor: colors.cardBackground, shadowColor: colors.textPrimary }]}>
                                <Text style={[styles.heroValue, { color: colors.success }]}>{avgConversion}%</Text>
                                <Text style={[styles.heroLabel, { color: colors.textTertiary }]}>Avg Conv.</Text>
                            </View>
                        </View>

                        {/* Search Bar */}
                        <View style={[styles.searchBar, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                            <Ionicons name="search" size={18} color={colors.textTertiary} />
                            <TextInput
                                style={[styles.searchInput, { color: colors.textPrimary }]}
                                placeholder="Search team members..."
                                placeholderTextColor={colors.textTertiary}
                                value={search}
                                onChangeText={setSearch}
                                returnKeyType="search"
                            />
                            {search.length > 0 && (
                                <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                    <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Filter Chips */}
                        {filters.length > 1 && (
                            <View style={styles.filterRow}>
                                {filters.map((f) => {
                                    const isActive = filter === f.key;
                                    const count = counts[f.key] || 0;
                                    return (
                                        <TouchableOpacity
                                            key={f.key}
                                            style={[
                                                styles.filterChip,
                                                {
                                                    backgroundColor: isActive ? colors.accent : colors.cardBackground,
                                                    borderColor: isActive ? colors.accent : colors.border,
                                                },
                                            ]}
                                            onPress={() => setFilter(f.key)}
                                        >
                                            <Text style={[styles.filterText, { color: isActive ? '#FFF' : colors.textSecondary }]}>
                                                {f.label}
                                            </Text>
                                            <Text style={[styles.filterCount, { color: isActive ? 'rgba(255,255,255,0.8)' : colors.textTertiary }]}>
                                                {count}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}

                        {/* Section Label */}
                        <View style={styles.sectionRow}>
                            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                                {filteredMembers.length} member{filteredMembers.length !== 1 ? 's' : ''}
                            </Text>
                        </View>
                    </View>
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
                        <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>No members found</Text>
                        <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
                            {search.trim() ? `No results for "${search}"` : 'Try a different filter'}
                        </Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    listContent: { paddingHorizontal: 16, paddingBottom: 32 },

    // ── Hero Stats ──
    heroRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 8,
        marginBottom: 16,
    },
    heroCard: {
        flex: 1,
        borderRadius: 14,
        paddingVertical: 16,
        paddingHorizontal: 12,
        alignItems: 'center',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    heroValue: {
        fontSize: 22,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: -0.3,
    },
    heroLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.8)',
        marginTop: 2,
        letterSpacing: 0.2,
    },

    // ── Search ──
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
        fontSize: 15,
        padding: 0,
    },

    // ── Filters ──
    filterRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        borderWidth: 1,
    },
    filterText: { fontSize: 13, fontWeight: '600' },
    filterCount: { fontSize: 12 },

    // ── Section ──
    sectionRow: {
        marginBottom: 8,
    },
    sectionLabel: {
        fontSize: 13,
        fontWeight: '600',
    },

    // ── Card ──
    card: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 2,
    },
    cardTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        fontSize: 16,
        fontWeight: '700',
    },
    cardInfo: {
        flex: 1,
        gap: 4,
    },
    name: {
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: -0.2,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    roleBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    roleDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    roleText: {
        fontSize: 11,
        fontWeight: '700',
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '600',
    },

    // ── Stats Row ──
    statsRow: {
        flexDirection: 'row',
        marginTop: 14,
        paddingTop: 14,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 17,
        fontWeight: '800',
    },
    statLabel: {
        fontSize: 11,
        fontWeight: '500',
        marginTop: 2,
    },
    statDivider: {
        width: StyleSheet.hairlineWidth,
        height: '100%',
    },

    // ── Empty ──
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 64,
        gap: 8,
    },
    emptyTitle: { fontSize: 16, fontWeight: '600' },
    emptySubtitle: { fontSize: 14 },
});
