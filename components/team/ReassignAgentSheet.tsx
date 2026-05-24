import { useBottomSheetSafeBottom } from '@/hooks/useBottomSheetSafeBottom';
import { useSheetAnimation } from '@/hooks/useSheetAnimation';
import type { ThemeColors } from '@/types/theme';
import type { ReassignableManager } from '@/lib/team';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
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
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

interface ReassignAgentSheetProps {
    visible: boolean;
    agentName: string;
    currentManagerName: string | null;
    managers: ReassignableManager[];
    loading: boolean;
    submitting: boolean;
    colors: ThemeColors;
    onConfirm: (manager: ReassignableManager | null) => void;
    onClose: () => void;
}

function ReassignAgentSheet({
    visible,
    agentName,
    currentManagerName,
    managers,
    loading,
    submitting,
    colors,
    onConfirm,
    onClose,
}: ReassignAgentSheetProps) {
    const sheetY = useSharedValue(Dimensions.get('window').height);
    const modalVisible = useSheetAnimation(visible, sheetY);
    const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: sheetY.value }] }));
    const paddingBottom = useBottomSheetSafeBottom(40);

    // Two steps in one sheet: 'pick' (manager list) → 'confirm' (type to confirm).
    // Stacking two Modals collides on iOS, so we keep everything in one sheet.
    const [pending, setPending] = useState<ReassignableManager | null>(null);
    const [step, setStep] = useState<'pick' | 'confirm'>('pick');
    const [typed, setTyped] = useState('');

    useEffect(() => {
        if (!visible) {
            setStep('pick');
            setPending(null);
            setTyped('');
        }
    }, [visible]);

    const targetName = pending?.fullName ?? 'Unassigned';
    const expected = `reassign to ${targetName}`;
    const matches = typed.trim().toLowerCase() === expected.toLowerCase();

    const handlePick = (manager: ReassignableManager | null) => {
        setPending(manager);
        setTyped('');
        setStep('confirm');
    };

    const handleBackToPick = () => {
        if (submitting) return;
        setStep('pick');
        setPending(null);
        setTyped('');
    };

    return (
        <Modal visible={modalVisible} transparent animationType="none" onRequestClose={onClose}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={styles.overlay}>
                    <Pressable
                        style={StyleSheet.absoluteFill}
                        onPress={submitting ? undefined : onClose}
                        accessibilityRole="button"
                        accessibilityLabel="Close reassign sheet"
                    />
                    <Animated.View
                        style={[styles.sheet, { backgroundColor: colors.cardBackground, paddingBottom }, animatedStyle]}
                    >
                        {step === 'pick' ? (
                            <>
                                <Text style={[styles.title, { color: colors.textPrimary }]}>Reassign Agent</Text>
                                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                                    {currentManagerName
                                        ? `${agentName} is currently under ${currentManagerName}. Pick a new upline.`
                                        : `${agentName} is unassigned. Pick an upline.`}
                                </Text>

                                {loading ? (
                                    <View style={styles.centered}>
                                        <ActivityIndicator color={colors.accent} />
                                    </View>
                                ) : managers.length === 0 ? (
                                    <Text style={[styles.empty, { color: colors.textTertiary }]}>
                                        No active managers or directors available
                                    </Text>
                                ) : (
                                    <ScrollView style={styles.list} bounces={false}>
                                        <TouchableOpacity
                                            style={[styles.row, { borderColor: colors.borderLight }]}
                                            onPress={() => handlePick(null)}
                                            accessibilityRole="button"
                                            accessibilityLabel="Leave unassigned"
                                        >
                                            <View style={[styles.avatar, { backgroundColor: colors.surfaceSecondary }]}>
                                                <Ionicons
                                                    name="remove-circle-outline"
                                                    size={20}
                                                    color={colors.textTertiary}
                                                />
                                            </View>
                                            <View style={styles.rowBody}>
                                                <Text style={[styles.rowName, { color: colors.textPrimary }]}>
                                                    Unassigned
                                                </Text>
                                                <Text style={[styles.rowMeta, { color: colors.textTertiary }]}>
                                                    No upline
                                                </Text>
                                            </View>
                                            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                                        </TouchableOpacity>
                                        {managers.map((m) => (
                                            <TouchableOpacity
                                                key={m.id}
                                                style={[styles.row, { borderColor: colors.borderLight }]}
                                                onPress={() => handlePick(m)}
                                                accessibilityRole="button"
                                                accessibilityLabel={`Reassign to ${m.fullName}`}
                                            >
                                                <View style={[styles.avatar, { backgroundColor: colors.accentLight }]}>
                                                    <Text style={[styles.avatarText, { color: colors.accent }]}>
                                                        {m.fullName.charAt(0).toUpperCase()}
                                                    </Text>
                                                </View>
                                                <View style={styles.rowBody}>
                                                    <Text style={[styles.rowName, { color: colors.textPrimary }]}>
                                                        {m.fullName}
                                                    </Text>
                                                    <Text style={[styles.rowMeta, { color: colors.textTertiary }]}>
                                                        {m.role === 'director' ? 'Director' : 'Manager'}
                                                    </Text>
                                                </View>
                                                <Ionicons
                                                    name="chevron-forward"
                                                    size={16}
                                                    color={colors.textTertiary}
                                                />
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                )}

                                <TouchableOpacity
                                    style={[styles.cancel, { borderColor: colors.borderLight }]}
                                    onPress={onClose}
                                    accessibilityRole="button"
                                    accessibilityLabel="Cancel"
                                >
                                    <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <>
                                <View
                                    style={[
                                        styles.iconCircle,
                                        { backgroundColor: colors.dangerLight ?? colors.warningLight },
                                    ]}
                                >
                                    <Ionicons name="swap-horizontal" size={22} color={colors.danger} />
                                </View>
                                <Text style={[styles.title, { color: colors.textPrimary }]}>Reassign {agentName}?</Text>
                                <Text style={[styles.body, { color: colors.textSecondary }]}>
                                    This will move{' '}
                                    <Text style={{ fontWeight: '700', color: colors.textPrimary }}>{agentName}</Text>{' '}
                                    from{' '}
                                    <Text style={{ fontWeight: '700', color: colors.textPrimary }}>
                                        {currentManagerName ?? 'Unassigned'}
                                    </Text>{' '}
                                    to{' '}
                                    <Text style={{ fontWeight: '700', color: colors.textPrimary }}>{targetName}</Text>.
                                </Text>
                                <Text style={[styles.instruction, { color: colors.textTertiary }]}>
                                    To confirm, type{' '}
                                    <Text style={{ fontWeight: '700', color: colors.textPrimary }}>{expected}</Text>{' '}
                                    below.
                                </Text>
                                <TextInput
                                    value={typed}
                                    onChangeText={setTyped}
                                    placeholder={expected}
                                    placeholderTextColor={colors.textTertiary}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    editable={!submitting}
                                    style={[
                                        styles.input,
                                        {
                                            color: colors.textPrimary,
                                            backgroundColor: colors.surfaceSecondary,
                                            borderColor: matches ? colors.success : colors.border,
                                        },
                                    ]}
                                    accessibilityLabel="Type to confirm reassignment"
                                />
                                <View style={styles.actionsRow}>
                                    <TouchableOpacity
                                        style={[styles.cancel, { borderColor: colors.borderLight, flex: 1 }]}
                                        onPress={handleBackToPick}
                                        disabled={submitting}
                                        accessibilityRole="button"
                                        accessibilityLabel="Back to manager list"
                                    >
                                        <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Back</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[
                                            styles.confirm,
                                            {
                                                flex: 1,
                                                backgroundColor:
                                                    matches && !submitting ? colors.danger : colors.surfaceSecondary,
                                                opacity: matches && !submitting ? 1 : 0.6,
                                            },
                                        ]}
                                        onPress={() => onConfirm(pending)}
                                        disabled={!matches || submitting}
                                        accessibilityRole="button"
                                        accessibilityLabel="Confirm reassignment"
                                        accessibilityState={{ disabled: !matches || submitting }}
                                    >
                                        {submitting ? (
                                            <ActivityIndicator color={colors.textInverse} size="small" />
                                        ) : (
                                            <Text style={[styles.confirmText, { color: colors.textInverse }]}>
                                                Reassign
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}
                    </Animated.View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

export default React.memo(ReassignAgentSheet);

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'flex-end',
    },
    sheet: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 24,
        paddingBottom: 40,
    },
    title: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
    subtitle: { fontSize: 13, marginBottom: 20 },
    body: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
    instruction: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
    centered: { paddingVertical: 36, alignItems: 'center' },
    empty: { fontSize: 14, textAlign: 'center', paddingVertical: 12 },
    list: { maxHeight: 360 },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: 0.5,
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: { fontSize: 15, fontWeight: '700' },
    rowBody: { flex: 1, gap: 2 },
    rowName: { fontSize: 15, fontWeight: '600' },
    rowMeta: { fontSize: 12 },
    cancel: {
        marginTop: 16,
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 0.5,
        alignItems: 'center',
    },
    cancelText: { fontSize: 15, fontWeight: '600' },
    iconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    input: {
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 12,
        fontSize: 15,
        marginBottom: 4,
    },
    actionsRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 12,
    },
    confirm: {
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
    },
    confirmText: { fontSize: 15, fontWeight: '700' },
});
