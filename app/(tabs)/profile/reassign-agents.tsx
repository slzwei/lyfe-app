import LoadingState from '@/components/LoadingState';
import ScreenHeader from '@/components/ScreenHeader';
import ReassignAgentSheet from '@/components/team/ReassignAgentSheet';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { canReassignAgents } from '@/constants/Roles';
import {
    fetchAgentsForReassign,
    fetchReassignableManagers,
    reassignAgent,
    type AgentForReassign,
    type ReassignableManager,
} from '@/lib/team';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ReassignAgentsScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();

    const [agents, setAgents] = useState<AgentForReassign[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [selectedAgent, setSelectedAgent] = useState<AgentForReassign | null>(null);
    const [managers, setManagers] = useState<ReassignableManager[]>([]);
    const [managersLoading, setManagersLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const allowed = canReassignAgents(user?.role ?? 'candidate');

    const load = useCallback(async () => {
        const { data, error: fetchErr } = await fetchAgentsForReassign();
        if (fetchErr) {
            setError(fetchErr);
            setAgents([]);
        } else {
            setError(null);
            setAgents(data);
        }
    }, []);

    useEffect(() => {
        if (!allowed) {
            setLoading(false);
            return;
        }
        load().finally(() => setLoading(false));
    }, [allowed, load]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    }, [load]);

    const openPicker = useCallback(async (agent: AgentForReassign) => {
        setSelectedAgent(agent);
        setManagersLoading(true);
        const { data, error: mgrErr } = await fetchReassignableManagers(agent.currentManagerId);
        setManagersLoading(false);
        if (mgrErr) {
            Alert.alert('Could not load managers', mgrErr);
            setSelectedAgent(null);
            return;
        }
        setManagers(data);
    }, []);

    const handleSelect = useCallback(
        async (manager: ReassignableManager | null) => {
            if (!selectedAgent) return;
            setSubmitting(true);
            const { error: rErr } = await reassignAgent(selectedAgent.id, manager?.id ?? null);
            setSubmitting(false);
            if (rErr) {
                Alert.alert('Reassignment failed', rErr);
                return;
            }
            const agentName = selectedAgent.fullName;
            setSelectedAgent(null);
            await load();
            Alert.alert(
                'Reassigned',
                manager ? `${agentName} now reports to ${manager.fullName}.` : `${agentName} is now unassigned.`,
            );
        },
        [selectedAgent, load],
    );

    if (!allowed) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <ScreenHeader title="Reassign Agents" showBack backLabel="Profile" />
                <View style={styles.empty}>
                    <Ionicons name="lock-closed-outline" size={40} color={colors.textTertiary} />
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                        You don&apos;t have permission to reassign agents.
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <ScreenHeader title="Reassign Agents" showBack backLabel="Profile" />

            {loading ? (
                <LoadingState />
            ) : (
                <ScrollView
                    contentContainerStyle={styles.scroll}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                >
                    {error ? (
                        <View style={[styles.errorCard, { backgroundColor: colors.dangerLight }]}>
                            <Ionicons name="alert-circle" size={18} color={colors.danger} />
                            <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
                        </View>
                    ) : null}

                    <Text style={[styles.helper, { color: colors.textSecondary }]}>
                        Tap an agent to move them to a different manager or leave them unassigned.
                    </Text>

                    {agents.length === 0 && !error ? (
                        <View style={[styles.emptyCard, { backgroundColor: colors.cardBackground }]}>
                            <Ionicons name="people-outline" size={32} color={colors.textTertiary} />
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                No active agents yet.
                            </Text>
                        </View>
                    ) : (
                        agents.map((a) => (
                            <TouchableOpacity
                                key={a.id}
                                style={[styles.row, { backgroundColor: colors.cardBackground }]}
                                onPress={() => openPicker(a)}
                                activeOpacity={0.8}
                                accessibilityRole="button"
                                accessibilityLabel={`Reassign ${a.fullName}`}
                            >
                                <View style={[styles.avatar, { backgroundColor: colors.accentLight }]}>
                                    <Text style={[styles.avatarText, { color: colors.accent }]}>
                                        {a.fullName.charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                                <View style={styles.rowBody}>
                                    <Text style={[styles.rowName, { color: colors.textPrimary }]}>{a.fullName}</Text>
                                    <Text style={[styles.rowMeta, { color: colors.textTertiary }]}>
                                        Upline: {a.currentManagerName ?? 'Unassigned'}
                                    </Text>
                                </View>
                                <Ionicons name="swap-horizontal" size={18} color={colors.textTertiary} />
                            </TouchableOpacity>
                        ))
                    )}
                </ScrollView>
            )}

            <ReassignAgentSheet
                visible={!!selectedAgent}
                agentName={selectedAgent?.fullName ?? ''}
                currentManagerName={selectedAgent?.currentManagerName ?? null}
                managers={managers}
                loading={managersLoading}
                submitting={submitting}
                colors={colors}
                onSelect={handleSelect}
                onClose={() => setSelectedAgent(null)}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scroll: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
    helper: { fontSize: 13, marginBottom: 4 },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        borderRadius: 12,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: { fontSize: 16, fontWeight: '700' },
    rowBody: { flex: 1, gap: 2 },
    rowName: { fontSize: 15, fontWeight: '600' },
    rowMeta: { fontSize: 12 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
    emptyCard: { padding: 32, borderRadius: 12, alignItems: 'center', gap: 10 },
    emptyText: { fontSize: 14, textAlign: 'center' },
    errorCard: {
        flexDirection: 'row',
        gap: 8,
        padding: 12,
        borderRadius: 10,
        alignItems: 'center',
    },
    errorText: { fontSize: 13, flex: 1 },
});
