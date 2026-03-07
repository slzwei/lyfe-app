import Avatar from '@/components/Avatar';
import LyfeLogo from '@/components/LyfeLogo';
import ScreenHeader from '@/components/ScreenHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useViewMode, type ViewMode } from '@/contexts/ViewModeContext';
import { getBiometryType, type BiometryType } from '@/lib/biometrics';
import { pickAndUploadAvatar, removeAvatar, takeAndUploadAvatar } from '@/lib/storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const ROLE_LABELS: Record<string, string> = {
    admin: 'Administrator',
    director: 'Director',
    manager: 'Manager',
    agent: 'Agent',
    pa: 'Personal Assistant',
    candidate: 'Candidate',
};

const VIEW_MODE_OPTIONS: Array<{ value: ViewMode; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
    { value: 'agent', label: 'Agent View', icon: 'person-outline' },
    { value: 'manager', label: 'Manager View', icon: 'shield-outline' },
];

// ── Settings Rows Config ──
interface SettingsRow {
    key: string;
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    subtitle?: string;
    danger?: boolean;
}

const GENERAL_SETTINGS: SettingsRow[] = [
    { key: 'edit', icon: 'create-outline', label: 'Edit Profile', subtitle: 'Name, photo, and details' },
    { key: 'notifications', icon: 'notifications-outline', label: 'Notifications', subtitle: 'Alerts and reminders' },
    { key: 'privacy', icon: 'lock-closed-outline', label: 'Privacy', subtitle: 'Data and security' },
];

const SUPPORT_SETTINGS: SettingsRow[] = [
    { key: 'terms', icon: 'document-text-outline', label: 'Terms of Service' },
];

export default function ProfileScreen() {
    const { colors, isDark, mode, setMode } = useTheme();
    const { user, signOut, biometricsEnabled, enableBiometrics, disableBiometrics, updateAvatarUrl, updateProfile } = useAuth();
    const { viewMode, canToggle, setViewMode } = useViewMode();
    const router = useRouter();
    const [showSignOutModal, setShowSignOutModal] = useState(false);
    const [showAvatarSheet, setShowAvatarSheet] = useState(false);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const [biometryType, setBiometryType] = useState<BiometryType>('none');

    // Edit profile modal
    const [showEditModal, setShowEditModal] = useState(false);
    const [editName, setEditName] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [editSaving, setEditSaving] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);

    useEffect(() => {
        getBiometryType().then(setBiometryType);
    }, []);

    // Sheet slide-up animations (overlay appears instantly; only the sheet slides)
    const avatarSheetY = useRef(new Animated.Value(400)).current;
    const editSheetY = useRef(new Animated.Value(400)).current;

    useEffect(() => {
        if (showAvatarSheet) {
            avatarSheetY.setValue(400);
            Animated.spring(avatarSheetY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }).start();
        }
    }, [showAvatarSheet]);

    useEffect(() => {
        if (showEditModal) {
            editSheetY.setValue(400);
            Animated.spring(editSheetY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }).start();
        }
    }, [showEditModal]);

    const handleToggleBiometrics = async (value: boolean) => {
        if (value) {
            const success = await enableBiometrics();
            if (!success && Platform.OS !== 'web') {
                Alert.alert('Could not enable', 'Biometric authentication failed. Please try again.');
            }
        } else {
            await disableBiometrics();
        }
    };

    const handleSignOut = () => {
        setShowSignOutModal(true);
    };

    const confirmSignOut = () => {
        setShowSignOutModal(false);
        signOut();
    };

    const handleViewModeChange = (newMode: ViewMode) => {
        if (newMode === viewMode) return;
        setViewMode(newMode);
        // FM-01 mitigation: redirect to Home after mode switch to avoid tab stranding
        setTimeout(() => {
            router.replace('/(tabs)/home');
        }, 100);
    };

    const handleSettingsPress = (key: string) => {
        if (key === 'edit') {
            setEditName(user?.full_name || '');
            setEditEmail(user?.email || '');
            setEditError(null);
            setShowEditModal(true);
            return;
        }
        if (key === 'notifications') { router.push('/(tabs)/profile/notifications' as any); return; }
        if (key === 'privacy') { router.push('/(tabs)/profile/privacy' as any); return; }
        if (key === 'help') { router.push('/(tabs)/profile/help' as any); return; }
        if (key === 'terms') { router.push('/(tabs)/profile/terms' as any); return; }
    };

    const handleSaveProfile = async () => {
        if (!editName.trim()) { setEditError('Name is required'); return; }
        setEditSaving(true);
        setEditError(null);
        const { error } = await updateProfile(editName, editEmail || null);
        setEditSaving(false);
        if (error) { setEditError(error); return; }
        setShowEditModal(false);
    };

    const handleAvatarAction = async (action: 'camera' | 'library' | 'remove') => {
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
    };

    const themeOptions: Array<{ value: 'system' | 'light' | 'dark'; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
        { value: 'system', label: 'System', icon: 'phone-portrait-outline' },
        { value: 'light', label: 'Light', icon: 'sunny-outline' },
        { value: 'dark', label: 'Dark', icon: 'moon-outline' },
    ];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScreenHeader title="Profile" />
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* Hero User Card */}
                <View style={[styles.card, styles.userCard, { backgroundColor: colors.cardBackground, shadowColor: colors.textPrimary }]}>
                    <View style={styles.userCardRow}>
                        {/* Avatar — tappable */}
                        <TouchableOpacity
                            onPress={() => setShowAvatarSheet(true)}
                            activeOpacity={0.8}
                            accessibilityRole="button"
                            accessibilityLabel="Change profile photo"
                            style={[styles.avatarOuter, { borderColor: colors.accent + '30' }]}
                        >
                            {avatarUploading ? (
                                <View style={[styles.avatarCircle, { backgroundColor: colors.accentLight }]}>
                                    <ActivityIndicator color={colors.accent} />
                                </View>
                            ) : (
                                <Avatar
                                    name={user?.full_name || '?'}
                                    avatarUrl={user?.avatar_url}
                                    size={66}
                                    backgroundColor={colors.accentLight}
                                    textColor={colors.accent}
                                />
                            )}
                            <View style={[styles.avatarEditBadge, { backgroundColor: colors.accent }]}>
                                <Ionicons name="camera" size={10} color="#FFFFFF" />
                            </View>
                        </TouchableOpacity>

                        {/* User Info */}
                        <View style={styles.userInfo}>
                            <Text style={[styles.userName, { color: colors.textPrimary }]} numberOfLines={1}>
                                {user?.full_name || 'Unknown User'}
                            </Text>
                            <View style={[styles.roleBadge, { backgroundColor: colors.accentLight }]}>
                                <Text style={[styles.roleText, { color: colors.accent }]}>
                                    {ROLE_LABELS[user?.role || 'agent']}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Contact Info — inline in user card */}
                    <View style={[styles.contactDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.contactSection}>
                        {user?.phone && (
                            <View style={styles.contactRow}>
                                <Ionicons name="call-outline" size={16} color={colors.textTertiary} />
                                <Text style={[styles.contactText, { color: colors.textSecondary }]}>{user.phone}</Text>
                            </View>
                        )}
                        {user?.email && (
                            <View style={styles.contactRow}>
                                <Ionicons name="mail-outline" size={16} color={colors.textTertiary} />
                                <Text style={[styles.contactText, { color: colors.textSecondary }]}>{user.email}</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* View Mode Toggle — T2/T3 only */}
                {canToggle && (
                    <View style={[styles.card, { backgroundColor: colors.cardBackground, shadowColor: colors.textPrimary }]}>
                        <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>VIEW MODE</Text>
                        <View style={[styles.segmentContainer, { backgroundColor: colors.inputBackground }]}>
                            {VIEW_MODE_OPTIONS.map((option) => {
                                const isActive = viewMode === option.value;
                                return (
                                    <TouchableOpacity
                                        key={option.value}
                                        style={[
                                            styles.segmentOption,
                                            isActive && {
                                                backgroundColor: colors.cardBackground,
                                                shadowColor: '#000',
                                                shadowOffset: { width: 0, height: 1 },
                                                shadowOpacity: 0.1,
                                                shadowRadius: 2,
                                                elevation: 2,
                                            },
                                        ]}
                                        onPress={() => handleViewModeChange(option.value)}
                                        activeOpacity={0.7}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Switch to ${option.label}`}
                                        accessibilityState={{ selected: isActive }}
                                    >
                                        <Ionicons
                                            name={option.icon}
                                            size={18}
                                            color={isActive ? colors.accent : colors.textSecondary}
                                        />
                                        <Text
                                            style={[
                                                styles.segmentLabel,
                                                {
                                                    color: isActive ? colors.accent : colors.textSecondary,
                                                    fontWeight: isActive ? '600' : '400',
                                                },
                                            ]}
                                        >
                                            {option.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                        <Text style={[styles.viewModeHint, { color: colors.textTertiary }]}>
                            {viewMode === 'agent'
                                ? 'Manage your leads and clients'
                                : 'Manage your team and candidates'}
                        </Text>
                    </View>
                )}

                {/* Security — Face ID / Touch ID */}
                {biometryType !== 'none' && (
                    <View style={[styles.card, { backgroundColor: colors.cardBackground, shadowColor: colors.textPrimary }]}>
                        <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>SECURITY</Text>
                        <View style={styles.settingsRow}>
                            <View style={[styles.settingsIconCircle, { backgroundColor: colors.accentLight }]}>
                                <Ionicons
                                    name={biometryType === 'faceid' ? 'scan' : 'finger-print'}
                                    size={18}
                                    color={colors.accent}
                                />
                            </View>
                            <View style={styles.settingsTextCol}>
                                <Text style={[styles.settingsLabel, { color: colors.textPrimary }]}>
                                    {biometryType === 'faceid' ? 'Face ID' : 'Touch ID'}
                                </Text>
                                <Text style={[styles.settingsSubtitle, { color: colors.textTertiary }]}>
                                    Sign in without OTP
                                </Text>
                            </View>
                            <Switch
                                value={biometricsEnabled}
                                onValueChange={handleToggleBiometrics}
                                trackColor={{ false: colors.border, true: colors.accent }}
                                thumbColor="#FFFFFF"
                                accessibilityLabel={`${biometryType === 'faceid' ? 'Face ID' : 'Touch ID'} sign-in`}
                            />
                        </View>
                    </View>
                )}

                {/* General Settings */}
                <View style={[styles.card, { backgroundColor: colors.cardBackground, shadowColor: colors.textPrimary }]}>
                    <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>GENERAL</Text>
                    {GENERAL_SETTINGS.map((row, index) => (
                        <React.Fragment key={row.key}>
                            <TouchableOpacity
                                style={styles.settingsRow}
                                onPress={() => handleSettingsPress(row.key)}
                                activeOpacity={0.6}
                                accessibilityRole="button"
                                accessibilityLabel={row.label}
                            >
                                <View style={[styles.settingsIconCircle, { backgroundColor: colors.accentLight }]}>
                                    <Ionicons name={row.icon} size={18} color={colors.accent} />
                                </View>
                                <View style={styles.settingsTextCol}>
                                    <Text style={[styles.settingsLabel, { color: colors.textPrimary }]}>{row.label}</Text>
                                    {row.subtitle && (
                                        <Text style={[styles.settingsSubtitle, { color: colors.textTertiary }]}>{row.subtitle}</Text>
                                    )}
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                            </TouchableOpacity>
                            {index < GENERAL_SETTINGS.length - 1 && (
                                <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
                            )}
                        </React.Fragment>
                    ))}
                </View>

                {/* Appearance */}
                <View style={[styles.card, { backgroundColor: colors.cardBackground, shadowColor: colors.textPrimary }]}>
                    <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>APPEARANCE</Text>
                    <View style={styles.themeRow}>
                        {themeOptions.map((option) => {
                            const isActive = mode === option.value;
                            return (
                                <TouchableOpacity
                                    key={option.value}
                                    style={[
                                        styles.themeOption,
                                        {
                                            backgroundColor: isActive ? colors.accentLight : colors.inputBackground,
                                            borderColor: isActive ? colors.accent : colors.border,
                                        },
                                    ]}
                                    onPress={() => setMode(option.value)}
                                    activeOpacity={0.7}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Set theme to ${option.label}`}
                                    accessibilityState={{ selected: isActive }}
                                >
                                    <Ionicons
                                        name={option.icon}
                                        size={20}
                                        color={isActive ? colors.accent : colors.textSecondary}
                                    />
                                    <Text
                                        style={[
                                            styles.themeLabel,
                                            {
                                                color: isActive ? colors.accent : colors.textSecondary,
                                                fontWeight: isActive ? '600' : '400',
                                            },
                                        ]}
                                    >
                                        {option.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* Support Settings */}
                <View style={[styles.card, { backgroundColor: colors.cardBackground, shadowColor: colors.textPrimary }]}>
                    <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>SUPPORT</Text>
                    {SUPPORT_SETTINGS.map((row, index) => (
                        <React.Fragment key={row.key}>
                            <TouchableOpacity
                                style={styles.settingsRow}
                                onPress={() => handleSettingsPress(row.key)}
                                activeOpacity={0.6}
                                accessibilityRole="button"
                                accessibilityLabel={row.label}
                            >
                                <View style={[styles.settingsIconCircle, { backgroundColor: colors.accentLight }]}>
                                    <Ionicons name={row.icon} size={18} color={colors.accent} />
                                </View>
                                <View style={styles.settingsTextCol}>
                                    <Text style={[styles.settingsLabel, { color: colors.textPrimary }]}>{row.label}</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                            </TouchableOpacity>
                            {index < SUPPORT_SETTINGS.length - 1 && (
                                <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
                            )}
                        </React.Fragment>
                    ))}
                </View>

                {/* App Info */}
                <View style={[styles.card, styles.appInfoCard, { backgroundColor: colors.cardBackground, shadowColor: colors.textPrimary }]}>
                    <LyfeLogo size="sm" />
                    <Text style={[styles.versionText, { color: colors.textTertiary }]}>v1.0.0</Text>
                </View>

                {/* Sign Out */}
                <TouchableOpacity
                    style={[styles.signOutButton, { borderColor: colors.danger }]}
                    onPress={handleSignOut}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Sign out of your account"
                >
                    <Ionicons name="log-out-outline" size={20} color={colors.danger} />
                    <Text style={[styles.signOutText, { color: colors.danger }]}>Sign Out</Text>
                </TouchableOpacity>
            </ScrollView>

            {/* Edit Profile Modal */}
            <Modal
                visible={showEditModal}
                transparent
                animationType="none"
                onRequestClose={() => setShowEditModal(false)}
                accessibilityViewIsModal
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={{ flex: 1 }}
                >
                    <TouchableOpacity
                        style={styles.sheetOverlay}
                        activeOpacity={1}
                        onPress={() => setShowEditModal(false)}
                    >
                        <Animated.View style={[styles.sheet, { backgroundColor: colors.cardBackground, transform: [{ translateY: editSheetY }] }]}>
                            <View style={[styles.sheetHandle, { backgroundColor: colors.divider }]} />
                            <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>Edit Profile</Text>

                            <Text style={[styles.editLabel, { color: colors.textTertiary }]}>FULL NAME</Text>
                            <View style={[styles.editInputWrap, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                                <TextInput
                                    style={[styles.editInput, { color: colors.textPrimary }]}
                                    value={editName}
                                    onChangeText={setEditName}
                                    placeholder="Your full name"
                                    placeholderTextColor={colors.textTertiary}
                                    returnKeyType="next"
                                    autoCapitalize="words"
                                />
                            </View>

                            <Text style={[styles.editLabel, { color: colors.textTertiary, marginTop: 16 }]}>EMAIL (OPTIONAL)</Text>
                            <View style={[styles.editInputWrap, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                                <TextInput
                                    style={[styles.editInput, { color: colors.textPrimary }]}
                                    value={editEmail}
                                    onChangeText={setEditEmail}
                                    placeholder="your@email.com"
                                    placeholderTextColor={colors.textTertiary}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    returnKeyType="done"
                                    onSubmitEditing={handleSaveProfile}
                                />
                            </View>

                            {editError && (
                                <Text style={[styles.editErrorText, { color: colors.danger }]}>{editError}</Text>
                            )}

                            <TouchableOpacity
                                style={[styles.editSaveBtn, { backgroundColor: colors.accent, opacity: editSaving ? 0.7 : 1 }]}
                                onPress={handleSaveProfile}
                                disabled={editSaving}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.editSaveBtnText}>{editSaving ? 'Saving…' : 'Save Changes'}</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    </TouchableOpacity>
                </KeyboardAvoidingView>
            </Modal>

            {/* Avatar Picker Sheet */}
            <Modal
                visible={showAvatarSheet}
                transparent
                animationType="none"
                onRequestClose={() => setShowAvatarSheet(false)}
                accessibilityViewIsModal
            >
                <TouchableOpacity
                    style={styles.sheetOverlay}
                    activeOpacity={1}
                    onPress={() => setShowAvatarSheet(false)}
                >
                    <Animated.View style={[styles.sheet, { backgroundColor: colors.cardBackground, transform: [{ translateY: avatarSheetY }] }]}>
                        <View style={[styles.sheetHandle, { backgroundColor: colors.divider }]} />
                        <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>Profile Photo</Text>

                        <TouchableOpacity
                            style={styles.sheetRow}
                            onPress={() => handleAvatarAction('camera')}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.sheetIconCircle, { backgroundColor: colors.accentLight }]}>
                                <Ionicons name="camera-outline" size={20} color={colors.accent} />
                            </View>
                            <Text style={[styles.sheetRowText, { color: colors.textPrimary }]}>Take Photo</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.sheetRow}
                            onPress={() => handleAvatarAction('library')}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.sheetIconCircle, { backgroundColor: colors.accentLight }]}>
                                <Ionicons name="image-outline" size={20} color={colors.accent} />
                            </View>
                            <Text style={[styles.sheetRowText, { color: colors.textPrimary }]}>Choose from Library</Text>
                        </TouchableOpacity>

                        {user?.avatar_url && (
                            <TouchableOpacity
                                style={styles.sheetRow}
                                onPress={() => handleAvatarAction('remove')}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.sheetIconCircle, { backgroundColor: colors.dangerLight }]}>
                                    <Ionicons name="trash-outline" size={20} color={colors.danger} />
                                </View>
                                <Text style={[styles.sheetRowText, { color: colors.danger }]}>Remove Photo</Text>
                            </TouchableOpacity>
                        )}
                    </Animated.View>
                </TouchableOpacity>
            </Modal>

            {/* Sign Out Confirmation Modal */}
            <Modal
                visible={showSignOutModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowSignOutModal(false)}
                accessibilityViewIsModal
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
                        <View style={[styles.modalIconCircle, { backgroundColor: colors.dangerLight }]}>
                            <Ionicons name="log-out-outline" size={28} color={colors.danger} />
                        </View>
                        <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Sign Out</Text>
                        <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
                            Are you sure you want to sign out of your account?
                        </Text>
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: colors.surfaceSecondary }]}
                                onPress={() => setShowSignOutModal(false)}
                                accessibilityRole="button"
                                accessibilityLabel="Cancel sign out"
                            >
                                <Text style={[styles.modalBtnText, { color: colors.textPrimary }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: colors.danger }]}
                                onPress={confirmSignOut}
                                accessibilityRole="button"
                                accessibilityLabel="Confirm sign out"
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

    // ── Hero User Card ──
    userCard: {
        padding: 20,
    },
    userCardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    avatarOuter: {
        width: 76,
        height: 76,
        borderRadius: 38,
        borderWidth: 2.5,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    avatarCircle: {
        width: 66,
        height: 66,
        borderRadius: 33,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarEditBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    userInfo: {
        flex: 1,
        gap: 8,
    },
    userName: {
        fontSize: 22,
        fontWeight: '800',
        letterSpacing: -0.3,
    },
    roleBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    roleText: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    contactDivider: {
        height: StyleSheet.hairlineWidth,
        marginTop: 16,
        marginBottom: 12,
    },
    contactSection: {
        gap: 8,
    },
    contactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    contactText: {
        fontSize: 14,
    },

    // ── Section Labels ──
    sectionLabel: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.8,
        marginBottom: 12,
    },

    // ── View Mode Segment ──
    segmentContainer: {
        flexDirection: 'row',
        borderRadius: 10,
        padding: 3,
        gap: 2,
    },
    segmentOption: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 8,
    },
    segmentLabel: {
        fontSize: 13,
    },
    viewModeHint: {
        fontSize: 12,
        marginTop: 10,
        textAlign: 'center',
    },

    // ── Settings Rows ──
    settingsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        gap: 12,
    },
    settingsIconCircle: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    settingsTextCol: {
        flex: 1,
    },
    settingsLabel: {
        fontSize: 15,
        fontWeight: '500',
    },
    settingsSubtitle: {
        fontSize: 12,
        marginTop: 1,
    },
    rowDivider: {
        height: StyleSheet.hairlineWidth,
        marginLeft: 48,
    },

    // ── Theme Selector ──
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
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1.5,
    },
    themeLabel: {
        fontSize: 13,
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

    // ── Edit Profile ──
    editLabel: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.6,
        marginBottom: 6,
        paddingHorizontal: 4,
    },
    editInputWrap: {
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    editInput: {
        fontSize: 16,
        padding: 0,
    },
    editErrorText: {
        fontSize: 13,
        marginTop: 8,
        paddingHorizontal: 4,
    },
    editSaveBtn: {
        marginTop: 24,
        paddingVertical: 15,
        borderRadius: 14,
        alignItems: 'center',
    },
    editSaveBtnText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },

    // ── Avatar Sheet ──
    sheetOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    sheet: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 40,
        gap: 4,
    },
    sheetHandle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 16,
        opacity: 0.5,
    },
    sheetTitle: {
        fontSize: 17,
        fontWeight: '700',
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    sheetRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 12,
        paddingHorizontal: 4,
    },
    sheetIconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sheetRowText: {
        fontSize: 16,
        fontWeight: '500',
    },

    // ── Modal ──
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
        borderRadius: 20,
        padding: 28,
        alignItems: 'center',
    },
    modalIconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
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
        lineHeight: 20,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    modalBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    modalBtnText: {
        fontSize: 15,
        fontWeight: '600',
    },
});
