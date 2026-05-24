import { letterSpacing } from '@/constants/platform';
import { ERROR_BG, ERROR_TEXT } from '@/constants/ui';
import { useBottomSheetSafeBottom } from '@/hooks/useBottomSheetSafeBottom';
import type { ThemeColors } from '@/types/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';

export interface ReadinessItem {
    label: string;
    satisfied: boolean;
    detail?: string;
}

interface Props {
    visible: boolean;
    candidateName: string;
    readiness: ReadinessItem[];
    error: string | null;
    isSubmitting: boolean;
    colors: ThemeColors;
    animatedStyle: AnimatedStyle<ViewStyle>;
    onSubmit: () => void;
    onDismiss: () => void;
}

function ActivateAgentSheet({
    visible,
    candidateName,
    readiness,
    error,
    isSubmitting,
    colors,
    animatedStyle,
    onSubmit,
    onDismiss,
}: Props) {
    const allSatisfied = readiness.every((r) => r.satisfied);
    const canSubmit = allSatisfied && !isSubmitting;
    const paddingBottom = useBottomSheetSafeBottom(40);
    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
            <View style={styles.overlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
                <Animated.View
                    style={[styles.sheet, { backgroundColor: colors.cardBackground, paddingBottom }, animatedStyle]}
                >
                    <View style={[styles.handle, { backgroundColor: colors.border }]} />
                    <View style={[styles.iconWrap, { backgroundColor: colors.successLight }]}>
                        <Ionicons name="star-outline" size={28} color={colors.success} />
                    </View>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>Activate as Agent</Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        <Text style={{ fontWeight: '700' }}>{candidateName}</Text> will be promoted to an active agent.
                        Their role changes to <Text style={{ fontWeight: '700' }}>agent</Text> and they will start
                        receiving leads.
                    </Text>
                    <KeyboardAwareScrollView
                        style={{ width: '100%' }}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>Readiness Checks</Text>
                        <View style={[styles.checksCard, { backgroundColor: colors.surfacePrimary }]}>
                            {readiness.map((item, idx) => (
                                <View
                                    key={item.label}
                                    style={[
                                        styles.checkRow,
                                        idx > 0 && {
                                            borderTopWidth: StyleSheet.hairlineWidth,
                                            borderTopColor: colors.border,
                                        },
                                    ]}
                                    testID={`activate-agent-check-${item.label.replace(/\s+/g, '-').toLowerCase()}`}
                                >
                                    <Ionicons
                                        name={item.satisfied ? 'checkmark-circle' : 'ellipse-outline'}
                                        size={20}
                                        color={item.satisfied ? colors.success : colors.textTertiary}
                                    />
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.checkLabel, { color: colors.textPrimary }]}>
                                            {item.label}
                                        </Text>
                                        {item.detail && (
                                            <Text style={[styles.checkDetail, { color: colors.textTertiary }]}>
                                                {item.detail}
                                            </Text>
                                        )}
                                    </View>
                                </View>
                            ))}
                        </View>

                        {!allSatisfied && (
                            <Text style={[styles.helperText, { color: colors.textTertiary }]}>
                                All readiness checks must be satisfied before activation.
                            </Text>
                        )}

                        {error && (
                            <View style={[styles.errorRow, { backgroundColor: ERROR_BG }]}>
                                <Ionicons name="alert-circle" size={14} color={ERROR_TEXT} />
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        )}

                        <TouchableOpacity
                            style={[
                                styles.primaryBtn,
                                { backgroundColor: colors.success, opacity: canSubmit ? 1 : 0.4 },
                            ]}
                            onPress={onSubmit}
                            activeOpacity={0.85}
                            disabled={!canSubmit}
                            accessibilityRole="button"
                            accessibilityLabel={isSubmitting ? 'Activating' : 'Confirm activation'}
                            testID="activate-agent-submit"
                        >
                            <Ionicons name="star" size={18} color="#FFFFFF" />
                            <Text style={styles.primaryBtnText}>
                                {isSubmitting ? 'Activating...' : 'Confirm Activation'}
                            </Text>
                        </TouchableOpacity>
                        <View style={{ height: 8 }} />
                    </KeyboardAwareScrollView>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    sheet: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 24,
        paddingTop: 12,
        paddingBottom: 40,
        alignItems: 'center',
        maxHeight: '92%',
    },
    handle: { width: 36, height: 4, borderRadius: 2, marginBottom: 20 },
    iconWrap: {
        width: 52,
        height: 52,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
        letterSpacing: letterSpacing(-0.3),
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 19,
        marginBottom: 20,
        paddingHorizontal: 8,
    },
    fieldLabel: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 6,
        alignSelf: 'flex-start',
    },
    checksCard: {
        width: '100%',
        borderRadius: 12,
        marginBottom: 12,
        paddingHorizontal: 12,
    },
    checkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 12,
    },
    checkLabel: { fontSize: 14, fontWeight: '600' },
    checkDetail: { fontSize: 12, marginTop: 2 },
    helperText: { fontSize: 12, marginBottom: 12, textAlign: 'center' },
    errorRow: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        padding: 10,
        borderRadius: 10,
        marginBottom: 12,
    },
    errorText: { fontSize: 13, color: ERROR_TEXT, flex: 1 },
    primaryBtn: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 15,
        borderRadius: 14,
        minHeight: 52,
    },
    primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});

export default React.memo(ActivateAgentSheet);
