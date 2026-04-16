import ContactOutcomeSheet from '@/components/candidates/ContactOutcomeSheet';
import { AddDocumentSheet, DocumentList, type GeneratedPdf } from '@/components/candidates/DocumentSection';
import HeroSection from '@/components/candidates/HeroSection';
import InterviewSchedulerSheet from '@/components/candidates/InterviewSchedulerSheet';
import InterviewCard from '@/components/InterviewCard';
import LoadingState from '@/components/LoadingState';
import NoteSheet from '@/components/candidates/NoteSheet';
import OnboardingChecklist from '@/components/candidates/OnboardingChecklist';
import PdfViewerModal from '@/components/candidates/PdfViewerModal';
import ProgressSummaryCard from '@/components/roadmap/ProgressSummaryCard';
import QuickActionsBar from '@/components/candidates/QuickActionsBar';
import ScreenHeader from '@/components/ScreenHeader';
import SectionCard, { DetailRow } from '@/components/candidates/SectionCard';
import UnlockConfirmSheet from '@/components/roadmap/UnlockConfirmSheet';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useContactOutcome } from '@/hooks/useContactOutcome';
import { useDocumentManager } from '@/hooks/useDocumentManager';
import { useInterviewScheduler } from '@/hooks/useInterviewScheduler';
import { addCandidateActivity, fetchCandidate, getGeneratedPdfUrl } from '@/lib/recruitment';
import { fetchCandidateRoadmap, unlockProgrammeForCandidate } from '@/lib/roadmap';
import type { CandidateActivity, CandidateStatus, Interview, RecruitmentCandidate } from '@/types/recruitment';
import { CANDIDATE_STATUS_CONFIG } from '@/types/recruitment';
import type { ProgrammeWithModules } from '@/types/roadmap';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useTypedRouter } from '@/hooks/useTypedRouter';
import { useSheetAnimation } from '@/hooks/useSheetAnimation';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActionSheetIOS,
    Alert,
    Dimensions,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

function formatAddress(p: RecruitmentCandidate['profile_details']): string | null {
    if (!p) return null;
    const parts = [
        p.address_block && `Blk ${p.address_block}`,
        p.address_street,
        p.address_unit && `#${p.address_unit}`,
        p.address_postal && `S(${p.address_postal})`,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : null;
}

function formatSalary(p: RecruitmentCandidate['profile_details']): string | null {
    if (!p?.expected_salary) return null;
    const period = p.salary_period ? ` / ${p.salary_period}` : '';
    return `$${p.expected_salary}${period}`;
}

export default function CandidateDetailScreen() {
    const { candidateId } = useLocalSearchParams<{ candidateId: string }>();
    const { colors } = useTheme();
    const { user } = useAuth();
    const router = useTypedRouter();

    const [candidate, setCandidate] = useState<RecruitmentCandidate | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [callLog, setCallLog] = useState<CandidateActivity[]>([]);
    const [showNoteSheet, setShowNoteSheet] = useState(false);
    const [noteSheetText, setNoteSheetText] = useState('');

    const role = user?.role ?? '';
    const canMarkComplete = role === 'admin' || role === 'pa' || role === 'manager' || role === 'director';
    const [programmes, setProgrammes] = useState<ProgrammeWithModules[]>([]);
    const [showUnlockSheet, setShowUnlockSheet] = useState(false);
    const [isUnlocking, setIsUnlocking] = useState(false);
    const [unlockError, setUnlockError] = useState<string | null>(null);

    // ── Hooks ──
    const docManager = useDocumentManager({ candidateId: candidateId || '' });
    const {
        documents,
        showPdf,
        pdfUrl,
        pdfTitle,
        showAddDoc,
        addDocLabel,
        addDocCustomLabel,
        addDocStep,
        addDocError,
        hasDocumentPicker,
        setShowPdf,
        setShowAddDoc,
        setAddDocCustomLabel,
        handleViewDocument,
        handleDeleteDocument,
        handleSelectLabel,
        pickAndUploadDocument,
        openAddDocSheet,
    } = docManager;

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
        pendingType,
        showConfirmSheet,
        confirmStep,
        selectedOutcome,
        noteText,
        setNoteText,
        handleCall,
        handleWhatsApp,
        handleOutcomeSelect,
        handleSaveActivity,
        handleDismissSheet,
    } = contactOutcome;

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
                    prev
                        ? {
                              ...prev,
                              interviews: prev.interviews.map((iv) => (iv.id === interview.id ? interview : iv)),
                          }
                        : prev,
                );
            } else if (action === 'deleted') {
                setCandidate((prev) =>
                    prev ? { ...prev, interviews: prev.interviews.filter((iv) => iv.id !== interview.id) } : prev,
                );
            }
        }, []),
    });
    const {
        showScheduleSheet,
        editingInterview,
        scheduleStatus,
        scheduleDate,
        scheduleHour,
        scheduleMinute,
        scheduleAmPm,
        scheduleType,
        scheduleLink,
        scheduleLocation,
        scheduleNotes,
        scheduleRecommendation,
        isScheduling,
        scheduleError,
        setScheduleDate,
        setScheduleHour,
        setScheduleMinute,
        setScheduleAmPm,
        setScheduleType,
        setScheduleLink,
        setScheduleLocation,
        setScheduleNotes,
        setScheduleStatus,
        setScheduleRecommendation,
        openNewInterview,
        openEditInterview,
        dismissScheduleSheet,
        handleDeleteInterview,
        handleSubmitSchedule,
    } = scheduler;

    // ── Sheet animations (slide up on open, slide down on dismiss) ──
    const screenH = Dimensions.get('window').height;
    const confirmSheetY = useSharedValue(screenH);
    const noteSheetY = useSharedValue(screenH);
    const scheduleSheetY = useSharedValue(screenH);
    const addDocSheetY = useSharedValue(screenH);

    const confirmSheetVisible = useSheetAnimation(showConfirmSheet, confirmSheetY);
    const noteSheetVisible = useSheetAnimation(showNoteSheet, noteSheetY);
    const scheduleSheetVisible = useSheetAnimation(showScheduleSheet, scheduleSheetY);
    const addDocSheetVisible = useSheetAnimation(showAddDoc, addDocSheetY);

    const confirmSheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: confirmSheetY.value }] }));
    const noteSheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: noteSheetY.value }] }));
    const scheduleSheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: scheduleSheetY.value }] }));
    const addDocSheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: addDocSheetY.value }] }));

    // ── Data loading ──
    const loadCandidate = useCallback(async () => {
        if (!candidateId) return;
        setError(null);
        const { data, error: fetchError } = await fetchCandidate(candidateId);
        if (fetchError) setError(fetchError);
        else setCandidate(data);
        setIsLoading(false);
    }, [candidateId]);

    useEffect(() => {
        loadCandidate();
    }, [loadCandidate]);
    useEffect(() => {
        if (candidateId) docManager.loadDocuments();
    }, [candidateId]); // eslint-disable-line react-hooks/exhaustive-deps

    const loadRoadmap = useCallback(async () => {
        if (!candidateId || !canMarkComplete) return;
        const { data } = await fetchCandidateRoadmap(candidateId);
        if (data) setProgrammes(data);
    }, [candidateId, canMarkComplete]);
    useEffect(() => {
        loadRoadmap();
    }, [loadRoadmap]);

    // ── Handlers ──
    const handleViewGeneratedPdf = useCallback(
        async (path: string, title: string) => {
            const url = await getGeneratedPdfUrl(path);
            if (url)
                docManager.handleViewDocument({
                    id: path,
                    candidate_id: '',
                    label: title,
                    file_name: '',
                    file_url: url,
                    created_at: '',
                });
        },
        [docManager],
    );

    const handleSaveNote = () => {
        const text = noteSheetText.trim();
        if (!text) return;
        const activity: CandidateActivity = {
            id: `ca_${Date.now()}`,
            candidate_id: candidate!.id,
            user_id: user?.id || 'me',
            type: 'note',
            outcome: null,
            note: text,
            created_at: new Date().toISOString(),
            actor_name: user?.full_name || undefined,
        };
        setCallLog((prev) => [activity, ...prev]);
        if (user?.id) addCandidateActivity(candidate!.id, user.id, 'note', null, text);
        setNoteSheetText('');
        setShowNoteSheet(false);
    };

    const handleStatusPress = () => {
        if (!candidate) return;
        const statuses = Object.entries(CANDIDATE_STATUS_CONFIG) as [
            CandidateStatus,
            (typeof CANDIDATE_STATUS_CONFIG)[CandidateStatus],
        ][];
        const options = statuses.sort(([, a], [, b]) => a.order - b.order).map(([, v]) => v.label);
        options.push('Cancel');

        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions(
                { options, cancelButtonIndex: options.length - 1, title: 'Change Status' },
                (idx) => {
                    if (idx < statuses.length) {
                        const [key] = statuses.sort(([, a], [, b]) => a.order - b.order)[idx];
                        import('@/lib/recruitment').then(({ updateCandidateStatus }) =>
                            updateCandidateStatus(candidate.id, key).then(({ error: e }) => {
                                if (e) Alert.alert('Error', e);
                                else setCandidate((prev) => (prev ? { ...prev, status: key } : prev));
                            }),
                        );
                    }
                },
            );
        } else {
            Alert.alert('Change Status', undefined, [
                ...statuses
                    .sort(([, a], [, b]) => a.order - b.order)
                    .map(([key, v]) => ({
                        text: v.label,
                        onPress: () => {
                            import('@/lib/recruitment').then(({ updateCandidateStatus }) =>
                                updateCandidateStatus(candidate.id, key).then(({ error: e }) => {
                                    if (e) Alert.alert('Error', e);
                                    else setCandidate((prev) => (prev ? { ...prev, status: key } : prev));
                                }),
                            );
                        },
                    })),
                { text: 'Cancel', style: 'cancel' },
            ]);
        }
    };

    const handleUnlockConfirm = useCallback(async () => {
        if (!canMarkComplete || !user?.id || !candidateId) return;
        const sproutProgramme = programmes.find((p) => p.slug === 'sproutlyfe');
        if (!sproutProgramme) return;
        setIsUnlocking(true);
        setUnlockError(null);
        const { error: unlockErr } = await unlockProgrammeForCandidate(candidateId, sproutProgramme.id, user.id);
        setIsUnlocking(false);
        if (unlockErr) setUnlockError(unlockErr);
        else {
            setShowUnlockSheet(false);
            await loadRoadmap();
        }
    }, [user?.id, candidateId, programmes, loadRoadmap, canMarkComplete]);

    // ── Guards ──
    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <ScreenHeader showBack backLabel="Back" title="Loading..." />
                <LoadingState />
            </SafeAreaView>
        );
    }
    if (!candidate) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <ScreenHeader showBack backLabel="Back" title="Not Found" />
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

    const p = candidate.profile_details;
    const disc = candidate.disc_results;
    const sortedInterviews = [...candidate.interviews].sort(
        (a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime(),
    );

    const quickActions = [
        {
            icon: 'call' as const,
            label: 'Call',
            color: colors.success,
            bgColor: colors.successLight,
            onPress: handleCall,
        },
        {
            icon: 'logo-whatsapp' as const,
            label: 'WhatsApp',
            color: colors.success,
            bgColor: colors.successLight,
            onPress: handleWhatsApp,
        },
        {
            icon: 'calendar' as const,
            label: 'Schedule',
            color: colors.warning,
            bgColor: colors.warningLight,
            onPress: openNewInterview,
        },
        {
            icon: 'create-outline' as const,
            label: 'Note',
            color: colors.textTertiary,
            bgColor: colors.surfacePrimary || colors.background,
            onPress: () => setShowNoteSheet(true),
        },
    ];

    const generatedPdfs: GeneratedPdf[] = [
        ...(candidate.profile_pdf_path
            ? [
                  {
                      label: 'Form',
                      title: 'Registration Form',
                      onView: () => handleViewGeneratedPdf(candidate.profile_pdf_path!, 'Registration Form'),
                  },
              ]
            : []),
        ...(candidate.disc_pdf_path
            ? [
                  {
                      label: 'DISC',
                      title: 'DISC Report',
                      onView: () => handleViewGeneratedPdf(candidate.disc_pdf_path!, 'DISC Report'),
                  },
              ]
            : []),
    ];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <ScreenHeader showBack backLabel="Back" title={candidate.name} />

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* ── Hero ── */}
                <HeroSection candidate={candidate} colors={colors} onStatusPress={handleStatusPress} />

                {/* ── Quick Actions ── */}
                <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
                    <QuickActionsBar actions={quickActions} colors={colors} />
                </View>

                {/* ── Onboarding Checklist ── */}
                <View style={{ marginTop: 12 }}>
                    <OnboardingChecklist candidate={candidate} documents={documents} colors={colors} />
                </View>

                {/* ── Personal Details ── */}
                {p && (
                    <SectionCard title="Personal Details" icon="person-outline" colors={colors}>
                        <DetailRow label="Full Name" value={p.full_name} colors={colors} />
                        <DetailRow label="Chinese Name" value={p.chinese_name} colors={colors} />
                        <DetailRow label="Alias" value={p.alias} colors={colors} />
                        <DetailRow label="Date of Birth" value={p.date_of_birth} colors={colors} />
                        <DetailRow label="Nationality" value={p.nationality} colors={colors} />
                        <DetailRow label="Race" value={p.race} colors={colors} />
                        <DetailRow label="Gender" value={p.gender} colors={colors} />
                        <DetailRow label="Marital Status" value={p.marital_status} colors={colors} />
                        <DetailRow label="Address" value={formatAddress(p)} colors={colors} />
                    </SectionCard>
                )}

                {/* ── Employment Details ── */}
                {p && (p.position_applied || p.expected_salary || p.date_available) && (
                    <SectionCard title="Employment Details" icon="briefcase-outline" colors={colors}>
                        <DetailRow label="Position" value={p.position_applied} colors={colors} />
                        <DetailRow label="Salary" value={formatSalary(p)} colors={colors} />
                        <DetailRow label="Available From" value={p.date_available} colors={colors} />
                    </SectionCard>
                )}

                {/* ── Emergency Contact ── */}
                {p && p.emergency_name && (
                    <SectionCard title="Emergency Contact" icon="alert-circle-outline" colors={colors}>
                        <DetailRow label="Name" value={p.emergency_name} colors={colors} />
                        <DetailRow label="Relationship" value={p.emergency_relationship} colors={colors} />
                        <DetailRow label="Phone" value={p.emergency_contact} colors={colors} />
                    </SectionCard>
                )}

                {/* ── Education ── */}
                {p && p.education && p.education.length > 0 && (
                    <SectionCard
                        title="Education"
                        icon="school-outline"
                        badge={`${p.education.length}`}
                        colors={colors}
                    >
                        {p.education.map((ed, i) => (
                            <View
                                key={i}
                                style={[
                                    styles.listItem,
                                    i > 0 && {
                                        borderTopWidth: StyleSheet.hairlineWidth,
                                        borderTopColor: colors.border,
                                    },
                                ]}
                            >
                                <Text style={[styles.listPrimary, { color: colors.textPrimary }]}>
                                    {ed.institution}
                                </Text>
                                <Text style={[styles.listSecondary, { color: colors.textSecondary }]}>
                                    {ed.qualification}
                                </Text>
                                {ed.year && (
                                    <Text style={[styles.listMeta, { color: colors.textTertiary }]}>{ed.year}</Text>
                                )}
                            </View>
                        ))}
                    </SectionCard>
                )}

                {/* ── Employment History ── */}
                {p && p.employment_history && p.employment_history.length > 0 && (
                    <SectionCard
                        title="Employment History"
                        icon="business-outline"
                        badge={`${p.employment_history.length}`}
                        colors={colors}
                    >
                        {p.employment_history.map((job, i) => (
                            <View
                                key={i}
                                style={[
                                    styles.listItem,
                                    i > 0 && {
                                        borderTopWidth: StyleSheet.hairlineWidth,
                                        borderTopColor: colors.border,
                                    },
                                ]}
                            >
                                <Text style={[styles.listPrimary, { color: colors.textPrimary }]}>{job.company}</Text>
                                <Text style={[styles.listSecondary, { color: colors.textSecondary }]}>
                                    {job.position}
                                </Text>
                                <Text style={[styles.listMeta, { color: colors.textTertiary }]}>{job.period}</Text>
                                {job.reason_for_leaving && (
                                    <Text style={[styles.listMeta, { color: colors.textTertiary }]}>
                                        Left: {job.reason_for_leaving}
                                    </Text>
                                )}
                            </View>
                        ))}
                    </SectionCard>
                )}

                {/* ── Skills & Languages ── */}
                {p &&
                    ((p.languages && p.languages.length > 0) ||
                        p.software_competencies ||
                        p.shorthand_wpm ||
                        p.typing_wpm) && (
                        <SectionCard title="Skills & Languages" icon="language-outline" colors={colors}>
                            {p.languages &&
                                p.languages.length > 0 &&
                                p.languages.map((lang, i) => (
                                    <View key={i} style={styles.langRow}>
                                        <Text style={[styles.langName, { color: colors.textPrimary }]}>
                                            {lang.language}
                                        </Text>
                                        <Text style={[styles.langLevel, { color: colors.textSecondary }]}>
                                            Spoken: {lang.spoken}
                                        </Text>
                                        <Text style={[styles.langLevel, { color: colors.textSecondary }]}>
                                            Written: {lang.written}
                                        </Text>
                                    </View>
                                ))}
                            <DetailRow label="Software" value={p.software_competencies} colors={colors} />
                            <DetailRow
                                label="Shorthand"
                                value={p.shorthand_wpm ? `${p.shorthand_wpm} WPM` : null}
                                colors={colors}
                            />
                            <DetailRow
                                label="Typing"
                                value={p.typing_wpm ? `${p.typing_wpm} WPM` : null}
                                colors={colors}
                            />
                        </SectionCard>
                    )}

                {/* ── DISC Profile ── */}
                {disc && (
                    <SectionCard title="DISC Profile" icon="analytics-outline" colors={colors}>
                        <Text style={[styles.discType, { color: colors.accent }]}>{disc.disc_type}</Text>
                        <View style={styles.discGrid}>
                            {(['d_pct', 'i_pct', 's_pct', 'c_pct'] as const).map((key) => {
                                const label = key[0].toUpperCase();
                                const value = disc[key];
                                return (
                                    <View key={key} style={styles.discItem}>
                                        <View style={[styles.discBar, { backgroundColor: colors.surfaceSecondary }]}>
                                            <View
                                                style={[
                                                    styles.discFill,
                                                    { backgroundColor: colors.accent, height: `${value}%` },
                                                ]}
                                            />
                                        </View>
                                        <Text style={[styles.discLabel, { color: colors.textPrimary }]}>{label}</Text>
                                        <Text style={[styles.discValue, { color: colors.textTertiary }]}>{value}%</Text>
                                    </View>
                                );
                            })}
                        </View>
                    </SectionCard>
                )}

                {/* ── Documents ── */}
                <SectionCard
                    title="Documents"
                    icon="folder-outline"
                    badge={`${documents.length + generatedPdfs.length}`}
                    colors={colors}
                >
                    <DocumentList
                        documents={documents}
                        generatedPdfs={generatedPdfs}
                        hasDocumentPicker={hasDocumentPicker}
                        colors={colors}
                        onViewDocument={handleViewDocument}
                        onDeleteDocument={handleDeleteDocument}
                        onAddDocument={openAddDocSheet}
                    />
                </SectionCard>

                {/* ── Interviews ── */}
                <SectionCard
                    title="Interviews"
                    icon="videocam-outline"
                    badge={`${sortedInterviews.length}`}
                    colors={colors}
                >
                    {sortedInterviews.length === 0 ? (
                        <View style={styles.empty}>
                            <Ionicons name="videocam-off-outline" size={28} color={colors.textTertiary} />
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
                </SectionCard>

                {/* ── Contact Activity ── */}
                <SectionCard
                    title="Contact Activity"
                    icon="chatbubbles-outline"
                    badge={callLog.length > 0 ? `${callLog.length}` : undefined}
                    colors={colors}
                >
                    {callLog.length === 0 ? (
                        <View style={styles.empty}>
                            <Ionicons name="call-outline" size={28} color={colors.textTertiary} />
                            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                                No calls or messages logged yet
                            </Text>
                        </View>
                    ) : (
                        callLog.map((entry) => (
                            <View key={entry.id} style={[styles.activityRow, { borderBottomColor: colors.border }]}>
                                <Ionicons
                                    name={
                                        entry.type === 'call'
                                            ? 'call-outline'
                                            : entry.type === 'whatsapp'
                                              ? 'logo-whatsapp'
                                              : 'create-outline'
                                    }
                                    size={16}
                                    color={colors.textTertiary}
                                />
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.activityType, { color: colors.textPrimary }]}>
                                        {entry.type === 'call'
                                            ? 'Call'
                                            : entry.type === 'whatsapp'
                                              ? 'WhatsApp'
                                              : 'Note'}
                                        {entry.outcome ? ` — ${entry.outcome}` : ''}
                                    </Text>
                                    {entry.note && (
                                        <Text style={[styles.activityNote, { color: colors.textSecondary }]}>
                                            {entry.note}
                                        </Text>
                                    )}
                                    <Text style={[styles.activityTime, { color: colors.textTertiary }]}>
                                        {entry.actor_name ? `${entry.actor_name} · ` : ''}
                                        {new Date(entry.created_at).toLocaleString('en-SG', {
                                            day: 'numeric',
                                            month: 'short',
                                            hour: 'numeric',
                                            minute: '2-digit',
                                        })}
                                    </Text>
                                </View>
                            </View>
                        ))
                    )}
                </SectionCard>

                {/* ── Training Progress ── */}
                {canMarkComplete && programmes.length > 0 && (
                    <SectionCard title="Training Progress" icon="school-outline" colors={colors}>
                        <ProgressSummaryCard
                            programmes={programmes}
                            onViewFull={() => router.push(`/(tabs)/candidates/progress/${candidateId}`)}
                            colors={colors}
                        />
                        {programmes.some((prog) => prog.slug === 'sproutlyfe' && prog.isLocked) && (
                            <View style={[styles.unlockRow, { borderTopColor: colors.border }]}>
                                {unlockError && (
                                    <Text style={[styles.unlockError, { color: colors.danger }]}>{unlockError}</Text>
                                )}
                                <TouchableOpacity
                                    style={[styles.unlockBtn, { borderColor: colors.accent }]}
                                    onPress={() => {
                                        setUnlockError(null);
                                        setShowUnlockSheet(true);
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="lock-open-outline" size={15} color={colors.accent} />
                                    <Text style={[styles.unlockBtnText, { color: colors.accent }]}>
                                        Unlock SproutLYFE
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </SectionCard>
                )}

                {/* ── Notes ── */}
                {candidate.notes && (
                    <SectionCard title="Notes" icon="reader-outline" colors={colors}>
                        <Text style={[styles.notesBody, { color: colors.textSecondary }]}>{candidate.notes}</Text>
                    </SectionCard>
                )}
            </ScrollView>

            {/* ── Bottom Sheets ── */}
            <ContactOutcomeSheet
                visible={confirmSheetVisible}
                colors={colors}
                animatedStyle={confirmSheetStyle}
                pendingType={pendingType}
                confirmStep={confirmStep}
                selectedOutcome={selectedOutcome}
                noteText={noteText}
                candidateName={candidate.name}
                candidatePhone={candidate.phone}
                onNoteTextChange={setNoteText}
                onOutcomeSelect={handleOutcomeSelect}
                onSaveActivity={handleSaveActivity}
                onDismiss={handleDismissSheet}
            />
            <NoteSheet
                visible={noteSheetVisible}
                noteText={noteSheetText}
                colors={colors}
                animatedStyle={noteSheetStyle}
                onNoteTextChange={setNoteSheetText}
                onSave={handleSaveNote}
                onClose={() => setShowNoteSheet(false)}
            />
            <InterviewSchedulerSheet
                visible={scheduleSheetVisible}
                colors={colors}
                animatedStyle={scheduleSheetStyle}
                editingInterview={editingInterview}
                candidateInterviewCount={candidate.interviews.length}
                scheduleDate={scheduleDate}
                scheduleHour={scheduleHour}
                scheduleMinute={scheduleMinute}
                scheduleAmPm={scheduleAmPm}
                scheduleType={scheduleType}
                scheduleLink={scheduleLink}
                scheduleLocation={scheduleLocation}
                scheduleNotes={scheduleNotes}
                scheduleStatus={scheduleStatus}
                scheduleRecommendation={scheduleRecommendation}
                scheduleError={scheduleError}
                isScheduling={isScheduling}
                onDateChange={setScheduleDate}
                onHourChange={setScheduleHour}
                onMinuteChange={setScheduleMinute}
                onAmPmChange={setScheduleAmPm}
                onTypeChange={setScheduleType}
                onLinkChange={setScheduleLink}
                onLocationChange={setScheduleLocation}
                onNotesChange={setScheduleNotes}
                onStatusChange={setScheduleStatus}
                onRecommendationChange={setScheduleRecommendation}
                onSubmit={handleSubmitSchedule}
                onDismiss={dismissScheduleSheet}
            />
            <AddDocumentSheet
                visible={addDocSheetVisible}
                colors={colors}
                animatedStyle={addDocSheetStyle}
                addDocStep={addDocStep}
                addDocLabel={addDocLabel}
                addDocCustomLabel={addDocCustomLabel}
                addDocError={addDocError}
                onClose={() => setShowAddDoc(false)}
                onSelectLabel={handleSelectLabel}
                onCustomLabelChange={setAddDocCustomLabel}
                onPickAndUpload={pickAndUploadDocument}
            />
            <PdfViewerModal
                visible={showPdf}
                pdfUrl={pdfUrl}
                pdfTitle={pdfTitle}
                colors={colors}
                onClose={() => setShowPdf(false)}
            />
            <UnlockConfirmSheet
                visible={showUnlockSheet}
                candidateName={candidate.name}
                programmeName="SproutLYFE"
                isUnlocking={isUnlocking}
                onConfirm={handleUnlockConfirm}
                onCancel={() => setShowUnlockSheet(false)}
                colors={colors}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { paddingBottom: 40 },
    notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    notFoundText: { fontSize: 16, fontWeight: '600' },

    // List items (education, employment history)
    listItem: { paddingVertical: 10 },
    listPrimary: { fontSize: 14, fontWeight: '600' },
    listSecondary: { fontSize: 13, fontWeight: '500', marginTop: 2 },
    listMeta: { fontSize: 12, fontWeight: '400', marginTop: 2 },

    // Languages
    langRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
    langName: { fontSize: 13, fontWeight: '600', width: 80 },
    langLevel: { fontSize: 12, fontWeight: '400' },

    // DISC
    discType: { fontSize: 16, fontWeight: '800', textAlign: 'center', marginBottom: 12 },
    discGrid: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8 },
    discItem: { alignItems: 'center', gap: 6 },
    discBar: { width: 32, height: 80, borderRadius: 16, justifyContent: 'flex-end', overflow: 'hidden' },
    discFill: { width: '100%', borderRadius: 16 },
    discLabel: { fontSize: 14, fontWeight: '800' },
    discValue: { fontSize: 12, fontWeight: '500' },
    // Activity log
    activityRow: { flexDirection: 'row', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
    activityType: { fontSize: 13, fontWeight: '600' },
    activityNote: { fontSize: 13, marginTop: 2 },
    activityTime: { fontSize: 11, marginTop: 4 },

    // Empty state
    empty: { alignItems: 'center', paddingVertical: 20, gap: 8 },
    emptyText: { fontSize: 13 },

    // Notes
    notesBody: { fontSize: 14, lineHeight: 20 },

    // Unlock
    unlockRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, marginTop: 8, gap: 8 },
    unlockError: { fontSize: 13, textAlign: 'center' },
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
    unlockBtnText: { fontSize: 14, fontWeight: '600' },
});
