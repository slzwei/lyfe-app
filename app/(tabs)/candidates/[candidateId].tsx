import ContactOutcomeSheet from '@/components/candidates/ContactOutcomeSheet';
import { AddDocumentSheet, DocumentList, type GeneratedPdf } from '@/components/candidates/DocumentSection';
import HeroSection from '@/components/candidates/HeroSection';
import InterviewSchedulerSheet from '@/components/candidates/InterviewSchedulerSheet';
import InterviewCard from '@/components/InterviewCard';
import LicensedReadinessBanner from '@/components/candidates/LicensedReadinessBanner';
import LoadingState from '@/components/LoadingState';
import MilestoneMarkSheet from '@/components/candidates/MilestoneMarkSheet';
import MilestonesSection from '@/components/candidates/MilestonesSection';
import NoteSheet from '@/components/candidates/NoteSheet';
import OnboardingChecklist from '@/components/candidates/OnboardingChecklist';
import EmockScoresSection from '@/components/candidates/EmockScoresSection';
import PapersSection from '@/components/candidates/PapersSection';
import PdfViewerModal from '@/components/candidates/PdfViewerModal';
import PrepCourseMarkSheet from '@/components/candidates/PrepCourseMarkSheet';
import PrepCourseSection from '@/components/candidates/PrepCourseSection';
import ReassignManagerSheet from '@/components/candidates/ReassignManagerSheet';
import DeleteCandidateSheet from '@/components/candidates/DeleteCandidateSheet';
import RejectCandidateSheet from '@/components/candidates/RejectCandidateSheet';
import ActivateAgentSheet, { type ReadinessItem } from '@/components/candidates/ActivateAgentSheet';
import ProgressSummaryCard from '@/components/roadmap/ProgressSummaryCard';
import QuickActionsBar from '@/components/candidates/QuickActionsBar';
import ScreenHeader from '@/components/ScreenHeader';
import SectionCard, { DetailRow } from '@/components/candidates/SectionCard';
import UnlockConfirmSheet from '@/components/roadmap/UnlockConfirmSheet';
import { useAuth } from '@/contexts/AuthContext';
import { useCandidateProgressionContext } from '@/contexts/CandidateProgressionContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useContactOutcome } from '@/hooks/useContactOutcome';
import { useDocumentManager } from '@/hooks/useDocumentManager';
import { useInterviewScheduler } from '@/hooks/useInterviewScheduler';
import {
    activateAgent,
    addCandidateActivity,
    archiveCandidate,
    deleteCandidate,
    fetchAssignableManagers,
    fetchCandidate,
    getGeneratedPdfUrl,
    markCandidateLicensed,
    reassignCandidate,
    rejectCandidate,
    upsertMilestone,
    upsertPrepCourseBooking,
    type AssignableManager,
} from '@/lib/recruitment';
import {
    canActivateAgent,
    canArchiveCandidate,
    canDeleteCandidate,
    canManageMilestones,
    canPutOnHold,
    canReassignCandidates,
    canRejectCandidate,
    canVerifyPapers,
} from '@/types/shared/roles';
import { formatSgPhone } from '@/lib/phone';
import { fetchCandidateRoadmap, unlockProgrammeForCandidate } from '@/lib/roadmap';
import type {
    CandidateActivity,
    CandidateStatus,
    Interview,
    MilestoneCode,
    MilestoneStatus,
    PaperRequirement,
    PrepCourseCode,
    RecruitmentCandidate,
} from '@/types/recruitment';
import { CANDIDATE_STATUS_CONFIG } from '@/types/recruitment';
import type { ProgrammeWithModules } from '@/types/roadmap';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, usePathname } from 'expo-router';
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
    const pathname = usePathname();

    const [candidate, setCandidate] = useState<RecruitmentCandidate | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [callLog, setCallLog] = useState<CandidateActivity[]>([]);
    const [showNoteSheet, setShowNoteSheet] = useState(false);
    const [noteSheetText, setNoteSheetText] = useState('');

    // 4-tab structure (introduced 2026-04-22 via /impeccable:layout).
    // Previously all 13 sections rendered in one long scroll; managers had to scroll
    // past reference data to reach actionable content. Default to 'progress' which
    // is the daily-use view (papers, milestones, training state).
    type Tab = 'progress' | 'profile' | 'docs' | 'activity';
    const [tab, setTab] = useState<Tab>('progress');
    const handleTabChange = useCallback((next: Tab) => {
        setTab(next);
    }, []);

    // Papers — tapping a row pushes the attempts screen. Add/edit happens
    // there via a single modal, avoiding nested-modal complexity.

    // Milestones mark sheet state
    const [markingMilestone, setMarkingMilestone] = useState<MilestoneCode | null>(null);
    const [markingMilestoneLabel, setMarkingMilestoneLabel] = useState('');
    const [markMsStatus, setMarkMsStatus] = useState<MilestoneStatus>('not_started');
    const [markMsScheduledAt, setMarkMsScheduledAt] = useState<Date | null>(null);
    const [markMsScheduledEndAt, setMarkMsScheduledEndAt] = useState<Date | null>(null);
    const [markMsReferenceNumber, setMarkMsReferenceNumber] = useState('');
    const [markMsNote, setMarkMsNote] = useState('');
    const [isMarkingMs, setIsMarkingMs] = useState(false);
    const [markMsError, setMarkMsError] = useState<string | null>(null);

    // Prep-course mark sheet state
    const [markingPrepCourse, setMarkingPrepCourse] = useState<PrepCourseCode | null>(null);
    const [markingPrepCourseLabel, setMarkingPrepCourseLabel] = useState('');
    const [markPcBookedAt, setMarkPcBookedAt] = useState<Date | null>(null);
    const [markPcBookedEndAt, setMarkPcBookedEndAt] = useState<Date | null>(null);
    const [markPcAttended, setMarkPcAttended] = useState(false);
    const [markPcNote, setMarkPcNote] = useState('');
    const [isMarkingPc, setIsMarkingPc] = useState(false);
    const [markPcError, setMarkPcError] = useState<string | null>(null);

    // Licensed-readiness banner state
    const [isMarkingLicensed, setIsMarkingLicensed] = useState(false);
    const [licensedError, setLicensedError] = useState<string | null>(null);

    const role = user?.role ?? '';
    const canMarkComplete =
        role === 'admin' || role === 'pa' || role === 'ro' || role === 'manager' || role === 'director';
    const canConfirmLicensed =
        canVerifyPapers(role as Parameters<typeof canVerifyPapers>[0]) &&
        canManageMilestones(role as Parameters<typeof canManageMilestones>[0]);
    const canHoldCandidate = canPutOnHold(role as Parameters<typeof canPutOnHold>[0]);
    const canRejectCand = canRejectCandidate(role as Parameters<typeof canRejectCandidate>[0]);
    const canActivate = canActivateAgent(role as Parameters<typeof canActivateAgent>[0]);
    const canReassign = canReassignCandidates(role as Parameters<typeof canReassignCandidates>[0]);
    const canArchiveCand = canArchiveCandidate(role as Parameters<typeof canArchiveCandidate>[0]);
    const canDeleteCand = canDeleteCandidate(role as Parameters<typeof canDeleteCandidate>[0]);

    // ── Reject flow state ──
    const [showRejectSheet, setShowRejectSheet] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [rejectError, setRejectError] = useState<string | null>(null);
    const [isRejecting, setIsRejecting] = useState(false);

    // ── Archive / delete flow state ──
    const [showDeleteSheet, setShowDeleteSheet] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isArchiving, setIsArchiving] = useState(false);

    // ── Activate agent flow state ──
    const [showActivateSheet, setShowActivateSheet] = useState(false);
    const [activateError, setActivateError] = useState<string | null>(null);
    const [isActivating, setIsActivating] = useState(false);

    // ── Reassign manager flow state ──
    const [showReassignSheet, setShowReassignSheet] = useState(false);
    const [reassignManagers, setReassignManagers] = useState<AssignableManager[]>([]);
    const [isLoadingManagers, setIsLoadingManagers] = useState(false);
    const [isReassigning, setIsReassigning] = useState(false);
    const [reassignError, setReassignError] = useState<string | null>(null);
    const progression = useCandidateProgressionContext();
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
    const milestoneSheetY = useSharedValue(screenH);
    const prepCourseSheetY = useSharedValue(screenH);
    const rejectSheetY = useSharedValue(screenH);
    const activateSheetY = useSharedValue(screenH);
    const deleteSheetY = useSharedValue(screenH);

    const confirmSheetVisible = useSheetAnimation(showConfirmSheet, confirmSheetY);
    const noteSheetVisible = useSheetAnimation(showNoteSheet, noteSheetY);
    const scheduleSheetVisible = useSheetAnimation(showScheduleSheet, scheduleSheetY);
    const addDocSheetVisible = useSheetAnimation(showAddDoc, addDocSheetY);
    const milestoneSheetVisible = useSheetAnimation(!!markingMilestone, milestoneSheetY);
    const prepCourseSheetVisible = useSheetAnimation(!!markingPrepCourse, prepCourseSheetY);
    const rejectSheetVisible = useSheetAnimation(showRejectSheet, rejectSheetY);
    const activateSheetVisible = useSheetAnimation(showActivateSheet, activateSheetY);
    const deleteSheetVisible = useSheetAnimation(showDeleteSheet, deleteSheetY);

    const confirmSheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: confirmSheetY.value }] }));
    const noteSheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: noteSheetY.value }] }));
    const scheduleSheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: scheduleSheetY.value }] }));
    const addDocSheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: addDocSheetY.value }] }));
    const milestoneSheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: milestoneSheetY.value }] }));
    const prepCourseSheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: prepCourseSheetY.value }] }));
    const rejectSheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: rejectSheetY.value }] }));
    const activateSheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: activateSheetY.value }] }));
    const deleteSheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: deleteSheetY.value }] }));

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

    // Re-fetch docs + roadmap on focus. Progression is shared via
    // CandidateProgressionContext, so writes from pushed screens already
    // propagate — no refresh needed here.
    useFocusEffect(
        useCallback(() => {
            if (!candidateId) return;
            docManager.loadDocuments();
            loadRoadmap();
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [candidateId]),
    );

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
            if (url) docManager.openPdfViewer(url, title);
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

    const applyStatusChange = useCallback(
        async (key: CandidateStatus) => {
            if (!candidate) return;
            const { updateCandidateStatus } = await import('@/lib/recruitment');
            const { error: updateErr } = await updateCandidateStatus(candidate.id, key);
            if (updateErr) {
                Alert.alert('Error', updateErr);
                return;
            }
            // eapp_done is rewritten to exam_prep by a DB trigger — re-fetch to
            // reflect the server-authoritative status rather than the click value.
            if (key === 'eapp_done') {
                await loadCandidate();
            } else {
                setCandidate((prev) => (prev ? { ...prev, status: key } : prev));
            }
        },
        [candidate, loadCandidate],
    );

    const handleHoldPress = useCallback(() => {
        if (!candidate) return;
        Alert.alert(
            'Put on Hold?',
            `${candidate.name} will be moved to On Hold. Their current stage is preserved and can be restored when you resume them.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Put on Hold',
                    style: 'default',
                    onPress: () => {
                        void applyStatusChange('on_hold');
                    },
                },
            ],
        );
    }, [candidate, applyStatusChange]);

    const handleResumePress = useCallback(() => {
        if (!candidate) return;
        const target: CandidateStatus = candidate.stage_before_hold ?? 'applied';
        const label = CANDIDATE_STATUS_CONFIG[target].label;
        Alert.alert('Resume Candidate?', `${candidate.name} will be restored to ${label}.`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Resume',
                style: 'default',
                onPress: () => {
                    void applyStatusChange(target);
                },
            },
        ]);
    }, [candidate, applyStatusChange]);

    const openRejectSheet = useCallback(() => {
        setRejectReason('');
        setRejectError(null);
        setShowRejectSheet(true);
    }, []);

    // ── Activate agent readiness (derived from progression milestones) ──
    const activationReadiness = useCallback((): ReadinessItem[] => {
        const statusSatisfied = candidate?.status === 'licensed';
        const bdm = progression?.milestoneByCode?.bdm?.status;
        const bes = progression?.milestoneByCode?.bes_induction?.status;
        const rnf = progression?.milestoneByCode?.rnf?.status;
        const sa = progression?.milestoneByCode?.sales_authority?.status;
        return [
            {
                label: 'Status is Licensed',
                satisfied: statusSatisfied,
                detail: statusSatisfied
                    ? undefined
                    : `Current status: ${CANDIDATE_STATUS_CONFIG[candidate?.status ?? 'applied'].label}`,
            },
            { label: 'BDM Interview completed', satisfied: bdm === 'completed' },
            { label: 'BES Induction completed', satisfied: bes === 'completed' },
            { label: 'RNF issued', satisfied: rnf === 'issued' },
            { label: 'Sales Authority issued', satisfied: sa === 'issued' },
        ];
    }, [candidate?.status, progression?.milestoneByCode]);

    const openActivateSheet = useCallback(() => {
        setActivateError(null);
        setShowActivateSheet(true);
    }, []);

    const handleActivateSubmit = useCallback(async () => {
        if (!candidate) return;
        setActivateError(null);
        setIsActivating(true);
        const { error: actErr, warning } = await activateAgent(candidate.id);
        setIsActivating(false);
        if (actErr) {
            setActivateError(actErr);
            return;
        }
        setCandidate((prev) =>
            prev
                ? {
                      ...prev,
                      status: 'active_agent',
                  }
                : prev,
        );
        setShowActivateSheet(false);
        if (warning) {
            Alert.alert('Activated — session refresh needed', warning);
        } else {
            Alert.alert(
                'Agent activated',
                `${candidate.name} is now an active agent. They may need to sign out and back in to see their new role.`,
            );
        }
    }, [candidate]);

    const openReassignSheet = useCallback(async () => {
        if (!user?.id) return;
        setReassignError(null);
        setShowReassignSheet(true);
        setIsLoadingManagers(true);
        const { data, error: fetchErr } = await fetchAssignableManagers(
            user.id,
            role,
            candidate?.assigned_manager_id ?? null,
        );
        setIsLoadingManagers(false);
        if (fetchErr) setReassignError(fetchErr);
        else setReassignManagers(data);
    }, [user?.id, role, candidate?.assigned_manager_id]);

    const handleReassignSelect = useCallback(
        async (manager: AssignableManager) => {
            if (!candidate || !user?.id) return;
            setReassignError(null);
            setIsReassigning(true);
            const { error: reErr } = await reassignCandidate(candidate.id, manager.id, user.id);
            setIsReassigning(false);
            if (reErr) {
                setReassignError(reErr);
                return;
            }
            setCandidate((prev) =>
                prev
                    ? {
                          ...prev,
                          assigned_manager_id: manager.id,
                          assigned_manager_name: manager.full_name,
                      }
                    : prev,
            );
            setShowReassignSheet(false);
        },
        [candidate, user?.id],
    );

    const dismissRejectSheet = useCallback(() => {
        if (rejectReason.trim()) {
            Alert.alert('Discard rejection?', 'Your reason will not be saved.', [
                { text: 'Keep editing', style: 'cancel' },
                {
                    text: 'Discard',
                    style: 'destructive',
                    onPress: () => {
                        setShowRejectSheet(false);
                    },
                },
            ]);
        } else {
            setShowRejectSheet(false);
        }
    }, [rejectReason]);

    const handleRejectSubmit = useCallback(async () => {
        if (!candidate || !user?.id) return;
        setRejectError(null);
        setIsRejecting(true);
        const { error: rejErr } = await rejectCandidate(candidate.id, rejectReason, user.id);
        setIsRejecting(false);
        if (rejErr) {
            setRejectError(rejErr);
            return;
        }
        setCandidate((prev) =>
            prev
                ? {
                      ...prev,
                      status: 'rejected',
                      rejected_reason: rejectReason.trim(),
                      rejected_by_user_id: user.id,
                      rejected_at: new Date().toISOString(),
                  }
                : prev,
        );
        setShowRejectSheet(false);
    }, [candidate, user?.id, rejectReason]);

    const handleArchivePress = (archive: boolean) => {
        if (!candidate || isArchiving) return;
        Alert.alert(
            archive ? 'Archive Candidate' : 'Unarchive Candidate',
            archive
                ? `${candidate.name} will be moved to the Archived list and hidden from the active pipeline. You can unarchive them anytime.`
                : `${candidate.name} will be restored to the active pipeline.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: archive ? 'Archive' : 'Unarchive',
                    onPress: async () => {
                        setIsArchiving(true);
                        const { error: archiveErr } = await archiveCandidate(candidate.id, archive);
                        setIsArchiving(false);
                        if (archiveErr) {
                            Alert.alert('Could not update', archiveErr);
                            return;
                        }
                        // Q3: return to the candidate list after archive / unarchive.
                        router.back();
                    },
                },
            ],
        );
    };

    const openDeleteSheet = () => {
        setDeleteConfirmText('');
        setDeleteError(null);
        setShowDeleteSheet(true);
    };

    const dismissDeleteSheet = () => {
        if (isDeleting) return;
        setShowDeleteSheet(false);
    };

    const handleDeleteSubmit = useCallback(async () => {
        if (!candidate) return;
        setDeleteError(null);
        setIsDeleting(true);
        const { ok, error: delErr, code, warning } = await deleteCandidate(candidate.id);
        setIsDeleting(false);
        if (!ok) {
            if (code === 'candidate_completed_profile_and_quiz') {
                setShowDeleteSheet(false);
                Alert.alert(
                    'Archive instead',
                    delErr ?? 'This candidate has completed registration and quiz. Archive them instead of deleting.',
                );
                return;
            }
            setDeleteError(delErr ?? 'Failed to delete candidate.');
            return;
        }
        setShowDeleteSheet(false);
        if (warning) Alert.alert('Candidate deleted', warning);
        router.back();
    }, [candidate]);

    const handleMorePress = () => {
        if (!candidate) return;
        const isArchived = candidate.archived_at != null;
        type MoreAction = { key: 'archive' | 'unarchive' | 'delete'; label: string; destructive?: boolean };
        const moreActions: MoreAction[] = [];
        if (canArchiveCand) {
            moreActions.push(
                isArchived
                    ? { key: 'unarchive', label: 'Unarchive Candidate' }
                    : { key: 'archive', label: 'Archive Candidate' },
            );
        }
        if (canDeleteCand) {
            moreActions.push({ key: 'delete', label: 'Delete Candidate...', destructive: true });
        }
        if (moreActions.length === 0) return;

        const invoke = (action: MoreAction) => {
            if (action.key === 'delete') openDeleteSheet();
            else handleArchivePress(action.key === 'archive');
        };
        const options = [...moreActions.map((a) => a.label), 'Cancel'];

        if (Platform.OS === 'ios') {
            const destructiveIndex = moreActions.findIndex((a) => a.destructive);
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options,
                    cancelButtonIndex: options.length - 1,
                    destructiveButtonIndex: destructiveIndex >= 0 ? destructiveIndex : undefined,
                    title: 'Candidate Actions',
                },
                (idx) => {
                    if (idx < moreActions.length) invoke(moreActions[idx]);
                },
            );
        } else {
            Alert.alert('Candidate Actions', undefined, [
                ...moreActions.map((action) => ({
                    text: action.label,
                    style: action.destructive ? ('destructive' as const) : ('default' as const),
                    onPress: () => invoke(action),
                })),
                { text: 'Cancel', style: 'cancel' as const },
            ]);
        }
    };

    const handleStatusPress = () => {
        if (!candidate) return;
        // Direct status picks exclude:
        //  - active_agent (Phase G — activate-agent edge function)
        //  - licensed (goes via LicensedReadinessBanner which re-verifies papers + RNF)
        //  - on_hold (dedicated Put on Hold action below)
        //  - rejected (dedicated Reject action below — needs reason)
        const statuses = (
            Object.entries(CANDIDATE_STATUS_CONFIG) as [
                CandidateStatus,
                (typeof CANDIDATE_STATUS_CONFIG)[CandidateStatus],
            ][]
        )
            .filter(([key]) => key !== 'active_agent' && key !== 'licensed' && key !== 'on_hold' && key !== 'rejected')
            .sort(([, a], [, b]) => a.order - b.order);

        // Build contextual extra actions.
        type ExtraAction = {
            key: 'hold' | 'resume' | 'reject' | 'activate';
            label: string;
            destructive?: boolean;
        };
        const extras: ExtraAction[] = [];
        if (candidate.status === 'licensed' && canActivate) {
            extras.push({ key: 'activate', label: 'Activate as Agent...' });
        }
        if (candidate.status === 'on_hold') {
            extras.push({ key: 'resume', label: 'Resume Candidate' });
        } else if (candidate.status !== 'rejected' && canHoldCandidate) {
            extras.push({ key: 'hold', label: 'Put on Hold...' });
        }
        if (candidate.status !== 'rejected' && canRejectCand) {
            extras.push({ key: 'reject', label: 'Reject...', destructive: true });
        }

        const statusOptions = statuses.map(([, v]) => v.label);
        const extraOptions = extras.map((e) => e.label);
        const options = [...statusOptions, ...extraOptions, 'Cancel'];

        const invokeExtra = (extra: ExtraAction) => {
            if (extra.key === 'hold') handleHoldPress();
            else if (extra.key === 'resume') handleResumePress();
            else if (extra.key === 'reject') openRejectSheet();
            else if (extra.key === 'activate') openActivateSheet();
        };

        if (Platform.OS === 'ios') {
            const destructiveButtonIndex = extras.findIndex((e) => e.destructive);
            const adjustedDestructiveIndex =
                destructiveButtonIndex >= 0 ? statuses.length + destructiveButtonIndex : undefined;
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options,
                    cancelButtonIndex: options.length - 1,
                    destructiveButtonIndex: adjustedDestructiveIndex,
                    title: 'Change Status',
                },
                (idx) => {
                    if (idx < statuses.length) {
                        const [key] = statuses[idx];
                        void applyStatusChange(key);
                    } else if (idx < statuses.length + extras.length) {
                        invokeExtra(extras[idx - statuses.length]);
                    }
                },
            );
        } else {
            Alert.alert('Change Status', undefined, [
                ...statuses.map(([key, v]) => ({
                    text: v.label,
                    onPress: () => {
                        void applyStatusChange(key);
                    },
                })),
                ...extras.map((extra) => ({
                    text: extra.label,
                    style: extra.destructive ? ('destructive' as const) : ('default' as const),
                    onPress: () => invokeExtra(extra),
                })),
                { text: 'Cancel', style: 'cancel' },
            ]);
        }
    };

    const openPaperAttempts = useCallback(
        (req: PaperRequirement) => {
            if (!candidateId) return;
            // Push within the CURRENT tab's stack so Back returns to this
            // detail page rather than jumping tabs. pathname is e.g.
            //   /candidates/<id>              (candidates tab)
            //   /pa/candidate/<id>            (pa tab)
            //   /home/candidate/<id>          (home tab)
            // Replace the final <id> segment with papers/<id>/<code>.
            const base = pathname.replace(/\/[^/]+$/, '');
            router.push(`${base}/papers/${candidateId}/${req.code}` as Parameters<typeof router.push>[0]);
        },
        [candidateId, pathname, router],
    );

    const openMarkMilestone = useCallback(
        (code: MilestoneCode, label: string) => {
            const current = progression.milestoneByCode[code];
            setMarkingMilestone(code);
            setMarkingMilestoneLabel(label);
            setMarkMsStatus(current?.status ?? 'not_started');
            setMarkMsScheduledAt(current?.scheduled_date ? new Date(current.scheduled_date) : null);
            setMarkMsScheduledEndAt(current?.scheduled_end_date ? new Date(current.scheduled_end_date) : null);
            setMarkMsReferenceNumber(current?.reference_number ?? '');
            setMarkMsNote(current?.note ?? '');
            setMarkMsError(null);
        },
        [progression.milestoneByCode],
    );

    const dismissMarkMilestone = useCallback(() => {
        if (isMarkingMs) return;
        setMarkingMilestone(null);
        setMarkMsError(null);
    }, [isMarkingMs]);

    const handleSaveMilestone = useCallback(async () => {
        if (!candidateId || !markingMilestone) return;
        setIsMarkingMs(true);
        setMarkMsError(null);
        const { error: upsertErr } = await upsertMilestone(
            candidateId,
            markingMilestone,
            {
                status: markMsStatus,
                scheduledDate:
                    markMsStatus === 'scheduled' && markMsScheduledAt ? markMsScheduledAt.toISOString() : null,
                scheduledEndDate:
                    markMsStatus === 'scheduled' && markMsScheduledEndAt ? markMsScheduledEndAt.toISOString() : null,
                referenceNumber:
                    markingMilestone === 'rnf' && markMsStatus === 'issued' ? markMsReferenceNumber.trim() : null,
                note: markMsNote.trim() || null,
            },
            user?.id,
        );
        if (upsertErr) {
            setIsMarkingMs(false);
            setMarkMsError(upsertErr);
            return;
        }
        await progression.refresh();
        setIsMarkingMs(false);
        setMarkingMilestone(null);
    }, [
        candidateId,
        markingMilestone,
        markMsStatus,
        markMsScheduledAt,
        markMsScheduledEndAt,
        markMsReferenceNumber,
        markMsNote,
        user?.id,
        progression,
    ]);

    const openMarkPrepCourse = useCallback(
        (code: PrepCourseCode, label: string) => {
            const current = progression.prepCourseByCode[code];
            setMarkingPrepCourse(code);
            setMarkingPrepCourseLabel(label);
            setMarkPcBookedAt(current?.booked_date ? new Date(current.booked_date) : null);
            setMarkPcBookedEndAt(current?.booked_end_date ? new Date(current.booked_end_date) : null);
            setMarkPcAttended(current?.attended ?? false);
            setMarkPcNote(current?.note ?? '');
            setMarkPcError(null);
        },
        [progression.prepCourseByCode],
    );

    const dismissMarkPrepCourse = useCallback(() => {
        if (isMarkingPc) return;
        setMarkingPrepCourse(null);
        setMarkPcError(null);
    }, [isMarkingPc]);

    const handleSavePrepCourse = useCallback(async () => {
        if (!candidateId || !markingPrepCourse) return;
        setIsMarkingPc(true);
        setMarkPcError(null);
        const { error: upsertErr } = await upsertPrepCourseBooking(
            candidateId,
            markingPrepCourse,
            {
                bookedDate: markPcBookedAt ? markPcBookedAt.toISOString() : null,
                bookedEndDate: markPcBookedEndAt ? markPcBookedEndAt.toISOString() : null,
                attended: markPcAttended,
                note: markPcNote.trim() || null,
            },
            user?.id,
        );
        if (upsertErr) {
            setIsMarkingPc(false);
            setMarkPcError(upsertErr);
            return;
        }
        await progression.refresh();
        setIsMarkingPc(false);
        setMarkingPrepCourse(null);
    }, [
        candidateId,
        markingPrepCourse,
        markPcBookedAt,
        markPcBookedEndAt,
        markPcAttended,
        markPcNote,
        user?.id,
        progression,
    ]);

    const handleConfirmLicensed = useCallback(async () => {
        if (!candidate || !canConfirmLicensed) return;
        setIsMarkingLicensed(true);
        setLicensedError(null);
        const { error: updateErr } = await markCandidateLicensed(candidate.id);
        if (updateErr) {
            setIsMarkingLicensed(false);
            setLicensedError(updateErr);
            return;
        }
        setCandidate((prev) => (prev ? { ...prev, status: 'licensed' } : prev));
        await progression.refresh();
        setIsMarkingLicensed(false);
    }, [candidate, canConfirmLicensed, progression]);

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
                    <View style={{ flexDirection: 'row', gap: 20 }}>
                        <TouchableOpacity
                            onPress={() => {
                                setIsLoading(true);
                                loadCandidate();
                            }}
                        >
                            <Text style={{ color: colors.accent, fontWeight: '600' }}>Retry</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => router.back()}>
                            <Text style={{ color: colors.accent, fontWeight: '600' }}>Go Back</Text>
                        </TouchableOpacity>
                    </View>
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
            testID: 'candidate-action-call',
        },
        {
            icon: 'logo-whatsapp' as const,
            label: 'WhatsApp',
            color: colors.success,
            bgColor: colors.successLight,
            onPress: handleWhatsApp,
            testID: 'candidate-action-whatsapp',
        },
        {
            icon: 'calendar' as const,
            label: 'Schedule',
            color: colors.warning,
            bgColor: colors.warningLight,
            onPress: openNewInterview,
            testID: 'candidate-action-schedule',
        },
        {
            icon: 'create-outline' as const,
            label: 'Note',
            color: colors.textTertiary,
            bgColor: colors.surfacePrimary || colors.background,
            onPress: () => setShowNoteSheet(true),
            testID: 'candidate-action-note',
        },
        ...(canArchiveCand || canDeleteCand
            ? [
                  {
                      icon: 'ellipsis-horizontal' as const,
                      label: 'More',
                      color: colors.textTertiary,
                      bgColor: colors.surfacePrimary || colors.background,
                      onPress: handleMorePress,
                      testID: 'candidate-action-more',
                  },
              ]
            : []),
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
        ...(candidate.enneagram_pdf_path
            ? [
                  {
                      label: 'Enneagram',
                      title: 'Enneagram Report',
                      onView: () => handleViewGeneratedPdf(candidate.enneagram_pdf_path!, 'Enneagram Report'),
                  },
              ]
            : []),
    ];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <ScreenHeader showBack backLabel="Back" title={candidate.name} />

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* ── Hero (always visible — candidate identity) ── */}
                <HeroSection
                    candidate={candidate}
                    colors={colors}
                    onStatusPress={handleStatusPress}
                    canReassign={canReassign}
                    onReassignPress={openReassignSheet}
                />

                {/* ── Quick Actions (always visible — universal actions) ── */}
                <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
                    <QuickActionsBar actions={quickActions} colors={colors} />
                </View>

                {/* ── Onboarding Checklist (always visible — high-signal lifecycle status) ── */}
                <View style={{ marginTop: 28 }}>
                    <OnboardingChecklist candidate={candidate} documents={documents} colors={colors} />
                </View>

                {/* ── Tab bar: Progress | Profile | Docs | Activity ── */}
                <View style={[styles.tabBar, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
                    {(
                        [
                            { key: 'progress', label: 'Progress' },
                            { key: 'profile', label: 'Profile' },
                            {
                                key: 'docs',
                                label: 'Docs',
                                badge: documents.length + generatedPdfs.length,
                            },
                            { key: 'activity', label: 'Activity' },
                        ] as { key: Tab; label: string; badge?: number }[]
                    ).map(({ key, label, badge }) => {
                        const active = tab === key;
                        return (
                            <TouchableOpacity
                                key={key}
                                testID={`candidate-section-nav-${key}`}
                                onPress={() => handleTabChange(key)}
                                activeOpacity={0.7}
                                style={styles.tabButton}
                                accessibilityRole="tab"
                                accessibilityState={{ selected: active }}
                                accessibilityLabel={`${label}${badge ? `, ${badge} items` : ''}`}
                            >
                                <View style={styles.tabLabelRow}>
                                    <Text
                                        style={[
                                            styles.tabLabel,
                                            {
                                                color: active ? colors.textPrimary : colors.textSecondary,
                                                fontWeight: active ? '700' : '500',
                                            },
                                        ]}
                                    >
                                        {label}
                                    </Text>
                                    {badge !== undefined && badge > 0 ? (
                                        <View
                                            style={[
                                                styles.tabBadge,
                                                {
                                                    backgroundColor: active ? colors.accent : colors.surfaceSecondary,
                                                },
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.tabBadgeText,
                                                    {
                                                        color: active ? colors.textInverse : colors.textTertiary,
                                                    },
                                                ]}
                                            >
                                                {badge}
                                            </Text>
                                        </View>
                                    ) : null}
                                </View>
                                {active ? (
                                    <View style={[styles.tabUnderline, { backgroundColor: colors.accent }]} />
                                ) : (
                                    <View style={styles.tabUnderline} />
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* ══════════════════════════════════════════
                    PROFILE TAB — reference data about the candidate
                    ══════════════════════════════════════════ */}
                {tab === 'profile' && p && (
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
                {tab === 'profile' && p && (p.position_applied || p.expected_salary || p.date_available) && (
                    <SectionCard title="Employment Details" icon="briefcase-outline" colors={colors}>
                        <DetailRow label="Position" value={p.position_applied} colors={colors} />
                        <DetailRow label="Salary" value={formatSalary(p)} colors={colors} />
                        <DetailRow label="Available From" value={p.date_available} colors={colors} />
                    </SectionCard>
                )}

                {/* ── Emergency Contact ── */}
                {tab === 'profile' && p && p.emergency_name && (
                    <SectionCard title="Emergency Contact" icon="alert-circle-outline" colors={colors}>
                        <DetailRow label="Name" value={p.emergency_name} colors={colors} />
                        <DetailRow label="Relationship" value={p.emergency_relationship} colors={colors} />
                        <DetailRow label="Phone" value={formatSgPhone(p.emergency_contact)} colors={colors} />
                    </SectionCard>
                )}

                {/* ── Education ── */}
                {tab === 'profile' && p && p.education && p.education.length > 0 && (
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
                {tab === 'profile' && p && p.employment_history && p.employment_history.length > 0 && (
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
                {tab === 'profile' &&
                    p &&
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
                {tab === 'profile' && disc && (
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

                {/* ══════════════════════════════════════════
                    PROGRESS TAB — papers, milestones, training (default for managers)
                    ══════════════════════════════════════════ */}
                {tab === 'progress' && canMarkComplete && (
                    <>
                        {canConfirmLicensed &&
                            progression.allPapersPassed &&
                            progression.rnfIssued &&
                            candidate.status !== 'licensed' &&
                            candidate.status !== 'active_agent' && (
                                <LicensedReadinessBanner
                                    candidateName={candidate.name}
                                    rnfReferenceNumber={progression.milestoneByCode.rnf?.reference_number ?? null}
                                    isConfirming={isMarkingLicensed}
                                    error={licensedError}
                                    onConfirm={handleConfirmLicensed}
                                    colors={colors}
                                />
                            )}
                        <PapersSection
                            requirements={progression.paperRequirements}
                            colors={colors}
                            onMark={openPaperAttempts}
                        />
                        <EmockScoresSection summariesByCode={progression.emockSummariesByCode} colors={colors} />
                        <MilestonesSection
                            milestoneByCode={progression.milestoneByCode}
                            colors={colors}
                            onMark={openMarkMilestone}
                        />
                        <PrepCourseSection
                            prepCourseByCode={progression.prepCourseByCode}
                            colors={colors}
                            onMark={openMarkPrepCourse}
                        />
                    </>
                )}

                {/* ══════════════════════════════════════════
                    DOCS TAB — uploaded files + generated PDFs
                    ══════════════════════════════════════════ */}
                {tab === 'docs' && (
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
                )}

                {/* ══════════════════════════════════════════
                    ACTIVITY TAB — interviews, contact log, notes
                    ══════════════════════════════════════════ */}
                {tab === 'activity' && (
                    <>
                        <SectionCard
                            title="Interviews"
                            icon="videocam-outline"
                            badge={`${sortedInterviews.length}`}
                            colors={colors}
                        >
                            {sortedInterviews.length === 0 ? (
                                <View style={styles.empty}>
                                    <Ionicons name="videocam-off-outline" size={28} color={colors.textTertiary} />
                                    <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                                        No interviews yet
                                    </Text>
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
                                    <View
                                        key={entry.id}
                                        style={[styles.activityRow, { borderBottomColor: colors.border }]}
                                    >
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
                    </>
                )}

                {/* ── Training Progress (Progress tab) ── */}
                {tab === 'progress' && canMarkComplete && programmes.length > 0 && (
                    <SectionCard title="Training Progress" icon="school-outline" colors={colors}>
                        <ProgressSummaryCard
                            programmes={programmes}
                            onViewFull={() => {
                                // Same path-aware push as openPaperAttempts so
                                // back returns to this detail page in the
                                // current tab (not a jump to candidates tab).
                                const base = pathname.replace(/\/[^/]+$/, '');
                                router.push(`${base}/progress/${candidateId}` as Parameters<typeof router.push>[0]);
                            }}
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

                {/* ── Notes (Activity tab) ── */}
                {tab === 'activity' && candidate.notes && (
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
            <MilestoneMarkSheet
                visible={milestoneSheetVisible}
                colors={colors}
                animatedStyle={milestoneSheetStyle}
                milestoneCode={markingMilestone}
                milestoneLabel={markingMilestoneLabel}
                selectedStatus={markMsStatus}
                scheduledAt={markMsScheduledAt}
                scheduledEndAt={markMsScheduledEndAt}
                referenceNumber={markMsReferenceNumber}
                noteText={markMsNote}
                isSaving={isMarkingMs}
                error={markMsError}
                onStatusChange={setMarkMsStatus}
                onScheduledAtChange={setMarkMsScheduledAt}
                onScheduledEndAtChange={setMarkMsScheduledEndAt}
                onReferenceNumberChange={setMarkMsReferenceNumber}
                onNoteTextChange={setMarkMsNote}
                onSave={handleSaveMilestone}
                onDismiss={dismissMarkMilestone}
            />
            <PrepCourseMarkSheet
                visible={prepCourseSheetVisible}
                colors={colors}
                animatedStyle={prepCourseSheetStyle}
                courseCode={markingPrepCourse}
                courseLabel={markingPrepCourseLabel}
                bookedAt={markPcBookedAt}
                bookedEndAt={markPcBookedEndAt}
                attended={markPcAttended}
                noteText={markPcNote}
                isSaving={isMarkingPc}
                error={markPcError}
                onBookedAtChange={setMarkPcBookedAt}
                onBookedEndAtChange={setMarkPcBookedEndAt}
                onAttendedChange={setMarkPcAttended}
                onNoteTextChange={setMarkPcNote}
                onSave={handleSavePrepCourse}
                onDismiss={dismissMarkPrepCourse}
            />
            <RejectCandidateSheet
                visible={rejectSheetVisible}
                candidateName={candidate.name}
                reason={rejectReason}
                error={rejectError}
                isSubmitting={isRejecting}
                colors={colors}
                animatedStyle={rejectSheetStyle}
                onReasonChange={setRejectReason}
                onSubmit={handleRejectSubmit}
                onDismiss={dismissRejectSheet}
            />
            <DeleteCandidateSheet
                visible={deleteSheetVisible}
                candidateName={candidate.name}
                confirmText={deleteConfirmText}
                error={deleteError}
                isSubmitting={isDeleting}
                colors={colors}
                animatedStyle={deleteSheetStyle}
                onConfirmTextChange={setDeleteConfirmText}
                onSubmit={handleDeleteSubmit}
                onDismiss={dismissDeleteSheet}
            />
            <ActivateAgentSheet
                visible={activateSheetVisible}
                candidateName={candidate.name}
                readiness={activationReadiness()}
                error={activateError}
                isSubmitting={isActivating}
                colors={colors}
                animatedStyle={activateSheetStyle}
                onSubmit={handleActivateSubmit}
                onDismiss={() => setShowActivateSheet(false)}
            />
            <ReassignManagerSheet
                visible={showReassignSheet}
                candidateName={candidate.name}
                currentManagerName={candidate.assigned_manager_name ?? null}
                managers={reassignManagers}
                loading={isLoadingManagers}
                submitting={isReassigning}
                error={reassignError}
                colors={colors}
                onSelect={handleReassignSelect}
                onClose={() => {
                    if (!isReassigning) setShowReassignSheet(false);
                }}
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

    // ── Tab bar (introduced 2026-04-22 by /impeccable:layout) ───────
    tabBar: {
        flexDirection: 'row',
        marginTop: 24,
        marginBottom: 8,
        paddingHorizontal: 20,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    tabButton: {
        flex: 1,
        paddingTop: 12,
        alignItems: 'center',
    },
    tabLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 10,
    },
    tabLabel: {
        fontSize: 14,
        letterSpacing: -0.1,
    },
    tabBadge: {
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        paddingHorizontal: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabBadgeText: {
        fontSize: 11,
        fontWeight: '700',
    },
    tabUnderline: {
        height: 2,
        width: '60%',
        borderRadius: 1,
    },
});
