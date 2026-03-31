import EmptyState from '@/components/EmptyState';
import ErrorBanner from '@/components/ErrorBanner';
import LoadingState from '@/components/LoadingState';
import ScreenHeader from '@/components/ScreenHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { fetchTeamMembers, type TeamMember } from '@/lib/team';
import { canInviteMembers } from '@/lib/invitations';
import { useFilteredList } from '@/hooks/useFilteredList';
import { letterSpacing } from '@/constants/platform';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useTypedRouter } from '@/hooks/useTypedRouter';
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const TEAM_SEARCH_FIELDS: (keyof TeamMember)[] = ['name', 'phone', 'email'];
const AVATAR_COLOR_KEYS = ['statusProposed', 'accent', 'danger', 'warning', 'statusProposed', 'info'] as const;

type FilterKey = 'all' | 'manager' | 'agent';

export default function TeamScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const router = useTypedRouter();
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState<FilterKey>('all');
    const [search, setSearch] = useState('');
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const canFilter = user?.role === 'director' || user?.role === 'admin' || user?.role === 'manager';

    const loadMembers = useCallback(async () => {
        if (!user?.id) return;
        setError(null);
        try {
            const { data, error: fetchError } = await fetchTeamMembers(user.id, user.role || 'agent');
            if (fetchError) {
                setError(fetchError);
            } else {
                setMembers(data);
            }
        } catch {
            setError('Failed to load team members');
        } finally {
            setIsLoading(false);
        }
    }, [user?.id, user?.role]);

    useFocusEffect(
        useCallback(() => {
            loadMembers();
        }, [loadMembers]),
    );

    const { filtered: filteredMembers, counts: baseCounts } = useFilteredList(
        members,
        search,
        filter,
        'role',
        TEAM_SEARCH_FIELDS,
    );

    const { counts, totalLeads, totalWon, avgConversion } = useMemo(() => {
        const c: Record<string, number> = {
            ...baseCounts,
            active: members.filter((m) => m.isActive).length,
        };
        const tl = members.reduce((sum, m) => sum + m.leadsCount, 0);
        const tw = members.reduce((sum, m) => sum + m.wonCount, 0);
        return { counts: c, totalLeads: tl, totalWon: tw, avgConversion: tl > 0 ? Math.round((tw / tl) * 100) : 0 };
    }, [members, baseCounts]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadMembers();
        setRefreshing(false);
    }, [loadMembers]);

    const filters: { key: FilterKey; label: string }[] = canFilter
        ? [
              { key: 'all', label: 'All' },
              { key: 'manager', label: 'Managers' },
              { key: 'agent', label: 'Agents' },
          ]
        : [{ key: 'all', label: 'All' }];

    const getAvatarColor = useCallback(
        (name: string) => {
            const index = name.charCodeAt(0) % AVATAR_COLOR_KEYS.length;
            return colors[AVATAR_COLOR_KEYS[index]];
        },
        [colors],
    );

    const renderMember = useCallback(
        ({ item }: { item: TeamMember }) => {
            const avatarColor = getAvatarColor(item.name);
            const isManager = item.role === 'manager';

            return (
                <TouchableOpacity
                    style={[styles.card, { backgroundColor: colors.cardBackground, shadowColor: colors.textPrimary }]}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`View ${item.name}'s profile`}
                    onPress={() => router.push(`/(tabs)/team/agent/${item.id}`)}
                >
                    {/* Top Row: Avatar + Info + Status */}
                    <View style={styles.cardTop}>
                        <View style={[styles.avatar, { backgroundColor: avatarColor + '18' }]}>
                            <Text style={[styles.avatarText, { color: avatarColor }]}>
                                {item.name
                                    .split(' ')
                                    .map((n) => n[0])
                                    .join('')}
                            </Text>
                        </View>

                        <View style={styles.cardInfo}>
                            <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                                {item.name}
                            </Text>
                            <View style={styles.metaRow}>
                                <View
                                    style={[
                                        styles.roleBadge,
                                        {
                                            backgroundColor: isManager
                                                ? colors.statusProposed + '18'
                                                : colors.accentLight,
                                        },
                                    ]}
                                >
                                    <View
                                        style={[
                                            styles.roleDot,
                                            { backgroundColor: isManager ? colors.statusProposed : colors.accent },
                                        ]}
                                    />
                                    <Text
                                        style={[
                                            styles.roleText,
                                            { color: isManager ? colors.statusProposed : colors.accent },
                                        ]}
                                    >
                                        {isManager ? 'Manager' : 'Agent'}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        <View
                            style={[
                                styles.statusPill,
                                { backgroundColor: item.isActive ? colors.successLight : colors.surfaceSecondary },
                            ]}
                        >
                            <View
                                style={[
                                    styles.statusDot,
                                    { backgroundColor: item.isActive ? colors.success : colors.textTertiary },
                                ]}
                            />
                            <Text
                                style={[
                                    styles.statusText,
                                    { color: item.isActive ? colors.success : colors.textTertiary },
                                ]}
                            >
                                {item.isActive ? 'Active' : 'Inactive'}
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
                            <Text
                                style={[
                                    styles.statValue,
                                    { color: item.conversionRate >= 30 ? colors.success : colors.textPrimary },
                                ]}
                            >
                                {item.conversionRate}%
                            </Text>
                            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Conv.</Text>
                        </View>
                    </View>
                </TouchableOpacity>
            );
        },
        [colors, router, getAvatarColor],
    );

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <ScreenHeader title="Team" />
                <LoadingState />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <ScreenHeader
                title="Team"
                rightAction={
                    canInviteMembers((user?.role ?? 'agent') as import('@/types/shared/roles').UserRole) ? (
                        <TouchableOpacity
                            onPress={() => router.push('/(tabs)/team/invite-member')}
                            hitSlop={8}
                            testID="team-invite-button"
                        >
                            <Ionicons name="person-add-outline" size={22} color={colors.accent} />
                        </TouchableOpacity>
                    ) : undefined
                }
            />

            {/* Pinned Search + Filters */}
            <View style={styles.stickyHeader}>
                {/* Search Bar */}
                <View
                    style={[styles.searchBar, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                >
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
                        <TouchableOpacity
                            onPress={() => setSearch('')}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
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
                                    accessibilityRole="button"
                                    accessibilityLabel={`Filter by ${f.label}`}
                                    accessibilityState={{ selected: isActive }}
                                >
                                    <Text
                                        style={[
                                            styles.filterText,
                                            { color: isActive ? colors.textInverse : colors.textSecondary },
                                        ]}
                                    >
                                        {f.label}
                                    </Text>
                                    <Text
                                        style={[
                                            styles.filterCount,
                                            {
                                                color: isActive ? colors.textInverse : colors.textTertiary,
                                                opacity: isActive ? 0.8 : 1,
                                            },
                                        ]}
                                    >
                                        {count}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}
            </View>

            {/* Error Banner */}
            {error && (
                <View style={{ paddingHorizontal: 16 }}>
                    <ErrorBanner message={error} onRetry={loadMembers} />
                </View>
            )}

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
                                <Text style={[styles.heroValue, { color: colors.textInverse }]}>{counts.all}</Text>
                                <Text style={[styles.heroLabel, { color: colors.textInverse, opacity: 0.8 }]}>
                                    Members
                                </Text>
                            </View>
                            <View
                                style={[
                                    styles.heroCard,
                                    { backgroundColor: colors.cardBackground, shadowColor: colors.textPrimary },
                                ]}
                            >
                                <Text style={[styles.heroValue, { color: colors.textPrimary }]}>{totalLeads}</Text>
                                <Text style={[styles.heroLabel, { color: colors.textTertiary }]}>Total Leads</Text>
                            </View>
                            <View
                                style={[
                                    styles.heroCard,
                                    { backgroundColor: colors.cardBackground, shadowColor: colors.textPrimary },
                                ]}
                            >
                                <Text style={[styles.heroValue, { color: colors.success }]}>{avgConversion}%</Text>
                                <Text style={[styles.heroLabel, { color: colors.textTertiary }]}>Avg Conv.</Text>
                            </View>
                        </View>

                        {/* Section Label */}
                        <View style={styles.sectionRow}>
                            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                                {filteredMembers.length} member{filteredMembers.length !== 1 ? 's' : ''}
                            </Text>
                        </View>
                    </View>
                }
                ListEmptyComponent={
                    <EmptyState
                        icon="people-outline"
                        title="No members found"
                        subtitle={search.trim() ? `No results for "${search}"` : 'Try a different filter'}
                    />
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    listContent: { paddingHorizontal: 16, paddingBottom: 32, flexGrow: 1 },
    stickyHeader: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 4,
    },

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
        letterSpacing: letterSpacing(-0.3),
    },
    heroLabel: {
        fontSize: 11,
        fontWeight: '600',
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
        letterSpacing: letterSpacing(-0.2),
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
});
