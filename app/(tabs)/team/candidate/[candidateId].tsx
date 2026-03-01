import PipelineStepper from '@/components/PipelineStepper';
import { useTheme } from '@/contexts/ThemeContext';
import { CANDIDATE_STATUS_CONFIG, MOCK_CANDIDATES } from '@/types/recruitment';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
    Alert,
    Linking,
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
    const [showStatusModal, setShowStatusModal] = useState(false);

    const candidate = useMemo(
        () => MOCK_CANDIDATES.find((c) => c.id === candidateId),
        [candidateId]
    );

    if (!candidate) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <Text style={{ color: colors.textPrimary, padding: 20 }}>Candidate not found</Text>
            </SafeAreaView>
        );
    }

    const statusConfig = CANDIDATE_STATUS_CONFIG[candidate.status];

    const actions = [
        { icon: 'swap-horizontal-outline', label: 'Status', onPress: () => setShowStatusModal(true) },
        { icon: 'calendar-outline', label: 'Schedule', onPress: () => Alert.alert('Coming Soon', 'Calendar integration in Phase 4B') },
        { icon: 'create-outline', label: 'Note', onPress: () => Alert.alert('Coming Soon', 'Notes will be saved to database') },
        { icon: 'call-outline', label: 'Call', onPress: () => Linking.openURL(`tel:${candidate.phone}`) },
    ];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Nav Header */}
            <View style={styles.navHeader}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color={colors.accent} />
                </TouchableOpacity>
                <Text style={[styles.navTitle, { color: colors.textPrimary }]}>{candidate.name}</Text>
                <View style={{ width: 32 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Profile Card */}
                <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
                    <View style={styles.profileHeader}>
                        <View style={[styles.avatar, { backgroundColor: colors.accentLight }]}>
                            <Text style={[styles.avatarText, { color: colors.accent }]}>
                                {candidate.name.charAt(0).toUpperCase()}
                            </Text>
                        </View>
                        <Text style={[styles.profileName, { color: colors.textPrimary }]}>
                            {candidate.name}
                        </Text>
                        <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '14' }]}>
                            <Text style={[styles.statusText, { color: statusConfig.color }]}>
                                {statusConfig.label}
                            </Text>
                        </View>
                    </View>

                    <View style={[styles.contactInfo, { borderTopColor: colors.border }]}>
                        <ContactRow icon="call-outline" value={candidate.phone} colors={colors} />
                        {candidate.email && <ContactRow icon="mail-outline" value={candidate.email} colors={colors} />}
                        {candidate.assigned_manager_name && (
                            <ContactRow icon="person-outline" value={`Manager: ${candidate.assigned_manager_name}`} colors={colors} />
                        )}
                    </View>
                </View>

                {/* Pipeline Progress */}
                <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Pipeline Progress</Text>
                    <PipelineStepper currentStatus={candidate.status} />
                </View>

                {/* Actions */}
                <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Actions</Text>
                    <View style={styles.actionsGrid}>
                        {actions.map((action) => (
                            <TouchableOpacity
                                key={action.label}
                                style={[styles.actionBtn, { backgroundColor: colors.background }]}
                                onPress={action.onPress}
                                activeOpacity={0.7}
                            >
                                <Ionicons name={action.icon as any} size={22} color={colors.accent} />
                                <Text style={[styles.actionLabel, { color: colors.textSecondary }]}>
                                    {action.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Interview History */}
                {candidate.interviews.length > 0 && (
                    <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
                        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                            Interview History ({candidate.interviews.length})
                        </Text>
                        {candidate.interviews.map((interview, index) => (
                            <View
                                key={interview.id}
                                style={[
                                    styles.interviewRow,
                                    index < candidate.interviews.length - 1 && {
                                        borderBottomColor: colors.border,
                                        borderBottomWidth: StyleSheet.hairlineWidth,
                                    },
                                ]}
                            >
                                <View style={[styles.roundBadge, { backgroundColor: colors.background }]}>
                                    <Text style={[styles.roundText, { color: colors.textSecondary }]}>
                                        R{interview.round_number}
                                    </Text>
                                </View>
                                <View style={styles.interviewInfo}>
                                    <Text style={[styles.interviewDate, { color: colors.textPrimary }]}>
                                        {new Date(interview.datetime).toLocaleDateString('en-SG', {
                                            day: 'numeric',
                                            month: 'short',
                                            year: 'numeric',
                                        })}
                                        {' · '}
                                        {new Date(interview.datetime).toLocaleTimeString('en-SG', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </Text>
                                    <View style={styles.interviewMeta}>
                                        <Ionicons
                                            name={interview.type === 'zoom' ? 'videocam-outline' : 'location-outline'}
                                            size={12}
                                            color={colors.textTertiary}
                                        />
                                        <Text style={[styles.interviewType, { color: colors.textTertiary }]}>
                                            {interview.type === 'zoom' ? 'Zoom' : 'In-Person'}
                                        </Text>
                                        <Text style={[
                                            styles.interviewStatus,
                                            {
                                                color: interview.status === 'completed' ? colors.success
                                                    : interview.status === 'scheduled' ? colors.accent
                                                        : colors.danger,
                                            },
                                        ]}>
                                            {interview.status.charAt(0).toUpperCase() + interview.status.slice(1)}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* Notes */}
                {candidate.notes && (
                    <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
                        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Notes</Text>
                        <Text style={[styles.notesText, { color: colors.textSecondary }]}>
                            {candidate.notes}
                        </Text>
                    </View>
                )}
            </ScrollView>

            {/* Status Change Modal */}
            <Modal visible={showStatusModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
                        <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Change Status</Text>
                        <Text style={[styles.modalSubtitle, { color: colors.textTertiary }]}>
                            Current: {statusConfig.label}
                        </Text>
                        {Object.entries(CANDIDATE_STATUS_CONFIG).map(([key, config]) => (
                            <TouchableOpacity
                                key={key}
                                style={[
                                    styles.statusOption,
                                    { borderBottomColor: colors.border },
                                    key === candidate.status && { backgroundColor: colors.accentLight },
                                ]}
                                onPress={() => {
                                    setShowStatusModal(false);
                                    Alert.alert('Status Updated', `Changed to ${config.label}`);
                                }}
                            >
                                <View style={[styles.statusDot, { backgroundColor: config.color }]} />
                                <Text style={[
                                    styles.statusOptionText,
                                    { color: key === candidate.status ? colors.accent : colors.textPrimary },
                                ]}>
                                    {config.label}
                                </Text>
                                {key === candidate.status && (
                                    <Ionicons name="checkmark" size={18} color={colors.accent} />
                                )}
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity
                            style={[styles.cancelBtn, { backgroundColor: colors.background }]}
                            onPress={() => setShowStatusModal(false)}
                        >
                            <Text style={[styles.cancelText, { color: colors.textPrimary }]}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

function ContactRow({ icon, value, colors }: { icon: string; value: string; colors: any }) {
    return (
        <View style={styles.contactRow}>
            <Ionicons name={icon as any} size={16} color={colors.textTertiary} />
            <Text style={[styles.contactValue, { color: colors.textSecondary }]}>{value}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    navHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
        paddingVertical: 8,
    },
    backBtn: { padding: 8 },
    navTitle: { fontSize: 17, fontWeight: '600' },
    scrollContent: { paddingBottom: 32 },

    // Card
    card: {
        marginHorizontal: 16,
        marginBottom: 8,
        borderRadius: 12,
        padding: 16,
    },
    sectionTitle: { fontSize: 17, fontWeight: '600', marginBottom: 12 },

    // Profile
    profileHeader: {
        alignItems: 'center',
        paddingBottom: 16,
    },
    avatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    avatarText: { fontSize: 26, fontWeight: '600' },
    profileName: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3, marginBottom: 6 },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: { fontSize: 13, fontWeight: '600' },

    // Contact
    contactInfo: {
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingTop: 14,
        gap: 10,
    },
    contactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    contactValue: { fontSize: 14 },

    // Actions
    actionsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    actionBtn: {
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        gap: 6,
    },
    actionLabel: { fontSize: 12, fontWeight: '500' },

    // Interviews
    interviewRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        gap: 12,
    },
    roundBadge: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    roundText: { fontSize: 13, fontWeight: '600' },
    interviewInfo: { flex: 1 },
    interviewDate: { fontSize: 14, fontWeight: '500' },
    interviewMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
    },
    interviewType: { fontSize: 12 },
    interviewStatus: { fontSize: 12, fontWeight: '600', marginLeft: 8 },

    // Notes
    notesText: { fontSize: 14, lineHeight: 20 },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        padding: 20,
        paddingBottom: 36,
    },
    modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
    modalSubtitle: { fontSize: 13, marginBottom: 16 },
    statusOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        gap: 10,
    },
    statusDot: { width: 10, height: 10, borderRadius: 5 },
    statusOptionText: { flex: 1, fontSize: 15, fontWeight: '500' },
    cancelBtn: {
        marginTop: 12,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    cancelText: { fontSize: 16, fontWeight: '600' },
});
