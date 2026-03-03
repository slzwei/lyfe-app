import CandidateCard from '@/components/CandidateCard';
import EmptyState from '@/components/EmptyState';
import LoadingState from '@/components/LoadingState';
import ScreenHeader from '@/components/ScreenHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useViewMode } from '@/contexts/ViewModeContext';
import { fetchCandidates } from '@/lib/recruitment';
import { CANDIDATE_STATUSES, CANDIDATE_STATUS_CONFIG, type CandidateStatus, type RecruitmentCandidate } from '@/types/recruitment';
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
const d = (days: number) => new Date(now - days * 86400000).toISOString();

const MOCK_CANDIDATES: RecruitmentCandidate[] = [
    {
        id: 'c1', name: 'Jason Teo', phone: '+65 9111 2222', email: 'jason.teo@gmail.com',
        status: 'applied', assigned_manager_id: 'mgr-1', assigned_manager_name: 'David Lim',
        created_by_id: 'mock-user-id', invite_token: 'inv_abc123', notes: 'Referred by agent Michael Wong',
        interviews: [], created_at: d(1), updated_at: d(1),
    },
    {
        id: 'c2', name: 'Priya Sharma', phone: '+65 8222 3333', email: 'priya.s@outlook.com',
        status: 'interview_scheduled', assigned_manager_id: 'mgr-1', assigned_manager_name: 'David Lim',
        created_by_id: 'mock-user-id', invite_token: 'inv_def456', notes: 'Strong background in financial advisory',
        interviews: [{
            id: 'int-1', candidate_id: 'c2', manager_id: 'mgr-1', scheduled_by_id: 'mock-user-id',
            round_number: 1, type: 'zoom', datetime: new Date(now + 2 * 86400000).toISOString(),
            location: null, zoom_link: 'https://zoom.us/j/123456789', google_calendar_event_id: null,
            status: 'scheduled', notes: null, created_at: d(3),
        }],
        created_at: d(5), updated_at: d(3),
    },
    {
        id: 'c3', name: 'Ahmad Razak', phone: '+65 9333 4444', email: 'ahmad.r@email.com',
        status: 'interviewed', assigned_manager_id: 'mgr-1', assigned_manager_name: 'David Lim',
        created_by_id: 'mock-user-id', invite_token: null, notes: 'Very motivated, good presentation skills',
        interviews: [{
            id: 'int-2', candidate_id: 'c3', manager_id: 'mgr-1', scheduled_by_id: 'mock-user-id',
            round_number: 1, type: 'zoom', datetime: d(2),
            location: null, zoom_link: 'https://zoom.us/j/987654321', google_calendar_event_id: null,
            status: 'completed', notes: 'Good cultural fit. Recommend proceed to round 2.', created_at: d(7),
        }],
        created_at: d(10), updated_at: d(2),
    },
    {
        id: 'c4', name: 'Lisa Tan', phone: '+65 8444 5555', email: 'lisa.tan@company.sg',
        status: 'approved', assigned_manager_id: 'mgr-1', assigned_manager_name: 'David Lim',
        created_by_id: 'mock-user-id', invite_token: null, notes: 'Previously in banking sector. Approved after 2 interview rounds.',
        interviews: [
            { id: 'int-3', candidate_id: 'c4', manager_id: 'mgr-1', scheduled_by_id: 'mock-user-id', round_number: 1, type: 'zoom', datetime: d(14), location: null, zoom_link: 'https://zoom.us/j/111222333', google_calendar_event_id: null, status: 'completed', notes: 'Solid understanding of insurance products', created_at: d(18) },
            { id: 'int-4', candidate_id: 'c4', manager_id: 'mgr-1', scheduled_by_id: 'mock-user-id', round_number: 2, type: 'in_person', datetime: d(10), location: 'Lyfe Office, 1 Raffles Place #20-01', zoom_link: null, google_calendar_event_id: null, status: 'completed', notes: 'Approved. Ready for exam preparation.', created_at: d(14) },
        ],
        created_at: d(20), updated_at: d(10),
    },
    {
        id: 'c5', name: 'Wei Ming Chen', phone: '+65 9555 6666', email: null,
        status: 'exam_prep', assigned_manager_id: 'mgr-1', assigned_manager_name: 'David Lim',
        created_by_id: 'mock-user-id', invite_token: null, notes: 'Preparing for M5 and M9. Target completion: March 2026.',
        interviews: [
            { id: 'int-5', candidate_id: 'c5', manager_id: 'mgr-1', scheduled_by_id: 'mock-user-id', round_number: 1, type: 'zoom', datetime: d(30), location: null, zoom_link: 'https://zoom.us/j/444555666', google_calendar_event_id: null, status: 'completed', notes: 'Great energy', created_at: d(35) },
        ],
        created_at: d(40), updated_at: d(5),
    },
    {
        id: 'c6', name: 'Siti Nurhaliza', phone: '+65 8666 7777', email: 'siti.n@gmail.com',
        status: 'licensed', assigned_manager_id: 'mgr-1', assigned_manager_name: 'David Lim',
        created_by_id: 'mock-user-id', invite_token: null, notes: 'All 4 mandatory papers passed. Pending final activation.',
        interviews: [
            { id: 'int-6', candidate_id: 'c6', manager_id: 'mgr-1', scheduled_by_id: 'mock-user-id', round_number: 1, type: 'in_person', datetime: d(60), location: 'Lyfe Office', zoom_link: null, google_calendar_event_id: null, status: 'completed', notes: 'Excellent candidate', created_at: d(65) },
        ],
        created_at: d(70), updated_at: d(3),
    },
];

// Export for detail screen (mock mode only)
export { MOCK_CANDIDATES };

const FILTER_TABS: { key: CandidateStatus | 'all'; label: string }[] = [
    { key: 'all', label: 'All' },
    ...CANDIDATE_STATUSES.map((status) => ({
        key: status,
        label: CANDIDATE_STATUS_CONFIG[status].label,
    })),
];

export default function CandidatesScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const { viewMode, canToggle } = useViewMode();
    const router = useRouter();
    const isManagerView = canToggle && viewMode === 'manager';

    const [search, setSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState<CandidateStatus | 'all'>('all');
    const [refreshing, setRefreshing] = useState(false);
    const [candidates, setCandidates] = useState<RecruitmentCandidate[]>([]);
    const [isLoading, setIsLoading] = useState(!MOCK_OTP);
    const [error, setError] = useState<string | null>(null);

    const loadCandidates = useCallback(async () => {
        if (MOCK_OTP) {
            setCandidates(MOCK_CANDIDATES);
            return;
        }

        if (!user?.id) return;
        setError(null);
        const { data, error: fetchError } = await fetchCandidates(user.id, isManagerView);
        if (fetchError) {
            setError(fetchError);
        } else {
            setCandidates(data);
        }
        setIsLoading(false);
    }, [user?.id, isManagerView]);

    useFocusEffect(
        useCallback(() => {
            loadCandidates();
        }, [loadCandidates])
    );

    const filteredCandidates = candidates.filter((candidate) => {
        if (search.trim()) {
            const q = search.toLowerCase();
            const matchesName = candidate.name.toLowerCase().includes(q);
            const matchesPhone = candidate.phone?.includes(q);
            if (!matchesName && !matchesPhone) return false;
        }
        if (activeFilter !== 'all' && candidate.status !== activeFilter) return false;
        return true;
    }).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    const counts: Record<string, number> = { all: candidates.length };
    candidates.forEach((c) => { counts[c.status] = (counts[c.status] || 0) + 1; });

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadCandidates();
        setRefreshing(false);
    }, [loadCandidates]);

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <ScreenHeader title="Candidates" />
                <LoadingState />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScreenHeader
                title="Candidates"
                rightAction={
                    <TouchableOpacity
                        style={[styles.addButton, { backgroundColor: colors.accent }]}
                        onPress={() => router.push('/team/add-candidate' as any)}
                        accessibilityLabel="Add new candidate"
                    >
                        <Ionicons name="person-add" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                }
            />

            <FlatList
                data={filteredCandidates}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
                }
                ListHeaderComponent={
                    <View style={styles.headerContainer}>
                        {/* Search */}
                        <View style={[styles.searchBar, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                            <Ionicons name="search" size={18} color={colors.textTertiary} />
                            <TextInput
                                style={[styles.searchInput, { color: colors.textPrimary }]}
                                placeholder="Search candidates..."
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

                        {/* Error Banner */}
                        {error && (
                            <TouchableOpacity
                                style={[styles.errorBanner, { backgroundColor: '#FEE2E2' }]}
                                onPress={loadCandidates}
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
                        icon="people-outline"
                        title="No candidates found"
                        subtitle={search.trim() ? `No results for "${search}"` : 'No candidates match this filter'}
                    />
                }
                renderItem={({ item }) => (
                    <CandidateCard
                        candidate={item}
                        onPress={() => router.push(`/candidates/${item.id}` as any)}
                    />
                )}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    addButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
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
        marginBottom: 8,
    },
    filterRow: {
        gap: 8,
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
        paddingHorizontal: 16,
        paddingBottom: 40,
        paddingTop: 16,
    },
});
