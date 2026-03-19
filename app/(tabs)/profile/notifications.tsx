import ScreenHeader from '@/components/ScreenHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
    fetchNotificationPreferences,
    updateNotificationPreference,
    type NotificationPreferences,
} from '@/lib/notificationPreferences';
import { NOTIFICATION_TYPE_CONFIG, ROLE_NOTIFICATION_TYPES, type NotificationType } from '@/types/notification';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** Human-readable subtitle for each notification type */
const TYPE_SUBTITLES: Partial<Record<NotificationType, string>> = {
    event_reminder: 'Upcoming events and roadshow check-ins',
    candidate_update: 'Candidate status changes',
    lead_milestone: 'Won and lost deals',
    agency_announcement: 'Important announcements',
    roadshow_pledge: 'Agent pledges during roadshows',
    new_lead: 'New leads assigned to you',
    lead_reassigned: 'Leads reassigned to or from you',
    interview_scheduled: 'New interview appointments',
    interview_updated: 'Interview rescheduled or cancelled',
    interview_reminder: 'Upcoming interview reminders',
    candidate_assigned: 'New candidates added to your team',
    agent_invite_accepted: 'Invited agents who joined',
    module_completed: 'Training modules marked complete',
    roadmap_unlocked: 'New programmes unlocked for you',
    new_manager_joined: 'New managers joining your team',
    lead_reassigned_global: 'Cross-team lead reassignments',
    lead_stale: 'Leads with no recent activity',
    roadshow_summary: 'Post-roadshow performance recap',
    system_alert: 'System errors and alerts',
};

export default function NotificationsScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const role = user?.role ?? 'candidate';

    const [prefs, setPrefs] = useState<NotificationPreferences>({});
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState<NotificationType | null>(null);

    const relevantTypes = ROLE_NOTIFICATION_TYPES[role] || [];

    useEffect(() => {
        if (!user?.id) return;
        fetchNotificationPreferences(user.id).then(({ prefs: p }) => {
            setPrefs(p);
            setLoading(false);
        });
    }, [user?.id]);

    const handleToggle = useCallback(
        async (type: NotificationType, enabled: boolean) => {
            if (!user?.id) return;
            setUpdating(type);
            // Optimistic update
            setPrefs((prev) => {
                const next = { ...prev };
                if (enabled) {
                    delete next[type];
                } else {
                    next[type] = false;
                }
                return next;
            });

            const { error } = await updateNotificationPreference(user.id, type, enabled);
            if (error) {
                // Rollback
                setPrefs((prev) => {
                    const next = { ...prev };
                    if (enabled) {
                        next[type] = false;
                    } else {
                        delete next[type];
                    }
                    return next;
                });
            }
            setUpdating(null);
        },
        [user?.id],
    );

    const isEnabled = (type: NotificationType) => prefs[type] !== false;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <ScreenHeader title="Notifications" showBack backLabel="Profile" />
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Info card */}
                <View style={[styles.infoCard, { backgroundColor: colors.accentLight }]}>
                    <Ionicons name="notifications" size={24} color={colors.accent} />
                    <View style={styles.infoText}>
                        <Text style={[styles.infoTitle, { color: colors.accent }]}>Push Notifications</Text>
                        <Text style={[styles.infoSubtitle, { color: colors.accent }]}>
                            Toggle push notifications for each category. In-app notifications are always available in
                            your inbox.
                        </Text>
                    </View>
                </View>

                {/* Notification types */}
                <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>PUSH NOTIFICATION PREFERENCES</Text>
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="small" color={colors.accent} />
                    </View>
                ) : (
                    <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
                        {relevantTypes.map((type, index) => {
                            const config = NOTIFICATION_TYPE_CONFIG[type];
                            const subtitle = TYPE_SUBTITLES[type];
                            const enabled = isEnabled(type);

                            return (
                                <View key={type}>
                                    <View style={styles.row}>
                                        <View style={[styles.iconCircle, { backgroundColor: colors.accentLight }]}>
                                            <Ionicons name={config.icon} size={18} color={colors.accent} />
                                        </View>
                                        <View style={styles.rowText}>
                                            <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                                                {config.label}
                                            </Text>
                                            {subtitle ? (
                                                <Text style={[styles.rowSubtitle, { color: colors.textTertiary }]}>
                                                    {subtitle}
                                                </Text>
                                            ) : null}
                                        </View>
                                        <Switch
                                            value={enabled}
                                            onValueChange={(val) => handleToggle(type, val)}
                                            disabled={updating === type}
                                            trackColor={{ false: colors.border, true: colors.accent }}
                                            accessibilityLabel={`${config.label} push notifications`}
                                        />
                                    </View>
                                    {index < relevantTypes.length - 1 && (
                                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                                    )}
                                </View>
                            );
                        })}
                    </View>
                )}

                {/* Device settings button */}
                <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>DEVICE PERMISSIONS</Text>
                <TouchableOpacity
                    style={[styles.card, styles.settingsBtn, { backgroundColor: colors.cardBackground }]}
                    onPress={() => Linking.openSettings()}
                    activeOpacity={0.7}
                >
                    <View style={[styles.iconCircle, { backgroundColor: colors.accentLight }]}>
                        <Ionicons name="settings-outline" size={18} color={colors.accent} />
                    </View>
                    <Text style={[styles.settingsBtnText, { color: colors.textPrimary }]}>Open Device Settings</Text>
                    <Ionicons name="open-outline" size={16} color={colors.textTertiary} />
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 40 },

    infoCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        borderRadius: 14,
        padding: 16,
        marginBottom: 24,
    },
    infoText: { flex: 1 },
    infoTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
    infoSubtitle: { fontSize: 13, lineHeight: 18 },

    sectionLabel: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.8,
        marginBottom: 8,
        paddingHorizontal: 4,
    },
    card: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
    },
    iconCircle: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowText: { flex: 1 },
    rowTitle: { fontSize: 15, fontWeight: '500' },
    rowSubtitle: { fontSize: 12, marginTop: 1 },
    divider: { height: StyleSheet.hairlineWidth, marginLeft: 48 },

    settingsBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    settingsBtnText: { flex: 1, fontSize: 15, fontWeight: '500' },

    loadingContainer: {
        paddingVertical: 40,
        alignItems: 'center',
    },
});
