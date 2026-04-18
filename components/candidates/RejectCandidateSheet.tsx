import { letterSpacing } from '@/constants/platform';
import { ERROR_BG, ERROR_TEXT } from '@/constants/ui';
import type { ThemeColors } from '@/types/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View, type ViewStyle } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';

interface Props {
    visible: boolean;
    candidateName: string;
    reason: string;
    error: string | null;
    isSubmitting: boolean;
    colors: ThemeColors;
    animatedStyle: AnimatedStyle<ViewStyle>;
    onReasonChange: (text: string) => void;
    onSubmit: () => void;
    onDismiss: () => void;
}

function RejectCandidateSheet({
    visible,
    candidateName,
    reason,
    error,
    isSubmitting,
    colors,
    animatedStyle,
    onReasonChange,
    onSubmit,
    onDismiss,
}: Props) {
    const canSubmit = reason.trim().length > 0 && !isSubmitting;
    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
            <View style={styles.overlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
                <Animated.View style={[styles.sheet, { backgroundColor: colors.cardBackground }, animatedStyle]}>
                    <View style={[styles.handle, { backgroundColor: colors.border }]} />
                    <View style={[styles.iconWrap, { backgroundColor: ERROR_BG }]}>
                        <Ionicons name="close-circle-outline" size={28} color={ERROR_TEXT} />
                    </View>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>Reject Candidate</Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        This will move <Text style={{ fontWeight: '700' }}>{candidateName}</Text> to Rejected. The
                        candidate will no longer appear in the default Candidates list.
                    </Text>
                    <KeyboardAwareScrollView
                        style={{ width: '100%' }}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>Reason (required)</Text>
                        <TextInput
                            style={[
                                styles.input,
                                { color: colors.textPrimary, backgroundColor: colors.surfacePrimary },
                            ]}
                            placeholder="Why is this candidate being rejected?"
                            placeholderTextColor={colors.textTertiary}
                            value={reason}
                            onChangeText={onReasonChange}
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                            autoFocus
                            testID="reject-candidate-reason-input"
                        />
                        {error && (
                            <View style={[styles.errorRow, { backgroundColor: ERROR_BG }]}>
                                <Ionicons name="alert-circle" size={14} color={ERROR_TEXT} />
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        )}
                        <TouchableOpacity
                            style={[styles.primaryBtn, { backgroundColor: ERROR_TEXT, opacity: canSubmit ? 1 : 0.4 }]}
                            onPress={onSubmit}
                            activeOpacity={0.85}
                            disabled={!canSubmit}
                            accessibilityRole="button"
                            accessibilityLabel={isSubmitting ? 'Rejecting' : 'Confirm rejection'}
                            testID="reject-candidate-submit"
                        >
                            <Ionicons name="close" size={18} color="#FFFFFF" />
                            <Text style={styles.primaryBtnText}>
                                {isSubmitting ? 'Rejecting...' : 'Confirm Rejection'}
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
    input: {
        width: '100%',
        borderRadius: 12,
        padding: 14,
        fontSize: 15,
        minHeight: 96,
        marginBottom: 12,
        lineHeight: 21,
    },
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

export default React.memo(RejectCandidateSheet);
