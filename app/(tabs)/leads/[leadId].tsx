import LeadActivityItem from '@/components/LeadActivityItem';
import StatusBadge from '@/components/StatusBadge';
import { useTheme } from '@/contexts/ThemeContext';
import { PRODUCT_LABELS, SOURCE_LABELS, STATUS_CONFIG, type LeadActivity, type LeadStatus } from '@/types/lead';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    KeyboardAvoidingView,
    Linking,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

// Import mock data from list screen
import { MOCK_ACTIVITIES, MOCK_LEADS } from './index';

const STATUS_ORDER: LeadStatus[] = ['new', 'contacted', 'qualified', 'proposed', 'won', 'lost'];

export default function LeadDetailScreen() {
    const { leadId } = useLocalSearchParams<{ leadId: string }>();
    const { colors } = useTheme();
    const router = useRouter();

    const lead = MOCK_LEADS.find((l) => l.id === leadId);
    const [activities, setActivities] = useState<LeadActivity[]>(
        () => (MOCK_ACTIVITIES[leadId || ''] || [])
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    );
    const [currentStatus, setCurrentStatus] = useState(lead?.status || 'new');
    const [showNoteInput, setShowNoteInput] = useState(false);
    const [noteText, setNoteText] = useState('');
    const [showStatusPicker, setShowStatusPicker] = useState(false);

    if (!lead) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
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

    const handleCall = () => {
        if (lead.phone) {
            Linking.openURL(`tel:${lead.phone.replace(/\s/g, '')}`);
        }
    };

    const handleWhatsApp = () => {
        if (lead.phone) {
            const phone = lead.phone.replace(/[\s+]/g, '');
            Linking.openURL(`https://wa.me/${phone}`);
        }
    };

    const addNote = () => {
        if (!noteText.trim()) return;
        const newActivity: LeadActivity = {
            id: `a_${Date.now()}`,
            lead_id: lead.id,
            user_id: 'me',
            type: 'note',
            description: noteText.trim(),
            metadata: {},
            created_at: new Date().toISOString(),
        };
        setActivities((prev) => [newActivity, ...prev]);
        setNoteText('');
        setShowNoteInput(false);
    };

    const changeStatus = (newStatus: LeadStatus) => {
        if (newStatus === currentStatus) return;
        const newActivity: LeadActivity = {
            id: `a_${Date.now()}`,
            lead_id: lead.id,
            user_id: 'me',
            type: 'status_change',
            description: null,
            metadata: { from_status: currentStatus, to_status: newStatus },
            created_at: new Date().toISOString(),
        };
        setActivities((prev) => [newActivity, ...prev]);
        setCurrentStatus(newStatus);
        setShowStatusPicker(false);
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header Bar */}
            <View style={[styles.headerBar, { borderBottomColor: colors.borderLight }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
                    <Text style={[styles.backText, { color: colors.textPrimary }]}>Leads</Text>
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={100}
            >
                <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    {/* Lead Header Card */}
                    <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                        <View style={styles.leadHeaderRow}>
                            <View style={[styles.avatar, { backgroundColor: colors.accentLight }]}>
                                <Text style={[styles.avatarText, { color: colors.accent }]}>
                                    {lead.full_name.charAt(0).toUpperCase()}
                                </Text>
                            </View>
                            <View style={styles.leadInfo}>
                                <Text style={[styles.leadName, { color: colors.textPrimary }]}>{lead.full_name}</Text>
                                <View style={{ marginTop: 4 }}>
                                    <StatusBadge status={currentStatus} size="medium" showIcon />
                                </View>
                            </View>
                        </View>

                        {/* Contact Info */}
                        <View style={[styles.contactSection, { borderTopColor: colors.borderLight }]}>
                            {lead.phone && (
                                <View style={styles.contactRow}>
                                    <Ionicons name="call-outline" size={16} color={colors.textTertiary} />
                                    <Text style={[styles.contactText, { color: colors.textSecondary }]}>{lead.phone}</Text>
                                </View>
                            )}
                            {lead.email && (
                                <View style={styles.contactRow}>
                                    <Ionicons name="mail-outline" size={16} color={colors.textTertiary} />
                                    <Text style={[styles.contactText, { color: colors.textSecondary }]}>{lead.email}</Text>
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
                    <View style={[styles.actionsCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                        <QuickAction
                            icon="call"
                            label="Call"
                            color="#16A34A"
                            bgColor="#DCFCE7"
                            onPress={handleCall}
                            disabled={!lead.phone}
                        />
                        <QuickAction
                            icon="logo-whatsapp"
                            label="WhatsApp"
                            color="#25D366"
                            bgColor="#D1FAE5"
                            onPress={handleWhatsApp}
                            disabled={!lead.phone}
                        />
                        <QuickAction
                            icon="swap-horizontal"
                            label="Status"
                            color="#D97706"
                            bgColor="#FEF3C7"
                            onPress={() => setShowStatusPicker(!showStatusPicker)}
                        />
                        <QuickAction
                            icon="create-outline"
                            label="Note"
                            color="#6B7280"
                            bgColor={colors.surfacePrimary}
                            onPress={() => setShowNoteInput(!showNoteInput)}
                        />
                    </View>

                    {/* Status Picker */}
                    {showStatusPicker && (
                        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Change Status</Text>
                            <View style={styles.statusGrid}>
                                {STATUS_ORDER.map((s) => {
                                    const cfg = STATUS_CONFIG[s];
                                    const isActive = s === currentStatus;
                                    return (
                                        <TouchableOpacity
                                            key={s}
                                            style={[
                                                styles.statusOption,
                                                {
                                                    backgroundColor: isActive ? cfg.bgColor : colors.surfacePrimary,
                                                    borderColor: isActive ? cfg.color : colors.borderLight,
                                                    borderWidth: isActive ? 1.5 : 0.5,
                                                },
                                            ]}
                                            onPress={() => changeStatus(s)}
                                        >
                                            <Ionicons name={cfg.icon as any} size={16} color={isActive ? cfg.color : colors.textTertiary} />
                                            <Text style={[styles.statusOptionText, { color: isActive ? cfg.color : colors.textSecondary }]}>
                                                {cfg.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    )}

                    {/* Add Note Input */}
                    {showNoteInput && (
                        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Add Note</Text>
                            <TextInput
                                style={[styles.noteInput, { color: colors.textPrimary, borderColor: colors.borderLight, backgroundColor: colors.surfacePrimary }]}
                                placeholder="Write a note..."
                                placeholderTextColor={colors.textTertiary}
                                value={noteText}
                                onChangeText={setNoteText}
                                multiline
                                numberOfLines={3}
                                textAlignVertical="top"
                            />
                            <View style={styles.noteActions}>
                                <TouchableOpacity
                                    style={[styles.noteCancel, { borderColor: colors.borderLight }]}
                                    onPress={() => { setShowNoteInput(false); setNoteText(''); }}
                                >
                                    <Text style={[styles.noteCancelText, { color: colors.textSecondary }]}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.noteSave, { backgroundColor: colors.accent, opacity: noteText.trim() ? 1 : 0.4 }]}
                                    onPress={addNote}
                                    disabled={!noteText.trim()}
                                >
                                    <Text style={styles.noteSaveText}>Save Note</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* Activity Timeline */}
                    <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                        <View style={styles.timelineHeader}>
                            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Activity</Text>
                            <Text style={[styles.activityCount, { color: colors.textTertiary }]}>{activities.length} entries</Text>
                        </View>
                        <View style={styles.timelineContent}>
                            {activities.map((act, idx) => (
                                <LeadActivityItem
                                    key={act.id}
                                    activity={act}
                                    isLast={idx === activities.length - 1}
                                />
                            ))}
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

// ── QuickAction Button ──
function QuickAction({
    icon,
    label,
    color,
    bgColor,
    onPress,
    disabled,
}: {
    icon: string;
    label: string;
    color: string;
    bgColor: string;
    onPress: () => void;
    disabled?: boolean;
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

const styles = StyleSheet.create({
    container: { flex: 1 },
    headerBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 0.5,
    },
    backBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    backText: { fontSize: 16, fontWeight: '500' },
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
    leadName: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
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
    quickAction: {
        alignItems: 'center',
        gap: 4,
    },
    quickActionIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    quickActionLabel: { fontSize: 11, fontWeight: '600' },
    sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
    statusGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    statusOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
    },
    statusOptionText: { fontSize: 13, fontWeight: '600' },
    noteInput: {
        borderWidth: 0.5,
        borderRadius: 10,
        padding: 12,
        fontSize: 14,
        minHeight: 80,
    },
    noteActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
        marginTop: 10,
    },
    noteCancel: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 0.5,
    },
    noteCancelText: { fontSize: 13, fontWeight: '600' },
    noteSave: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
    },
    noteSaveText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
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
