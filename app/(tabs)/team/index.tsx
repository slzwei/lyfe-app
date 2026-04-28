import Avatar from '@/components/Avatar';
import EmptyState from '@/components/EmptyState';
import ErrorBanner from '@/components/ErrorBanner';
import LoadingState from '@/components/LoadingState';
import ScreenHeader from '@/components/ScreenHeader';
import { letterSpacing } from '@/constants/platform';
import { Fonts } from '@/constants/type';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useTypedRouter } from '@/hooks/useTypedRouter';
import { canInviteMembers, fetchMyInvitations, revokeInvitation, type MemberInvitation } from '@/lib/invitations';
import {
    buildTeamAttentionItems,
    buildTeamHealthSummary,
    getMemberSignal,
    type TeamAttentionItem,
} from '@/lib/teamAttention';
import { fetchTeamMembers, type TeamMember } from '@/lib/team';
import type { UserRole } from '@/types/shared/roles';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type FilterKey = 'all' | 'manager' | 'agent';

const TEAM_SEARCH_FIELDS: (keyof TeamMember)[] = ['name', 'phone', 'email'];
const AVATAR_COLOR_KEYS = ['accent', 'success', 'warning', 'info', 'statusProposed', 'accentMuted'] as const;

const ROLE_LABELS: Record<string, string> = {
    admin: 'Admin',
    director: 'Director',
    manager: 'Manager',
    agent: 'Agent',
    pa: 'PA',
    ro: 'RO',
};

function plural(count: number, singular: string, pluralText = `${singular}s`) {
    return `${count} ${count === 1 ? singular : pluralText}`;
}

function initials(name: string) {
    return name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase();
}

function daysLeftLabel(expiresAt: string) {
    const daysLeft = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000));
    if (daysLeft === 0) return 'Expires today';
    if (daysLeft === 1) return 'Expires tomorrow';
    return `Expires in ${daysLeft} days`;
}

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

    const role = (user?.role ?? 'agent') as UserRole;
    const showRoleFilters = role === 'director' || role === 'admin';
    const showInviteWorkflow = canInviteMembers(role);

    const loadMembers = useCallback(async () => {
        if (!user?.id) return;
        setError(null);
        try {
            const [teamResult, invResult] = await Promise.all([
                fetchTeamMembers(user.id, user.role || 'agent'),
                showInviteWorkflow ? fetchMyInvitations() : Promise.resolve({ data: [], error: null }),
            ]);
            if (teamResult.error) {
                setError(teamResult.error);
            } else {
                setMembers(teamResult.data);
            }
            if (invResult.error) {
                setError((prev) => prev ?? invResult.error);
            }
            setInvitations(
                invResult.data
                    .filter((inv) => inv.status === 'pending' && inv.intended_role !== 'candidate')
                    .sort((a, b) => new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime()),
            );
        } catch {
            setError('Failed to load team members');
        } finally {
            setIsLoading(false);
        }
    }, [user?.id, user?.role, showInviteWorkflow]);

    useFocusEffect(
        useCallback(() => {
            loadMembers();
        }, [loadMembers]),
    );

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadMembers();
        setRefreshing(false);
    }, [loadMembers]);

    const handleRevoke = useCallback((inv: MemberInvitation) => {
        Alert.alert('Revoke invitation', `Remove the pending invitation for ${inv.full_name}?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Revoke',
                style: 'destructive',
                onPress: async () => {
                    const { error: revokeErr } = await revokeInvitation(inv.id);
                    if (revokeErr) {
                        Alert.alert('Could not revoke invitation', revokeErr);
                    } else {
                        setInvitations((prev) => prev.filter((item) => item.id !== inv.id));
                    }
                },
            },
        ]);
    }, []);

    const canRevoke = useCallback(
        (inv: MemberInvitation) =>
            role === 'admin' ||
            inv.invited_by_id === user?.id ||
            (['manager', 'director'].includes(role) && inv.assigned_manager_id === user?.id),
        [role, user?.id],
    );

    const counts = useMemo(
        () => ({
            all: members.length,
            manager: members.filter((m) => m.role === 'manager').length,
            agent: members.filter((m) => m.role === 'agent').length,
        }),
        [members],
    );

    const isSearching = search.trim().length > 0;

    const filteredMembers = useMemo(() => {
        const term = search.trim().toLowerCase();
        return members.filter((member) => {
            const matchesFilter = filter === 'all' || member.role === filter;
            if (!matchesFilter) return false;
            if (!term) return true;
            return TEAM_SEARCH_FIELDS.some((field) => {
                const value = member[field];
                return typeof value === 'string' && value.toLowerCase().includes(term);
            });
        });
    }, [filter, members, search]);

    const attentionItems = useMemo(
        () =>
            buildTeamAttentionItems({
                members,
                invitations,
            }),
        [invitations, members],
    );

    const health = useMemo(
        () => buildTeamHealthSummary({ members, invitations, attentionItems }),
        [attentionItems, invitations, members],
    );

    const filters: { key: FilterKey; label: string }[] = showRoleFilters
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

    const goToAttentionItem = useCallback(
        (item: TeamAttentionItem) => {
            if (item.memberId) {
                router.push(`/(tabs)/team/agent/${item.memberId}`);
            }
        },
        [router],
    );

    const renderMember = useCallback(
        ({ item }: { item: TeamMember }) => (
            <TeamMemberCard
                member={item}
                avatarColor={getAvatarColor(item.name)}
                onPress={() =>
                    router.push(
                        item.role === 'manager' ? `/(tabs)/team/manager/${item.id}` : `/(tabs)/team/agent/${item.id}`,
                    )
                }
            />
        ),
        [getAvatarColor, router],
    );

    const headerRight = showInviteWorkflow ? (
        <TouchableOpacity
            onPress={() => router.push('/(tabs)/team/invite-member')}
            hitSlop={8}
            testID="team-invite-button"
            accessibilityRole="button"
            accessibilityLabel="Invite team member"
        >
            <Ionicons name="person-add-outline" size={22} color={colors.accent} />
        </TouchableOpacity>
    ) : undefined;

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
            <ScreenHeader title="Team" rightAction={headerRight} />

            <View style={styles.stickyHeader}>
                <View
                    style={[styles.searchBar, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                >
                    <Ionicons name="search" size={18} color={colors.textTertiary} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.textPrimary }]}
                        placeholder="Search members"
                        placeholderTextColor={colors.textTertiary}
                        value={search}
                        onChangeText={setSearch}
                        returnKeyType="search"
                        accessibilityLabel="Search members"
                    />
                    {search.length > 0 && (
                        <TouchableOpacity onPress={() => setSearch('')} hitSlop={8} accessibilityLabel="Clear search">
                            <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                        </TouchableOpacity>
                    )}
                </View>

                {filters.length > 1 && (
                    <View style={styles.filterRow}>
                        {filters.map((item) => {
                            const isActive = filter === item.key;
                            return (
                                <TouchableOpacity
                                    key={item.key}
                                    style={[
                                        styles.filterChip,
                                        {
                                            backgroundColor: isActive ? colors.accent : colors.cardBackground,
                                            borderColor: isActive ? colors.accent : colors.border,
                                        },
                                    ]}
                                    onPress={() => setFilter(item.key)}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: isActive }}
                                    accessibilityLabel={`Show ${item.label.toLowerCase()}`}
                                >
                                    <Text
                                        style={[
                                            styles.filterText,
                                            { color: isActive ? colors.textInverse : colors.textSecondary },
                                        ]}
                                    >
                                        {item.label}
                                    </Text>
                                    <Text
                                        style={[
                                            styles.filterCount,
                                            { color: isActive ? colors.textInverse : colors.textTertiary },
                                        ]}
                                    >
                                        {counts[item.key]}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}
            </View>

            {error && (
                <View style={styles.errorWrap}>
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
                removeClippedSubviews={true}
                maxToRenderPerBatch={10}
                windowSize={5}
                initialNumToRender={10}
                ListHeaderComponent={
                    <View>
                        {!isSearching && (
                            <>
                                <TeamHealthCard health={health} />
                                <NeedsAttentionSection items={attentionItems} onPressItem={goToAttentionItem} />
                                {showInviteWorkflow && (
                                    <PendingInvitesSection
                                        invitations={invitations}
                                        canRevoke={canRevoke}
                                        onRevoke={handleRevoke}
                                    />
                                )}
                            </>
                        )}
                        <View style={styles.sectionRow}>
                            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                                {isSearching ? 'Search results' : 'Members'}
                            </Text>
                            <Text style={[styles.sectionMeta, { color: colors.textTertiary }]}>
                                {plural(filteredMembers.length, 'person', 'people')}
                            </Text>
                        </View>
                    </View>
                }
                ListEmptyComponent={
                    <EmptyState
                        icon="people-outline"
                        title="No members found"
                        subtitle={
                            search.trim()
                                ? `No results for "${search}"`
                                : 'Members you invite will appear here once they accept.'
                        }
                    />
                }
            />
        </SafeAreaView>
    );
}

function TeamHealthCard({ health }: { health: ReturnType<typeof buildTeamHealthSummary> }) {
    const { colors } = useTheme();
    return (
        <View
            style={[
                styles.healthCard,
                { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder, shadowColor: colors.shadow },
            ]}
        >
            <View style={styles.healthHeader}>
                <Text style={[styles.kicker, { color: colors.accent }]}>Team health</Text>
            </View>
            <View style={styles.healthMainRow}>
                <Text style={[styles.healthNumber, { color: colors.textPrimary }]}>{health.activeMembers}</Text>
                <Text style={[styles.healthLabel, { color: colors.textSecondary }]}>active members</Text>
            </View>
            <View style={styles.healthFacts}>
                <FactPill label={`${health.needsFollowUp} need follow-up`} tone="warning" />
                <FactPill label={`${health.pendingInvites} pending invites`} tone="neutral" />
            </View>
            <View style={[styles.healthSecondary, { borderTopColor: colors.border }]}>
                <SecondaryFact label="Team leads" value={String(health.totalLeads)} />
                <SecondaryFact label="Avg conversion" value={`${health.avgConversion}%`} />
            </View>
        </View>
    );
}

function SecondaryFact({ label, value }: { label: string; value: string }) {
    const { colors } = useTheme();
    return (
        <View style={styles.secondaryFact}>
            <Text style={[styles.secondaryFactValue, { color: colors.textPrimary }]}>{value}</Text>
            <Text style={[styles.secondaryFactLabel, { color: colors.textTertiary }]}>{label}</Text>
        </View>
    );
}

function FactPill({ label, tone }: { label: string; tone: 'warning' | 'neutral' | 'danger' | 'success' }) {
    const { colors } = useTheme();
    const palette = getTonePalette(tone, colors);
    return (
        <View style={[styles.factPill, { backgroundColor: palette.bg }]}>
            <Text style={[styles.factPillText, { color: palette.fg }]}>{label}</Text>
        </View>
    );
}

function NeedsAttentionSection({
    items,
    onPressItem,
}: {
    items: TeamAttentionItem[];
    onPressItem: (item: TeamAttentionItem) => void;
}) {
    const { colors } = useTheme();
    if (items.length === 0) return null;

    return (
        <View style={styles.sectionBlock}>
            <View style={styles.sectionRow}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Needs attention</Text>
                <Text style={[styles.sectionMeta, { color: colors.textTertiary }]}>Sorted by who needs you first</Text>
            </View>
            {items.map((item) => {
                const palette = getTonePalette(item.tone, colors);
                const isPressable = Boolean(item.memberId);
                return (
                    <TouchableOpacity
                        key={item.id}
                        style={[
                            styles.attentionRow,
                            { backgroundColor: colors.cardBackground, borderColor: colors.border },
                        ]}
                        onPress={() => isPressable && onPressItem(item)}
                        activeOpacity={isPressable ? 0.7 : 1}
                        accessibilityRole={isPressable ? 'button' : undefined}
                    >
                        <View style={[styles.attentionIcon, { backgroundColor: palette.bg }]}>
                            <Ionicons name={attentionIcon(item.kind)} size={16} color={palette.fg} />
                        </View>
                        <View style={styles.attentionText}>
                            <Text style={[styles.attentionTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                                {item.title}
                            </Text>
                            <Text style={[styles.attentionSubtitle, { color: colors.textSecondary }]} numberOfLines={2}>
                                {item.subtitle}
                            </Text>
                        </View>
                        <Text style={[styles.attentionSignal, { color: palette.fg }]} numberOfLines={1}>
                            {item.signal}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

function PendingInvitesSection({
    invitations,
    canRevoke,
    onRevoke,
}: {
    invitations: MemberInvitation[];
    canRevoke: (inv: MemberInvitation) => boolean;
    onRevoke: (inv: MemberInvitation) => void;
}) {
    const { colors } = useTheme();
    if (invitations.length === 0) return null;

    return (
        <View style={styles.sectionBlock}>
            <View style={styles.sectionRow}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Pending invites</Text>
                <Text style={[styles.sectionMeta, { color: colors.textTertiary }]}>
                    {plural(invitations.length, 'invite')}
                </Text>
            </View>
            {invitations.map((inv) => {
                const inviterName = inv.inviter?.full_name;
                const managerName = inv.manager?.full_name;
                const isInviterSameAsManager = inv.invited_by_id === inv.assigned_manager_id;
                return (
                    <View
                        key={inv.id}
                        style={[
                            styles.inviteCard,
                            { backgroundColor: colors.cardBackground, borderColor: colors.border },
                        ]}
                    >
                        <View style={styles.inviteTop}>
                            <View style={[styles.smallAvatar, { backgroundColor: colors.warningLight }]}>
                                <Text style={[styles.smallAvatarText, { color: colors.warning }]}>
                                    {initials(inv.full_name)}
                                </Text>
                            </View>
                            <View style={styles.inviteInfo}>
                                <Text style={[styles.inviteName, { color: colors.textPrimary }]} numberOfLines={1}>
                                    {inv.full_name}
                                </Text>
                                <Text style={[styles.inviteRole, { color: colors.textSecondary }]}>
                                    {ROLE_LABELS[inv.intended_role] ?? inv.intended_role}
                                </Text>
                            </View>
                            <Text style={[styles.inviteExpiry, { color: colors.warning }]}>
                                {daysLeftLabel(inv.expires_at)}
                            </Text>
                        </View>
                        {(inviterName || managerName) && (
                            <View style={styles.inviteMetaRow}>
                                {inviterName && <InviteMeta icon="person-outline" text={`Invited by ${inviterName}`} />}
                                {managerName && !isInviterSameAsManager && (
                                    <InviteMeta icon="shield-outline" text={`Assigned to ${managerName}`} />
                                )}
                            </View>
                        )}
                        {canRevoke(inv) && (
                            <TouchableOpacity
                                style={[styles.revokeButton, { borderColor: colors.danger + '40' }]}
                                onPress={() => onRevoke(inv)}
                                accessibilityRole="button"
                                accessibilityLabel={`Revoke invitation for ${inv.full_name}`}
                            >
                                <Text style={[styles.revokeText, { color: colors.danger }]}>Revoke</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                );
            })}
        </View>
    );
}

function InviteMeta({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
    const { colors } = useTheme();
    return (
        <View style={styles.inviteMetaItem}>
            <Ionicons name={icon} size={13} color={colors.textTertiary} />
            <Text style={[styles.inviteMetaText, { color: colors.textTertiary }]} numberOfLines={1}>
                {text}
            </Text>
        </View>
    );
}

function TeamMemberCard({
    member,
    avatarColor,
    onPress,
}: {
    member: TeamMember;
    avatarColor: string;
    onPress: () => void;
}) {
    const { colors } = useTheme();
    const signal = getMemberSignal(member);
    const signalPalette = signal ? getTonePalette(signal.tone, colors) : null;
    const roleColor = member.role === 'manager' ? colors.info : colors.accent;
    const roleBg = member.role === 'manager' ? colors.infoLight : colors.accentLight;

    return (
        <TouchableOpacity
            style={[styles.memberCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}
            activeOpacity={0.72}
            accessibilityRole="button"
            accessibilityLabel={`View ${member.name}'s profile`}
            onPress={onPress}
        >
            <View style={styles.memberTop}>
                <Avatar
                    name={member.name}
                    avatarUrl={member.avatarUrl}
                    size={48}
                    backgroundColor={avatarColor + '18'}
                    textColor={avatarColor}
                />

                <View style={styles.memberInfo}>
                    <Text style={[styles.memberName, { color: colors.textPrimary }]} numberOfLines={1}>
                        {member.name}
                    </Text>
                    <View style={styles.badgeRow}>
                        <View style={[styles.roleBadge, { backgroundColor: roleBg }]}>
                            <Text style={[styles.roleText, { color: roleColor }]}>
                                {ROLE_LABELS[member.role] ?? member.role}
                            </Text>
                        </View>
                        <View
                            style={[
                                styles.statusBadge,
                                { backgroundColor: member.isActive ? colors.successLight : colors.surfaceSecondary },
                            ]}
                        >
                            <View
                                style={[
                                    styles.statusDot,
                                    { backgroundColor: member.isActive ? colors.success : colors.textTertiary },
                                ]}
                            />
                            <Text
                                style={[
                                    styles.statusText,
                                    { color: member.isActive ? colors.success : colors.textTertiary },
                                ]}
                            >
                                {member.isActive ? 'Active' : 'Inactive'}
                            </Text>
                        </View>
                    </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </View>

            {signal && signalPalette && (
                <View style={[styles.signalRow, { backgroundColor: signalPalette.bg }]}>
                    <Ionicons name={signalIcon(signal.tone)} size={15} color={signalPalette.fg} />
                    <Text style={[styles.signalText, { color: signalPalette.fg }]} numberOfLines={1}>
                        {signal.text}
                    </Text>
                </View>
            )}

            <View style={[styles.memberFacts, { borderTopColor: colors.border }]}>
                {member.role === 'manager' ? (
                    <>
                        <MetricChip value={String(member.outstandingCandidatesCount ?? 0)} label="outstanding" />
                        <MetricChip
                            value={String(member.teamSize ?? 0)}
                            label={(member.teamSize ?? 0) === 1 ? 'member' : 'members'}
                        />
                    </>
                ) : (
                    <>
                        <MetricChip value={String(member.leadsCount)} label="leads" />
                        <MetricChip value={String(member.wonCount)} label="won" />
                        <MetricChip value={`${member.conversionRate}%`} label="conversion" />
                    </>
                )}
            </View>
        </TouchableOpacity>
    );
}

function MetricChip({ value, label }: { value: string; label: string }) {
    const { colors } = useTheme();
    return (
        <View style={[styles.metricChip, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{value}</Text>
            <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>{label}</Text>
        </View>
    );
}

function getTonePalette(
    tone: 'danger' | 'warning' | 'success' | 'neutral',
    colors: ReturnType<typeof useTheme>['colors'],
) {
    switch (tone) {
        case 'danger':
            return { fg: colors.danger, bg: colors.dangerLight };
        case 'warning':
            return { fg: colors.warning, bg: colors.warningLight };
        case 'success':
            return { fg: colors.success, bg: colors.successLight };
        case 'neutral':
            return { fg: colors.textSecondary, bg: colors.surfaceSecondary };
    }
}

function attentionIcon(kind: TeamAttentionItem['kind']): keyof typeof Ionicons.glyphMap {
    switch (kind) {
        case 'stale_leads':
            return 'time-outline';
        case 'inactive_member':
            return 'person-circle-outline';
        case 'pending_invite':
            return 'mail-unread-outline';
    }
}

function signalIcon(tone: 'danger' | 'warning' | 'success' | 'neutral'): keyof typeof Ionicons.glyphMap {
    switch (tone) {
        case 'danger':
            return 'alert-circle-outline';
        case 'warning':
            return 'time-outline';
        case 'success':
            return 'trending-up-outline';
        case 'neutral':
            return 'chatbubble-ellipses-outline';
    }
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    listContent: { paddingHorizontal: 16, paddingBottom: 32, flexGrow: 1 },
    stickyHeader: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 4,
    },
    errorWrap: {
        paddingHorizontal: 16,
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
    filterText: { fontFamily: Fonts.sansSemibold, fontSize: 13, lineHeight: 17 },
    filterCount: { fontFamily: Fonts.sans, fontSize: 12, lineHeight: 16 },

    healthCard: {
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 20,
        padding: 18,
        marginTop: 8,
        marginBottom: 18,
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.05,
        shadowRadius: 14,
        elevation: 2,
    },
    healthHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    kicker: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 13,
        lineHeight: 18,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    healthMainRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 8,
    },
    healthNumber: {
        fontFamily: Fonts.serif,
        fontSize: 40,
        lineHeight: 48,
    },
    healthLabel: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 18,
        lineHeight: 24,
    },
    healthFacts: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 12,
    },
    factPill: {
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    factPillText: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 13,
        lineHeight: 17,
    },
    healthSecondary: {
        flexDirection: 'row',
        gap: 14,
        marginTop: 16,
        paddingTop: 14,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    secondaryFact: {
        flex: 1,
    },
    secondaryFactValue: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 16,
        lineHeight: 21,
    },
    secondaryFactLabel: {
        fontFamily: Fonts.sans,
        fontSize: 13,
        lineHeight: 17,
        marginTop: 1,
    },
    sectionBlock: {
        marginBottom: 18,
    },
    sectionRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 8,
    },
    sectionTitle: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 16,
        lineHeight: 21,
    },
    sectionMeta: {
        flexShrink: 1,
        fontFamily: Fonts.sans,
        fontSize: 13,
        lineHeight: 18,
        textAlign: 'right',
    },
    attentionRow: {
        minHeight: 64,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 14,
        padding: 12,
        marginBottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    attentionIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    attentionText: {
        flex: 1,
        minWidth: 0,
    },
    attentionTitle: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 15,
        lineHeight: 20,
    },
    attentionSubtitle: {
        fontFamily: Fonts.sans,
        fontSize: 13,
        lineHeight: 18,
        marginTop: 1,
    },
    attentionSignal: {
        maxWidth: 94,
        fontFamily: Fonts.mono,
        fontSize: 11,
        lineHeight: 15,
        textAlign: 'right',
    },
    inviteCard: {
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 14,
        padding: 14,
        marginBottom: 8,
    },
    inviteTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    smallAvatar: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
    },
    smallAvatarText: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 13,
        lineHeight: 17,
    },
    inviteInfo: {
        flex: 1,
        minWidth: 0,
    },
    inviteName: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 15,
        lineHeight: 20,
    },
    inviteRole: {
        fontFamily: Fonts.sans,
        fontSize: 13,
        lineHeight: 18,
    },
    inviteExpiry: {
        fontFamily: Fonts.mono,
        fontSize: 11,
        lineHeight: 15,
        maxWidth: 100,
        textAlign: 'right',
    },
    inviteMetaRow: {
        gap: 5,
        marginTop: 10,
    },
    inviteMetaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    inviteMetaText: {
        flex: 1,
        fontFamily: Fonts.sans,
        fontSize: 12,
        lineHeight: 16,
    },
    revokeButton: {
        alignSelf: 'flex-start',
        minHeight: 34,
        justifyContent: 'center',
        borderRadius: 8,
        borderWidth: 1,
        paddingHorizontal: 14,
        marginTop: 12,
    },
    revokeText: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 13,
        lineHeight: 17,
    },
    memberCard: {
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
    },
    memberTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    memberInfo: {
        flex: 1,
        minWidth: 0,
    },
    memberName: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 16,
        lineHeight: 22,
        letterSpacing: letterSpacing(-0.1),
    },
    badgeRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 6,
        marginTop: 4,
    },
    roleBadge: {
        borderRadius: 7,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    roleText: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 12,
        lineHeight: 16,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        borderRadius: 7,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusText: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 12,
        lineHeight: 16,
    },
    signalRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 8,
        marginTop: 12,
    },
    signalText: {
        flex: 1,
        fontFamily: Fonts.sansSemibold,
        fontSize: 14,
        lineHeight: 19,
    },
    memberFacts: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    metricChip: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 4,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    metricValue: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 14,
        lineHeight: 18,
    },
    metricLabel: {
        fontFamily: Fonts.sans,
        fontSize: 12,
        lineHeight: 16,
    },
});
