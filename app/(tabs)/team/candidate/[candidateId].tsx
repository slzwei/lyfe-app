import LoadingState from '@/components/LoadingState';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { addCandidateActivity, fetchCandidate, syncAgentToMKTR, updateCandidateStatus } from '@/lib/recruitment';
import { CANDIDATE_STATUS_CONFIG, type CandidateStatus, type RecruitmentCandidate } from '@/types/recruitment';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useSegments } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    KeyboardAvoidingView,
    Linking,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { isMockMode } from '@/lib/mockMode';

export default function CandidateDetailScreen() {
    const MOCK_OTP = isMockMode();
    const { colors } = useTheme();
    const { user } = useAuth();
    const router = useRouter();
    const { candidateId } = useLocalSearchParams<{ candidateId: string }>();
    const segments = useSegments();
    const isPaStack = segments.includes('pa' as never);
    const [showNoteModal, setShowNoteModal] = useState(false);
    const [noteText, setNoteText] = useState('');
    const [isSavingNote, setIsSavingNote] = useState(false);
    const [candidate, setCandidate] = useState<RecruitmentCandidate | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Sheet slide-up animations (overlay appears instantly; only the sheet slides)
    const noteSheetY = useRef(new Animated.Value(400)).current;

    useEffect(() => {
        if (showNoteModal) {
            noteSheetY.setValue(400);
            Animated.spring(noteSheetY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }).start();
        }
    }, [showNoteModal]);

    const loadCandidate = useCallback(async () => {
        if (MOCK_OTP) {
            const { MOCK_CANDIDATES } = require('../../candidates/index');
            const found = MOCK_CANDIDATES.find((c: RecruitmentCandidate) => c.id === candidateId);
            setCandidate(found || null);
            setIsLoading(false);
            return;
        }
        if (!candidateId) return;
        const { data } = await fetchCandidate(candidateId);
        setCandidate(data);
        setIsLoading(false);
    }, [candidateId]);

    useEffect(() => {
        loadCandidate();
    }, [loadCandidate]);

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <LoadingState />
            </SafeAreaView>
        );
    }

    if (!candidate) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <Text style={{ color: colors.textPrimary, padding: 20 }}>Candidate not found</Text>
            </SafeAreaView>
        );
    }

    const statusConfig = CANDIDATE_STATUS_CONFIG[candidate.status];

    const handleStatusChange = async (newStatus: CandidateStatus) => {
        if (newStatus === candidate.status) return;
        const prevStatus = candidate.status;
        setCandidate(prev => prev ? { ...prev, status: newStatus } : null);

        if (!MOCK_OTP) {
            const { error } = await updateCandidateStatus(candidate.id, newStatus);
            if (error) {
                setCandidate(prev => prev ? { ...prev, status: prevStatus } : null);
                Alert.alert('Error', error);
                return;
            }
            const newConfig = CANDIDATE_STATUS_CONFIG[newStatus];
            if (newStatus === 'active_agent') {
                syncAgentToMKTR({
                    email: candidate.email,
                    name: candidate.name,
                    phone: candidate.phone,
                }).then((result: { success: boolean; error?: string }) => {
                    if (result.success) {
                        Alert.alert('Agent Activated', `${candidate.name} is now active and synced to MKTR for lead assignment.`);
                    } else {
                        Alert.alert('Status Updated', `Changed to ${newConfig.label}\n\nMKTR sync failed: ${result.error}. The agent may need to be manually added to MKTR.`);
                    }
                });
            } else {
                Alert.alert('Status Updated', `Changed to ${newConfig.label}`);
            }
            loadCandidate();
        }
    };

    const handleSaveNote = async () => {
        if (!noteText.trim()) return;
        setIsSavingNote(true);
        if (!MOCK_OTP && user?.id && candidate.id) {
            await addCandidateActivity(candidate.id, user.id, 'note', null, noteText.trim());
        }
        setIsSavingNote(false);
        setNoteText('');
        setShowNoteModal(false);
    };

    const actions = [
        { icon: 'calendar-outline', label: 'Schedule', onPress: () => router.push(isPaStack ? `/(tabs)/pa/candidate/${candidateId}` as any : `/(tabs)/candidates/${candidateId}` as any) },
        { icon: 'create-outline', label: 'Note', onPress: () => { setNoteText(''); setShowNoteModal(true); } },
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
                    <StatusStepper currentStatus={candidate.status} colors={colors} onStepPress={handleStatusChange} />
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

            {/* Note Modal */}
            <Modal visible={showNoteModal} transparent animationType="none" onRequestClose={() => setShowNoteModal(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                    <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowNoteModal(false)}>
                        <Animated.View style={[styles.noteSheet, { backgroundColor: colors.cardBackground, transform: [{ translateY: noteSheetY }] }]}>
                            <View style={[styles.noteHandle, { backgroundColor: colors.border }]} />
                            <Text style={[styles.noteTitle, { color: colors.textPrimary }]}>Add Note</Text>
                            <TextInput
                                style={[styles.noteInput, { backgroundColor: colors.inputBackground, color: colors.textPrimary, borderColor: colors.border }]}
                                value={noteText}
                                onChangeText={setNoteText}
                                placeholder="Write a note about this candidate..."
                                placeholderTextColor={colors.textTertiary}
                                multiline
                                autoFocus
                            />
                            <TouchableOpacity
                                style={[styles.noteSaveBtn, { backgroundColor: colors.accent, opacity: isSavingNote || !noteText.trim() ? 0.5 : 1 }]}
                                onPress={handleSaveNote}
                                disabled={isSavingNote || !noteText.trim()}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.noteSaveBtnText}>{isSavingNote ? 'Saving…' : 'Save Note'}</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    </TouchableOpacity>
                </KeyboardAvoidingView>
            </Modal>

        </SafeAreaView>
    );
}

function StatusStepper({ currentStatus, colors, onStepPress }: { currentStatus: CandidateStatus; colors: any; onStepPress: (status: CandidateStatus) => void }) {
    const steps: CandidateStatus[] = ['applied', 'interview_scheduled', 'interviewed', 'approved', 'exam_prep', 'licensed', 'active_agent'];
    const currentIdx = steps.indexOf(currentStatus);

    return (
        <View style={stepperStyles.container}>
            {steps.map((step, idx) => {
                const cfg = CANDIDATE_STATUS_CONFIG[step];
                const isComplete = idx < currentIdx;
                const isCurrent = idx === currentIdx;
                const dotColor = isComplete || isCurrent ? cfg.color : colors.border;

                return (
                    <TouchableOpacity key={step} style={stepperStyles.stepRow} activeOpacity={0.6} onPress={() => onStepPress(step)}>
                        <View style={stepperStyles.dotCol}>
                            <View style={[stepperStyles.dot, { backgroundColor: dotColor, borderColor: dotColor }]}>
                                {isComplete && <Ionicons name="checkmark" size={10} color="#FFF" />}
                                {isCurrent && <View style={stepperStyles.activeDotInner} />}
                            </View>
                            {idx < steps.length - 1 && (
                                <View style={[stepperStyles.line, { backgroundColor: isComplete ? cfg.color : colors.border }]} />
                            )}
                        </View>
                        <Text style={[
                            stepperStyles.label,
                            { color: isCurrent ? cfg.color : isComplete ? colors.textPrimary : colors.textTertiary },
                            isCurrent && { fontWeight: '700' },
                        ]}>
                            {cfg.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
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

    // Note sheet
    noteSheet: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        paddingBottom: 40,
        gap: 12,
    },
    noteHandle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 4,
    },
    noteTitle: { fontSize: 18, fontWeight: '700' },
    noteInput: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 12,
        fontSize: 15,
        minHeight: 100,
        textAlignVertical: 'top',
    },
    noteSaveBtn: {
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    noteSaveBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
});

const stepperStyles = StyleSheet.create({
    container: { gap: 0 },
    stepRow: { flexDirection: 'row', alignItems: 'flex-start' },
    dotCol: { width: 24, alignItems: 'center' },
    dot: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    activeDotInner: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#FFF',
    },
    line: {
        width: 2,
        height: 18,
    },
    label: { fontSize: 13, marginLeft: 10, marginTop: 1 },
});
