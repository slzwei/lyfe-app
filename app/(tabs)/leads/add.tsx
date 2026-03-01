import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { createLead, type CreateLeadInput } from '@/lib/leads';
import { PRODUCT_LABELS, SOURCE_LABELS, type LeadSource, type ProductInterest } from '@/types/lead';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
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

const MOCK_OTP = process.env.EXPO_PUBLIC_MOCK_OTP === 'true';
const SOURCES: LeadSource[] = ['referral', 'walk_in', 'online', 'event', 'cold_call', 'other'];
const PRODUCTS: ProductInterest[] = ['life', 'health', 'ilp', 'general'];

export default function AddLeadScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const router = useRouter();

    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [source, setSource] = useState<LeadSource>('referral');
    const [product, setProduct] = useState<ProductInterest>('general');
    const [notes, setNotes] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};
        if (!name.trim()) newErrors.name = 'Name is required';
        if (!phone.trim()) newErrors.phone = 'Phone is required';
        else if (!/^\+?\d[\d\s-]{6,}$/.test(phone.trim())) newErrors.phone = 'Invalid phone number';
        if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            newErrors.email = 'Invalid email address';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
        if (!validate()) return;
        setSaveError(null);

        if (MOCK_OTP) {
            // Mock mode: just show success
            setShowSuccessModal(true);
            return;
        }

        if (!user?.id) {
            setSaveError('Not authenticated');
            return;
        }

        setIsSaving(true);
        const input: CreateLeadInput = {
            full_name: name.trim(),
            phone: phone.trim() || null,
            email: email.trim() || null,
            source,
            product_interest: product,
            notes: notes.trim() || null,
        };

        const { error } = await createLead(input, user.id);
        setIsSaving(false);

        if (error) {
            setSaveError(error);
            return;
        }

        setShowSuccessModal(true);
    };

    const handleSuccessDismiss = () => {
        setShowSuccessModal(false);
        router.back();
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.headerBar, { borderBottomColor: colors.borderLight }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.cancelBtn}>
                    <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>New Lead</Text>
                <TouchableOpacity
                    onPress={handleSave}
                    style={[styles.saveBtn, { backgroundColor: colors.accent, opacity: isSaving ? 0.6 : 1 }]}
                    disabled={isSaving}
                >
                    {isSaving ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <Text style={styles.saveBtnText}>Save</Text>
                    )}
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={100}
            >
                <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    {/* Save Error */}
                    {saveError && (
                        <View style={[styles.errorBanner, { backgroundColor: '#FEE2E2' }]}>
                            <Ionicons name="alert-circle" size={16} color="#DC2626" />
                            <Text style={styles.errorBannerText}>{saveError}</Text>
                        </View>
                    )}

                    {/* Contact Info */}
                    <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Contact Information</Text>

                        <FormField
                            label="Full Name *"
                            value={name}
                            onChangeText={setName}
                            placeholder="e.g. Sarah Tan"
                            error={errors.name}
                            colors={colors}
                            icon="person-outline"
                        />
                        <FormField
                            label="Phone *"
                            value={phone}
                            onChangeText={setPhone}
                            placeholder="+65 9123 4567"
                            error={errors.phone}
                            colors={colors}
                            icon="call-outline"
                            keyboardType="phone-pad"
                        />
                        <FormField
                            label="Email"
                            value={email}
                            onChangeText={setEmail}
                            placeholder="sarah@email.com"
                            error={errors.email}
                            colors={colors}
                            icon="mail-outline"
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </View>

                    {/* Source */}
                    <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Source</Text>
                        <View style={styles.chipGroup}>
                            {SOURCES.map((s) => (
                                <TouchableOpacity
                                    key={s}
                                    style={[
                                        styles.chip,
                                        {
                                            backgroundColor: source === s ? colors.accentLight : colors.surfacePrimary,
                                            borderColor: source === s ? colors.accent : colors.borderLight,
                                            borderWidth: source === s ? 1.5 : 0.5,
                                        },
                                    ]}
                                    onPress={() => setSource(s)}
                                >
                                    <Text
                                        style={[
                                            styles.chipText,
                                            { color: source === s ? colors.accent : colors.textSecondary },
                                        ]}
                                    >
                                        {SOURCE_LABELS[s]}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Product Interest */}
                    <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Product Interest</Text>
                        <View style={styles.chipGroup}>
                            {PRODUCTS.map((p) => (
                                <TouchableOpacity
                                    key={p}
                                    style={[
                                        styles.chip,
                                        {
                                            backgroundColor: product === p ? colors.accentLight : colors.surfacePrimary,
                                            borderColor: product === p ? colors.accent : colors.borderLight,
                                            borderWidth: product === p ? 1.5 : 0.5,
                                        },
                                    ]}
                                    onPress={() => setProduct(p)}
                                >
                                    <Text
                                        style={[
                                            styles.chipText,
                                            { color: product === p ? colors.accent : colors.textSecondary },
                                        ]}
                                    >
                                        {PRODUCT_LABELS[p]}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Notes */}
                    <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Notes</Text>
                        <TextInput
                            style={[styles.notesInput, { color: colors.textPrimary, borderColor: colors.borderLight, backgroundColor: colors.surfacePrimary }]}
                            placeholder="Any initial notes about this lead..."
                            placeholderTextColor={colors.textTertiary}
                            value={notes}
                            onChangeText={setNotes}
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                        />
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Success Modal */}
            <Modal
                visible={showSuccessModal}
                transparent
                animationType="fade"
                onRequestClose={handleSuccessDismiss}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
                        <Ionicons name="checkmark-circle" size={48} color="#22C55E" />
                        <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Lead Created</Text>
                        <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
                            {name} has been added to your leads.
                        </Text>
                        <TouchableOpacity
                            style={[styles.modalOkBtn, { backgroundColor: colors.accent }]}
                            onPress={handleSuccessDismiss}
                        >
                            <Text style={styles.modalOkBtnText}>OK</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

// ── Reusable Form Field ──
function FormField({
    label,
    value,
    onChangeText,
    placeholder,
    error,
    colors,
    icon,
    keyboardType,
    autoCapitalize,
}: {
    label: string;
    value: string;
    onChangeText: (v: string) => void;
    placeholder: string;
    error?: string;
    colors: any;
    icon: string;
    keyboardType?: 'default' | 'phone-pad' | 'email-address';
    autoCapitalize?: 'none' | 'sentences' | 'words';
}) {
    return (
        <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
            <View
                style={[
                    styles.fieldInputRow,
                    {
                        backgroundColor: colors.surfacePrimary,
                        borderColor: error ? '#EF4444' : colors.borderLight,
                    },
                ]}
            >
                <Ionicons name={icon as any} size={18} color={error ? '#EF4444' : colors.textTertiary} />
                <TextInput
                    style={[styles.fieldInput, { color: colors.textPrimary }]}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textTertiary}
                    keyboardType={keyboardType}
                    autoCapitalize={autoCapitalize}
                />
            </View>
            {error && <Text style={styles.fieldError}>{error}</Text>}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    headerBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 0.5,
    },
    cancelBtn: { paddingVertical: 4, paddingHorizontal: 4 },
    cancelText: { fontSize: 15, fontWeight: '500' },
    headerTitle: { fontSize: 16, fontWeight: '700' },
    saveBtn: {
        paddingHorizontal: 16,
        paddingVertical: 7,
        borderRadius: 8,
        minWidth: 60,
        alignItems: 'center',
    },
    saveBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
    scrollView: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 40 },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        borderRadius: 10,
        marginBottom: 12,
    },
    errorBannerText: { flex: 1, fontSize: 13, color: '#DC2626' },
    card: {
        borderRadius: 14,
        borderWidth: 0.5,
        padding: 16,
        marginBottom: 12,
    },
    sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
    fieldContainer: { marginBottom: 14 },
    fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
    fieldInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: 10,
        borderWidth: 0.5,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    fieldInput: { flex: 1, fontSize: 14, padding: 0 },
    fieldError: { color: '#EF4444', fontSize: 11, marginTop: 4, fontWeight: '500' },
    chipGroup: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
    },
    chipText: { fontSize: 13, fontWeight: '600' },
    notesInput: {
        borderWidth: 0.5,
        borderRadius: 10,
        padding: 12,
        fontSize: 14,
        minHeight: 90,
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
        marginTop: 12,
        marginBottom: 8,
    },
    modalMessage: {
        fontSize: 14,
        marginBottom: 24,
        textAlign: 'center',
    },
    modalOkBtn: {
        width: '100%',
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
    },
    modalOkBtnText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
});
