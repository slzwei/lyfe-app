import { CandidateList } from '@/components/CandidateListScreen';
import EmptyState from '@/components/EmptyState';
import ErrorBanner from '@/components/ErrorBanner';
import LoadingState from '@/components/LoadingState';
import ScreenHeader from '@/components/ScreenHeader';
import { canCreateCandidates } from '@/constants/Roles';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { fetchTeamMembers, type TeamMember } from '@/lib/team';
import { canInviteMembers, fetchMyInvitations, revokeInvitation, type MemberInvitation } from '@/lib/invitations';
import { useFilteredList } from '@/hooks/useFilteredList';
import { letterSpacing } from '@/constants/platform';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useTypedRouter } from '@/hooks/useTypedRouter';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { UserRole } from '@/types/shared/roles';

const TEAM_SEARCH_FIELDS: (keyof TeamMember)[] = ['name', 'phone', 'email'];
const AVATAR_COLOR_KEYS = ['statusProposed', 'accent', 'danger', 'warning', 'statusProposed', 'info'] as const;

type FilterKey = 'all' | 'manager' | 'agent' | 'pending';

const ROLE_LABELS: Record<string, string> = {
    admin: 'Admin',
    director: 'Director',
    manager: 'Manager',
    agent: 'Agent',
    pa: 'PA',
    candidate: 'Candidate',
};

export default function TeamScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const router = useTypedRouter();
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState<FilterKey>('all');
    const [search, setSearch] = useState('');
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [invitations, setInvitations] = useState<MemberInvitation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [teamView, setTeamView] = useState<'members' | 'candidates'>('members');

    const canFilter = user?.role === 'director' || user?.role === 'admin' || user?.role === 'manager';
    const showInviteTab = canInviteMembers((user?.role ?? 'agent') as import('@/types/shared/roles').UserRole);

    const loadMembers = useCallback(async () => {
        if (!user?.id) return;
        setError(null);
        try {
            const [teamResult, invResult] = await Promise.all([
                fetchTeamMembers(user.id, user.role || 'agent'),
                showInviteTab ? fetchMyInvitations() : Promise.resolve({ data: [], error: null }),
            ]);
            if (teamResult.error) {
                setError(teamResult.error);
            } else {
                setMembers(teamResult.data);
            }
            setInvitations(invResult.data.filter((i) => i.status === 'pending'));
        } catch {
            setError('Failed to load team members');
        } finally {
            setIsLoading(false);
        }
    }, [user?.id, user?.role, showInviteTab]);

    useFocusEffect(
        useCallback(() => {
            loadMembers();
        }, [loadMembers]),
    );

    const handleRevoke = useCallback((inv: MemberInvitation) => {
        Alert.alert('Revoke Invitation', `Remove the pending invitation for ${inv.full_name}?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Revoke',
                style: 'destructive',
                onPress: async () => {
                    const { error: revokeErr } = await revokeInvitation(inv.id);
                    if (revokeErr) {
                        Alert.alert('Error', revokeErr);
                    } else {
                        setInvitations((prev) => prev.filter((i) => i.id !== inv.id));
                    }
                },
            },
        ]);
    }, []);

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
              ...(showInviteTab ? [{ key: 'pending' as const, label: 'Pending' }] : []),
          ]
        : showInviteTab
          ? [
                { key: 'all' as const, label: 'All' },
                { key: 'pending' as const, label: 'Pending' },
            ]
          : [{ key: 'all' as const, label: 'All' }];

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

    const canRevoke = useCallback(
        (inv: MemberInvitation) =>
            user?.role === 'admin' ||
            inv.invited_by_id === user?.id ||
            (['manager', 'director'].includes(user?.role ?? '') && inv.assigned_manager_id === user?.id),
        [user?.id, user?.role],
    );

    const renderInvitation = useCallback(
        ({ item }: { item: MemberInvitation }) => {
            const avatarColor = getAvatarColor(item.full_name);
            const daysLeft = Math.max(0, Math.ceil((new Date(item.expires_at).getTime() - Date.now()) / 86400000));
            const showRevoke = canRevoke(item);
            const inviterName = item.inviter?.full_name;
            const managerName = item.manager?.full_name;
            const isInviterSameAsManager = item.invited_by_id === item.assigned_manager_id;

            return (
                <View
                    style={[
                        styles.card,
                        styles.pendingCard,
                        { backgroundColor: colors.cardBackground, borderColor: colors.border },
                    ]}
                >
                    <View style={styles.cardTop}>
                        <View style={[styles.avatar, { backgroundColor: avatarColor + '18' }]}>
                            <Text style={[styles.avatarText, { color: avatarColor }]}>
                                {item.full_name
                                    .split(' ')
                                    .map((n) => n[0])
                                    .join('')}
                            </Text>
                        </View>

                        <View style={styles.cardInfo}>
                            <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                                {item.full_name}
                            </Text>
                            <View style={styles.metaRow}>
                                <View style={[styles.roleBadge, { backgroundColor: colors.warning + '18' }]}>
                                    <View style={[styles.roleDot, { backgroundColor: colors.warning }]} />
                                    <Text style={[styles.roleText, { color: colors.warning }]}>
                                        {ROLE_LABELS[item.intended_role] ?? item.intended_role}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        <View style={[styles.statusPill, { backgroundColor: colors.warning + '18' }]}>
                            <View style={[styles.statusDot, { backgroundColor: colors.warning }]} />
                            <Text style={[styles.statusText, { color: colors.warning }]}>Pending</Text>
                        </View>
                    </View>

                    {(inviterName || managerName) && (
                        <View style={[styles.inviteMeta, { borderTopColor: colors.border }]}>
                            {inviterName && (
                                <View style={styles.inviteMetaItem}>
                                    <Ionicons name="person-outline" size={13} color={colors.textTertiary} />
                                    <Text style={[styles.inviteMetaLabel, { color: colors.textTertiary }]}>
                                        Invited by
                                    </Text>
                                    <Text
                                        style={[styles.inviteMetaValue, { color: colors.textSecondary }]}
                                        numberOfLines={1}
                                    >
                                        {inviterName}
                                    </Text>
                                </View>
                            )}
                            {managerName && !isInviterSameAsManager && (
                                <View style={styles.inviteMetaItem}>
                                    <Ionicons name="shield-outline" size={13} color={colors.textTertiary} />
                                    <Text style={[styles.inviteMetaLabel, { color: colors.textTertiary }]}>
                                        Assigned to
                                    </Text>
                                    <Text
                                        style={[styles.inviteMetaValue, { color: colors.textSecondary }]}
                                        numberOfLines={1}
                                    >
                                        {managerName}
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}

                    <View style={[styles.pendingFooter, { borderTopColor: colors.border }]}>
                        <Text style={[styles.pendingMeta, { color: colors.textTertiary }]}>
                            Expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
                        </Text>
                        {showRevoke && (
                            <TouchableOpacity
                                onPress={() => handleRevoke(item)}
                                hitSlop={8}
                                style={[styles.revokeButton, { borderColor: colors.danger + '40' }]}
                            >
                                <Text style={[styles.revokeText, { color: colors.danger }]}>Revoke</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            );
        },
        [colors, getAvatarColor, handleRevoke, canRevoke],
    );

    const isPending = filter === 'pending';

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <ScreenHeader title="Team" />
                <LoadingState />
            </SafeAreaView>
        );
    }

    const role = (user?.role ?? 'agent') as UserRole;
    const headerRight =
        teamView === 'candidates' ? (
            canCreateCandidates(role) ? (
                <TouchableOpacity
                    onPress={() => router.push('/(tabs)/team/add-candidate')}
                    hitSlop={8}
                    testID="team-add-candidate-button"
                    accessibilityLabel="Add candidate"
                >
                    <Ionicons name="person-add" size={22} color={colors.accent} />
                </TouchableOpacity>
            ) : undefined
        ) : canInviteMembers(role) ? (
            <TouchableOpacity
                onPress={() => router.push('/(tabs)/team/invite-member')}
                hitSlop={8}
                testID="team-invite-button"
            >
                <Ionicons name="person-add-outline" size={22} color={colors.accent} />
            </TouchableOpacity>
        ) : undefined;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <ScreenHeader title="Team" rightAction={headerRight} />

            {/* Segment + (Members only) Search + Filters */}
            <View style={[styles.stickyHeader, teamView === 'candidates' && { paddingBottom: 0 }]}>
                <View style={styles.segmentRow}>
                    <TouchableOpacity
                        style={[
                            styles.segmentButton,
                            {
                                backgroundColor: teamView === 'members' ? colors.accent : colors.cardBackground,
                                borderColor: teamView === 'members' ? colors.accent : colors.border,
                            },
                        ]}
                        onPress={() => setTeamView('members')}
                        accessibilityRole="button"
                        accessibilityState={{ selected: teamView === 'members' }}
                        testID="team-segment-members"
                    >
                        <Text
                            style={[
                                styles.segmentText,
                                { color: teamView === 'members' ? colors.textInverse : colors.textSecondary },
                            ]}
                        >
                            Members
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.segmentButton,
                            {
                                backgroundColor: teamView === 'candidates' ? colors.accent : colors.cardBackground,
                                borderColor: teamView === 'candidates' ? colors.accent : colors.border,
                            },
                        ]}
                        onPress={() => setTeamView('candidates')}
                        accessibilityRole="button"
                        accessibilityState={{ selected: teamView === 'candidates' }}
                        testID="team-segment-candidates"
                    >
                        <Text
                            style={[
                                styles.segmentText,
                                { color: teamView === 'candidates' ? colors.textInverse : colors.textSecondary },
                            ]}
                        >
                            Candidates
                        </Text>
                    </TouchableOpacity>
                </View>

                {teamView === 'members' && (
                    <>
                        {/* Search Bar */}
                        <View
                            style={[
                                styles.searchBar,
                                { backgroundColor: colors.cardBackground, borderColor: colors.border },
                            ]}
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
                                    const count = f.key === 'pending' ? invitations.length : counts[f.key] || 0;
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
                    </>
                )}
            </View>

            {/* Error Banner (members view only — CandidateList renders its own) */}
            {error && teamView === 'members' && (
                <View style={{ paddingHorizontal: 16 }}>
                    <ErrorBanner message={error} onRetry={loadMembers} />
                </View>
            )}

            {teamView === 'candidates' ? (
                <CandidateList candidateRoute={(id) => `/(tabs)/team/candidate/${id}`} isManagerView embedded />
            ) : isPending ? (
                <FlatList
                    data={invitations}
                    renderItem={renderInvitation}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
                    }
                    ListHeaderComponent={
                        <View style={styles.sectionRow}>
                            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                                {invitations.length} pending invitation{invitations.length !== 1 ? 's' : ''}
                            </Text>
                        </View>
                    }
                    ListEmptyComponent={
                        <EmptyState
                            icon="mail-outline"
                            title="No pending invitations"
                            subtitle="Invitations you send will appear here until accepted"
                        />
                    }
                />
            ) : (
                <FlatList
                    data={filteredMembers}
                    renderItem={renderMember}
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
            )}
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

    // ── Segment control ──
    segmentRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    segmentButton: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        alignItems: 'center',
    },
    segmentText: {
        fontSize: 14,
        fontWeight: '700',
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

    // ── Pending Card ──
    pendingCard: {
        borderWidth: 1,
        borderStyle: 'dashed',
    },
    inviteMeta: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        gap: 6,
    },
    inviteMetaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    inviteMetaLabel: {
        fontSize: 12,
        fontWeight: '400',
    },
    inviteMetaValue: {
        fontSize: 12,
        fontWeight: '600',
        flexShrink: 1,
    },
    pendingFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 14,
        paddingTop: 14,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    pendingMeta: {
        fontSize: 12,
        fontWeight: '500',
    },
    revokeButton: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
    },
    revokeText: {
        fontSize: 13,
        fontWeight: '600',
    },
});
