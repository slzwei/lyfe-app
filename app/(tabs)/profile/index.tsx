import LyfeLogo from '@/components/LyfeLogo';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    Modal,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

const ROLE_LABELS: Record<string, string> = {
    admin: 'Administrator',
    director: 'Director',
    manager: 'Manager',
    agent: 'Agent',
    pa: 'Personal Assistant',
    candidate: 'Candidate',
};

export default function ProfileScreen() {
    const { colors, isDark, mode, setMode } = useTheme();
    const { user, signOut } = useAuth();
    const [showSignOutModal, setShowSignOutModal] = useState(false);

    const handleSignOut = () => {
        setShowSignOutModal(true);
    };

    const confirmSignOut = () => {
        setShowSignOutModal(false);
        signOut();
    };

    const themeOptions: Array<{ value: 'system' | 'light' | 'dark'; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
        { value: 'system', label: 'System', icon: 'phone-portrait-outline' },
        { value: 'light', label: 'Light', icon: 'sunny-outline' },
        { value: 'dark', label: 'Dark', icon: 'moon-outline' },
    ];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>Profile</Text>
                </View>

                {/* User Card */}
                <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                    <View style={[styles.avatarCircle, { backgroundColor: colors.accentLight }]}>
                        <Text style={[styles.avatarText, { color: colors.accent }]}>
                            {user?.full_name?.charAt(0)?.toUpperCase() || '?'}
                        </Text>
                    </View>
                    <View style={styles.userInfo}>
                        <Text style={[styles.userName, { color: colors.textPrimary }]}>
                            {user?.full_name || 'Unknown User'}
                        </Text>
                        <View style={[styles.roleBadge, { backgroundColor: colors.accentLight }]}>
                            <Text style={[styles.roleText, { color: colors.accent }]}>
                                {ROLE_LABELS[user?.role || 'agent']}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Contact Info */}
                <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>CONTACT</Text>
                    {user?.phone && (
                        <View style={styles.infoRow}>
                            <Ionicons name="call-outline" size={18} color={colors.textSecondary} />
                            <Text style={[styles.infoText, { color: colors.textPrimary }]}>{user.phone}</Text>
                        </View>
                    )}
                    {user?.email && (
                        <View style={styles.infoRow}>
                            <Ionicons name="mail-outline" size={18} color={colors.textSecondary} />
                            <Text style={[styles.infoText, { color: colors.textPrimary }]}>{user.email}</Text>
                        </View>
                    )}
                </View>

                {/* Theme Selector */}
                <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>APPEARANCE</Text>
                    <View style={styles.themeRow}>
                        {themeOptions.map((option) => (
                            <TouchableOpacity
                                key={option.value}
                                style={[
                                    styles.themeOption,
                                    {
                                        backgroundColor: mode === option.value ? colors.accentLight : colors.inputBackground,
                                        borderColor: mode === option.value ? colors.accent : colors.border,
                                    },
                                ]}
                                onPress={() => setMode(option.value)}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name={option.icon}
                                    size={20}
                                    color={mode === option.value ? colors.accent : colors.textSecondary}
                                />
                                <Text
                                    style={[
                                        styles.themeLabel,
                                        {
                                            color: mode === option.value ? colors.accent : colors.textSecondary,
                                            fontWeight: mode === option.value ? '600' : '400',
                                        },
                                    ]}
                                >
                                    {option.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* App Info */}
                <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                    <View style={styles.appInfoRow}>
                        <LyfeLogo size="sm" />
                        <Text style={[styles.versionText, { color: colors.textTertiary }]}>v1.0.0</Text>
                    </View>
                </View>

                {/* Sign Out */}
                <TouchableOpacity
                    style={[styles.signOutButton, { borderColor: colors.danger }]}
                    onPress={handleSignOut}
                    activeOpacity={0.7}
                >
                    <Ionicons name="log-out-outline" size={20} color={colors.danger} />
                    <Text style={[styles.signOutText, { color: colors.danger }]}>Sign Out</Text>
                </TouchableOpacity>
            </ScrollView>

            {/* Sign Out Confirmation Modal */}
            <Modal
                visible={showSignOutModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowSignOutModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
                        <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Sign Out</Text>
                        <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
                            Are you sure you want to sign out?
                        </Text>
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: colors.surfacePrimary }]}
                                onPress={() => setShowSignOutModal(false)}
                            >
                                <Text style={[styles.modalBtnText, { color: colors.textPrimary }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: colors.danger }]}
                                onPress={confirmSignOut}
                            >
                                <Text style={[styles.modalBtnText, { color: '#FFFFFF' }]}>Sign Out</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { paddingBottom: 32 },
    header: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 12,
    },
    title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
    card: {
        marginHorizontal: 16,
        marginBottom: 12,
        borderRadius: 12,
        borderWidth: 0.5,
        padding: 16,
    },
    avatarCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        fontSize: 24,
        fontWeight: '700',
    },
    userInfo: {
        marginTop: 12,
        gap: 8,
    },
    userName: {
        fontSize: 20,
        fontWeight: '700',
    },
    roleBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
    },
    roleText: {
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.3,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1,
        marginBottom: 12,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 6,
    },
    infoText: {
        fontSize: 15,
    },
    themeRow: {
        flexDirection: 'row',
        gap: 8,
    },
    themeOption: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
    },
    themeLabel: {
        fontSize: 13,
    },
    appInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    versionText: {
        fontSize: 13,
    },
    signOutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginHorizontal: 16,
        marginTop: 8,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
    },
    signOutText: {
        fontSize: 15,
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
    },
    modalContent: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 8,
    },
    modalMessage: {
        fontSize: 14,
        marginBottom: 24,
        textAlign: 'center',
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    modalBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
    },
    modalBtnText: {
        fontSize: 14,
        fontWeight: '600',
    },
});
