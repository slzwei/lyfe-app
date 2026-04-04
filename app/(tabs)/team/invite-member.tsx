import ErrorBanner from '@/components/ErrorBanner';
import FormField from '@/components/FormField';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { createMemberInvitation, getInvitableRoles } from '@/lib/invitations';
import { fetchAssignableManagers, type AssignableManager } from '@/lib/recruitment';
import { useSubmitGuard } from '@/hooks/useSubmitGuard';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { UserRole } from '@/types/shared/roles';

const ROLE_LABELS: Record<UserRole, string> = {
    admin: 'Admin',
    director: 'Director',
    manager: 'Manager',
    agent: 'Agent',
    pa: 'PA',
    candidate: 'Candidate',
};

export default function InviteMemberScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const router = useRouter();
    const { isSubmitting, guard } = useSubmitGuard();

    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
    const [assignedManagerId, setAssignedManagerId] = useState<string | null>(null);
    const [notes, setNotes] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saveError, setSaveError] = useState<string | null>(null);
    const [showSuccess, setShowSuccess] = useState(false);
    const [successName, setSuccessName] = useState('');

    const [showRolePicker, setShowRolePicker] = useState(false);
    const [showManagerPicker, setShowManagerPicker] = useState(false);
    const [managerSearch, setManagerSearch] = useState('');
    const [managers, setManagers] = useState<AssignableManager[]>([]);
    const [loadingManagers, setLoadingManagers] = useState(false);

    const callerRole = (user?.role ?? 'agent') as UserRole;
    const invitableRoles = useMemo(() => getInvitableRoles(callerRole), [callerRole]);

    // Auto-select if PA (only candidate available)
    useEffect(() => {
        if (invitableRoles.length === 1) {
            setSelectedRole(invitableRoles[0]);
        }
    }, [invitableRoles]);

    // Load managers when role needs one
    const needsManager = selectedRole === 'candidate' || selectedRole === 'agent';
    useEffect(() => {
        if (!needsManager || !user?.id) return;
        setLoadingManagers(true);
        fetchAssignableManagers(user.id, callerRole).then(({ data }) => {
            setManagers(data);
            setLoadingManagers(false);
        });
    }, [needsManager, user?.id, callerRole]);

    const selectedManager = managers.find((m) => m.id === assignedManagerId);
    const filteredManagers = useMemo(() => {
        if (!managerSearch.trim()) return managers;
        const q = managerSearch.toLowerCase();
        return managers.filter((m) => m.full_name?.toLowerCase().includes(q));
    }, [managers, managerSearch]);

    const validate = (): boolean => {
        const e: Record<string, string> = {};
        if (!name.trim()) e.name = 'Name is required';
        if (!phone.trim()) e.phone = 'Phone number is required';
        else if (!/^[89]\d{7}$/.test(phone.replace(/[\s\-]/g, ''))) {
            e.phone = 'Enter a valid 8-digit SG number (starting with 8 or 9)';
        }
        if (!selectedRole) e.role = 'Please select a role';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = () =>
        guard(async () => {
            if (!validate()) return;
            Keyboard.dismiss();
            setSaveError(null);

            const { error } = await createMemberInvitation({
                name: name.trim(),
                phone: phone.replace(/[\s\-]/g, ''),
                intended_role: selectedRole!,
                assigned_manager_id: assignedManagerId ?? undefined,
                notes: notes.trim() || undefined,
            });

            if (error) {
                setSaveError(error);
                return;
            }

            setSuccessName(name.trim());
            setShowSuccess(true);
        });

    const handleDone = () => {
        setShowSuccess(false);
        router.back();
    };

    const handleAddAnother = () => {
        setShowSuccess(false);
        setName('');
        setPhone('');
        setNotes('');
        setAssignedManagerId(null);
        setErrors({});
        setSaveError(null);
        // Keep selectedRole if PA (only one option)
        if (invitableRoles.length > 1) setSelectedRole(null);
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
                        <Ionicons name="close" size={24} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Invite Member</Text>
                    <View style={{ width: 24 }} />
                </View>

                <ScrollView style={styles.flex} contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
                    {saveError && <ErrorBanner message={saveError} />}

                    {/* Name */}
                    <FormField label="Full Name" error={errors.name} required>
                        <TextInput
                            style={[
                                styles.input,
                                {
                                    color: colors.textPrimary,
                                    backgroundColor: colors.surfacePrimary,
                                    borderColor: errors.name ? colors.danger : colors.border,
                                },
                            ]}
                            value={name}
                            onChangeText={(t) => {
                                setName(t);
                                setErrors((e) => ({ ...e, name: '' }));
                            }}
                            placeholder="e.g. John Tan"
                            placeholderTextColor={colors.textTertiary}
                            autoCapitalize="words"
                            autoFocus
                            testID="invite-name-input"
                        />
                    </FormField>

                    {/* Phone */}
                    <FormField label="Phone Number" error={errors.phone} required>
                        <View
                            style={[
                                styles.phoneRow,
                                {
                                    backgroundColor: colors.surfacePrimary,
                                    borderColor: errors.phone ? colors.danger : colors.border,
                                },
                            ]}
                        >
                            <Text style={[styles.prefix, { color: colors.textSecondary }]}>+65</Text>
                            <View style={[styles.phoneDivider, { backgroundColor: colors.border }]} />
                            <TextInput
                                style={[styles.phoneInput, { color: colors.textPrimary }]}
                                value={phone.length > 4 ? `${phone.slice(0, 4)} ${phone.slice(4)}` : phone}
                                onChangeText={(t) => {
                                    setPhone(t.replace(/\D/g, '').slice(0, 8));
                                    setErrors((e) => ({ ...e, phone: '' }));
                                }}
                                placeholder="9123 4567"
                                placeholderTextColor={colors.textTertiary}
                                keyboardType="phone-pad"
                                maxLength={9}
                                testID="invite-phone-input"
                            />
                        </View>
                    </FormField>

                    {/* Role Picker */}
                    {invitableRoles.length > 1 && (
                        <FormField label="Role" error={errors.role} required>
                            <TouchableOpacity
                                style={[
                                    styles.pickerButton,
                                    {
                                        backgroundColor: colors.surfacePrimary,
                                        borderColor: errors.role ? colors.danger : colors.border,
                                    },
                                ]}
                                onPress={() => setShowRolePicker(true)}
                                testID="invite-role-picker"
                            >
                                <Text
                                    style={[
                                        styles.pickerText,
                                        { color: selectedRole ? colors.textPrimary : colors.textTertiary },
                                    ]}
                                >
                                    {selectedRole ? ROLE_LABELS[selectedRole] : 'Select a role'}
                                </Text>
                                <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </FormField>
                    )}

                    {/* Single-option role display for PA */}
                    {invitableRoles.length === 1 && (
                        <FormField label="Role">
                            <View
                                style={[
                                    styles.pickerButton,
                                    { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                                ]}
                            >
                                <Text style={[styles.pickerText, { color: colors.textPrimary }]}>
                                    {ROLE_LABELS[invitableRoles[0]]}
                                </Text>
                            </View>
                        </FormField>
                    )}

                    {/* Manager Picker (conditional) */}
                    {needsManager && (
                        <FormField label="Assign to Manager">
                            <TouchableOpacity
                                style={[
                                    styles.pickerButton,
                                    { backgroundColor: colors.surfacePrimary, borderColor: colors.border },
                                ]}
                                onPress={() => setShowManagerPicker(true)}
                                disabled={loadingManagers}
                                testID="invite-manager-picker"
                            >
                                {loadingManagers ? (
                                    <ActivityIndicator size="small" color={colors.textSecondary} />
                                ) : (
                                    <Text
                                        style={[
                                            styles.pickerText,
                                            { color: selectedManager ? colors.textPrimary : colors.textTertiary },
                                        ]}
                                    >
                                        {selectedManager?.full_name ?? 'Select a manager (optional)'}
                                    </Text>
                                )}
                                <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </FormField>
                    )}

                    {/* Notes */}
                    <FormField label="Notes (optional)">
                        <TextInput
                            style={[
                                styles.input,
                                styles.multiline,
                                {
                                    color: colors.textPrimary,
                                    backgroundColor: colors.surfacePrimary,
                                    borderColor: colors.border,
                                },
                            ]}
                            value={notes}
                            onChangeText={setNotes}
                            placeholder="Any notes about this person"
                            placeholderTextColor={colors.textTertiary}
                            multiline
                            numberOfLines={2}
                            textAlignVertical="top"
                            testID="invite-notes-input"
                        />
                    </FormField>

                    {/* Submit */}
                    <TouchableOpacity
                        style={[styles.submitButton, { backgroundColor: colors.accent }]}
                        onPress={handleSubmit}
                        disabled={isSubmitting}
                        testID="invite-submit-button"
                    >
                        {isSubmitting ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <Text style={styles.submitText}>Create Invitation</Text>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Role Picker Modal */}
            <Modal visible={showRolePicker} transparent animationType="slide">
                <View style={styles.sheetOverlay}>
                    <Pressable style={styles.sheetBackdrop} onPress={() => setShowRolePicker(false)} />
                    <View style={[styles.sheet, { backgroundColor: colors.background }]}>
                        <View style={styles.sheetHandle}>
                            <View style={[styles.handleBar, { backgroundColor: colors.border }]} />
                        </View>
                        <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
                            <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>Select Role</Text>
                            <TouchableOpacity onPress={() => setShowRolePicker(false)} hitSlop={12}>
                                <Ionicons name="close-circle" size={28} color={colors.textTertiary} />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.sheetBody}>
                            {invitableRoles.map((role, i) => (
                                <TouchableOpacity
                                    key={role}
                                    style={[
                                        styles.sheetOption,
                                        i < invitableRoles.length - 1 && {
                                            borderBottomWidth: StyleSheet.hairlineWidth,
                                            borderBottomColor: colors.border,
                                        },
                                        selectedRole === role && { backgroundColor: colors.accentLight },
                                    ]}
                                    onPress={() => {
                                        setSelectedRole(role);
                                        setErrors((e) => ({ ...e, role: '' }));
                                        setShowRolePicker(false);
                                    }}
                                >
                                    <Text style={[styles.sheetOptionText, { color: colors.textPrimary }]}>
                                        {ROLE_LABELS[role]}
                                    </Text>
                                    {selectedRole === role && (
                                        <Ionicons name="checkmark" size={22} color={colors.accent} />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Manager Picker Modal */}
            <Modal visible={showManagerPicker} transparent animationType="slide" onShow={() => setManagerSearch('')}>
                <View style={styles.sheetOverlay}>
                    <Pressable style={styles.sheetBackdrop} onPress={() => setShowManagerPicker(false)} />
                    <View style={[styles.sheet, styles.sheetTall, { backgroundColor: colors.background }]}>
                        <View style={styles.sheetHandle}>
                            <View style={[styles.handleBar, { backgroundColor: colors.border }]} />
                        </View>
                        <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
                            <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>Assign to Manager</Text>
                            <TouchableOpacity onPress={() => setShowManagerPicker(false)} hitSlop={12}>
                                <Ionicons name="close-circle" size={28} color={colors.textTertiary} />
                            </TouchableOpacity>
                        </View>
                        {managers.length > 5 && (
                            <View style={[styles.searchRow, { borderBottomColor: colors.border }]}>
                                <Ionicons name="search" size={18} color={colors.textTertiary} />
                                <TextInput
                                    style={[styles.searchInput, { color: colors.textPrimary }]}
                                    placeholder="Search managers..."
                                    placeholderTextColor={colors.textTertiary}
                                    value={managerSearch}
                                    onChangeText={setManagerSearch}
                                    autoCorrect={false}
                                />
                                {managerSearch.length > 0 && (
                                    <TouchableOpacity onPress={() => setManagerSearch('')} hitSlop={8}>
                                        <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}
                        {/* Assign to me option */}
                        {!managerSearch && (
                            <TouchableOpacity
                                style={[
                                    styles.selfAssignOption,
                                    { borderBottomColor: colors.border },
                                    !assignedManagerId && { backgroundColor: colors.accentLight },
                                ]}
                                onPress={() => {
                                    setAssignedManagerId(null);
                                    setShowManagerPicker(false);
                                }}
                            >
                                <View style={styles.selfAssignRow}>
                                    <View style={[styles.selfAssignIcon, { backgroundColor: colors.surfaceSecondary }]}>
                                        <Ionicons name="person" size={16} color={colors.accent} />
                                    </View>
                                    <Text style={[styles.sheetOptionText, { color: colors.textPrimary }]}>
                                        Assign to myself
                                    </Text>
                                </View>
                                {!assignedManagerId && <Ionicons name="checkmark" size={22} color={colors.accent} />}
                            </TouchableOpacity>
                        )}
                        <FlatList
                            data={filteredManagers}
                            keyExtractor={(m) => m.id}
                            keyboardShouldPersistTaps="handled"
                            renderItem={({ item: m, index }) => (
                                <TouchableOpacity
                                    style={[
                                        styles.sheetOption,
                                        index < filteredManagers.length - 1 && {
                                            borderBottomWidth: StyleSheet.hairlineWidth,
                                            borderBottomColor: colors.border,
                                        },
                                        assignedManagerId === m.id && { backgroundColor: colors.accentLight },
                                    ]}
                                    onPress={() => {
                                        setAssignedManagerId(m.id);
                                        setShowManagerPicker(false);
                                    }}
                                >
                                    <View style={styles.managerInfo}>
                                        <View style={[styles.avatar, { backgroundColor: colors.surfaceSecondary }]}>
                                            <Text style={[styles.avatarText, { color: colors.textSecondary }]}>
                                                {(m.full_name ?? '?').charAt(0).toUpperCase()}
                                            </Text>
                                        </View>
                                        <Text style={[styles.sheetOptionText, { color: colors.textPrimary }]}>
                                            {m.full_name}
                                        </Text>
                                    </View>
                                    {assignedManagerId === m.id && (
                                        <Ionicons name="checkmark" size={22} color={colors.accent} />
                                    )}
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={
                                <View style={styles.emptyList}>
                                    <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                                        {managerSearch ? 'No managers found' : 'No managers available'}
                                    </Text>
                                </View>
                            }
                        />
                    </View>
                </View>
            </Modal>

            {/* Success Modal */}
            <Modal visible={showSuccess} transparent animationType="fade">
                <View style={styles.successOverlay}>
                    <View style={[styles.successModal, { backgroundColor: colors.background }]}>
                        <View style={[styles.successIcon, { backgroundColor: colors.accentLight }]}>
                            <Ionicons name="checkmark-circle" size={48} color={colors.accent} />
                        </View>
                        <Text style={[styles.successTitle, { color: colors.textPrimary }]}>Invitation Created</Text>
                        <Text style={[styles.successSubtitle, { color: colors.textSecondary }]}>
                            Tell {successName} to download Lyfe and sign in with their phone number.
                        </Text>
                        <View style={styles.successButtons}>
                            <TouchableOpacity
                                style={[styles.submitButton, { backgroundColor: colors.accent }]}
                                onPress={handleDone}
                            >
                                <Text style={styles.submitText}>Done</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.outlineButton, { borderColor: colors.border }]}
                                onPress={handleAddAnother}
                            >
                                <Text style={[styles.outlineButtonText, { color: colors.accent }]}>Invite Another</Text>
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
    flex: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    headerTitle: { fontSize: 17, fontWeight: '600' },
    form: { padding: 16, paddingBottom: 40 },
    input: {
        height: 48,
        borderRadius: 10,
        borderWidth: 1,
        paddingHorizontal: 14,
        fontSize: 16,
    },
    multiline: { height: 64, paddingTop: 12 },
    phoneRow: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 48,
        borderRadius: 10,
        borderWidth: 1,
    },
    prefix: { paddingHorizontal: 14, fontSize: 16, fontWeight: '500' },
    phoneDivider: { width: 1, height: 24 },
    phoneInput: { flex: 1, paddingHorizontal: 14, fontSize: 16 },
    pickerButton: {
        height: 48,
        borderRadius: 10,
        borderWidth: 1,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    pickerText: { fontSize: 16 },
    submitButton: {
        height: 50,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
    },
    submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    outlineButton: {
        height: 50,
        borderRadius: 12,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    outlineButtonText: { fontSize: 16, fontWeight: '600' },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sheetOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    sheetBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    sheet: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '50%',
        paddingBottom: 34,
    },
    sheetTall: {
        maxHeight: '70%',
    },
    sheetHandle: {
        alignItems: 'center',
        paddingTop: 10,
        paddingBottom: 4,
    },
    handleBar: {
        width: 36,
        height: 4,
        borderRadius: 2,
    },
    sheetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    sheetTitle: { fontSize: 18, fontWeight: '600' },
    sheetBody: { paddingHorizontal: 8 },
    sheetOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 10,
        marginHorizontal: 8,
    },
    sheetOptionText: { fontSize: 16, fontWeight: '400' },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        paddingVertical: 4,
    },
    selfAssignOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    selfAssignRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    selfAssignIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    managerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: { fontSize: 14, fontWeight: '600' },
    emptyList: {
        paddingVertical: 32,
        alignItems: 'center',
    },
    emptyText: { fontSize: 15 },
    successOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    successModal: {
        width: '85%',
        borderRadius: 20,
        padding: 28,
        alignItems: 'center',
    },
    successButtons: {
        width: '100%',
        gap: 10,
    },
    successIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    successTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
    successSubtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
});
