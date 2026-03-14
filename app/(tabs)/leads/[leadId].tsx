import EmptyState from '@/components/EmptyState';
import ErrorBanner from '@/components/ErrorBanner';
import LeadActivityItem from '@/components/LeadActivityItem';
import ContactConfirmModal from '@/components/leads/ContactConfirmModal';
import NoteInput from '@/components/leads/NoteInput';
import QuickAction from '@/components/leads/QuickAction';
import ReassignModal from '@/components/leads/ReassignModal';
import StatusPicker from '@/components/leads/StatusPicker';
import LoadingState from '@/components/LoadingState';
import ScreenHeader from '@/components/ScreenHeader';
import StatusBadge from '@/components/StatusBadge';
import { KAV_BEHAVIOR, letterSpacing } from '@/constants/platform';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useViewMode } from '@/contexts/ViewModeContext';
import { useSubmitGuard } from '@/hooks/useSubmitGuard';
import {
    addLeadActivity,
    addLeadNote,
    fetchLead,
    fetchLeadActivities,
    fetchTeamAgents,
    reassignLead,
    updateLeadStatus,
} from '@/lib/leads';
import type { Lead } from '@/types/lead';
import { PRODUCT_LABELS, SOURCE_LABELS, type LeadActivity, type LeadStatus } from '@/types/lead';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useSegments } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    AppState,
    KeyboardAvoidingView,
    Linking,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LeadDetailScreen() {
    const { leadId } = useLocalSearchParams<{ leadId: string }>();
    const { colors } = useTheme();
    const { user } = useAuth();
    const { viewMode, canToggle } = useViewMode();
    const router = useRouter();
    const segments = useSegments();
    const backLabel = segments[1] === 'team' ? 'Agent' : 'Leads';
    const isManagerView = canToggle && viewMode === 'manager';

    const [lead, setLead] = useState<Lead | null>(null);
    const [activities, setActivities] = useState<LeadActivity[]>([]);
    const [currentStatus, setCurrentStatus] = useState<LeadStatus>('new');
    const [isLoading, setIsLoading] = useState(true);
    const [showNoteInput, setShowNoteInput] = useState(false);
    const [noteText, setNoteText] = useState('');
    const [showStatusPicker, setShowStatusPicker] = useState(false);
    const { isSubmitting: isSavingNote, guard: noteGuard } = useSubmitGuard();
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [showReassignModal, setShowReassignModal] = useState(false);
    const [reassignAgents, setReassignAgents] = useState<{ id: string; full_name: string }[]>([]);
    const [isReassigning, setIsReassigning] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Contact confirmation (AppState-based)
    const [pendingContact, setPendingContact] = useState<{ type: 'call' | 'whatsapp'; phone: string } | null>(null);
    const [showContactConfirm, setShowContactConfirm] = useState(false);
    const hasPendingContact = useRef(false);
    const wentToBackground = useRef(false);

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

    const loadData = useCallback(async () => {
        if (!leadId) return;

        try {
            setError(null);
            const [leadResult, activitiesResult] = await Promise.all([fetchLead(leadId), fetchLeadActivities(leadId)]);

            if (leadResult.data) {
                setLead(leadResult.data);
                setCurrentStatus(leadResult.data.status);
            }
            if (leadResult.error) {
                setError('Failed to load lead details');
            }
            if (activitiesResult.data) {
                setActivities(activitiesResult.data);
            }
        } catch {
            setError('Failed to load lead details');
        }
        setIsLoading(false);
    }, [leadId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <ScreenHeader showBack backLabel={backLabel} title="Loading..." />
                <LoadingState />
            </SafeAreaView>
        );
    }

    if (!lead) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <View style={styles.notFound}>
                    <Ionicons name="alert-circle-outline" size={48} color={colors.textTertiary} />
                    <Text style={[styles.notFoundText, { color: colors.textSecondary }]}>Lead not found</Text>
                    <TouchableOpacity onPress={() => router.back()}>
                        <Text style={{ color: colors.accent, fontWeight: '600' }}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const logActivity = (type: 'call' | 'whatsapp', description: string, metadata: Record<string, any>) => {
        const optimistic: LeadActivity = {
            id: `a_${Date.now()}`,
            lead_id: lead.id,
            user_id: user?.id || 'me',
            type,
            description,
            metadata,
            created_at: new Date().toISOString(),
            actor_name: user?.full_name || undefined,
        };
        setActivities((prev) => [optimistic, ...prev]);
        if (user?.id) {
            addLeadActivity(lead.id, user.id, type, description, metadata);
        }
    };

    const handleCall = () => {
        if (!lead.phone) return;
        hasPendingContact.current = true;
        setPendingContact({ type: 'call', phone: lead.phone });
        Linking.openURL(`tel:${lead.phone.replace(/\s/g, '')}`);
    };

    const handleWhatsApp = () => {
        if (!lead.phone) return;
        hasPendingContact.current = true;
        setPendingContact({ type: 'whatsapp', phone: lead.phone });
        const phone = lead.phone.replace(/[\s+]/g, '');
        Linking.openURL(`https://wa.me/${phone}`);
    };

    const handleContactConfirm = (outcome: 'reached' | 'no_answer' | 'sent' | 'skip') => {
        const pc = pendingContact;
        hasPendingContact.current = false;
        setPendingContact(null);
        setShowContactConfirm(false);
        if (!pc || outcome === 'skip') return;

        const description =
            pc.type === 'call'
                ? outcome === 'reached'
                    ? `Called ${pc.phone} — reached`
                    : `Called ${pc.phone} — no answer`
                : `Sent WhatsApp to ${pc.phone}`;

        logActivity(pc.type, description, { phone: pc.phone, outcome });

        // Auto-advance: New → Contacted on any logged contact attempt
        if (currentStatus === 'new') {
            handleChangeStatus('contacted');
        }
    };

    const handleOpenReassign = async () => {
        if (user?.id) {
            const { data } = await fetchTeamAgents(user.id);
            setReassignAgents(data.filter((a) => a.id !== lead.assigned_to));
        }
        setShowReassignModal(true);
    };

    const handleReassign = async (toAgent: { id: string; full_name: string }) => {
        if (!lead) return;
        const fromId = lead.assigned_to;
        const fromName = fromId;

        const newActivity: LeadActivity = {
            id: `a_${Date.now()}`,
            lead_id: lead.id,
            user_id: user?.id || 'me',
            type: 'reassignment',
            description: null,
            metadata: {
                from_agent_id: fromId,
                to_agent_id: toAgent.id,
                from_agent_name: fromName,
                to_agent_name: toAgent.full_name,
            },
            created_at: new Date().toISOString(),
            actor_name: user?.full_name || undefined,
        };

        setShowReassignModal(false);

        if (!user?.id) return;
        setIsReassigning(true);
        const { error } = await reassignLead(lead.id, toAgent.id, fromId, fromName, toAgent.full_name, user.id);
        setIsReassigning(false);
        if (!error) {
            setActivities((prev) => [newActivity, ...prev]);
        } else {
            if (__DEV__) console.error('Failed to reassign:', error);
        }
    };

    const handleAddNote = () =>
        noteGuard(async () => {
            if (!noteText.trim()) return;

            if (!user?.id) return;
            const { data, error } = await addLeadNote(lead.id, noteText.trim(), user.id);

            if (data) {
                setActivities((prev) => [data, ...prev]);
                setNoteText('');
                setShowNoteInput(false);
            } else if (error) {
                setError('Failed to add note');
                if (__DEV__) console.error('Failed to add note:', error);
            }
        });

    const handleChangeStatus = async (newStatus: LeadStatus) => {
        if (newStatus === currentStatus) return;

        const previousStatus = currentStatus;

        if (!user?.id) return;

        // Optimistic update — close picker and show new status immediately
        setCurrentStatus(newStatus);
        setShowStatusPicker(false);
        setIsUpdatingStatus(true);

        const { error } = await updateLeadStatus(lead.id, newStatus, previousStatus, user.id);
        setIsUpdatingStatus(false);

        if (!error) {
            // Re-fetch activities to get the persisted status_change entry
            const { data: updatedActivities } = await fetchLeadActivities(lead.id);
            if (updatedActivities) setActivities(updatedActivities);
        } else {
            // Rollback on failure
            setCurrentStatus(previousStatus);
            setError('Failed to update status');
            if (__DEV__) console.error('Failed to update status:', error);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header Bar */}
            <ScreenHeader
                showBack
                backLabel={backLabel}
                title={lead.full_name}
                banner={
                    isManagerView
                        ? {
                              text: 'Manager View — Limited actions available.',
                              icon: 'shield-outline',
                          }
                        : undefined
                }
            />

            {error && <ErrorBanner message={error} onRetry={loadData} onDismiss={() => setError(null)} />}

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={KAV_BEHAVIOR} keyboardVerticalOffset={100}>
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Lead Header Card */}
                    <View
                        style={[
                            styles.card,
                            { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder },
                        ]}
                    >
                        <View style={styles.leadHeaderRow}>
                            <View style={[styles.avatar, { backgroundColor: colors.accentLight }]}>
                                <Text style={[styles.avatarText, { color: colors.accent }]}>
                                    {lead.full_name.charAt(0).toUpperCase()}
                                </Text>
                            </View>
                            <View style={styles.leadInfo}>
                                <Text style={[styles.leadName, { color: colors.textPrimary }]}>{lead.full_name}</Text>
                                <View style={{ marginTop: 4 }}>
                                    <StatusBadge status={currentStatus} size="medium" />
                                </View>
                            </View>
                        </View>

                        {/* Contact Info */}
                        <View style={[styles.contactSection, { borderTopColor: colors.borderLight }]}>
                            {lead.phone && (
                                <View style={styles.contactRow}>
                                    <Ionicons name="call-outline" size={16} color={colors.textTertiary} />
                                    <Text style={[styles.contactText, { color: colors.textSecondary }]}>
                                        {lead.phone}
                                    </Text>
                                </View>
                            )}
                            {lead.email && (
                                <View style={styles.contactRow}>
                                    <Ionicons name="mail-outline" size={16} color={colors.textTertiary} />
                                    <Text style={[styles.contactText, { color: colors.textSecondary }]}>
                                        {lead.email}
                                    </Text>
                                </View>
                            )}
                            <View style={styles.tagsRow}>
                                <View style={[styles.infoTag, { backgroundColor: colors.surfacePrimary }]}>
                                    <Ionicons name="shield-outline" size={12} color={colors.textTertiary} />
                                    <Text style={[styles.infoTagText, { color: colors.textSecondary }]}>
                                        {PRODUCT_LABELS[lead.product_interest]}
                                    </Text>
                                </View>
                                <View style={[styles.infoTag, { backgroundColor: colors.surfacePrimary }]}>
                                    <Ionicons name="location-outline" size={12} color={colors.textTertiary} />
                                    <Text style={[styles.infoTagText, { color: colors.textSecondary }]}>
                                        {SOURCE_LABELS[lead.source]}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Quick Actions */}
                    <View
                        style={[
                            styles.actionsCard,
                            { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder },
                        ]}
                    >
                        <QuickAction
                            icon="call"
                            label="Call"
                            color={colors.success}
                            bgColor={colors.successLight}
                            onPress={handleCall}
                            disabled={!lead.phone}
                        />
                        <QuickAction
                            icon="logo-whatsapp"
                            label="WhatsApp"
                            color={colors.success}
                            bgColor={colors.successLight}
                            onPress={handleWhatsApp}
                            disabled={!lead.phone}
                        />
                        {isManagerView ? (
                            <QuickAction
                                icon="git-compare-outline"
                                label="Reassign"
                                color={colors.statusProposed}
                                bgColor={colors.surfacePrimary}
                                onPress={handleOpenReassign}
                                disabled={isReassigning}
                            />
                        ) : (
                            <>
                                <QuickAction
                                    icon="swap-horizontal"
                                    label="Status"
                                    color={colors.warning}
                                    bgColor={colors.warningLight}
                                    onPress={() => setShowStatusPicker(!showStatusPicker)}
                                />
                                <QuickAction
                                    icon="create-outline"
                                    label="Note"
                                    color={colors.textTertiary}
                                    bgColor={colors.surfacePrimary}
                                    onPress={() => setShowNoteInput(!showNoteInput)}
                                />
                            </>
                        )}
                    </View>

                    {/* Status Picker */}
                    {!isManagerView && showStatusPicker && (
                        <StatusPicker
                            currentStatus={currentStatus}
                            isUpdating={isUpdatingStatus}
                            colors={colors}
                            onChangeStatus={handleChangeStatus}
                        />
                    )}

                    {/* Add Note Input */}
                    {!isManagerView && showNoteInput && (
                        <NoteInput
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
                    )}

                    {/* Activity Timeline */}
                    <View
                        style={[
                            styles.card,
                            { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder },
                        ]}
                    >
                        <View style={styles.timelineHeader}>
                            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Activity</Text>
                            <Text style={[styles.activityCount, { color: colors.textTertiary }]}>
                                {activities.length} entries
                            </Text>
                        </View>
                        <View style={styles.timelineContent}>
                            {activities.map((act, idx) => (
                                <LeadActivityItem key={act.id} activity={act} isLast={idx === activities.length - 1} />
                            ))}
                            {activities.length === 0 && (
                                <EmptyState
                                    icon="time-outline"
                                    title="No activity yet"
                                    subtitle="Activity will appear here as you work this lead"
                                />
                            )}
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Contact Confirm Modal */}
            <ContactConfirmModal
                visible={showContactConfirm}
                contactType={pendingContact?.type ?? null}
                leadName={lead.full_name}
                colors={colors}
                onConfirm={handleContactConfirm}
            />

            {/* Reassign Modal */}
            <ReassignModal
                visible={showReassignModal}
                leadName={lead.full_name}
                agents={reassignAgents}
                colors={colors}
                onSelect={handleReassign}
                onClose={() => setShowReassignModal(false)}
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
    leadHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    avatar: {
        width: 52,
        height: 52,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: { fontSize: 22, fontWeight: '800' },
    leadInfo: { flex: 1 },
    leadName: { fontSize: 20, fontWeight: '800', letterSpacing: letterSpacing(-0.3) },
    contactSection: {
        marginTop: 14,
        paddingTop: 14,
        borderTopWidth: 0.5,
        gap: 6,
    },
    contactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    contactText: { fontSize: 14 },
    tagsRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 6,
    },
    infoTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    infoTagText: { fontSize: 12, fontWeight: '500' },
    actionsCard: {
        flexDirection: 'row',
        borderRadius: 14,
        borderWidth: 0.5,
        padding: 12,
        marginBottom: 12,
        justifyContent: 'space-around',
    },
    sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
    timelineHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    activityCount: { fontSize: 12 },
    timelineContent: { marginTop: 4 },
    notFound: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    notFoundText: { fontSize: 16, fontWeight: '600' },
});
