import CandidateProfileCard from '@/components/candidates/CandidateProfileCard';
import ContactHistoryCard from '@/components/candidates/ContactHistoryCard';
import ContactOutcomeSheet from '@/components/candidates/ContactOutcomeSheet';
import { AddDocumentSheet, DocumentList } from '@/components/candidates/DocumentSection';
import InterviewSchedulerSheet from '@/components/candidates/InterviewSchedulerSheet';
import InterviewCard from '@/components/InterviewCard';
import LoadingState from '@/components/LoadingState';
import NoteSheet from '@/components/candidates/NoteSheet';
import PdfViewerModal from '@/components/candidates/PdfViewerModal';
import ProgressSummaryCard from '@/components/roadmap/ProgressSummaryCard';
import QuickActionsBar from '@/components/candidates/QuickActionsBar';
import UnlockConfirmSheet from '@/components/roadmap/UnlockConfirmSheet';
import ScreenHeader from '@/components/ScreenHeader';
import StatusStepper from '@/components/StatusStepper';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useContactOutcome } from '@/hooks/useContactOutcome';
import { useDocumentManager } from '@/hooks/useDocumentManager';
import { useInterviewScheduler } from '@/hooks/useInterviewScheduler';
import { addCandidateActivity, fetchCandidate } from '@/lib/recruitment';
import { fetchCandidateRoadmap, unlockProgrammeForCandidate } from '@/lib/roadmap';
import type { CandidateActivity, Interview, RecruitmentCandidate } from '@/types/recruitment';
import type { ProgrammeWithModules } from '@/types/roadmap';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

export default function CandidateDetailScreen() {
    const { candidateId } = useLocalSearchParams<{ candidateId: string }>();
    const { colors } = useTheme();
    const { user } = useAuth();
    const router = useRouter();

    const [candidate, setCandidate] = useState<RecruitmentCandidate | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [callLog, setCallLog] = useState<CandidateActivity[]>([]);
    const [showNoteSheet, setShowNoteSheet] = useState(false);
    const [noteSheetText, setNoteSheetText] = useState('');

    // Roadmap
    const role = user?.role ?? '';
    const canMarkComplete = role === 'admin' || role === 'pa' || role === 'manager' || role === 'director';
    const [programmes, setProgrammes] = useState<ProgrammeWithModules[]>([]);
    const [showUnlockSheet, setShowUnlockSheet] = useState(false);
    const [isUnlocking, setIsUnlocking] = useState(false);
    const [unlockError, setUnlockError] = useState<string | null>(null);

    // Document Manager Hook
    const docManager = useDocumentManager({ candidateId: candidateId || '' });
    const {
        documents, showPdf, pdfUrl, pdfTitle, showAddDoc, addDocLabel, addDocCustomLabel, addDocStep, addDocError,
        hasDocumentPicker, setShowPdf, setShowAddDoc, setAddDocLabel, setAddDocCustomLabel,
        handleViewDocument, handleDeleteDocument, handleSelectLabel, pickAndUploadDocument, openAddDocSheet,
    } = docManager;

    // Contact Outcome Hook
    const contactOutcome = useContactOutcome({
        candidateId: candidateId || '',
        candidateName: candidate?.name || '',
        candidatePhone: candidate?.phone || '',
        userId: user?.id,
        userName: user?.full_name,
        onActivityLogged: useCallback((activity: CandidateActivity) => {
            setCallLog((prev) => [activity, ...prev]);
        }, []),
    });
    const {
        pendingType, showConfirmSheet, confirmStep, selectedOutcome, noteText, setNoteText,
        handleCall, handleWhatsApp, handleOutcomeSelect, handleSaveActivity, handleDismissSheet,
    } = contactOutcome;

    // Interview Scheduler Hook
    const scheduler = useInterviewScheduler({
        candidateId: candidateId || '',
        candidateManagerId: candidate?.assigned_manager_id || '',
        candidateInterviewCount: candidate?.interviews.length ?? 0,
        userId: user?.id,
        onInterviewChanged: useCallback((action: 'created' | 'updated' | 'deleted', interview: Interview) => {
            if (action === 'created') {
                setCandidate((prev) => (prev ? { ...prev, interviews: [interview, ...prev.interviews] } : prev));
            } else if (action === 'updated') {
                setCandidate((prev) =>
                    prev ? { ...prev, interviews: prev.interviews.map((iv) => (iv.id === interview.id ? interview : iv)) } : prev,
                );
            } else if (action === 'deleted') {
                setCandidate((prev) =>
                    prev ? { ...prev, interviews: prev.interviews.filter((iv) => iv.id !== interview.id) } : prev,
                );
            }
        }, []),
    });
    const {
        showScheduleSheet, editingInterview, scheduleStatus, scheduleDate, scheduleHour, scheduleMinute,
        scheduleAmPm, scheduleType, scheduleLink, scheduleLocation, scheduleNotes, isScheduling, scheduleError,
        setScheduleDate, setScheduleHour, setScheduleMinute, setScheduleAmPm, setScheduleType, setScheduleLink,
        setScheduleLocation, setScheduleNotes, setScheduleStatus, openNewInterview, openEditInterview,
        dismissScheduleSheet, handleDeleteInterview, handleSubmitSchedule,
    } = scheduler;

    // Bottom-sheet spring animations
    const confirmSheetY = useSharedValue(400);
    const noteSheetY = useSharedValue(400);
    const scheduleSheetY = useSharedValue(400);
    const addDocSheetY = useSharedValue(400);

    useEffect(() => {
        confirmSheetY.value = showConfirmSheet
            ? withSpring(0, { damping: 22, stiffness: 220 })
            : withSpring(400, { damping: 22, stiffness: 220 });
    }, [showConfirmSheet, confirmSheetY]);

    useEffect(() => {
        noteSheetY.value = showNoteSheet
            ? withSpring(0, { damping: 22, stiffness: 220 })
            : withSpring(400, { damping: 22, stiffness: 220 });
    }, [showNoteSheet, noteSheetY]);

    useEffect(() => {
        scheduleSheetY.value = showScheduleSheet
            ? withSpring(0, { damping: 22, stiffness: 220 })
            : withSpring(400, { damping: 22, stiffness: 220 });
    }, [showScheduleSheet, scheduleSheetY]);

    useEffect(() => {
        addDocSheetY.value = showAddDoc
            ? withSpring(0, { damping: 22, stiffness: 220 })
            : withSpring(400, { damping: 22, stiffness: 220 });
    }, [showAddDoc, addDocSheetY]);

    const confirmSheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: confirmSheetY.value }] }));
    const noteSheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: noteSheetY.value }] }));
    const scheduleSheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: scheduleSheetY.value }] }));
    const addDocSheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: addDocSheetY.value }] }));

    const loadCandidate = useCallback(async () => {
        if (!candidateId) return;
        setError(null);
        const { data, error: fetchError } = await fetchCandidate(candidateId);
        if (fetchError) { setError(fetchError); } else { setCandidate(data); }
        setIsLoading(false);
    }, [candidateId]);

    useEffect(() => { loadCandidate(); }, [loadCandidate]);
    useEffect(() => { if (candidateId) docManager.loadDocuments(); }, [candidateId]); // eslint-disable-line react-hooks/exhaustive-deps

    const loadRoadmap = useCallback(async () => {
        if (!candidateId || !canMarkComplete) return;
        const { data } = await fetchCandidateRoadmap(candidateId);
        if (data) setProgrammes(data);
    }, [candidateId, canMarkComplete]);

    useEffect(() => { loadRoadmap(); }, [loadRoadmap]);

    const handleUnlockConfirm = useCallback(async () => {
        if (!canMarkComplete || !user?.id || !candidateId) return;
        const sproutProgramme = programmes.find((p) => p.slug === 'sproutlyfe');
        if (!sproutProgramme) return;
        setIsUnlocking(true);
        setUnlockError(null);
        const { error: unlockErr } = await unlockProgrammeForCandidate(candidateId, sproutProgramme.id, user.id);
        setIsUnlocking(false);
        if (unlockErr) { setUnlockError(unlockErr); } else { setShowUnlockSheet(false); await loadRoadmap(); }
    }, [user?.id, candidateId, programmes, loadRoadmap]);

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <ScreenHeader showBack backLabel="Candidates" title="Loading..." />
                <LoadingState />
            </SafeAreaView>
        );
    }

    if (!candidate) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <ScreenHeader showBack backLabel="Candidates" title="Not Found" />
                <View style={styles.notFound}>
                    <Ionicons name="alert-circle-outline" size={48} color={colors.textTertiary} />
                    <Text style={[styles.notFoundText, { color: colors.textSecondary }]}>
                        {error || 'Candidate not found'}
                    </Text>
                    <TouchableOpacity onPress={() => router.back()}>
                        <Text style={{ color: colors.accent, fontWeight: '600' }}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const sortedInterviews = [...candidate.interviews].sort(
        (a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime(),
    );

    const handleSaveNote = () => {
        const text = noteSheetText.trim();
        if (!text) return;
        const activity: CandidateActivity = {
            id: `ca_${Date.now()}`,
            candidate_id: candidate.id,
            user_id: user?.id || 'me',
            type: 'note',
            outcome: null,
            note: text,
            created_at: new Date().toISOString(),
            actor_name: user?.full_name || undefined,
        };
        setCallLog((prev) => [activity, ...prev]);
        if (user?.id) addCandidateActivity(candidate.id, user.id, 'note', null, text);
        setNoteSheetText('');
        setShowNoteSheet(false);
    };

    const quickActions = [
        { icon: 'call', label: 'Call', color: colors.success, bgColor: colors.successLight, onPress: handleCall },
        { icon: 'logo-whatsapp', label: 'WhatsApp', color: colors.success, bgColor: colors.successLight, onPress: handleWhatsApp },
        { icon: 'calendar', label: 'Schedule', color: colors.warning, bgColor: colors.warningLight, onPress: openNewInterview },
        { icon: 'create-outline', label: 'Note', color: colors.textTertiary, bgColor: colors.surfacePrimary || colors.background, onPress: () => setShowNoteSheet(true) },
    ];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <ScreenHeader showBack backLabel="Candidates" title={candidate.name} />

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <CandidateProfileCard candidate={candidate} colors={colors} />
                <QuickActionsBar actions={quickActions} colors={colors} />

                {/* Documents */}
                <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                    <View style={styles.sectionHeaderRow}>
                        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Documents</Text>
                        {documents.length > 0 && (
                            <Text style={[styles.countBadge, { color: colors.textTertiary }]}>{documents.length}</Text>
                        )}
                    </View>
                    <DocumentList
                        documents={documents}
                        hasDocumentPicker={hasDocumentPicker}
                        colors={colors}
                        onViewDocument={handleViewDocument}
                        onDeleteDocument={handleDeleteDocument}
                        onAddDocument={openAddDocSheet}
                    />
                </View>

                <ContactHistoryCard callLog={callLog} colors={colors} />

                {/* Pipeline Progress */}
                <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Pipeline Progress</Text>
                    <StatusStepper currentStatus={candidate.status} colors={colors} />
                </View>

                {/* Development Roadmap */}
                {canMarkComplete && programmes.length > 0 && (
                    <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder, padding: 0, overflow: 'hidden' }]}>
                        <ProgressSummaryCard
                            programmes={programmes}
                            onViewFull={() => router.push(`/(tabs)/candidates/progress/${candidateId}` as any)}
                            colors={colors}
                        />
                        {programmes.some((p) => p.slug === 'sproutlyfe' && p.isLocked) && (
                            <View style={[styles.unlockRow, { borderTopColor: colors.border }]}>
                                {unlockError && (
                                    <Text style={[styles.unlockError, { color: colors.danger }]}>{unlockError}</Text>
                                )}
                                <TouchableOpacity
                                    style={[styles.unlockBtn, { borderColor: colors.accent }]}
                                    onPress={() => { setUnlockError(null); setShowUnlockSheet(true); }}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="lock-open-outline" size={15} color={colors.accent} />
                                    <Text style={[styles.unlockBtnText, { color: colors.accent }]}>Unlock SproutLYFE</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                )}

                {/* Notes */}
                {candidate.notes && (
                    <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Notes</Text>
                        <Text style={[styles.notesBody, { color: colors.textSecondary }]}>{candidate.notes}</Text>
                    </View>
                )}

                {/* Interviews */}
                <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                    <View style={styles.sectionHeaderRow}>
                        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Interviews</Text>
                        <Text style={[styles.countBadge, { color: colors.textTertiary }]}>{sortedInterviews.length}</Text>
                    </View>
                    {sortedInterviews.length === 0 ? (
                        <View style={styles.emptyInterviews}>
                            <Ionicons name="videocam-off-outline" size={32} color={colors.textTertiary} />
                            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No interviews yet</Text>
                        </View>
                    ) : (
                        sortedInterviews.map((interview) => (
                            <InterviewCard
                                key={interview.id}
                                interview={interview}
                                colors={colors}
                                onEdit={() => openEditInterview(interview)}
                                onDelete={() => handleDeleteInterview(interview)}
                            />
                        ))
                    )}
                </View>
            </ScrollView>

            <ContactOutcomeSheet
                visible={showConfirmSheet} colors={colors} animatedStyle={confirmSheetStyle}
                pendingType={pendingType} confirmStep={confirmStep} selectedOutcome={selectedOutcome}
                noteText={noteText} candidateName={candidate.name} candidatePhone={candidate.phone}
                onNoteTextChange={setNoteText} onOutcomeSelect={handleOutcomeSelect}
                onSaveActivity={handleSaveActivity} onDismiss={handleDismissSheet}
            />

            <NoteSheet
                visible={showNoteSheet} noteText={noteSheetText} colors={colors} animatedStyle={noteSheetStyle}
                onNoteTextChange={setNoteSheetText} onSave={handleSaveNote} onClose={() => setShowNoteSheet(false)}
            />

            <InterviewSchedulerSheet
                visible={showScheduleSheet} colors={colors} animatedStyle={scheduleSheetStyle}
                editingInterview={editingInterview} candidateInterviewCount={candidate?.interviews.length ?? 0}
                scheduleDate={scheduleDate} scheduleHour={scheduleHour} scheduleMinute={scheduleMinute}
                scheduleAmPm={scheduleAmPm} scheduleType={scheduleType} scheduleLink={scheduleLink}
                scheduleLocation={scheduleLocation} scheduleNotes={scheduleNotes} scheduleStatus={scheduleStatus}
                scheduleError={scheduleError} isScheduling={isScheduling}
                onDateChange={setScheduleDate} onHourChange={setScheduleHour} onMinuteChange={setScheduleMinute}
                onAmPmChange={setScheduleAmPm} onTypeChange={setScheduleType} onLinkChange={setScheduleLink}
                onLocationChange={setScheduleLocation} onNotesChange={setScheduleNotes} onStatusChange={setScheduleStatus}
                onSubmit={handleSubmitSchedule} onDismiss={dismissScheduleSheet}
            />

            <AddDocumentSheet
                visible={showAddDoc} colors={colors} animatedStyle={addDocSheetStyle}
                addDocStep={addDocStep} addDocLabel={addDocLabel} addDocCustomLabel={addDocCustomLabel}
                addDocError={addDocError} onClose={() => setShowAddDoc(false)}
                onSelectLabel={handleSelectLabel} onCustomLabelChange={setAddDocCustomLabel}
                onPickAndUpload={pickAndUploadDocument}
            />

            <PdfViewerModal
                visible={showPdf} pdfUrl={pdfUrl} pdfTitle={pdfTitle}
                colors={colors} onClose={() => setShowPdf(false)}
            />

            <UnlockConfirmSheet
                visible={showUnlockSheet} candidateName={candidate?.name ?? ''}
                programmeName="SproutLYFE" isUnlocking={isUnlocking}
                onConfirm={handleUnlockConfirm} onCancel={() => setShowUnlockSheet(false)} colors={colors}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollView: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 40 },
    card: {
        borderRadius: 14,
        borderWidth: 0.5,
        padding: 16,
        marginBottom: 12,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
    countBadge: { fontSize: 13, fontWeight: '600' },
    notesBody: { fontSize: 14, lineHeight: 20 },
    emptyInterviews: {
        alignItems: 'center',
        paddingVertical: 24,
        gap: 8,
    },
    emptyText: { fontSize: 14 },
    notFound: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    notFoundText: { fontSize: 16, fontWeight: '600' },
    unlockRow: {
        borderTopWidth: StyleSheet.hairlineWidth,
        padding: 12,
        gap: 8,
    },
    unlockError: {
        fontSize: 13,
        textAlign: 'center',
    },
    unlockBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 10,
        borderWidth: 1,
    },
    unlockBtnText: {
        fontSize: 14,
        fontWeight: '600',
    },
});
