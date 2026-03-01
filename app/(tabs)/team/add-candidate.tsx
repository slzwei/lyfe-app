import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
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

interface FormField {
    label: string;
    key: string;
    placeholder: string;
    required?: boolean;
    keyboardType?: 'default' | 'phone-pad' | 'email-address';
    multiline?: boolean;
}

const FIELDS: FormField[] = [
    { label: 'Full Name', key: 'name', placeholder: 'e.g. Jason Teo', required: true },
    { label: 'Phone Number', key: 'phone', placeholder: '+65 9123 4567', required: true, keyboardType: 'phone-pad' },
    { label: 'Email', key: 'email', placeholder: 'jason@email.com', keyboardType: 'email-address' },
    { label: 'Notes', key: 'notes', placeholder: 'How did you meet this candidate?', multiline: true },
];

export default function AddCandidateScreen() {
    const { colors } = useTheme();
    const router = useRouter();
    const [form, setForm] = useState<Record<string, string>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [successModalVisible, setSuccessModalVisible] = useState(false);
    const [generatedLink, setGeneratedLink] = useState('');

    const updateField = (key: string, value: string) => {
        setForm((prev) => ({ ...prev, [key]: value }));
        if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }));
    };

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};
        FIELDS.filter((f) => f.required).forEach((field) => {
            if (!form[field.key]?.trim()) {
                newErrors[field.key] = `${field.label} is required`;
            }
        });
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = () => {
        if (!validate()) return;

        // Generate mock invite link
        const token = 'inv_' + Math.random().toString(36).substring(2, 10);
        const link = `https://lyfe.app/invite/${token}`;
        setGeneratedLink(link);
        setSuccessModalVisible(true);
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Add Candidate</Text>
                <View style={{ width: 32 }} />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    {FIELDS.map((field) => (
                        <View key={field.key} style={styles.fieldContainer}>
                            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>
                                {field.label}
                                {field.required && <Text style={{ color: colors.accent }}> *</Text>}
                            </Text>
                            <TextInput
                                style={[
                                    styles.fieldInput,
                                    {
                                        backgroundColor: colors.surfacePrimary,
                                        color: colors.textPrimary,
                                        borderColor: errors[field.key] ? '#CF222E' : colors.borderLight,
                                    },
                                    field.multiline && styles.fieldInputMultiline,
                                ]}
                                placeholder={field.placeholder}
                                placeholderTextColor={colors.textTertiary}
                                value={form[field.key] || ''}
                                onChangeText={(v) => updateField(field.key, v)}
                                keyboardType={field.keyboardType}
                                multiline={field.multiline}
                                textAlignVertical={field.multiline ? 'top' : 'center'}
                                blurOnSubmit={!field.multiline}
                                returnKeyType={field.multiline ? 'default' : 'next'}
                            />
                            {errors[field.key] ? (
                                <Text style={styles.errorText}>{errors[field.key]}</Text>
                            ) : null}
                        </View>
                    ))}

                    {/* Info */}
                    <View style={[styles.infoBox, { backgroundColor: colors.infoLight }]}>
                        <Ionicons name="information-circle" size={18} color={colors.info} />
                        <Text style={[styles.infoText, { color: colors.info }]}>
                            An invite link will be generated. Share it with the candidate so they can complete
                            their registration.
                        </Text>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Submit Button */}
            <View style={[styles.footer, { borderTopColor: colors.borderLight }]}>
                <TouchableOpacity
                    style={[styles.submitBtn, { backgroundColor: colors.accent }]}
                    onPress={handleSubmit}
                    activeOpacity={0.7}
                >
                    <Ionicons name="person-add" size={18} color="#FFFFFF" />
                    <Text style={styles.submitBtnText}>Create Candidate</Text>
                </TouchableOpacity>
            </View>

            {/* Success Modal */}
            <Modal visible={successModalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
                        <View style={[styles.successIcon, { backgroundColor: colors.successLight }]}>
                            <Ionicons name="checkmark-circle" size={40} color={colors.success} />
                        </View>
                        <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Candidate Created!</Text>
                        <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                            Share this invite link with {form.name || 'the candidate'}:
                        </Text>

                        <TouchableOpacity
                            style={[styles.linkBox, { backgroundColor: colors.surfacePrimary, borderColor: colors.borderLight }]}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.linkText, { color: colors.accent }]} numberOfLines={1}>
                                {generatedLink}
                            </Text>
                            <Ionicons name="copy-outline" size={16} color={colors.accent} />
                        </TouchableOpacity>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: colors.accent }]}
                                onPress={() => {
                                    setSuccessModalVisible(false);
                                    router.back();
                                }}
                            >
                                <Text style={styles.modalBtnText}>Done</Text>
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 17, fontWeight: '600' },

    scrollContent: { padding: 20, gap: 16 },

    fieldContainer: { gap: 6 },
    fieldLabel: { fontSize: 14, fontWeight: '600' },
    fieldInput: {
        borderRadius: 10,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
    },
    fieldInputMultiline: { minHeight: 80, paddingTop: 12 },
    errorText: { color: '#CF222E', fontSize: 12 },

    infoBox: {
        flexDirection: 'row',
        gap: 10,
        padding: 14,
        borderRadius: 10,
        alignItems: 'flex-start',
    },
    infoText: { fontSize: 13, lineHeight: 18, flex: 1 },

    footer: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderTopWidth: 0.5,
    },
    submitBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderRadius: 12,
        paddingVertical: 14,
    },
    submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
    modalContent: { width: '100%', borderRadius: 16, padding: 24, alignItems: 'center', maxWidth: 400 },
    successIcon: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
    modalSubtitle: { fontSize: 14, textAlign: 'center', marginBottom: 16 },
    linkBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        width: '100%',
        marginBottom: 16,
    },
    linkText: { fontSize: 13, flex: 1 },
    modalActions: { width: '100%' },
    modalBtn: { borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
    modalBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
