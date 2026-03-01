import PipelineStepper from '@/components/PipelineStepper';
import { useTheme } from '@/contexts/ThemeContext';
import {
    CANDIDATE_STATUS_CONFIG,
    MOCK_CANDIDATES,
    type Interview
} from '@/types/recruitment';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
    Modal,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

export default function CandidateDetailScreen() {
    const { colors } = useTheme();
    const router = useRouter();
    const { candidateId } = useLocalSearchParams<{ candidateId: string }>();
    const [statusModalVisible, setStatusModalVisible] = useState(false);

    const candidate = useMemo(
        () => MOCK_CANDIDATES.find((c) => c.id === candidateId),
        [candidateId]
    );

    if (!candidate) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.notFound}>
                    <Text style={[styles.notFoundText, { color: colors.textSecondary }]}>
                        Candidate not found
                    </Text>
                    <TouchableOpacity onPress={() => router.back()}>
                        <Text style={{ color: colors.accent, fontWeight: '600' }}>Go back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const statusConfig = CANDIDATE_STATUS_CONFIG[candidate.status];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {candidate.name}
                </Text>
                <View style={{ width: 32 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Profile Hero */}
                <View style={[styles.heroCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                    <View style={[styles.heroAvatar, { backgroundColor: statusConfig.color + '18' }]}>
                        <Text style={[styles.heroAvatarText, { color: statusConfig.color }]}>
                            {candidate.name.charAt(0).toUpperCase()}
                        </Text>
                    </View>
                    <Text style={[styles.heroName, { color: colors.textPrimary }]}>{candidate.name}</Text>
                    <View style={[styles.heroBadge, { backgroundColor: statusConfig.color + '18' }]}>
                        <Ionicons name={statusConfig.icon as any} size={14} color={statusConfig.color} />
                        <Text style={[styles.heroBadgeText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
                    </View>

                    {/* Contact Info */}
                    <View style={styles.contactRow}>
                        <Ionicons name="call-outline" size={14} color={colors.textSecondary} />
                        <Text style={[styles.contactText, { color: colors.textSecondary }]}>{candidate.phone}</Text>
                    </View>
                    {candidate.email && (
                        <View style={styles.contactRow}>
                            <Ionicons name="mail-outline" size={14} color={colors.textSecondary} />
                            <Text style={[styles.contactText, { color: colors.textSecondary }]}>{candidate.email}</Text>
                        </View>
                    )}
                    <View style={styles.contactRow}>
                        <Ionicons name="person-outline" size={14} color={colors.textSecondary} />
                        <Text style={[styles.contactText, { color: colors.textSecondary }]}>
                            Manager: {candidate.assigned_manager_name}
                        </Text>
                    </View>
                </View>

                {/* Pipeline Stepper */}
                <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Pipeline Progress</Text>
                    <PipelineStepper currentStatus={candidate.status} />
                </View>

                {/* Quick Actions */}
                <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Actions</Text>
                    <View style={styles.actionsGrid}>
                        <ActionBtn icon="swap-horizontal" label="Change Status" color={colors.info} bgColor={colors.infoLight} onPress={() => setStatusModalVisible(true)} />
                        <ActionBtn icon="calendar" label="Schedule Interview" color={colors.accent} bgColor={colors.accentLight} onPress={() => { }} />
                        <ActionBtn icon="create" label="Add Note" color={colors.success} bgColor={colors.successLight} onPress={() => { }} />
                        <ActionBtn icon="call" label="Call" color={colors.warning} bgColor={colors.warningLight} onPress={() => { }} />
                    </View>
                </View>

                {/* Interview History */}
                <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                        Interview History ({candidate.interviews.length})
                    </Text>
                    {candidate.interviews.length === 0 ? (
                        <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No interviews scheduled yet</Text>
                    ) : (
                        candidate.interviews
                            .sort((a, b) => b.round_number - a.round_number)
                            .map((interview) => (
                                <InterviewRow key={interview.id} interview={interview} colors={colors} />
                            ))
                    )}
                </View>

                {/* Notes */}
                {candidate.notes && (
                    <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Notes</Text>
                        <Text style={[styles.noteText, { color: colors.textSecondary }]}>{candidate.notes}</Text>
                    </View>
                )}
            </ScrollView>

            {/* Status Change Modal */}
            <Modal visible={statusModalVisible} transparent animationType="fade" onRequestClose={() => setStatusModalVisible(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setStatusModalVisible(false)}>
                    <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
                        <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Change Status</Text>
                        {Object.entries(CANDIDATE_STATUS_CONFIG).map(([key, config]) => {
                            const isCurrent = key === candidate.status;
                            return (
                                <TouchableOpacity
                                    key={key}
                                    style={[styles.statusOption, isCurrent && { backgroundColor: config.color + '12' }]}
                                    onPress={() => setStatusModalVisible(false)}
                                >
                                    <Ionicons name={config.icon as any} size={18} color={config.color} />
                                    <Text style={[styles.statusOptionText, { color: colors.textPrimary }]}>{config.label}</Text>
                                    {isCurrent && <Ionicons name="checkmark" size={18} color={config.color} />}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
}

// ── Sub-Components ──

function ActionBtn({ icon, label, color, bgColor, onPress }: {
    icon: string; label: string; color: string; bgColor: string; onPress: () => void;
}) {
    return (
        <TouchableOpacity style={styles.actionBtn} onPress={onPress} activeOpacity={0.7}>
            <View style={[styles.actionIcon, { backgroundColor: bgColor }]}>
                <Ionicons name={icon as any} size={20} color={color} />
            </View>
            <Text style={[styles.actionLabel, { color }]}>{label}</Text>
        </TouchableOpacity>
    );
}

function InterviewRow({ interview, colors }: { interview: Interview; colors: any }) {
    const date = new Date(interview.datetime);
    const statusColors: Record<string, string> = {
        scheduled: '#BF8700',
        completed: '#1A7F37',
        cancelled: '#CF222E',
        rescheduled: '#0969DA',
    };

    return (
        <View style={[styles.interviewRow, { borderBottomColor: colors.borderLight }]}>
            <View style={[styles.roundBadge, { backgroundColor: colors.surfacePrimary }]}>
                <Text style={[styles.roundText, { color: colors.textPrimary }]}>R{interview.round_number}</Text>
            </View>
            <View style={styles.interviewInfo}>
                <Text style={[styles.interviewDate, { color: colors.textPrimary }]}>
                    {date.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {' · '}
                    {date.toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <View style={styles.interviewMeta}>
                    <Ionicons
                        name={interview.type === 'zoom' ? 'videocam' : 'location'}
                        size={12}
                        color={colors.textTertiary}
                    />
                    <Text style={[styles.interviewMetaText, { color: colors.textTertiary }]}>
                        {interview.type === 'zoom' ? 'Zoom' : interview.location || 'In Person'}
                    </Text>
                    <View
                        style={[
                            styles.interviewStatusBadge,
                            { backgroundColor: (statusColors[interview.status] || colors.textTertiary) + '18' },
                        ]}
                    >
                        <Text
                            style={[
                                styles.interviewStatusText,
                                { color: statusColors[interview.status] || colors.textTertiary },
                            ]}
                        >
                            {interview.status}
                        </Text>
                    </View>
                </View>
                {interview.notes && (
                    <Text style={[styles.interviewNotes, { color: colors.textSecondary }]} numberOfLines={2}>
                        {interview.notes}
                    </Text>
                )}
            </View>
        </View>
    );
}

// ── Styles ──
const styles = StyleSheet.create({
    container: { flex: 1 },
    notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    notFoundText: { fontSize: 16 },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 17, fontWeight: '600', flex: 1, textAlign: 'center' },

    scrollContent: { paddingBottom: 40 },

    // Hero
    heroCard: {
        marginHorizontal: 12,
        marginBottom: 10,
        borderRadius: 14,
        borderWidth: 0.5,
        padding: 20,
        alignItems: 'center',
    },
    heroAvatar: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    heroAvatarText: { fontSize: 24, fontWeight: '800' },
    heroName: { fontSize: 20, fontWeight: '800', marginBottom: 6 },
    heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 14 },
    heroBadgeText: { fontSize: 13, fontWeight: '600' },
    contactRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
    contactText: { fontSize: 13 },

    // Cards
    card: { marginHorizontal: 12, marginBottom: 10, borderRadius: 14, borderWidth: 0.5, padding: 16 },
    sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },

    // Actions
    actionsGrid: { flexDirection: 'row', justifyContent: 'space-around' },
    actionBtn: { alignItems: 'center', gap: 6 },
    actionIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    actionLabel: { fontSize: 11, fontWeight: '600' },

    // Interview
    interviewRow: { flexDirection: 'row', gap: 10, paddingVertical: 10, borderBottomWidth: 0.5 },
    roundBadge: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    roundText: { fontSize: 12, fontWeight: '700' },
    interviewInfo: { flex: 1, gap: 2 },
    interviewDate: { fontSize: 13, fontWeight: '600' },
    interviewMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
    interviewMetaText: { fontSize: 11 },
    interviewStatusBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
    interviewStatusText: { fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
    interviewNotes: { fontSize: 12, marginTop: 4, fontStyle: 'italic' },

    // Notes
    noteText: { fontSize: 14, lineHeight: 20 },
    emptyText: { fontSize: 13, fontStyle: 'italic' },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
    modalContent: { width: '100%', borderRadius: 16, padding: 20, maxWidth: 400 },
    modalTitle: { fontSize: 17, fontWeight: '700', marginBottom: 16 },
    statusOption: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8, marginBottom: 2 },
    statusOptionText: { fontSize: 14, fontWeight: '500', flex: 1 },
});
