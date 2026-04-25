import ErrorBanner from '@/components/ErrorBanner';
import FormField from '@/components/FormField';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
    createCandidate,
    fetchAssignableManagers,
    getInviteUrl,
    uploadCandidateDocument,
    type AssignableManager,
    type CreateCandidateInput,
} from '@/lib/recruitment';
import { useSubmitGuard } from '@/hooks/useSubmitGuard';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
let Clipboard: typeof import('expo-clipboard') | null = null;
try {
    Clipboard = require('expo-clipboard');
} catch {
    /* native module not available in this build */
}

let DocumentPicker: typeof import('expo-document-picker') | null = null;
try {
    DocumentPicker = require('expo-document-picker');
} catch {
    /* native module not yet compiled */
}
export default function AddCandidateScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const router = useRouter();
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [notes, setNotes] = useState('');
    const [resumeFile, setResumeFile] = useState<{ uri: string; name: string } | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [showSuccess, setShowSuccess] = useState(false);
    const [inviteLink, setInviteLink] = useState('');
    const { isSubmitting: isSaving, guard } = useSubmitGuard();
    const [saveError, setSaveError] = useState<string | null>(null);
    const [managers, setManagers] = useState<AssignableManager[]>([]);
    const [selectedManagerId, setSelectedManagerId] = useState<string>('');
    const [showManagerPicker, setShowManagerPicker] = useState(false);

    const userRole = user?.app_metadata?.role as string | undefined;
    const isPA = userRole === 'pa';

    React.useEffect(() => {
        if (user?.id && userRole) {
            fetchAssignableManagers(user.id, userRole).then(({ data }) => {
                setManagers(data);
            });
        }
    }, [user?.id, userRole]);

    const selectedManager = managers.find((m) => m.id === selectedManagerId);

    const candidateFieldStyle = { paddingHorizontal: 16, paddingVertical: 12, marginBottom: 0 } as const;

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};
        if (!name.trim()) newErrors.name = 'Name is required';
        if (!phone.trim()) newErrors.phone = 'Phone number is required';
        if (isPA && !selectedManagerId) newErrors.manager = 'Please select a manager';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = () =>
        guard(async () => {
            if (!validate()) return;
            setSaveError(null);

            if (!user?.id) {
                setSaveError('Not authenticated');
                return;
            }

            const input: CreateCandidateInput = {
                name: name.trim(),
                phone: phone.trim(),
                email: email.trim() || null,
                notes: notes.trim() || null,
                assigned_manager_id: selectedManagerId || undefined,
            };

            const { data: newCandidate, inviteToken, error } = await createCandidate(input, user.id);
            if (error || !newCandidate) {
                setSaveError(error ?? 'Failed to create candidate');
                return;
            }

            if (resumeFile) {
                uploadCandidateDocument(newCandidate.id, 'Resume', resumeFile.uri, resumeFile.name);
            }

            setInviteLink(getInviteUrl(inviteToken));
            setShowSuccess(true);
        });

    const handleDone = () => {
        setShowSuccess(false);
        router.back();
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Nav Header */}
            <View style={styles.navHeader}>
                <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
                    <Ionicons name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.navTitle, { color: colors.textPrimary }]}>Add Candidate</Text>
                <View style={{ width: 32 }} />
            </View>

            <View style={{ flex: 1 }}>
                <KeyboardAwareScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Save Error */}
                    {saveError && <ErrorBanner message={saveError} />}

                    {/* Form Card */}
                    <View style={[styles.formCard, { backgroundColor: colors.cardBackground }]}>
                        <FormField
                            testID="add-candidate-name"
                            label="Full Name"
                            value={name}
                            onChangeText={setName}
                            placeholder="Enter full name"
                            error={errors.name}
                            colors={colors}
                            required
                            containerStyle={candidateFieldStyle}
                        />
                        <View style={[styles.fieldDivider, { backgroundColor: colors.border }]} />
                        <FormField
                            testID="add-candidate-phone"
                            label="Phone Number"
                            value={phone}
                            onChangeText={setPhone}
                            placeholder="+65 9XXX XXXX"
                            keyboardType="phone-pad"
                            error={errors.phone}
                            colors={colors}
                            required
                            containerStyle={candidateFieldStyle}
                        />
                        <View style={[styles.fieldDivider, { backgroundColor: colors.border }]} />
                        <FormField
                            label="Email"
                            value={email}
                            onChangeText={setEmail}
                            placeholder="email@example.com"
                            keyboardType="email-address"
                            colors={colors}
                            containerStyle={candidateFieldStyle}
                        />
                        <View style={[styles.fieldDivider, { backgroundColor: colors.border }]} />
                        <View style={styles.fieldContainer}>
                            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Notes</Text>
                            <TextInput
                                style={[styles.textArea, { color: colors.textPrimary }]}
                                value={notes}
                                onChangeText={setNotes}
                                placeholder="How did you meet this candidate?"
                                placeholderTextColor={colors.textTertiary}
                                multiline
                                numberOfLines={3}
                            />
                        </View>
                        <View style={[styles.fieldDivider, { backgroundColor: colors.border }]} />
                        <View style={styles.fieldContainer}>
                            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                                Resume <Text style={{ color: colors.textTertiary, fontWeight: '400' }}>(optional)</Text>
                            </Text>
                            {resumeFile ? (
                                <View style={[styles.resumeAttached, { backgroundColor: colors.background }]}>
                                    <Ionicons name="document-text" size={20} color={colors.accent} />
                                    <Text
                                        style={[styles.resumeName, { color: colors.textPrimary, flex: 1 }]}
                                        numberOfLines={1}
                                    >
                                        {resumeFile.name}
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() => setResumeFile(null)}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <TouchableOpacity
                                    style={[
                                        styles.resumePickerBtn,
                                        { borderColor: colors.border, opacity: DocumentPicker ? 1 : 0.4 },
                                    ]}
                                    onPress={async () => {
                                        if (!DocumentPicker) return;
                                        const r = await DocumentPicker.getDocumentAsync({
                                            type: 'application/pdf',
                                            copyToCacheDirectory: true,
                                        });
                                        if (!r.canceled && r.assets[0])
                                            setResumeFile({ uri: r.assets[0].uri, name: r.assets[0].name });
                                    }}
                                    activeOpacity={0.7}
                                    disabled={!DocumentPicker}
                                >
                                    <Ionicons name="cloud-upload-outline" size={18} color={colors.accent} />
                                    <Text style={[styles.resumePickerText, { color: colors.accent }]}>Attach PDF</Text>
                                    <Text style={[styles.resumePickerHint, { color: colors.textTertiary }]}>
                                        Up to 10 MB
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* Manager Assignment Picker — shown when managers are available */}
                    {managers.length > 0 && (
                        <View style={[styles.formCard, { backgroundColor: colors.cardBackground, marginTop: 16 }]}>
                            <View style={styles.fieldContainer}>
                                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                                    Assign to Manager{isPA ? ' *' : ''}
                                </Text>
                                <TouchableOpacity
                                    style={[
                                        styles.managerPickerBtn,
                                        { borderColor: errors.manager ? colors.danger : colors.border },
                                    ]}
                                    onPress={() => setShowManagerPicker(true)}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="person-outline" size={18} color={colors.accent} />
                                    <Text
                                        style={[
                                            styles.managerPickerText,
                                            { color: selectedManager ? colors.textPrimary : colors.textTertiary },
                                        ]}
                                        numberOfLines={1}
                                    >
                                        {selectedManager
                                            ? `${selectedManager.full_name} (${selectedManager.role})`
                                            : isPA
                                              ? 'Select a manager...'
                                              : 'Myself (default)'}
                                    </Text>
                                    <Ionicons name="chevron-down" size={16} color={colors.textTertiary} />
                                </TouchableOpacity>
                                {errors.manager && (
                                    <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4 }}>
                                        {errors.manager}
                                    </Text>
                                )}
                            </View>
                        </View>
                    )}

                    <Text style={[styles.infoText, { color: colors.textTertiary }]}>
                        An invite link will be generated for the candidate to complete their registration.
                    </Text>
                </KeyboardAwareScrollView>

                {/* Submit Button */}
                <View style={styles.submitContainer}>
                    <TouchableOpacity
                        testID="add-candidate-submit"
                        style={[styles.submitButton, { backgroundColor: colors.accent, opacity: isSaving ? 0.5 : 1 }]}
                        onPress={handleSubmit}
                        activeOpacity={0.8}
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <ActivityIndicator size="small" color={colors.textInverse} />
                        ) : (
                            <>
                                <Ionicons name="person-add-outline" size={18} color={colors.textInverse} />
                                <Text style={[styles.submitText, { color: colors.textInverse }]}>Create Candidate</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {/* Manager Picker Modal */}
            <Modal visible={showManagerPicker} transparent animationType="fade">
                <Pressable style={styles.modalOverlay} onPress={() => setShowManagerPicker(false)}>
                    <View style={[styles.modalContent, { backgroundColor: colors.cardBackground, maxHeight: '60%' }]}>
                        <Text style={[styles.modalTitle, { color: colors.textPrimary, marginBottom: 12 }]}>
                            Select Manager
                        </Text>
                        <ScrollView>
                            {!isPA && (
                                <TouchableOpacity
                                    style={[
                                        styles.managerOption,
                                        !selectedManagerId && { backgroundColor: colors.accentLight },
                                    ]}
                                    onPress={() => {
                                        setSelectedManagerId('');
                                        setShowManagerPicker(false);
                                    }}
                                >
                                    <Text style={[styles.managerOptionName, { color: colors.textPrimary }]}>
                                        Myself (default)
                                    </Text>
                                </TouchableOpacity>
                            )}
                            {managers.map((m) => (
                                <TouchableOpacity
                                    key={m.id}
                                    style={[
                                        styles.managerOption,
                                        selectedManagerId === m.id && { backgroundColor: colors.accentLight },
                                    ]}
                                    onPress={() => {
                                        setSelectedManagerId(m.id);
                                        setShowManagerPicker(false);
                                    }}
                                >
                                    <Text style={[styles.managerOptionName, { color: colors.textPrimary }]}>
                                        {m.full_name}
                                    </Text>
                                    <Text style={[styles.managerOptionRole, { color: colors.textTertiary }]}>
                                        {m.role}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </Pressable>
            </Modal>

            {/* Success Modal */}
            <Modal visible={showSuccess} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
                        <View style={[styles.successIcon, { backgroundColor: colors.successLight }]}>
                            <Ionicons name="checkmark-circle" size={40} color={colors.success} />
                        </View>
                        <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Candidate Created</Text>
                        <Text style={[styles.modalSubtitle, { color: colors.textTertiary }]}>
                            Share this invite link with {name}:
                        </Text>
                        <View style={[styles.linkContainer, { backgroundColor: colors.background }]}>
                            <Text style={[styles.linkText, { color: colors.accent }]} numberOfLines={1}>
                                {inviteLink}
                            </Text>
                            <TouchableOpacity
                                onPress={async () => {
                                    if (Clipboard) {
                                        await Clipboard.setStringAsync(inviteLink);
                                        Alert.alert('Copied', 'Link copied to clipboard');
                                    } else {
                                        Share.share({ message: inviteLink });
                                    }
                                }}
                            >
                                <Ionicons name="copy-outline" size={18} color={colors.textTertiary} />
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                            style={[styles.doneButton, { backgroundColor: colors.accent }]}
                            onPress={handleDone}
                        >
                            <Text style={[styles.doneText, { color: colors.textInverse }]}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    navHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
        paddingVertical: 8,
    },
    closeBtn: { padding: 8 },
    navTitle: { fontSize: 17, fontWeight: '600' },
    scrollContent: { paddingBottom: 20 },
    errorBannerSpacing: {
        marginHorizontal: 16,
    },

    // Form Card — iOS grouped style
    formCard: {
        marginHorizontal: 16,
        borderRadius: 12,
        padding: 0,
        overflow: 'hidden',
    },
    fieldContainer: {
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    fieldLabel: {
        fontSize: 13,
        fontWeight: '500',
        marginBottom: 6,
    },
    textArea: {
        fontSize: 16,
        minHeight: 60,
        textAlignVertical: 'top',
    },
    fieldDivider: {
        height: StyleSheet.hairlineWidth,
        marginLeft: 16,
    },
    infoText: {
        fontSize: 13,
        paddingHorizontal: 32,
        paddingTop: 12,
        textAlign: 'center',
    },
    resumePickerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderWidth: StyleSheet.hairlineWidth,
        borderStyle: 'dashed',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginTop: 4,
    },
    resumePickerText: { fontSize: 15, fontWeight: '500', flex: 1 },
    resumePickerHint: { fontSize: 12 },
    resumeAttached: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        marginTop: 4,
    },
    resumeName: { fontSize: 14, fontWeight: '500' },
    resumeSize: { fontSize: 12, marginTop: 1 },

    // Submit
    submitContainer: {
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    submitButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 50,
        borderRadius: 12,
        gap: 8,
    },
    submitText: {
        fontSize: 16,
        fontWeight: '600',
    },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    modalContent: {
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
    },
    successIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
    modalSubtitle: { fontSize: 14, marginBottom: 16, textAlign: 'center' },
    linkContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        width: '100%',
        gap: 8,
        marginBottom: 20,
    },
    linkText: { flex: 1, fontSize: 13 },
    doneButton: {
        width: '100%',
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    doneText: { fontSize: 16, fontWeight: '600' },

    // Manager Picker
    managerPickerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginTop: 4,
    },
    managerPickerText: { fontSize: 15, flex: 1 },
    managerOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 8,
    },
    managerOptionName: { fontSize: 16, fontWeight: '500' },
    managerOptionRole: { fontSize: 13, textTransform: 'capitalize' },
});
