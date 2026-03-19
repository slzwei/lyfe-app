import Constants from 'expo-constants';
import ErrorBanner from '@/components/ErrorBanner';
import LyfeLogo from '@/components/LyfeLogo';
import ScreenHeader from '@/components/ScreenHeader';
import AppearanceCard from '@/components/profile/AppearanceCard';
import AssignedManagersCard from '@/components/profile/AssignedManagersCard';
import AvatarPickerSheet, { type AvatarAction } from '@/components/profile/AvatarPickerSheet';
import DeleteAccountModal from '@/components/profile/DeleteAccountModal';
import EditProfileSheet from '@/components/profile/EditProfileSheet';
import SecurityCard from '@/components/profile/SecurityCard';
import SettingsListCard, { type SettingsRowConfig } from '@/components/profile/SettingsListCard';
import SignOutModal from '@/components/profile/SignOutModal';
import UserHeroCard from '@/components/profile/UserHeroCard';
import PersonalityQuizzesCard from '@/components/profile/PersonalityQuizzesCard';
import ViewModeCard from '@/components/profile/ViewModeCard';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useViewMode, type ViewMode } from '@/contexts/ViewModeContext';
import { getBiometryType, type BiometryType } from '@/lib/biometrics';
import { pickAndUploadAvatar, removeAvatar, takeAndUploadAvatar } from '@/lib/storage';
import type { AssignedManager } from '@/types/recruitment';
import { useSubmitGuard } from '@/hooks/useSubmitGuard';
import { useTypedRouter } from '@/hooks/useTypedRouter';
import { supabase } from '@/lib/supabase';
import { fetchPAManagers } from '@/lib/recruitment';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

// ── Settings Rows Config ──
const GENERAL_SETTINGS: SettingsRowConfig[] = [
    { key: 'edit', icon: 'create-outline', label: 'Edit Profile', subtitle: 'Name, photo, and details' },
    { key: 'notifications', icon: 'notifications-outline', label: 'Notifications', subtitle: 'Alerts and reminders' },
    { key: 'privacy', icon: 'lock-closed-outline', label: 'Privacy', subtitle: 'Data and security' },
];

const SUPPORT_SETTINGS: SettingsRowConfig[] = [
    { key: 'terms', icon: 'document-text-outline', label: 'Terms of Service' },
];

export default function ProfileScreen() {
    const { colors, mode, setMode } = useTheme();
    const { user, signOut, biometricsEnabled, enableBiometrics, disableBiometrics, updateAvatarUrl, updateProfile } =
        useAuth();
    const { viewMode, canToggle, setViewMode } = useViewMode();
    const router = useTypedRouter();
    const [showSignOutModal, setShowSignOutModal] = useState(false);
    const [managers, setManagers] = useState<AssignedManager[]>([]);
    const [showAvatarSheet, setShowAvatarSheet] = useState(false);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const [biometryType, setBiometryType] = useState<BiometryType>('none');
    const [error, setError] = useState<string | null>(null);

    // Delete account modal
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // Edit profile modal
    const [showEditModal, setShowEditModal] = useState(false);
    const [editName, setEditName] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const { isSubmitting: editSaving, guard: editGuard } = useSubmitGuard();
    const [editError, setEditError] = useState<string | null>(null);

    useEffect(() => {
        getBiometryType().then(setBiometryType);
    }, []);

    const loadManagers = useCallback(async () => {
        if (user?.role !== 'pa') return;
        if (!user?.id) return;
        const managers = await fetchPAManagers(user.id);
        setManagers(managers);
    }, [user?.id, user?.role]);

    useFocusEffect(
        useCallback(() => {
            loadManagers();
        }, [loadManagers]),
    );

    const handleToggleBiometrics = useCallback(
        async (value: boolean) => {
            if (value) {
                const success = await enableBiometrics();
                if (!success && Platform.OS !== 'web') {
                    Alert.alert('Could not enable', 'Biometric authentication failed. Please try again.');
                }
            } else {
                await disableBiometrics();
            }
        },
        [enableBiometrics, disableBiometrics],
    );

    const handleSignOut = () => {
        setShowSignOutModal(true);
    };

    const confirmSignOut = async () => {
        setShowSignOutModal(false);
        try {
            await signOut();
        } catch {
            setError('Failed to sign out. Please try again.');
        }
    };

    const confirmDeleteAccount = async () => {
        setDeleting(true);
        setDeleteError(null);
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;
            if (!token) {
                setDeleteError('Not authenticated. Please sign in again.');
                setDeleting(false);
                return;
            }
            const { data, error: fnError } = await supabase.functions.invoke('delete-account', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (fnError || !data?.success) {
                setDeleteError(fnError?.message || data?.error || 'Failed to delete account. Please try again.');
                setDeleting(false);
                return;
            }
            setShowDeleteModal(false);
            // Clear biometrics so Face ID doesn't show for a deleted account
            if (biometricsEnabled) await disableBiometrics();
            await supabase.auth.signOut();
        } catch {
            setDeleteError('Failed to delete account. Please try again.');
            setDeleting(false);
        }
    };

    const handleViewModeChange = useCallback(
        (newMode: ViewMode) => {
            if (newMode === viewMode) return;
            setViewMode(newMode);
            // FM-01 mitigation: redirect to Home after mode switch to avoid tab stranding
            setTimeout(() => {
                router.replace('/(tabs)/home');
            }, 100);
        },
        [viewMode, setViewMode, router],
    );

    const handleSettingsPress = (key: string) => {
        if (key === 'edit') {
            setEditName(user?.full_name || '');
            setEditEmail(user?.email || '');
            setEditError(null);
            setShowEditModal(true);
            return;
        }
        if (key === 'notifications') {
            router.push('/(tabs)/profile/notifications');
            return;
        }
        if (key === 'privacy') {
            router.push('/(tabs)/profile/privacy');
            return;
        }
        if (key === 'terms') {
            router.push('/(tabs)/profile/terms');
            return;
        }
    };

    const handleSaveProfile = () =>
        editGuard(async () => {
            if (!editName.trim()) {
                setEditError('Name is required');
                return;
            }
            setEditError(null);
            const { error } = await updateProfile(editName, editEmail || null);
            if (error) {
                setEditError(error);
                return;
            }
            setShowEditModal(false);
        });

    const handleAvatarAction = useCallback(
        async (action: AvatarAction) => {
            setShowAvatarSheet(false);
            if (!user?.id) return;

            setAvatarUploading(true);
            let result: { url?: string | null; error: string | null };

            if (action === 'remove') {
                result = await removeAvatar(user.id);
                if (!result.error) updateAvatarUrl(null);
            } else if (action === 'camera') {
                result = await takeAndUploadAvatar(user.id);
                if (!result.error && result.url) updateAvatarUrl(result.url);
            } else {
                result = await pickAndUploadAvatar(user.id);
                if (!result.error && result.url) updateAvatarUrl(result.url);
            }

            setAvatarUploading(false);

            if (result.error) {
                Alert.alert('Upload Failed', result.error);
            }
        },
        [user?.id, updateAvatarUrl],
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <ScreenHeader title="Profile" />
            {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Hero User Card */}
                <UserHeroCard
                    testID="profile-user-hero"
                    colors={colors}
                    fullName={user?.full_name}
                    role={user?.role}
                    phone={user?.phone}
                    email={user?.email}
                    avatarUrl={user?.avatar_url}
                    avatarUploading={avatarUploading}
                    onAvatarPress={() => setShowAvatarSheet(true)}
                />

                {/* Assigned Managers -- PA only */}
                {user?.role === 'pa' && <AssignedManagersCard colors={colors} managers={managers} />}

                {/* View Mode Toggle -- T2/T3 only */}
                {canToggle && (
                    <ViewModeCard colors={colors} viewMode={viewMode} onViewModeChange={handleViewModeChange} />
                )}

                {/* Personality Quizzes — non-candidate, non-PA roles */}
                {user?.id && user?.role !== 'candidate' && user?.role !== 'pa' && (
                    <PersonalityQuizzesCard colors={colors} userId={user.id} />
                )}

                {/* Security -- Biometrics */}
                {biometryType !== 'none' && (
                    <SecurityCard
                        testID="profile-security-card"
                        colors={colors}
                        biometryType={biometryType}
                        enabled={biometricsEnabled}
                        onToggle={handleToggleBiometrics}
                    />
                )}

                {/* General Settings */}
                <SettingsListCard
                    testID="profile-general-settings"
                    colors={colors}
                    title="GENERAL"
                    rows={GENERAL_SETTINGS}
                    onPress={handleSettingsPress}
                />

                {/* Appearance */}
                <AppearanceCard colors={colors} mode={mode} onModeChange={setMode} />

                {/* Support Settings */}
                <SettingsListCard
                    colors={colors}
                    title="SUPPORT"
                    rows={SUPPORT_SETTINGS}
                    onPress={handleSettingsPress}
                />

                {/* App Info */}
                <View
                    style={[
                        styles.card,
                        styles.appInfoCard,
                        { backgroundColor: colors.cardBackground, shadowColor: colors.textPrimary },
                    ]}
                >
                    <LyfeLogo size="sm" />
                    <Text style={[styles.versionText, { color: colors.textTertiary }]}>
                        v{Constants.expoConfig?.version ?? '1.0.0'}
                    </Text>
                </View>

                {/* Sign Out */}
                <TouchableOpacity
                    testID="profile-sign-out-button"
                    style={[styles.signOutButton, { borderColor: colors.danger }]}
                    onPress={handleSignOut}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Sign out of your account"
                >
                    <Ionicons name="log-out-outline" size={20} color={colors.danger} />
                    <Text style={[styles.signOutText, { color: colors.danger }]}>Sign Out</Text>
                </TouchableOpacity>

                {/* Delete Account */}
                <TouchableOpacity
                    style={styles.deleteAccountButton}
                    onPress={() => setShowDeleteModal(true)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Delete your account"
                >
                    <Text style={[styles.deleteAccountText, { color: colors.textTertiary }]}>Delete Account</Text>
                </TouchableOpacity>
            </ScrollView>

            {/* Edit Profile Modal */}
            <EditProfileSheet
                visible={showEditModal}
                colors={colors}
                name={editName}
                email={editEmail}
                saving={editSaving}
                error={editError}
                onNameChange={setEditName}
                onEmailChange={setEditEmail}
                onSave={handleSaveProfile}
                onClose={() => setShowEditModal(false)}
            />

            {/* Avatar Picker Sheet */}
            <AvatarPickerSheet
                visible={showAvatarSheet}
                colors={colors}
                hasAvatar={!!user?.avatar_url}
                onAction={handleAvatarAction}
                onClose={() => setShowAvatarSheet(false)}
            />

            {/* Sign Out Confirmation Modal */}
            <SignOutModal
                visible={showSignOutModal}
                colors={colors}
                onCancel={() => setShowSignOutModal(false)}
                onConfirm={confirmSignOut}
            />

            {/* Delete Account Confirmation Modal */}
            <DeleteAccountModal
                visible={showDeleteModal}
                colors={colors}
                deleting={deleting}
                error={deleteError}
                onCancel={() => {
                    setShowDeleteModal(false);
                    setDeleteError(null);
                }}
                onConfirm={confirmDeleteAccount}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { paddingBottom: 120, paddingTop: 8 },

    // ── Cards ──
    card: {
        marginHorizontal: 16,
        marginBottom: 12,
        borderRadius: 16,
        padding: 16,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 2,
    },

    // ── App Info ──
    appInfoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    versionText: {
        fontSize: 13,
    },

    // ── Sign Out ──
    signOutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginHorizontal: 16,
        marginTop: 8,
        paddingVertical: 16,
        borderRadius: 14,
        borderWidth: 1.5,
    },
    signOutText: {
        fontSize: 15,
        fontWeight: '600',
    },

    // ── Delete Account ──
    deleteAccountButton: {
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 16,
        marginTop: 16,
        minHeight: 44,
    },
    deleteAccountText: {
        fontSize: 13,
        fontWeight: '500',
    },
});
