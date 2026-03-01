import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function AddCandidateScreen() {
    const { colors } = useTheme();
    const router = useRouter();
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [notes, setNotes] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [showSuccess, setShowSuccess] = useState(false);
    const [inviteLink, setInviteLink] = useState('');

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};
        if (!name.trim()) newErrors.name = 'Name is required';
        if (!phone.trim()) newErrors.phone = 'Phone number is required';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = () => {
        if (!validate()) return;
        const token = `inv_${Math.random().toString(36).substring(2, 12)}`;
        setInviteLink(`https://lyfe.app/invite/${token}`);
        setShowSuccess(true);
    };

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

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    {/* Form Card */}
                    <View style={[styles.formCard, { backgroundColor: colors.cardBackground }]}>
                        <FormField
                            label="Full Name"
                            value={name}
                            onChangeText={setName}
                            placeholder="Enter full name"
                            error={errors.name}
                            colors={colors}
                            required
                        />
                        <View style={[styles.fieldDivider, { backgroundColor: colors.border }]} />
                        <FormField
                            label="Phone Number"
                            value={phone}
                            onChangeText={setPhone}
                            placeholder="+65 9XXX XXXX"
                            keyboardType="phone-pad"
                            error={errors.phone}
                            colors={colors}
                            required
                        />
                        <View style={[styles.fieldDivider, { backgroundColor: colors.border }]} />
                        <FormField
                            label="Email"
                            value={email}
                            onChangeText={setEmail}
                            placeholder="email@example.com"
                            keyboardType="email-address"
                            colors={colors}
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
                    </View>

                    <Text style={[styles.infoText, { color: colors.textTertiary }]}>
                        An invite link will be generated for the candidate to complete their registration.
                    </Text>
                </ScrollView>

                {/* Submit Button */}
                <View style={styles.submitContainer}>
                    <TouchableOpacity
                        style={[styles.submitButton, { backgroundColor: colors.accent }]}
                        onPress={handleSubmit}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="person-add-outline" size={18} color="#FFFFFF" />
                        <Text style={styles.submitText}>Create Candidate</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

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
                            <TouchableOpacity onPress={() => Alert.alert('Copied', 'Link copied to clipboard')}>
                                <Ionicons name="copy-outline" size={18} color={colors.textTertiary} />
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                            style={[styles.doneButton, { backgroundColor: colors.accent }]}
                            onPress={handleDone}
                        >
                            <Text style={styles.doneText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

function FormField({ label, value, onChangeText, placeholder, keyboardType, error, colors, required }: {
    label: string; value: string; onChangeText: (v: string) => void; placeholder: string;
    keyboardType?: any; error?: string; colors: any; required?: boolean;
}) {
    return (
        <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                {label}{required && <Text style={{ color: colors.danger }}> *</Text>}
            </Text>
            <TextInput
                style={[styles.fieldInput, { color: colors.textPrimary }]}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={colors.textTertiary}
                keyboardType={keyboardType}
            />
            {error && <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>}
        </View>
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
    fieldInput: {
        fontSize: 16,
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
    errorText: {
        fontSize: 12,
        marginTop: 4,
    },
    infoText: {
        fontSize: 13,
        paddingHorizontal: 32,
        paddingTop: 12,
        textAlign: 'center',
    },

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
        color: '#FFFFFF',
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
    doneText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
