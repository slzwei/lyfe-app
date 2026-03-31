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
                    <FormField label="Full Name" error={errors.name}>
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
                    <FormField label="Phone Number" error={errors.phone}>
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
                                value={phone}
                                onChangeText={(t) => {
                                    setPhone(t.replace(/\D/g, '').slice(0, 8));
                                    setErrors((e) => ({ ...e, phone: '' }));
                                }}
                                placeholder="9123 4567"
                                placeholderTextColor={colors.textTertiary}
                                keyboardType="phone-pad"
                                maxLength={8}
                                testID="invite-phone-input"
                            />
                        </View>
                    </FormField>

                    {/* Role Picker */}
                    {invitableRoles.length > 1 && (
                        <FormField label="Role" error={errors.role}>
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
                            numberOfLines={3}
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
                            <Text style={styles.submitText}>Send Invitation</Text>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Role Picker Modal */}
            <Modal visible={showRolePicker} transparent animationType="fade">
                <Pressable style={styles.overlay} onPress={() => setShowRolePicker(false)}>
                    <View style={[styles.modal, { backgroundColor: colors.background }]}>
                        <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Select Role</Text>
                        {invitableRoles.map((role) => (
                            <TouchableOpacity
                                key={role}
                                style={[
                                    styles.modalOption,
                                    selectedRole === role && { backgroundColor: colors.accentLight },
                                ]}
                                onPress={() => {
                                    setSelectedRole(role);
                                    setErrors((e) => ({ ...e, role: '' }));
                                    setShowRolePicker(false);
                                }}
                            >
                                <Text style={[styles.modalOptionText, { color: colors.textPrimary }]}>
                                    {ROLE_LABELS[role]}
                                </Text>
                                {selectedRole === role && <Ionicons name="checkmark" size={20} color={colors.accent} />}
                            </TouchableOpacity>
                        ))}
                    </View>
                </Pressable>
            </Modal>

            {/* Manager Picker Modal */}
            <Modal visible={showManagerPicker} transparent animationType="fade">
                <Pressable style={styles.overlay} onPress={() => setShowManagerPicker(false)}>
                    <View style={[styles.modal, { backgroundColor: colors.background }]}>
                        <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Assign to Manager</Text>
                        <TouchableOpacity
                            style={[styles.modalOption, !assignedManagerId && { backgroundColor: colors.accentLight }]}
                            onPress={() => {
                                setAssignedManagerId(null);
                                setShowManagerPicker(false);
                            }}
                        >
                            <Text style={[styles.modalOptionText, { color: colors.textSecondary }]}>
                                None (assign to me)
                            </Text>
                        </TouchableOpacity>
                        {managers.map((m) => (
                            <TouchableOpacity
                                key={m.id}
                                style={[
                                    styles.modalOption,
                                    assignedManagerId === m.id && { backgroundColor: colors.accentLight },
                                ]}
                                onPress={() => {
                                    setAssignedManagerId(m.id);
                                    setShowManagerPicker(false);
                                }}
                            >
                                <Text style={[styles.modalOptionText, { color: colors.textPrimary }]}>
                                    {m.full_name}
                                </Text>
                                {assignedManagerId === m.id && (
                                    <Ionicons name="checkmark" size={20} color={colors.accent} />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                </Pressable>
            </Modal>

            {/* Success Modal */}
            <Modal visible={showSuccess} transparent animationType="fade">
                <View style={styles.overlay}>
                    <View style={[styles.successModal, { backgroundColor: colors.background }]}>
                        <View style={[styles.successIcon, { backgroundColor: colors.accentLight }]}>
                            <Ionicons name="checkmark-circle" size={48} color={colors.accent} />
                        </View>
                        <Text style={[styles.successTitle, { color: colors.textPrimary }]}>Invitation Sent</Text>
                        <Text style={[styles.successSubtitle, { color: colors.textSecondary }]}>
                            Tell {successName} to download Lyfe and sign in with their phone number.
                        </Text>
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
    form: { padding: 16, gap: 16, paddingBottom: 40 },
    input: {
        height: 48,
        borderRadius: 10,
        borderWidth: 1,
        paddingHorizontal: 14,
        fontSize: 16,
    },
    multiline: { height: 80, paddingTop: 12 },
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
    modal: {
        width: '85%',
        borderRadius: 16,
        padding: 20,
    },
    modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
    modalOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 10,
    },
    modalOptionText: { fontSize: 16 },
    successModal: {
        width: '85%',
        borderRadius: 20,
        padding: 28,
        alignItems: 'center',
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
