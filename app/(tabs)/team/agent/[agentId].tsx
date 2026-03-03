import LeadCard from '@/components/LeadCard';
import LoadingState from '@/components/LoadingState';
import ScreenHeader from '@/components/ScreenHeader';
import { useTheme } from '@/contexts/ThemeContext';
import { fetchTeamMember, type TeamMember } from '@/lib/team';
import type { Lead, LeadStatus } from '@/types/lead';
import { STATUS_CONFIG } from '@/types/lead';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Linking,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

const MOCK_OTP = process.env.EXPO_PUBLIC_MOCK_OTP === 'true';

const AVATAR_COLORS = ['#6366F1', '#0D9488', '#E11D48', '#F59E0B', '#8B5CF6', '#06B6D4'];
const PIPELINE_STATUSES: LeadStatus[] = ['new', 'contacted', 'qualified', 'proposed', 'won', 'lost'];

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-SG', { month: 'short', year: 'numeric' });
}

export default function AgentDetailScreen() {
    const { colors } = useTheme();
    const router = useRouter();
    const { agentId } = useLocalSearchParams<{ agentId: string }>();

    const [agent, setAgent] = useState<TeamMember | null>(null);
    const [agentLeads, setAgentLeads] = useState<Lead[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const loadAgent = useCallback(async () => {
        if (MOCK_OTP) {
            // Import mock data from team index
            const { MOCK_AGENTS, MOCK_MANAGERS } = require('../index');
            const allMock = [...MOCK_MANAGERS, ...MOCK_AGENTS];
            const found = allMock.find((m: TeamMember) => m.id === agentId);
            setAgent(found || null);
            // Mock leads — import from leads screen
            try {
                const { MOCK_LEADS } = require('../../leads/index');
                setAgentLeads(MOCK_LEADS || []);
            } catch {
                setAgentLeads([]);
            }
            setIsLoading(false);
            return;
        }

        if (!agentId) return;
        const { member, leads, error } = await fetchTeamMember(agentId);
        if (!error && member) {
            setAgent(member);
            setAgentLeads(leads);
        }
        setIsLoading(false);
    }, [agentId]);

    useEffect(() => {
        loadAgent();
    }, [loadAgent]);

    const pipelineCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        PIPELINE_STATUSES.forEach((s) => { counts[s] = 0; });
        agentLeads.forEach((l) => { counts[l.status] = (counts[l.status] || 0) + 1; });
        return counts;
    }, [agentLeads]);

    const totalPipelineLeads = agentLeads.length;

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <ScreenHeader title="Team Member" showBack backLabel="Team" />
                <LoadingState />
            </SafeAreaView>
        );
    }

    if (!agent) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <ScreenHeader title="Agent" showBack backLabel="Team" />
                <View style={styles.errorContainer}>
                    <Ionicons name="person-outline" size={48} color={colors.textTertiary} />
                    <Text style={[styles.errorText, { color: colors.textSecondary }]}>Agent not found</Text>
                </View>
            </SafeAreaView>
        );
    }

    const avatarColor = AVATAR_COLORS[agent.name.charCodeAt(0) % AVATAR_COLORS.length];
    const initials = agent.name.split(' ').map((n) => n[0]).join('');
    const isManager = agent.role === 'manager';
    const lostCount = pipelineCounts['lost'] || 0;

    const handleCall = () => {
        if (agent.phone) {
            const tel = agent.phone.replace(/\s/g, '');
            Linking.openURL(`tel:${tel}`);
        }
    };

    const handleEmail = () => {
        if (agent.email) Linking.openURL(`mailto:${agent.email}`);
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScreenHeader title="Team Member" showBack backLabel="Team" />

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* ── Profile Card ── */}
                <View style={[styles.profileCard, { backgroundColor: colors.cardBackground, shadowColor: colors.textPrimary }]}>
                    <View style={styles.profileTop}>
                        <View style={[styles.avatarLarge, { backgroundColor: avatarColor + '18' }]}>
                            <Text style={[styles.avatarLargeText, { color: avatarColor }]}>{initials}</Text>
                        </View>
                        <View style={styles.profileInfo}>
                            <Text style={[styles.profileName, { color: colors.textPrimary }]}>{agent.name}</Text>
                            <View style={styles.profileMeta}>
                                <View style={[styles.roleBadge, { backgroundColor: isManager ? '#6366F118' : colors.accentLight }]}>
                                    <View style={[styles.roleDot, { backgroundColor: isManager ? '#6366F1' : colors.accent }]} />
                                    <Text style={[styles.roleText, { color: isManager ? '#6366F1' : colors.accent }]}>
                                        {isManager ? 'Manager' : 'Agent'}
                                    </Text>
                                </View>
                                <View style={[
                                    styles.statusPill,
                                    { backgroundColor: agent.isActive ? colors.successLight : colors.surfaceSecondary }
                                ]}>
                                    <View style={[
                                        styles.statusDot,
                                        { backgroundColor: agent.isActive ? colors.success : colors.textTertiary }
                                    ]} />
                                    <Text style={[
                                        styles.statusText,
                                        { color: agent.isActive ? colors.success : colors.textTertiary }
                                    ]}>
                                        {agent.isActive ? 'Active' : 'Inactive'}
                                    </Text>
                                </View>
                            </View>
                            <Text style={[styles.joinDate, { color: colors.textTertiary }]}>
                                Member since {formatDate(agent.joinedDate)}
                            </Text>
                        </View>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.actionRow}>
                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: colors.accent }]}
                            onPress={handleCall}
                            activeOpacity={0.8}
                            disabled={!agent.phone}
                        >
                            <Ionicons name="call" size={18} color="#FFF" />
                            <Text style={styles.actionBtnText}>Call</Text>
                        </TouchableOpacity>
                        {agent.email && (
                            <TouchableOpacity
                                style={[styles.actionBtn, { backgroundColor: colors.cardBackground, borderWidth: 1, borderColor: colors.border }]}
                                onPress={handleEmail}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="mail" size={18} color={colors.textPrimary} />
                                <Text style={[styles.actionBtnText, { color: colors.textPrimary }]}>Email</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* ── Performance Stats ── */}
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Performance</Text>
                <View style={styles.statsGrid}>
                    <View style={[styles.statCard, { backgroundColor: colors.accent }]}>
                        <Text style={styles.statValueWhite}>{agent.leadsCount}</Text>
                        <Text style={styles.statLabelWhite}>Total Leads</Text>
                    </View>
                    <View style={[styles.statCard, { backgroundColor: colors.cardBackground, shadowColor: colors.textPrimary }]}>
                        <Text style={[styles.statValue, { color: colors.success }]}>{agent.wonCount}</Text>
                        <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Won</Text>
                    </View>
                    <View style={[styles.statCard, { backgroundColor: colors.cardBackground, shadowColor: colors.textPrimary }]}>
                        <Text style={[styles.statValue, { color: agent.conversionRate >= 30 ? colors.success : colors.textPrimary }]}>
                            {agent.conversionRate}%
                        </Text>
                        <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Conv. Rate</Text>
                    </View>
                    <View style={[styles.statCard, { backgroundColor: colors.cardBackground, shadowColor: colors.textPrimary }]}>
                        <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                            {agent.leadsCount - agent.wonCount - lostCount}
                        </Text>
                        <Text style={[styles.statLabel, { color: colors.textTertiary }]}>In Pipeline</Text>
                    </View>
                </View>

                {/* ── Pipeline Breakdown ── */}
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Pipeline Breakdown</Text>
                <View style={[styles.pipelineCard, { backgroundColor: colors.cardBackground, shadowColor: colors.textPrimary }]}>
                    {/* Stacked Bar */}
                    {totalPipelineLeads > 0 && (
                        <View style={styles.pipelineBar}>
                            {PIPELINE_STATUSES.map((status) => {
                                const count = pipelineCounts[status] || 0;
                                if (count === 0) return null;
                                const config = STATUS_CONFIG[status];
                                return (
                                    <View
                                        key={status}
                                        style={[
                                            styles.pipelineSegment,
                                            {
                                                backgroundColor: config.color,
                                                flex: count,
                                            },
                                        ]}
                                    />
                                );
                            })}
                        </View>
                    )}

                    {/* Legend */}
                    <View style={styles.pipelineLegend}>
                        {PIPELINE_STATUSES.map((status) => {
                            const count = pipelineCounts[status] || 0;
                            const config = STATUS_CONFIG[status];
                            return (
                                <View key={status} style={styles.legendItem}>
                                    <View style={[styles.legendDot, { backgroundColor: config.color }]} />
                                    <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>{config.label}</Text>
                                    <Text style={[styles.legendCount, { color: colors.textPrimary }]}>{count}</Text>
                                </View>
                            );
                        })}
                    </View>
                </View>

                {/* ── Leads List ── */}
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                    Leads ({agentLeads.length})
                </Text>
                {agentLeads.length > 0 ? (
                    agentLeads.map((lead) => (
                        <LeadCard
                            key={lead.id}
                            lead={lead}
                            onPress={() => router.push(`/(tabs)/leads/${lead.id}` as any)}
                        />
                    ))
                ) : (
                    <View style={[styles.emptyLeads, { backgroundColor: colors.cardBackground }]}>
                        <Ionicons name="folder-open-outline" size={36} color={colors.textTertiary} />
                        <Text style={[styles.emptyLeadsText, { color: colors.textSecondary }]}>
                            No leads assigned yet
                        </Text>
                    </View>
                )}

                {/* Bottom spacer */}
                <View style={{ height: 32 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingTop: 8 },

    // ── Error ──
    errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    errorText: { fontSize: 16 },

    // ── Profile Card ──
    profileCard: {
        borderRadius: 16,
        padding: 18,
        marginBottom: 20,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 3,
    },
    profileTop: {
        flexDirection: 'row',
        gap: 16,
    },
    avatarLarge: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarLargeText: {
        fontSize: 22,
        fontWeight: '800',
    },
    profileInfo: {
        flex: 1,
        gap: 4,
    },
    profileName: {
        fontSize: 22,
        fontWeight: '800',
        letterSpacing: -0.3,
    },
    profileMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 2,
    },
    roleBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    roleDot: { width: 6, height: 6, borderRadius: 3 },
    roleText: { fontSize: 11, fontWeight: '700' },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontSize: 11, fontWeight: '600' },
    joinDate: { fontSize: 12, marginTop: 2 },

    // Actions
    actionRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 16,
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 11,
        borderRadius: 12,
    },
    actionBtnText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFF',
    },

    // ── Section Title ──
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: -0.2,
        marginBottom: 10,
    },

    // ── Performance Stats ──
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 20,
    },
    statCard: {
        width: '47%',
        flexGrow: 1,
        borderRadius: 14,
        paddingVertical: 16,
        paddingHorizontal: 14,
        alignItems: 'center',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    statValue: {
        fontSize: 24,
        fontWeight: '800',
        letterSpacing: -0.3,
    },
    statValueWhite: {
        fontSize: 24,
        fontWeight: '800',
        letterSpacing: -0.3,
        color: '#FFF',
    },
    statLabel: {
        fontSize: 12,
        fontWeight: '500',
        marginTop: 2,
    },
    statLabelWhite: {
        fontSize: 12,
        fontWeight: '500',
        marginTop: 2,
        color: 'rgba(255,255,255,0.8)',
    },

    // ── Pipeline ──
    pipelineCard: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    pipelineBar: {
        flexDirection: 'row',
        height: 10,
        borderRadius: 5,
        overflow: 'hidden',
        marginBottom: 14,
        gap: 2,
    },
    pipelineSegment: {
        borderRadius: 5,
    },
    pipelineLegend: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    legendLabel: {
        fontSize: 12,
    },
    legendCount: {
        fontSize: 12,
        fontWeight: '700',
        marginLeft: 2,
    },

    // ── Empty Leads ──
    emptyLeads: {
        borderRadius: 14,
        paddingVertical: 36,
        alignItems: 'center',
        gap: 8,
    },
    emptyLeadsText: { fontSize: 14 },
});
