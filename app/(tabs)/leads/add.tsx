import ErrorBanner from '@/components/ErrorBanner';
import FormField from '@/components/FormField';
import { KAV_BEHAVIOR } from '@/constants/platform';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { createLead, type CreateLeadInput } from '@/lib/leads';
import { PRODUCT_LABELS, SOURCE_LABELS, type LeadSource, type ProductInterest } from '@/types/lead';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSubmitGuard } from '@/hooks/useSubmitGuard';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
    const { isSubmitting: isSaving, guard } = useSubmitGuard();
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

    const handleSave = () =>
        guard(async () => {
            if (!validate()) return;
            setSaveError(null);

            if (!user?.id) {
                setSaveError('Not authenticated');
                return;
            }

            const input: CreateLeadInput = {
                full_name: name.trim(),
                phone: phone.trim() || null,
                email: email.trim() || null,
                source,
                product_interest: product,
                notes: notes.trim() || null,
            };

            const { error } = await createLead(input, user.id);

            if (error) {
                setSaveError(error);
                return;
            }

            setShowSuccessModal(true);
        });

    const handleSuccessDismiss = () => {
        setShowSuccessModal(false);
        router.back();
    };

    const canViewLeads = user?.role && ['admin', 'director', 'manager', 'agent'].includes(user.role);

    if (!canViewLeads) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={[styles.headerBar, { borderBottomColor: colors.borderLight }]}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={styles.cancelBtn}
                        accessibilityRole="button"
                        accessibilityLabel="Go back"
                    >
                        <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Back</Text>
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>New Lead</Text>
                    <View style={styles.cancelBtn} />
                </View>
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
                    <Ionicons name="lock-closed-outline" size={48} color={colors.textTertiary} />
                    <Text style={{ fontSize: 17, fontWeight: '600', color: colors.textPrimary, marginTop: 16 }}>
                        Not Authorized
                    </Text>
                    <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 8 }}>
                        You don&apos;t have permission to add leads.
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.headerBar, { borderBottomColor: colors.borderLight }]}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.cancelBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel and go back"
                >
                    <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>New Lead</Text>
                <TouchableOpacity
                    onPress={handleSave}
                    style={[styles.saveBtn, { backgroundColor: colors.accent, opacity: isSaving ? 0.5 : 1 }]}
                    disabled={isSaving}
                    accessibilityRole="button"
                    accessibilityLabel="Save new lead"
                >
                    {isSaving ? (
                        <ActivityIndicator size="small" color={colors.textInverse} />
                    ) : (
                        <Text style={[styles.saveBtnText, { color: colors.textInverse }]}>Save</Text>
                    )}
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={KAV_BEHAVIOR} keyboardVerticalOffset={100}>
                <Pressable style={{ flex: 1 }} onPress={Keyboard.dismiss}>
                    <ScrollView
                        style={styles.scrollView}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Save Error */}
                        {saveError && <ErrorBanner message={saveError} />}

                        {/* Contact Info */}
                        <View
                            style={[
                                styles.card,
                                { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder },
                            ]}
                        >
                            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                                Contact Information
                            </Text>

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
                        <View
                            style={[
                                styles.card,
                                { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder },
                            ]}
                        >
                            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Source</Text>
                            <View style={styles.chipGroup}>
                                {SOURCES.map((s) => (
                                    <TouchableOpacity
                                        key={s}
                                        style={[
                                            styles.chip,
                                            {
                                                backgroundColor:
                                                    source === s ? colors.accentLight : colors.surfacePrimary,
                                                borderColor: source === s ? colors.accent : colors.borderLight,
                                                borderWidth: source === s ? 1.5 : 0.5,
                                            },
                                        ]}
                                        onPress={() => setSource(s)}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Source: ${SOURCE_LABELS[s]}`}
                                        accessibilityState={{ selected: source === s }}
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
                        <View
                            style={[
                                styles.card,
                                { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder },
                            ]}
                        >
                            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Product Interest</Text>
                            <View style={styles.chipGroup}>
                                {PRODUCTS.map((p) => (
                                    <TouchableOpacity
                                        key={p}
                                        style={[
                                            styles.chip,
                                            {
                                                backgroundColor:
                                                    product === p ? colors.accentLight : colors.surfacePrimary,
                                                borderColor: product === p ? colors.accent : colors.borderLight,
                                                borderWidth: product === p ? 1.5 : 0.5,
                                            },
                                        ]}
                                        onPress={() => setProduct(p)}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Product: ${PRODUCT_LABELS[p]}`}
                                        accessibilityState={{ selected: product === p }}
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
                        <View
                            style={[
                                styles.card,
                                { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder },
                            ]}
                        >
                            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Notes</Text>
                            <TextInput
                                style={[
                                    styles.notesInput,
                                    {
                                        color: colors.textPrimary,
                                        borderColor: colors.borderLight,
                                        backgroundColor: colors.surfacePrimary,
                                    },
                                ]}
                                placeholder="Any initial notes about this lead..."
                                placeholderTextColor={colors.textTertiary}
                                value={notes}
                                onChangeText={setNotes}
                                multiline
                                numberOfLines={4}
                                textAlignVertical="top"
                                accessibilityLabel="Notes"
                            />
                        </View>
                    </ScrollView>
                </Pressable>
            </KeyboardAvoidingView>

            {/* Success Modal */}
            <Modal visible={showSuccessModal} transparent animationType="fade" onRequestClose={handleSuccessDismiss}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
                        <Ionicons name="checkmark-circle" size={48} color={colors.success} />
                        <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Lead Created</Text>
                        <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
                            {name} has been added to your leads.
                        </Text>
                        <TouchableOpacity
                            style={[styles.modalOkBtn, { backgroundColor: colors.accent }]}
                            onPress={handleSuccessDismiss}
                            accessibilityRole="button"
                            accessibilityLabel="OK, dismiss"
                        >
                            <Text style={[styles.modalOkBtnText, { color: colors.textInverse }]}>OK</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
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
    saveBtnText: { fontSize: 14, fontWeight: '700' },
    scrollView: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 40 },
    card: {
        borderRadius: 14,
        borderWidth: 0.5,
        padding: 16,
        marginBottom: 12,
    },
    sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
    chipGroup: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
        minHeight: 44,
        justifyContent: 'center' as const,
    },
    chipText: { fontSize: 14, fontWeight: '600' },
    notesInput: {
        borderWidth: 0.5,
        borderRadius: 10,
        padding: 14,
        fontSize: 15,
        minHeight: 100,
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
        fontSize: 14,
        fontWeight: '600',
    },
});
