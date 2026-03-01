import ScreenHeader from '@/components/ScreenHeader';
import { useTheme } from '@/contexts/ThemeContext';
import { CANDIDATE_STATUS_CONFIG, MOCK_CANDIDATES, type CandidateStatus, type Interview } from '@/types/recruitment';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import {
    Linking,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

// ── Helpers ──

function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getTimeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
}

// ── Status Stepper ──

function StatusStepper({ currentStatus, colors }: { currentStatus: CandidateStatus; colors: any }) {
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
                    <View key={step} style={stepperStyles.stepRow}>
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
                    </View>
                );
            })}
        </View>
    );
}

// ── Interview Card ──

function InterviewCard({ interview, colors }: { interview: Interview; colors: any }) {
    const isUpcoming = new Date(interview.datetime) > new Date();
    const statusColor = interview.status === 'completed' ? '#34C759'
        : interview.status === 'cancelled' ? '#FF3B30'
            : '#FF9500';

    return (
        <View style={[interviewStyles.card, { backgroundColor: colors.surfacePrimary || colors.background, borderColor: colors.border }]}>
            <View style={interviewStyles.headerRow}>
                <View style={interviewStyles.roundBadge}>
                    <Text style={interviewStyles.roundText}>R{interview.round_number}</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[interviewStyles.dateText, { color: colors.textPrimary }]}>
                        {formatDateTime(interview.datetime)}
                    </Text>
                    <Text style={[interviewStyles.typeText, { color: colors.textTertiary }]}>
                        {interview.type === 'zoom' ? '📹 Zoom' : '🏢 In-Person'}
                    </Text>
                </View>
                <View style={[interviewStyles.statusPill, { backgroundColor: statusColor + '18' }]}>
                    <Text style={[interviewStyles.statusText, { color: statusColor }]}>
                        {interview.status.charAt(0).toUpperCase() + interview.status.slice(1)}
                    </Text>
                </View>
            </View>

            {interview.location && (
                <View style={interviewStyles.detailRow}>
                    <Ionicons name="location-outline" size={14} color={colors.textTertiary} />
                    <Text style={[interviewStyles.detailText, { color: colors.textSecondary }]}>{interview.location}</Text>
                </View>
            )}
            {interview.zoom_link && isUpcoming && (
                <TouchableOpacity
                    style={interviewStyles.detailRow}
                    onPress={() => Linking.openURL(interview.zoom_link!)}
                >
                    <Ionicons name="videocam-outline" size={14} color={colors.accent} />
                    <Text style={[interviewStyles.detailText, { color: colors.accent }]}>Join Zoom Meeting</Text>
                </TouchableOpacity>
            )}
            {interview.notes && (
                <Text style={[interviewStyles.notesText, { color: colors.textSecondary }]}>
                    💬 {interview.notes}
                </Text>
            )}
        </View>
    );
}

// ── Main Screen ──

export default function CandidateDetailScreen() {
    const { candidateId } = useLocalSearchParams<{ candidateId: string }>();
    const { colors } = useTheme();
    const router = useRouter();

    const candidate = MOCK_CANDIDATES.find((c) => c.id === candidateId);

    if (!candidate) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.notFound}>
                    <Ionicons name="alert-circle-outline" size={48} color={colors.textTertiary} />
                    <Text style={[styles.notFoundText, { color: colors.textSecondary }]}>Candidate not found</Text>
                    <TouchableOpacity onPress={() => router.back()}>
                        <Text style={{ color: colors.accent, fontWeight: '600' }}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const statusConfig = CANDIDATE_STATUS_CONFIG[candidate.status];
    const sortedInterviews = [...candidate.interviews].sort(
        (a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime()
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScreenHeader
                showBack
                backLabel="Candidates"
                title={candidate.name}
            />

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Profile Card */}
                <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                    <View style={styles.profileRow}>
                        <View style={[styles.avatar, { backgroundColor: statusConfig.color + '18' }]}>
                            <Text style={[styles.avatarText, { color: statusConfig.color }]}>
                                {candidate.name.charAt(0).toUpperCase()}
                            </Text>
                        </View>
                        <View style={styles.profileInfo}>
                            <Text style={[styles.profileName, { color: colors.textPrimary }]}>{candidate.name}</Text>
                            <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '14' }]}>
                                <Ionicons name={statusConfig.icon as any} size={12} color={statusConfig.color} />
                                <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>
                                    {statusConfig.label}
                                </Text>
                            </View>
                        </View>
                    </View>

                    <View style={[styles.contactSection, { borderTopColor: colors.borderLight || colors.border }]}>
                        <View style={styles.contactRow}>
                            <Ionicons name="call-outline" size={16} color={colors.textTertiary} />
                            <Text style={[styles.contactText, { color: colors.textSecondary }]}>{candidate.phone}</Text>
                        </View>
                        {candidate.email && (
                            <View style={styles.contactRow}>
                                <Ionicons name="mail-outline" size={16} color={colors.textTertiary} />
                                <Text style={[styles.contactText, { color: colors.textSecondary }]}>{candidate.email}</Text>
                            </View>
                        )}
                        <View style={styles.contactRow}>
                            <Ionicons name="person-outline" size={16} color={colors.textTertiary} />
                            <Text style={[styles.contactText, { color: colors.textSecondary }]}>
                                Recruiter: {candidate.assigned_manager_name}
                            </Text>
                        </View>
                        <View style={styles.contactRow}>
                            <Ionicons name="calendar-outline" size={16} color={colors.textTertiary} />
                            <Text style={[styles.contactText, { color: colors.textSecondary }]}>
                                Applied {formatDate(candidate.created_at)} · Updated {getTimeAgo(candidate.updated_at)}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Quick Actions */}
                <View style={[styles.actionsCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                    <QuickAction
                        icon="call"
                        label="Call"
                        color="#16A34A"
                        bgColor="#DCFCE7"
                        onPress={() => Linking.openURL(`tel:${candidate.phone.replace(/\s/g, '')}`)}
                    />
                    <QuickAction
                        icon="logo-whatsapp"
                        label="WhatsApp"
                        color="#25D366"
                        bgColor="#D1FAE5"
                        onPress={() => {
                            const phone = candidate.phone.replace(/[\s+]/g, '');
                            Linking.openURL(`https://wa.me/${phone}`);
                        }}
                    />
                    <QuickAction
                        icon="calendar"
                        label="Schedule"
                        color="#FF9500"
                        bgColor="#FFF3E0"
                        onPress={() => { }}
                    />
                    <QuickAction
                        icon="create-outline"
                        label="Note"
                        color="#6B7280"
                        bgColor={colors.surfacePrimary || colors.background}
                        onPress={() => { }}
                    />
                </View>

                {/* Pipeline Progress */}
                <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Pipeline Progress</Text>
                    <StatusStepper currentStatus={candidate.status} colors={colors} />
                </View>

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
                        <Text style={[styles.countBadge, { color: colors.textTertiary }]}>
                            {sortedInterviews.length}
                        </Text>
                    </View>
                    {sortedInterviews.length === 0 ? (
                        <View style={styles.emptyInterviews}>
                            <Ionicons name="videocam-off-outline" size={32} color={colors.textTertiary} />
                            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No interviews yet</Text>
                        </View>
                    ) : (
                        sortedInterviews.map((interview) => (
                            <InterviewCard key={interview.id} interview={interview} colors={colors} />
                        ))
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

// ── QuickAction Button ──

function QuickAction({ icon, label, color, bgColor, onPress, disabled }: {
    icon: string; label: string; color: string; bgColor: string;
    onPress: () => void; disabled?: boolean;
}) {
    return (
        <TouchableOpacity
            style={[styles.quickAction, { opacity: disabled ? 0.4 : 1 }]}
            onPress={onPress}
            disabled={disabled}
        >
            <View style={[styles.quickActionIcon, { backgroundColor: bgColor }]}>
                <Ionicons name={icon as any} size={20} color={color} />
            </View>
            <Text style={[styles.quickActionLabel, { color }]}>{label}</Text>
        </TouchableOpacity>
    );
}

// ── Styles ──

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
    profileRow: {
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
    profileInfo: { flex: 1 },
    profileName: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        marginTop: 6,
    },
    statusBadgeText: { fontSize: 12, fontWeight: '600' },
    contactSection: {
        marginTop: 14,
        paddingTop: 14,
        borderTopWidth: 0.5,
        gap: 8,
    },
    contactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    contactText: { fontSize: 14 },
    actionsCard: {
        flexDirection: 'row',
        borderRadius: 14,
        borderWidth: 0.5,
        padding: 12,
        marginBottom: 12,
        justifyContent: 'space-around',
    },
    quickAction: { alignItems: 'center', gap: 4 },
    quickActionIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    quickActionLabel: { fontSize: 11, fontWeight: '600' },
    sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
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

const interviewStyles = StyleSheet.create({
    card: {
        borderRadius: 10,
        borderWidth: 0.5,
        padding: 12,
        marginBottom: 8,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    roundBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#007AFF18',
        alignItems: 'center',
        justifyContent: 'center',
    },
    roundText: { fontSize: 11, fontWeight: '700', color: '#007AFF' },
    dateText: { fontSize: 14, fontWeight: '600' },
    typeText: { fontSize: 12, marginTop: 1 },
    statusPill: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    statusText: { fontSize: 11, fontWeight: '600' },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
    },
    detailText: { fontSize: 13 },
    notesText: { fontSize: 13, marginTop: 8, fontStyle: 'italic' },
});
