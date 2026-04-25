import EmptyState from '@/components/EmptyState';
import ErrorBanner from '@/components/ErrorBanner';
import LeadActivityItem from '@/components/LeadActivityItem';
import ContactConfirmModal from '@/components/leads/ContactConfirmModal';
import NoteInput from '@/components/leads/NoteInput';
import QuickAction from '@/components/leads/QuickAction';
import ReassignModal from '@/components/leads/ReassignModal';
import RecordingCard from '@/components/leads/RecordingCard';
import StatusPicker from '@/components/leads/StatusPicker';
import LoadingState from '@/components/LoadingState';
import ScreenHeader from '@/components/ScreenHeader';
import StatusBadge from '@/components/StatusBadge';
import { letterSpacing, shadow } from '@/constants/platform';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useViewMode } from '@/contexts/ViewModeContext';
import { useLeadDetail } from '@/hooks/useLeadDetail';
import { timeAgo } from '@/lib/dateTime';
import { formatSgPhone } from '@/lib/phone';
import { PRODUCT_LABELS, SOURCE_LABELS } from '@/types/lead';
import type { ThemeColors } from '@/types/theme';
import type { IconName } from '@/types/ui';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useSegments } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { AppState, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ── Local helper: premium info row with right-aligned value ──
function InfoRow({
    icon,
    label,
    value,
    colors,
    isLast,
}: {
    icon: IconName;
    label: string;
    value: string;
    colors: ThemeColors;
    isLast?: boolean;
}) {
    return (
        <View
            style={[
                styles.infoRow,
                !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
            ]}
        >
            <View style={[styles.infoIconWrap, { backgroundColor: colors.surfaceSecondary }]}>
                <Ionicons name={icon} size={14} color={colors.textTertiary} />
            </View>
            <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>{label}</Text>
            <Text style={[styles.infoValue, { color: colors.textPrimary }]} numberOfLines={1}>
                {value}
            </Text>
        </View>
    );
}

// ── Section header with optional count pill ──
function SectionHeader({ title, count, colors }: { title: string; count?: number; colors: ThemeColors }) {
    return (
        <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
            {count !== undefined && count > 0 && (
                <View style={[styles.countPill, { backgroundColor: colors.accentLight }]}>
                    <Text style={[styles.countPillText, { color: colors.accent }]}>{count}</Text>
                </View>
            )}
        </View>
    );
}

export default function LeadDetailScreen() {
    const { leadId } = useLocalSearchParams<{ leadId: string }>();
    const { colors } = useTheme();
    const { user } = useAuth();
    const { viewMode, canToggle } = useViewMode();
    const router = useRouter();
    const segments = useSegments();
    const backLabel = segments[1] === 'team' ? 'Agent' : segments[1] === 'home' ? 'Back' : 'Leads';
    const isManagerView = canToggle && viewMode === 'manager';

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
        showStatusPicker,
        setShowStatusPicker,
        isUpdatingStatus,
    } = useLeadDetail({ leadId, userId: user?.id, userRole: user?.role, fullName: user?.full_name });

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

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <ScreenHeader showBack backLabel={backLabel} title="Loading..." />
                <LoadingState />
            </SafeAreaView>
        );
    }

    // Parse MKTR source details from notes (format: "Key: Value | Key: Value")
    const mktrInfo =
        lead?.source_name === 'mktr' && lead.notes
            ? Object.fromEntries(
                  lead.notes.split(' | ').map((part) => {
                      const [key, ...rest] = part.split(': ');
                      return [key.toLowerCase(), rest.join(': ')];
                  }),
              )
            : null;

    if (!lead) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <View style={styles.notFound}>
                    <View style={[styles.notFoundIconWrap, { backgroundColor: colors.surfaceSecondary }]}>
                        <Ionicons name="alert-circle-outline" size={32} color={colors.textTertiary} />
                    </View>
                    <Text style={[styles.notFoundText, { color: colors.textPrimary }]}>Lead not found</Text>
                    <Text style={[styles.notFoundSub, { color: colors.textTertiary }]}>
                        This lead may have been removed
                    </Text>
                    <TouchableOpacity
                        style={[styles.notFoundBtn, { backgroundColor: colors.accent }]}
                        onPress={() => router.back()}
                    >
                        <Text style={[styles.notFoundBtnText, { color: colors.textInverse }]}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

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

        const displayPhone = formatSgPhone(pc.phone);
        const description =
            pc.type === 'call'
                ? outcome === 'reached'
                    ? `Called ${displayPhone} — reached`
                    : `Called ${displayPhone} — no answer`
                : `Sent WhatsApp to ${displayPhone}`;

        logActivity(pc.type, description, { phone: pc.phone, outcome });

        // Auto-advance: New -> Contacted on any logged contact attempt
        if (currentStatus === 'new') {
            handleChangeStatus('contacted');
        }
    };

    // Avatar initial + color
    const initials = lead.full_name.charAt(0).toUpperCase();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <ScreenHeader
                showBack
                backLabel={backLabel}
                title={lead.full_name}
                banner={
                    isManagerView
                        ? { text: 'Manager View — Limited actions available.', icon: 'shield-outline' }
                        : undefined
                }
            />

            {error && <ErrorBanner message={error} onRetry={loadData} onDismiss={() => setError(null)} />}

            <KeyboardAwareScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                bottomOffset={20}
            >
                {/* ─── Hero Card ─── */}
                <View style={[styles.hero, { backgroundColor: colors.cardBackground }, shadow('md')]}>
                    {/* Avatar */}
                    <View style={styles.avatarSection}>
                        <View style={[styles.avatarRing, { borderColor: colors.accent + '28' }]}>
                            <View style={[styles.avatar, { backgroundColor: colors.accentLight }]}>
                                <Text style={[styles.avatarText, { color: colors.accent }]}>{initials}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Identity */}
                    <Text style={[styles.heroName, { color: colors.textPrimary }]}>{lead.full_name}</Text>

                    <View testID="lead-status-badge" style={styles.heroStatusRow}>
                        <StatusBadge status={currentStatus} size="medium" />
                    </View>

                    {/* Contact info */}
                    {(lead.phone || lead.email) && (
                        <View style={styles.contactInfo}>
                            {lead.phone && (
                                <View style={styles.contactLine}>
                                    <Ionicons name="call-outline" size={13} color={colors.textTertiary} />
                                    <Text style={[styles.heroContact, { color: colors.textSecondary }]}>
                                        {formatSgPhone(lead.phone)}
                                    </Text>
                                </View>
                            )}
                            {lead.email && (
                                <View style={styles.contactLine}>
                                    <Ionicons name="mail-outline" size={13} color={colors.textTertiary} />
                                    <Text style={[styles.heroContactSub, { color: colors.textTertiary }]}>
                                        {lead.email}
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}

                    {/* Divider */}
                    <View style={[styles.heroDivider, { backgroundColor: colors.border }]} />

                    {/* Quick Actions */}
                    <View style={styles.actionsRow}>
                        <QuickAction
                            icon="call"
                            label="Call"
                            color={colors.success}
                            bgColor={colors.successLight}
                            onPress={handleCall}
                            disabled={!lead.phone}
                        />
                        <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />
                        <QuickAction
                            icon="logo-whatsapp"
                            label="WhatsApp"
                            color={colors.whatsappGreen}
                            bgColor={colors.successLight}
                            onPress={handleWhatsApp}
                            disabled={!lead.phone}
                        />
                        {isManagerView ? (
                            <>
                                <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />
                                <QuickAction
                                    testID="lead-reassign-action"
                                    icon="git-compare-outline"
                                    label="Reassign"
                                    color={colors.statusProposed}
                                    bgColor={colors.surfaceSecondary}
                                    onPress={handleOpenReassign}
                                    disabled={isReassigning}
                                />
                            </>
                        ) : (
                            <>
                                <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />
                                <QuickAction
                                    testID="lead-status-action"
                                    icon="swap-horizontal"
                                    label="Status"
                                    color={colors.warning}
                                    bgColor={colors.warningLight}
                                    onPress={() => setShowStatusPicker(!showStatusPicker)}
                                />
                                <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />
                                <QuickAction
                                    testID="lead-note-action"
                                    icon="create-outline"
                                    label="Note"
                                    color={colors.accent}
                                    bgColor={colors.accentLight}
                                    onPress={() => setShowNoteInput(!showNoteInput)}
                                />
                            </>
                        )}
                    </View>
                </View>

                {/* ─── Inline panels (status picker / note) ─── */}
                {!isManagerView && showStatusPicker && (
                    <StatusPicker
                        currentStatus={currentStatus}
                        isUpdating={isUpdatingStatus}
                        colors={colors}
                        onChangeStatus={handleChangeStatus}
                    />
                )}

                {!isManagerView && showNoteInput && (
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
                )}

                {/* ─── Details Card ─── */}
                <View style={[styles.card, { backgroundColor: colors.cardBackground }, shadow('sm')]}>
                    <SectionHeader title="Details" colors={colors} />
                    <InfoRow
                        icon="shield-outline"
                        label="Product"
                        value={PRODUCT_LABELS[lead.product_interest]}
                        colors={colors}
                    />
                    <InfoRow
                        icon="location-outline"
                        label="Source"
                        value={lead.source_name === 'mktr' ? 'MKTR' : SOURCE_LABELS[lead.source]}
                        colors={colors}
                    />
                    {lead.source_name === 'mktr' && (
                        <InfoRow
                            icon="megaphone-outline"
                            label="Campaign"
                            value={mktrInfo?.campaign || 'Unknown'}
                            colors={colors}
                        />
                    )}
                    {mktrInfo?.qr && (
                        <InfoRow icon="qr-code-outline" label="QR Code" value={mktrInfo.qr} colors={colors} />
                    )}
                    <InfoRow
                        icon="time-outline"
                        label="Added"
                        value={timeAgo(lead.created_at)}
                        colors={colors}
                        isLast
                    />
                </View>

                {/* ─── Call Recording & Transcript ─── */}
                {(lead.recording_url || lead.transcript) && (
                    <RecordingCard recordingUrl={lead.recording_url} transcript={lead.transcript} />
                )}

                {/* ─── Activity Timeline ─── */}
                <View
                    testID="lead-activity-list"
                    style={[styles.card, { backgroundColor: colors.cardBackground }, shadow('sm')]}
                >
                    <SectionHeader title="Activity" count={activities.length} colors={colors} />
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

                {/* Metadata footer */}
                <Text style={[styles.metaFooter, { color: colors.textTertiary }]}>
                    Lead created {timeAgo(lead.created_at)}
                </Text>
            </KeyboardAwareScrollView>

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
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 48,
        gap: 12,
    },

    // ── Hero ──
    hero: {
        borderRadius: 20,
        paddingTop: 28,
        paddingBottom: 0,
        paddingHorizontal: 24,
        alignItems: 'center',
        overflow: 'hidden',
    },
    avatarSection: {
        marginBottom: 16,
    },
    avatarRing: {
        width: 96,
        height: 96,
        borderRadius: 48,
        borderWidth: 3,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatar: {
        width: 84,
        height: 84,
        borderRadius: 42,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        fontSize: 34,
        fontWeight: '700',
        letterSpacing: letterSpacing(-0.5),
    },
    heroName: {
        fontSize: 24,
        fontWeight: '700',
        letterSpacing: letterSpacing(-0.4),
        textAlign: 'center',
        lineHeight: 30,
    },
    heroStatusRow: {
        marginTop: 10,
        marginBottom: 4,
    },
    contactInfo: {
        marginTop: 10,
        alignItems: 'center',
        gap: 4,
    },
    contactLine: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    heroContact: {
        fontSize: 14,
        fontWeight: '500',
    },
    heroContactSub: {
        fontSize: 13,
    },
    heroDivider: {
        height: StyleSheet.hairlineWidth,
        width: '120%',
        marginTop: 20,
        marginBottom: 4,
    },
    actionsRow: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-evenly',
        alignItems: 'center',
        paddingVertical: 16,
    },
    actionDivider: {
        width: StyleSheet.hairlineWidth,
        height: 36,
        opacity: 0.6,
    },

    // ── Cards ──
    card: {
        borderRadius: 16,
        padding: 16,
    },

    // ── Section header ──
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: letterSpacing(-0.1),
    },
    countPill: {
        minWidth: 24,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        alignItems: 'center',
    },
    countPillText: {
        fontSize: 12,
        fontWeight: '700',
    },

    // ── Info rows ──
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 11,
        gap: 10,
    },
    infoIconWrap: {
        width: 26,
        height: 26,
        borderRadius: 7,
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoLabel: {
        fontSize: 13,
        width: 72,
        fontWeight: '500',
    },
    infoValue: {
        flex: 1,
        fontSize: 14,
        fontWeight: '500',
        textAlign: 'right',
    },

    // ── Not found ──
    notFound: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        paddingHorizontal: 32,
    },
    notFoundIconWrap: {
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
    },
    notFoundText: {
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: letterSpacing(-0.2),
    },
    notFoundSub: {
        fontSize: 14,
        textAlign: 'center',
    },
    notFoundBtn: {
        marginTop: 8,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
    },
    notFoundBtnText: {
        fontSize: 15,
        fontWeight: '600',
    },

    // ── Footer metadata ──
    metaFooter: {
        textAlign: 'center',
        fontSize: 12,
        marginTop: 4,
    },
});
