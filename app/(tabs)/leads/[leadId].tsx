import Confetti, { CONFETTI_DURATION } from '@/components/Confetti';
import { ActivityFeed } from '@/components/leads/ActivityFeed';
import ContactConfirmModal from '@/components/leads/ContactConfirmModal';
import NoteInput from '@/components/leads/NoteInput';
import ReassignModal from '@/components/leads/ReassignModal';
import RecordingCard from '@/components/leads/RecordingCard';
import { LogActivitySheet, type LogResult, type LogType } from '@/components/leads/LogActivitySheet';
import { FollowUpSheet } from '@/components/leads/FollowUpSheet';
import { KeyFactsSheet } from '@/components/leads/KeyFactsSheet';
import { LeadActionsSheet } from '@/components/leads/LeadActionsSheet';
import { ScPrConfirmDialog } from '@/components/leads/ScPrConfirmDialog';
import { Txt, Eyebrow, Monogram, StatusChip } from '@/components/leads/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useViewMode } from '@/contexts/ViewModeContext';
import { useLeadDetail } from '@/hooks/useLeadDetail';
import { timeAgo } from '@/lib/dateTime';
import { addLeadActivity, setLeadArchived } from '@/lib/leads';
import { scheduleFollowUpReminder, cancelFollowUpReminder, warnRemindersDisabled } from '@/lib/leads/reminders';
import {
    resolveLeadSource,
    displayLeadId,
    parseLeadNotes,
    timelineActivities,
    deriveFollowUp,
    deriveKeyFacts,
    type KeyFact,
} from '@/lib/leads/meta';
import {
    useLeadsTheme,
    useLeadsThemedStyles,
    alpha,
    spacing,
    radius,
    statusColors,
    pillText,
    STATUS_LABELS,
    type LeadsTheme,
} from '@/lib/leads/theme';
import { formatSgPhone } from '@/lib/phone';
import { LEAD_STATUSES, PRODUCT_LABELS, SOURCE_LABELS, type LeadStatus } from '@/types/lead';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

export default function LeadDetailScreen() {
    const { leadId } = useLocalSearchParams<{ leadId: string }>();
    const { colors } = useLeadsTheme();
    const styles = useLeadsThemedStyles(makeStyles);
    const { user } = useAuth();
    const { viewMode, canToggle } = useViewMode();
    const router = useRouter();
    const isManagerView = canToggle && viewMode === 'manager';
    const reduced = useReducedMotion();

    const {
        lead,
        activities,
        currentStatus,
        isLoading,
        error,
        setError,
        loadData,
        logActivity,
        handleChangeStatus,
        handleAddNote,
        handleOpenReassign,
        handleReassign,
        showReassignModal,
        setShowReassignModal,
        reassignAgents,
        isReassigning,
        showNoteInput,
        setShowNoteInput,
        noteText,
        setNoteText,
        isSavingNote,
        isUpdatingStatus,
    } = useLeadDetail({ leadId, userId: user?.id, userRole: user?.role, fullName: user?.full_name });

    // Contact confirmation (AppState-based) — preserved behavior.
    const [pendingContact, setPendingContact] = useState<{ type: 'call' | 'whatsapp'; phone: string } | null>(null);
    const [showContactConfirm, setShowContactConfirm] = useState(false);
    const hasPendingContact = useRef(false);
    const wentToBackground = useRef(false);

    // Won celebration (P4) — reuse the shared terracotta Confetti.
    const [showConfetti, setShowConfetti] = useState(false);
    const [confettiKey, setConfettiKey] = useState(0);
    const confettiTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    useEffect(() => () => clearTimeout(confettiTimer.current), []);

    // Rich activity logging (＋ Log) — owner-only.
    const [logOpen, setLogOpen] = useState(false);
    const [logType, setLogType] = useState<LogType>('note');
    const [logBusy, setLogBusy] = useState(false);

    // Follow-ups — owner-only.
    const [followUpOpen, setFollowUpOpen] = useState(false);
    const [followUpBusy, setFollowUpBusy] = useState(false);

    // Key facts — owner-only edit.
    const [keyFactsOpen, setKeyFactsOpen] = useState(false);
    const [keyFactsBusy, setKeyFactsBusy] = useState(false);

    // Archive actions — owner-only.
    const [actionsOpen, setActionsOpen] = useState(false);

    // SC/PR confirm gate before `qualified` (fires ConfirmedResident to Meta).
    const [scPrOpen, setScPrOpen] = useState(false);
    const [scPrBusy, setScPrBusy] = useState(false);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'background') {
                wentToBackground.current = true;
            } else if (nextState === 'active' && wentToBackground.current && hasPendingContact.current) {
                wentToBackground.current = false;
                setShowContactConfirm(true);
            }
        });
        return () => subscription.remove();
    }, []);

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.root, styles.center]} edges={['top']}>
                <ActivityIndicator testID="lead-detail-loading" color={colors.accent} />
            </SafeAreaView>
        );
    }

    if (!lead) {
        return (
            <SafeAreaView style={[styles.root, styles.center]} edges={['top']}>
                <View style={[styles.notFoundIcon, { backgroundColor: colors.surfaceAlt }]}>
                    <Ionicons name="alert-circle-outline" size={30} color={colors.textFaint} />
                </View>
                <Txt role="display" weight="semibold" size={19} color={colors.text}>
                    Lead not found
                </Txt>
                <Txt role="body" size={14} color={colors.textMuted} center style={{ marginTop: 4 }}>
                    This lead may have been removed
                </Txt>
                <TouchableOpacity
                    style={[styles.backBtn, { backgroundColor: colors.accent }]}
                    onPress={() => router.back()}
                >
                    <Txt role="body" weight="semibold" size={15} color={colors.textInverse}>
                        Go Back
                    </Txt>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    // Do-not-contact (MKTR suppression propagation): scope 'all' = the person
    // was erased / fully suppressed — every contact affordance hard-blocks.
    // 'marketing' renders the advisory banner but leaves service contact open.
    const dncBlocked = lead.do_not_contact_scope === 'all';

    const handleCall = () => {
        if (!lead.phone || dncBlocked) return;
        hasPendingContact.current = true;
        setPendingContact({ type: 'call', phone: lead.phone });
        if (process.env.EXPO_PUBLIC_E2E_LINKING_BYPASS === '1') {
            setShowContactConfirm(true);
        } else {
            Linking.openURL(`tel:${lead.phone.replace(/\s/g, '')}`);
        }
    };

    const handleWhatsApp = () => {
        if (!lead.phone || dncBlocked) return;
        hasPendingContact.current = true;
        setPendingContact({ type: 'whatsapp', phone: lead.phone });
        if (process.env.EXPO_PUBLIC_E2E_LINKING_BYPASS === '1') {
            setShowContactConfirm(true);
        } else {
            const phone = lead.phone.replace(/[\s+]/g, '');
            Linking.openURL(`https://wa.me/${phone}`);
        }
    };

    const handleContactConfirm = (outcome: 'reached' | 'no_answer' | 'sent' | 'skip') => {
        const pc = pendingContact;
        hasPendingContact.current = false;
        setPendingContact(null);
        setShowContactConfirm(false);
        if (!pc || outcome === 'skip') return;

        const displayPhone = formatSgPhone(pc.phone);
        const description =
            pc.type === 'call'
                ? outcome === 'reached'
                    ? `Called ${displayPhone} — reached`
                    : `Called ${displayPhone} — no answer`
                : `Sent WhatsApp to ${displayPhone}`;

        logActivity(pc.type, description, { phone: pc.phone, outcome });
        if (currentStatus === 'new') handleChangeStatus('contacted');
    };

    // Fired when a lead is moved to Won — a warm, auto-dismissing beat (brand brief).
    const celebrateWin = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        if (reduced) return; // respect prefers-reduced-motion
        setConfettiKey((k) => k + 1);
        setShowConfetti(true);
        clearTimeout(confettiTimer.current);
        confettiTimer.current = setTimeout(() => setShowConfetti(false), CONFETTI_DURATION);
    };

    const saveLog = async (r: LogResult) => {
        if (!user?.id || !leadId) return;
        setLogBusy(true);
        try {
            const desc = r.note || `${r.type.charAt(0).toUpperCase()}${r.type.slice(1)}`;
            await addLeadActivity(leadId, user.id, r.type, desc, {
                ...(r.outcome ? { outcome: r.outcome } : {}),
                ...(r.nextStep ? { next_step: r.nextStep } : {}),
            });
            if (r.followUp) {
                let reminderId: string | null = null;
                const res = await scheduleFollowUpReminder(r.followUp.at, lead.full_name || 'Lead', r.followUp.task);
                if (res.result === 'scheduled') reminderId = res.id;
                else if (res.result === 'denied') warnRemindersDisabled();
                await addLeadActivity(leadId, user.id, 'follow_up', r.followUp.task, {
                    next_follow_up_at: r.followUp.at.toISOString(),
                    task: r.followUp.task,
                    remind: r.followUp.remind,
                    ...(reminderId ? { reminder_id: reminderId } : {}),
                });
            }
            setLogOpen(false);
            await loadData();
        } finally {
            setLogBusy(false);
        }
    };

    const saveFollowUp = async (at: Date, task: string, remind: boolean) => {
        if (!user?.id || !leadId) return;
        setFollowUpBusy(true);
        try {
            // Reschedule: cancel any reminder from the prior follow-up first.
            const prior = activities.find((a) => a.type === 'follow_up');
            await cancelFollowUpReminder((prior?.metadata as { reminder_id?: string } | undefined)?.reminder_id);
            let reminderId: string | null = null;
            if (remind) {
                const res = await scheduleFollowUpReminder(at, lead.full_name || 'Lead', task);
                if (res.result === 'scheduled') reminderId = res.id;
                else if (res.result === 'denied') warnRemindersDisabled();
            }
            await addLeadActivity(leadId, user.id, 'follow_up', task, {
                next_follow_up_at: at.toISOString(),
                task,
                remind,
                ...(reminderId ? { reminder_id: reminderId } : {}),
            });
            setFollowUpOpen(false);
            await loadData();
        } finally {
            setFollowUpBusy(false);
        }
    };

    const saveKeyFacts = async (facts: KeyFact[]) => {
        if (!user?.id || !leadId) return;
        setKeyFactsBusy(true);
        try {
            await addLeadActivity(leadId, user.id, 'key_facts', null, { facts });
            setKeyFactsOpen(false);
            await loadData();
        } finally {
            setKeyFactsBusy(false);
        }
    };

    const doArchive = async () => {
        if (!user?.id || !leadId) return;
        setActionsOpen(false);
        await setLeadArchived(leadId, true, user.id);
        router.back(); // archived leads leave the active list
    };
    const doUnarchive = async () => {
        if (!user?.id || !leadId) return;
        setActionsOpen(false);
        await setLeadArchived(leadId, false, user.id);
        await loadData();
    };

    // Status changes. `qualified` is gated behind the SC/PR confirm (it reports a
    // ConfirmedResident conversion to Meta via the live outcome trigger); `won`
    // celebrates only on a confirmed transition.
    const onStatusPress = async (s: LeadStatus) => {
        if (s === currentStatus) return;
        if (s === 'qualified') {
            setScPrOpen(true);
            return;
        }
        const wasWon = currentStatus === 'won';
        const ok = await handleChangeStatus(s);
        if (ok && s === 'won' && !wasWon) celebrateWin();
    };
    const confirmScPrYes = async () => {
        setScPrBusy(true);
        const ok = await handleChangeStatus('qualified');
        setScPrBusy(false);
        if (ok) setScPrOpen(false);
    };
    const confirmScPrNo = async () => {
        if (!user?.id || !leadId) return;
        setScPrOpen(false);
        await addLeadActivity(leadId, user.id, 'note', 'Marked not Singapore Citizen / PR', { sc_pr: false });
        await loadData();
    };

    const src = resolveLeadSource(lead);
    const leadIdLabel = displayLeadId(lead);
    const mktrRows = lead.source_name === 'mktr' ? parseLeadNotes(lead.notes) : [];
    const tags = [PRODUCT_LABELS[lead.product_interest], src.label].filter(Boolean) as string[];
    const followUp = deriveFollowUp(activities);
    const followUpWhen = followUp
        ? new Date(followUp.at).toLocaleString('en-SG', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              hour: 'numeric',
              minute: '2-digit',
          })
        : null;
    const keyFacts = deriveKeyFacts(activities);

    return (
        <SafeAreaView style={styles.root} edges={['top']}>
            {/* top bar */}
            <View style={styles.topBar}>
                <Pressable
                    onPress={() => router.back()}
                    style={styles.pill}
                    testID="lead-back"
                    accessibilityRole="button"
                    accessibilityLabel="Back"
                    hitSlop={8}
                >
                    <Ionicons name="chevron-back" size={20} color={colors.accent} />
                </Pressable>
                <Txt role="mono" size={13} color={colors.textMuted} tracking={0.3}>
                    {leadIdLabel}
                </Txt>
                {isManagerView ? (
                    <Pressable
                        onPress={handleOpenReassign}
                        disabled={isReassigning}
                        style={styles.pill}
                        testID="lead-reassign-action"
                        accessibilityRole="button"
                        accessibilityLabel="Reassign lead"
                        hitSlop={8}
                    >
                        <Ionicons name="swap-horizontal" size={20} color={colors.textMuted} />
                    </Pressable>
                ) : (
                    <Pressable
                        onPress={() => setActionsOpen(true)}
                        style={styles.pill}
                        testID="lead-actions-action"
                        accessibilityRole="button"
                        accessibilityLabel="Lead actions"
                        hitSlop={8}
                    >
                        <Ionicons name="ellipsis-horizontal" size={20} color={colors.textMuted} />
                    </Pressable>
                )}
            </View>

            {isManagerView ? (
                <View testID="manager-banner" style={[styles.banner, { backgroundColor: alpha(colors.accent, 0.1) }]}>
                    <Ionicons name="eye-outline" size={15} color={colors.accent} />
                    <Txt role="body" size={13} color={colors.accent}>
                        Manager View — limited actions available.
                    </Txt>
                </View>
            ) : null}

            {error ? (
                <View testID="error-banner" style={[styles.banner, { backgroundColor: alpha(colors.danger, 0.1) }]}>
                    <Ionicons name="warning-outline" size={15} color={colors.danger} />
                    <Txt role="body" size={13} color={colors.danger} style={{ flex: 1 }}>
                        {error}
                    </Txt>
                    <Pressable onPress={loadData} hitSlop={8} accessibilityRole="button" accessibilityLabel="Retry">
                        <Txt role="body" weight="bold" size={13} color={colors.danger}>
                            Retry
                        </Txt>
                    </Pressable>
                    <Pressable
                        onPress={() => setError(null)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Dismiss error"
                    >
                        <Ionicons name="close" size={16} color={colors.danger} />
                    </Pressable>
                </View>
            ) : null}

            <KeyboardAwareScrollView
                contentContainerStyle={styles.scroll}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                bottomOffset={20}
            >
                {/* identity */}
                <View style={styles.identity}>
                    <Monogram name={lead.full_name} status={currentStatus} size={58} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                        <Txt
                            role="display"
                            weight="semibold"
                            size={26}
                            color={colors.text}
                            tracking={-0.5}
                            numberOfLines={2}
                        >
                            {lead.full_name || 'Unknown'}
                        </Txt>
                        {lead.phone ? (
                            <Txt role="mono" size={15} color={colors.textMuted} style={{ marginTop: 4 }}>
                                {formatSgPhone(lead.phone)}
                            </Txt>
                        ) : null}
                        {lead.email ? (
                            <Txt role="body" size={13.5} color={colors.textFaint} style={{ marginTop: 2 }}>
                                {lead.email}
                            </Txt>
                        ) : null}
                    </View>
                </View>

                {/* tags */}
                {tags.length ? (
                    <View style={styles.tagRow}>
                        {tags.map((t, i) => (
                            <View key={`${t}-${i}`} style={styles.tag}>
                                <Txt role="body" weight="semibold" size={13} color={colors.textMuted}>
                                    {t}
                                </Txt>
                            </View>
                        ))}
                    </View>
                ) : null}

                {/* won banner */}
                {currentStatus === 'won' ? (
                    <View style={styles.wonBanner}>
                        <Txt role="display" weight="bold" size={28} color={colors.textInverse} tracking={-0.4}>
                            Won!
                        </Txt>
                        <Txt
                            role="body"
                            weight="semibold"
                            size={13}
                            color={colors.textInverse}
                            style={{ marginTop: 4, opacity: 0.85 }}
                        >
                            Nice work closing this one.
                        </Txt>
                    </View>
                ) : null}

                {/* do-not-contact banner (MKTR suppression propagation) */}
                {lead.do_not_contact_at ? (
                    <View
                        testID="lead-dnc-banner"
                        style={[
                            styles.banner,
                            { backgroundColor: alpha(dncBlocked ? colors.danger : colors.warning, 0.12) },
                        ]}
                    >
                        <Ionicons name="ban" size={15} color={dncBlocked ? colors.danger : colors.warning} />
                        <Txt
                            role="body"
                            weight="semibold"
                            size={13}
                            color={dncBlocked ? colors.danger : colors.warning}
                            style={{ flex: 1 }}
                        >
                            {dncBlocked
                                ? 'Do not contact — this person withdrew all consent (PDPA). Calls and messages are blocked.'
                                : 'No marketing — this person unsubscribed. Service contact about their existing case is still OK.'}
                        </Txt>
                    </View>
                ) : null}

                {/* CTAs */}
                <View style={styles.ctaRow}>
                    <Pressable
                        onPress={handleCall}
                        disabled={!lead.phone || dncBlocked}
                        testID="lead-call-action"
                        accessibilityRole="button"
                        accessibilityLabel={`Call ${lead.full_name}`}
                        style={({ pressed }) => [
                            styles.cta,
                            styles.callCta,
                            (pressed || !lead.phone || dncBlocked) && { opacity: 0.6 },
                        ]}
                    >
                        <Ionicons name="call" size={20} color={colors.textInverse} />
                        <Txt role="body" weight="bold" size={16} color={colors.textInverse}>
                            Call
                        </Txt>
                    </Pressable>
                    <Pressable
                        onPress={handleWhatsApp}
                        disabled={!lead.phone || dncBlocked}
                        testID="lead-whatsapp-action"
                        accessibilityRole="button"
                        accessibilityLabel={`WhatsApp ${lead.full_name}`}
                        style={({ pressed }) => [
                            styles.cta,
                            styles.waCta,
                            (pressed || !lead.phone || dncBlocked) && { opacity: 0.6 },
                        ]}
                    >
                        <Ionicons name="logo-whatsapp" size={20} color={colors.inkOnBrand} />
                        <Txt role="body" weight="bold" size={16} color={colors.inkOnBrand}>
                            WhatsApp
                        </Txt>
                    </Pressable>
                </View>

                {/* next follow-up — owner only */}
                {!isManagerView ? (
                    followUp ? (
                        <Pressable
                            testID="lead-followup-card"
                            onPress={() => setFollowUpOpen(true)}
                            style={styles.fuCard}
                            accessibilityRole="button"
                            accessibilityLabel="Edit follow-up"
                        >
                            <View style={styles.fuIcon}>
                                <Ionicons name="notifications" size={20} color={colors.accent} />
                            </View>
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <Eyebrow color={colors.accent}>Next follow-up</Eyebrow>
                                <Txt
                                    role="body"
                                    weight="semibold"
                                    size={15}
                                    color={colors.text}
                                    style={{ marginTop: 3 }}
                                    numberOfLines={2}
                                >
                                    {followUp.task}
                                </Txt>
                                <Txt role="mono" size={13} color={colors.textMuted} style={{ marginTop: 2 }}>
                                    {followUpWhen}
                                </Txt>
                            </View>
                            <Ionicons name="pencil" size={18} color={colors.textMuted} />
                        </Pressable>
                    ) : (
                        <Pressable
                            testID="lead-followup-cta"
                            onPress={() => setFollowUpOpen(true)}
                            style={styles.fuGhost}
                            accessibilityRole="button"
                            accessibilityLabel="Set a follow-up"
                        >
                            <Ionicons name="notifications-outline" size={20} color={colors.accent} />
                            <Txt role="body" weight="semibold" size={14.5} color={colors.accent} style={{ flex: 1 }}>
                                Set a follow-up
                            </Txt>
                            <Ionicons name="chevron-forward" size={18} color={colors.accent} />
                        </Pressable>
                    )
                ) : null}

                {/* status — pill grid for owner, static chip in manager view */}
                <View>
                    <Eyebrow style={{ marginBottom: 10 }}>Status</Eyebrow>
                    {isManagerView ? (
                        <View testID="lead-status-chip" style={{ alignSelf: 'flex-start' }}>
                            <StatusChip status={currentStatus} />
                        </View>
                    ) : (
                        <View testID="lead-status-grid" style={styles.statusGrid}>
                            {LEAD_STATUSES.map((s) => {
                                const active = s === currentStatus;
                                const c = statusColors[s];
                                return (
                                    <Pressable
                                        key={s}
                                        testID={`lead-status-pill-${s}`}
                                        disabled={isUpdatingStatus}
                                        onPress={() => onStatusPress(s)}
                                        accessibilityRole="button"
                                        accessibilityState={{ selected: active }}
                                        accessibilityLabel={`Set status ${STATUS_LABELS[s]}`}
                                        style={[
                                            styles.statusPill,
                                            active
                                                ? { backgroundColor: c, borderColor: c }
                                                : { backgroundColor: 'transparent', borderColor: colors.border },
                                        ]}
                                    >
                                        <Txt
                                            role="body"
                                            weight={active ? 'bold' : 'semibold'}
                                            size={13.5}
                                            color={active ? pillText[s] : colors.textMuted}
                                        >
                                            {STATUS_LABELS[s]}
                                        </Txt>
                                    </Pressable>
                                );
                            })}
                        </View>
                    )}
                </View>

                {/* note affordance + inline input (owner only) */}
                {!isManagerView ? (
                    <>
                        <TouchableOpacity
                            testID="lead-note-action"
                            style={[styles.noteBtn, { borderColor: colors.border }]}
                            onPress={() => setShowNoteInput(!showNoteInput)}
                            accessibilityRole="button"
                            accessibilityLabel="Add a note"
                        >
                            <Ionicons name="create-outline" size={18} color={colors.accent} />
                            <Txt role="body" weight="semibold" size={14.5} color={colors.accent} style={{ flex: 1 }}>
                                Add a note
                            </Txt>
                            <Ionicons
                                name={showNoteInput ? 'chevron-up' : 'chevron-down'}
                                size={18}
                                color={colors.textFaint}
                            />
                        </TouchableOpacity>
                        {showNoteInput ? (
                            <NoteInput
                                testID="lead-note-input"
                                noteText={noteText}
                                onChangeText={setNoteText}
                                isSaving={isSavingNote}
                                colors={colors}
                                onSave={handleAddNote}
                                onCancel={() => {
                                    setShowNoteInput(false);
                                    setNoteText('');
                                }}
                            />
                        ) : null}
                    </>
                ) : null}

                {/* lead details */}
                <View style={styles.card}>
                    <View style={styles.cardHead}>
                        <Ionicons name="document-text-outline" size={16} color={colors.accent} />
                        <Txt role="body" weight="bold" size={14.5} color={colors.text}>
                            Lead details
                        </Txt>
                    </View>
                    <View style={{ gap: 11 }}>
                        {mktrRows.map((d, i) => (
                            <View key={`${d.label ?? 'note'}-${i}`} style={styles.factRow}>
                                {d.label ? (
                                    <Txt role="body" size={13} color={colors.textFaint} style={styles.factLabel}>
                                        {d.label}
                                    </Txt>
                                ) : null}
                                <Txt role="body" weight="medium" size={14} color={colors.text} style={{ flex: 1 }}>
                                    {d.value}
                                </Txt>
                            </View>
                        ))}
                        {/* Source shows only when enrichment rows didn't already carry it; Added is ALWAYS shown. */}
                        {mktrRows.length === 0 ? (
                            <DetailRow
                                label="Source"
                                value={lead.source_name === 'mktr' ? 'MKTR' : SOURCE_LABELS[lead.source]}
                            />
                        ) : null}
                        <DetailRow label="Added" value={timeAgo(lead.created_at)} />
                    </View>
                </View>

                {/* key facts — visible to all; editable by the owner */}
                {keyFacts.length || !isManagerView ? (
                    <View style={styles.card}>
                        <View style={styles.cardHead}>
                            <Ionicons name="bookmark" size={16} color={colors.accent} />
                            <Txt role="body" weight="bold" size={14.5} color={colors.text}>
                                Key facts
                            </Txt>
                            <View style={{ flex: 1 }} />
                            {!isManagerView ? (
                                <Pressable
                                    testID="lead-keyfacts-edit"
                                    onPress={() => setKeyFactsOpen(true)}
                                    hitSlop={8}
                                    accessibilityRole="button"
                                    accessibilityLabel="Edit key facts"
                                >
                                    <Txt role="body" weight="semibold" size={13.5} color={colors.accent}>
                                        Edit
                                    </Txt>
                                </Pressable>
                            ) : null}
                        </View>
                        {keyFacts.length ? (
                            <View style={{ gap: 11 }}>
                                {keyFacts.map((f, i) => (
                                    <View key={`${f.label}-${i}`} style={styles.factRow}>
                                        <Txt role="body" size={13} color={colors.textFaint} style={styles.factLabel}>
                                            {f.label}
                                        </Txt>
                                        <Txt
                                            role="body"
                                            weight="medium"
                                            size={14}
                                            color={colors.text}
                                            leading={20}
                                            style={{ flex: 1 }}
                                        >
                                            {f.value}
                                        </Txt>
                                    </View>
                                ))}
                            </View>
                        ) : (
                            <Txt role="body" size={13.5} color={colors.textFaint} leading={20}>
                                No key facts yet — tap Edit to capture what matters (looking for, budget, good to know).
                            </Txt>
                        )}
                    </View>
                ) : null}

                {/* recording / transcript */}
                {lead.recording_url || lead.transcript ? (
                    <RecordingCard recordingUrl={lead.recording_url} transcript={lead.transcript} />
                ) : null}

                {/* activity */}
                <View>
                    <View style={styles.activityHead}>
                        <Eyebrow>Activity</Eyebrow>
                        <View style={[styles.countPill, { backgroundColor: alpha(colors.accent, 0.14) }]}>
                            <Txt testID="lead-activity-count" role="body" weight="bold" size={13} color={colors.accent}>
                                {timelineActivities(activities).length}
                            </Txt>
                        </View>
                        <View style={{ flex: 1 }} />
                        {!isManagerView ? (
                            <Pressable
                                testID="lead-log-action"
                                onPress={() => {
                                    setLogType('note');
                                    setLogOpen(true);
                                }}
                                style={[styles.logPill, { backgroundColor: alpha(colors.accent, 0.14) }]}
                                accessibilityRole="button"
                                accessibilityLabel="Log activity"
                                hitSlop={6}
                            >
                                <Ionicons name="add" size={14} color={colors.accent} />
                                <Txt role="body" weight="bold" size={13} color={colors.accent}>
                                    Log
                                </Txt>
                            </Pressable>
                        ) : null}
                    </View>
                    {timelineActivities(activities).length ? (
                        <ActivityFeed activities={activities} />
                    ) : (
                        <Txt testID="lead-activity-empty" role="body" size={13.5} color={colors.textFaint}>
                            No activity yet. Call or WhatsApp to get started.
                        </Txt>
                    )}
                </View>
            </KeyboardAwareScrollView>

            <ContactConfirmModal
                visible={showContactConfirm}
                contactType={pendingContact?.type ?? null}
                leadName={lead.full_name}
                colors={colors}
                onConfirm={handleContactConfirm}
            />

            <ReassignModal
                visible={showReassignModal}
                leadName={lead.full_name}
                agents={reassignAgents}
                colors={colors}
                onSelect={handleReassign}
                onClose={() => setShowReassignModal(false)}
            />

            {!isManagerView ? (
                <>
                    <LogActivitySheet
                        visible={logOpen}
                        onClose={() => setLogOpen(false)}
                        leadName={lead.full_name || 'Lead'}
                        defaultType={logType}
                        busy={logBusy}
                        onSave={saveLog}
                    />
                    <FollowUpSheet
                        visible={followUpOpen}
                        onClose={() => setFollowUpOpen(false)}
                        initial={followUp}
                        busy={followUpBusy}
                        onSave={saveFollowUp}
                    />
                    <KeyFactsSheet
                        visible={keyFactsOpen}
                        onClose={() => setKeyFactsOpen(false)}
                        initial={keyFacts}
                        busy={keyFactsBusy}
                        onSave={saveKeyFacts}
                    />
                    <LeadActionsSheet
                        visible={actionsOpen}
                        onClose={() => setActionsOpen(false)}
                        isArchived={!!lead.archived_at}
                        onArchive={doArchive}
                        onUnarchive={doUnarchive}
                    />
                    <ScPrConfirmDialog
                        visible={scPrOpen}
                        busy={scPrBusy}
                        onYes={confirmScPrYes}
                        onNo={confirmScPrNo}
                        onClose={() => setScPrOpen(false)}
                    />
                </>
            ) : null}

            <Confetti visible={showConfetti} confettiKey={confettiKey} />
        </SafeAreaView>
    );
}

function DetailRow({ label, value }: { label: string; value: string }) {
    const { colors } = useLeadsTheme();
    return (
        <View style={{ flexDirection: 'row', gap: 12 }}>
            <Txt role="body" size={13} color={colors.textFaint} style={{ width: 88 }}>
                {label}
            </Txt>
            <Txt role="body" weight="medium" size={14} color={colors.text} style={{ flex: 1 }}>
                {value}
            </Txt>
        </View>
    );
}

const makeStyles = ({ colors }: LeadsTheme) =>
    StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.background },
        center: { alignItems: 'center', justifyContent: 'center', gap: 4 },
        notFoundIcon: {
            width: 64,
            height: 64,
            borderRadius: 32,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 8,
        },
        backBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
        topBar: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
        },
        pill: {
            width: 38,
            height: 38,
            borderRadius: 99,
            backgroundColor: colors.surfaceAlt,
            alignItems: 'center',
            justifyContent: 'center',
        },
        banner: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginHorizontal: spacing.lg,
            marginBottom: spacing.sm,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: radius.chip,
        },
        scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xxl, gap: 18 },
        identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
        tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -6 },
        tag: { backgroundColor: colors.surfaceAlt, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 7 },
        wonBanner: {
            borderRadius: radius.hero,
            paddingVertical: 18,
            paddingHorizontal: 22,
            backgroundColor: colors.success,
        },
        ctaRow: { flexDirection: 'row', gap: 11 },
        cta: {
            flex: 1,
            height: 54,
            borderRadius: radius.btn,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 9,
        },
        callCta: { backgroundColor: colors.accent },
        waCta: { backgroundColor: colors.whatsapp },
        statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
        statusPill: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            paddingVertical: 9,
            paddingHorizontal: 14,
            minHeight: 44,
            borderRadius: radius.chip,
            borderWidth: 1.5,
        },
        noteBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 11,
            paddingVertical: 13,
            paddingHorizontal: spacing.lg,
            borderRadius: radius.card,
            borderWidth: 1.5,
            borderStyle: 'dashed',
        },
        card: {
            backgroundColor: colors.surface,
            borderRadius: radius.card,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.lg,
        },
        cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 13 },
        factRow: { flexDirection: 'row', gap: 12 },
        factLabel: { width: 88, flexShrink: 0 },
        activityHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
        logPill: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            paddingVertical: 6,
            paddingHorizontal: 11,
            borderRadius: 99,
        },
        fuCard: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 13,
            padding: spacing.lg,
            borderRadius: radius.card,
            backgroundColor: alpha(colors.accent, 0.06),
            borderWidth: 1,
            borderColor: alpha(colors.accent, 0.4),
        },
        fuIcon: {
            width: 42,
            height: 42,
            borderRadius: 12,
            backgroundColor: alpha(colors.accent, 0.16),
            alignItems: 'center',
            justifyContent: 'center',
        },
        fuGhost: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 11,
            paddingVertical: 14,
            paddingHorizontal: spacing.lg,
            borderRadius: radius.card,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: alpha(colors.accent, 0.5),
            backgroundColor: alpha(colors.accent, 0.06),
        },
        countPill: { minWidth: 24, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99, alignItems: 'center' },
    });
