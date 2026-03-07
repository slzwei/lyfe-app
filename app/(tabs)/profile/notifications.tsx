import ScreenHeader from '@/components/ScreenHeader';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Linking, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const NOTIFICATION_TYPES = [
    {
        icon: 'calendar' as const,
        title: 'Event Reminders',
        subtitle: 'Upcoming events and roadshow check-ins',
    },
    {
        icon: 'person-add' as const,
        title: 'Candidate Updates',
        subtitle: 'Interview schedules and status changes',
    },
    {
        icon: 'trophy' as const,
        title: 'Lead Milestones',
        subtitle: 'Won deals and pipeline progress',
    },
    {
        icon: 'megaphone' as const,
        title: 'Agency Announcements',
        subtitle: 'Important agency-wide messages',
    },
];

export default function NotificationsScreen() {
    const { colors } = useTheme();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScreenHeader title="Notifications" showBack backLabel="Profile" />
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* Info card */}
                <View style={[styles.infoCard, { backgroundColor: colors.accentLight }]}>
                    <Ionicons name="notifications" size={24} color={colors.accent} />
                    <View style={styles.infoText}>
                        <Text style={[styles.infoTitle, { color: colors.accent }]}>Push Notifications Active</Text>
                        <Text style={[styles.infoSubtitle, { color: colors.accent }]}>
                            Lyfe sends you notifications for the activities below. Manage permissions from device settings.
                        </Text>
                    </View>
                </View>

                {/* Notification types */}
                <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>YOU RECEIVE NOTIFICATIONS FOR</Text>
                <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
                    {NOTIFICATION_TYPES.map((item, index) => (
                        <View key={item.title}>
                            <View style={styles.row}>
                                <View style={[styles.iconCircle, { backgroundColor: colors.accentLight }]}>
                                    <Ionicons name={item.icon} size={18} color={colors.accent} />
                                </View>
                                <View style={styles.rowText}>
                                    <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{item.title}</Text>
                                    <Text style={[styles.rowSubtitle, { color: colors.textTertiary }]}>{item.subtitle}</Text>
                                </View>
                                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                            </View>
                            {index < NOTIFICATION_TYPES.length - 1 && (
                                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                            )}
                        </View>
                    ))}
                </View>

                {/* Device settings button */}
                <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>MANAGE PERMISSIONS</Text>
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
});
