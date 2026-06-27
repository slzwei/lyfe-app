import ErrorBanner from '@/components/ErrorBanner';
import FormField from '@/components/FormField';
import { Txt } from '@/components/leads/ui';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useAuth } from '@/contexts/AuthContext';
import { useLeadsTheme, spacing, radius, type LeadsThemeColors } from '@/lib/leads/theme';
import { createLead, type CreateLeadInput } from '@/lib/leads';
import { PRODUCT_LABELS, SOURCE_LABELS, type LeadSource, type ProductInterest } from '@/types/lead';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSubmitGuard } from '@/hooks/useSubmitGuard';
import React, { useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const SOURCES: LeadSource[] = ['referral', 'walk_in', 'online', 'event', 'cold_call', 'other'];
const PRODUCTS: ProductInterest[] = ['life', 'health', 'ilp', 'general'];

export default function AddLeadScreen() {
    const { colors } = useLeadsTheme();
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
                <AddLeadHeader
                    colors={colors}
                    cancelLabel="Back"
                    showSave={false}
                    isSaving={isSaving}
                    onBack={() => router.back()}
                    onSave={handleSave}
                />
                <View style={styles.lockWrap}>
                    <Ionicons name="lock-closed-outline" size={48} color={colors.textFaint} />
                    <Txt role="display" weight="semibold" size={18} color={colors.text} style={{ marginTop: 16 }}>
                        Not Authorized
                    </Txt>
                    <Txt role="body" size={14} color={colors.textMuted} center style={{ marginTop: 8 }}>
                        You don&apos;t have permission to add leads.
                    </Txt>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <AddLeadHeader
                colors={colors}
                cancelLabel="Cancel"
                showSave
                isSaving={isSaving}
                onBack={() => router.back()}
                onSave={handleSave}
            />

            <KeyboardAwareScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                bottomOffset={20}
            >
                {saveError && <ErrorBanner message={saveError} />}

                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Txt role="body" weight="bold" size={15} color={colors.text} style={styles.sectionTitle}>
                        Contact Information
                    </Txt>
                    <FormField
                        testID="add-lead-name"
                        label="Full Name *"
                        value={name}
                        onChangeText={setName}
                        placeholder="e.g. Sarah Tan"
                        error={errors.name}
                        colors={colors}
                        icon="person-outline"
                    />
                    <FormField
                        testID="add-lead-phone"
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
                        testID="add-lead-email"
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

                <ChipSection
                    title="Source"
                    options={SOURCES}
                    labelFor={(s) => SOURCE_LABELS[s]}
                    selected={source}
                    onSelect={setSource}
                    prefix="Source"
                />
                <ChipSection
                    title="Product Interest"
                    options={PRODUCTS}
                    labelFor={(p) => PRODUCT_LABELS[p]}
                    selected={product}
                    onSelect={setProduct}
                    prefix="Product"
                />

                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Txt role="body" weight="bold" size={15} color={colors.text} style={styles.sectionTitle}>
                        Notes
                    </Txt>
                    <TextInput
                        style={[
                            styles.notesInput,
                            { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt },
                        ]}
                        placeholder="Any initial notes about this lead…"
                        placeholderTextColor={colors.textFaint}
                        value={notes}
                        onChangeText={setNotes}
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                        accessibilityLabel="Notes"
                    />
                </View>
            </KeyboardAwareScrollView>

            <Modal visible={showSuccessModal} transparent animationType="fade" onRequestClose={handleSuccessDismiss}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                        <Ionicons name="checkmark-circle" size={48} color={colors.success} />
                        <Txt role="display" weight="semibold" size={18} color={colors.text} style={{ marginTop: 12 }}>
                            Lead Created
                        </Txt>
                        <Txt
                            role="body"
                            size={14}
                            color={colors.textMuted}
                            center
                            style={{ marginTop: 6, marginBottom: 22 }}
                        >
                            {name} has been added to your leads.
                        </Txt>
                        <TouchableOpacity
                            style={[styles.modalOkBtn, { backgroundColor: colors.accent }]}
                            onPress={handleSuccessDismiss}
                            accessibilityRole="button"
                            testID="add-lead-success-ok"
                            accessibilityLabel="OK, dismiss"
                        >
                            <Txt role="body" weight="bold" size={15} color={colors.textInverse}>
                                OK
                            </Txt>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

function AddLeadHeader({
    colors,
    cancelLabel,
    showSave,
    isSaving,
    onBack,
    onSave,
}: {
    colors: LeadsThemeColors;
    cancelLabel: string;
    showSave: boolean;
    isSaving: boolean;
    onBack: () => void;
    onSave: () => void;
}) {
    return (
        <View style={[styles.headerBar, { borderBottomColor: colors.border }]}>
            <TouchableOpacity
                onPress={onBack}
                style={styles.cancelBtn}
                accessibilityRole="button"
                accessibilityLabel={showSave ? 'Cancel and go back' : 'Go back'}
            >
                <Txt role="body" weight="semibold" size={15} color={colors.textMuted}>
                    {cancelLabel}
                </Txt>
            </TouchableOpacity>
            <Txt role="display" weight="semibold" size={18} color={colors.text} tracking={-0.3}>
                New Lead
            </Txt>
            {showSave ? (
                <TouchableOpacity
                    onPress={onSave}
                    style={[styles.saveBtn, { backgroundColor: colors.accent, opacity: isSaving ? 0.5 : 1 }]}
                    disabled={isSaving}
                    accessibilityRole="button"
                    testID="add-lead-save"
                    accessibilityLabel="Save new lead"
                >
                    {isSaving ? (
                        <ActivityIndicator size="small" color={colors.textInverse} />
                    ) : (
                        <Txt role="body" weight="bold" size={14} color={colors.textInverse}>
                            Save
                        </Txt>
                    )}
                </TouchableOpacity>
            ) : (
                <View style={styles.cancelBtn} />
            )}
        </View>
    );
}

function ChipSection<T extends string>({
    title,
    options,
    labelFor,
    selected,
    onSelect,
    prefix,
}: {
    title: string;
    options: readonly T[];
    labelFor: (v: T) => string;
    selected: T;
    onSelect: (v: T) => void;
    prefix: string;
}) {
    const { colors } = useLeadsTheme();
    return (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Txt role="body" weight="bold" size={15} color={colors.text} style={styles.sectionTitle}>
                {title}
            </Txt>
            <View style={styles.chipGroup}>
                {options.map((o) => {
                    const active = selected === o;
                    return (
                        <TouchableOpacity
                            key={o}
                            style={[
                                styles.chip,
                                {
                                    backgroundColor: active ? colors.accent : colors.surfaceAlt,
                                    borderColor: active ? colors.accent : colors.border,
                                },
                            ]}
                            onPress={() => onSelect(o)}
                            accessibilityRole="button"
                            accessibilityLabel={`${prefix}: ${labelFor(o)}`}
                            accessibilityState={{ selected: active }}
                        >
                            <Txt
                                role="body"
                                weight="semibold"
                                size={14}
                                color={active ? colors.textInverse : colors.textMuted}
                            >
                                {labelFor(o)}
                            </Txt>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    headerBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    cancelBtn: { paddingVertical: 4, paddingHorizontal: 4, minWidth: 60 },
    saveBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: radius.chip,
        minWidth: 60,
        alignItems: 'center',
    },
    lockWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    scrollView: { flex: 1 },
    scrollContent: { padding: spacing.lg, paddingBottom: 40, gap: spacing.md },
    card: { borderRadius: radius.card, borderWidth: 1, padding: spacing.lg },
    sectionTitle: { marginBottom: 12 },
    chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: radius.chip,
        minHeight: 44,
        justifyContent: 'center',
        borderWidth: 1,
    },
    notesInput: { borderWidth: 1, borderRadius: radius.btn, padding: 14, fontSize: 15, minHeight: 100 },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
    },
    modalContent: { width: '100%', maxWidth: 340, borderRadius: radius.hero, padding: 24, alignItems: 'center' },
    modalOkBtn: { width: '100%', paddingVertical: 13, borderRadius: radius.btn, alignItems: 'center' },
});
