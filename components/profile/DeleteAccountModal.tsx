import { Ionicons } from '@expo/vector-icons';
import { KAV_BEHAVIOR } from '@/constants/platform';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import type { ThemeColors } from '@/types/theme';

interface DeleteAccountModalProps {
    visible: boolean;
    colors: ThemeColors;
    deleting: boolean;
    error?: string | null;
    onCancel: () => void;
    onConfirm: () => void;
}

export default function DeleteAccountModal({
    visible,
    colors,
    deleting,
    error,
    onCancel,
    onConfirm,
}: DeleteAccountModalProps) {
    const [confirmText, setConfirmText] = useState('');
    const isConfirmed = confirmText.toLowerCase() === 'delete';

    const handleClose = () => {
        Keyboard.dismiss();
        setConfirmText('');
        onCancel();
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose} accessibilityViewIsModal>
            <KeyboardAvoidingView style={styles.kavFlex} behavior={KAV_BEHAVIOR}>
                <View style={styles.overlay}>
                    <View
                        style={[styles.content, { backgroundColor: colors.cardBackground }]}
                        accessible
                        accessibilityRole="alert"
                    >
                        <View style={[styles.iconCircle, { backgroundColor: colors.dangerLight }]}>
                            <Ionicons name="trash-outline" size={28} color={colors.danger} />
                        </View>
                        <Text style={[styles.title, { color: colors.textPrimary }]}>Delete Account</Text>
                        <Text style={[styles.message, { color: colors.textSecondary }]}>
                            This will permanently delete your account and all associated data. This action cannot be
                            undone.
                        </Text>
                        {error ? <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text> : null}
                        <Text style={[styles.confirmLabel, { color: colors.textSecondary }]}>
                            Type "delete" to confirm
                        </Text>
                        <TextInput
                            style={[
                                styles.input,
                                {
                                    color: colors.textPrimary,
                                    backgroundColor: colors.inputBackground,
                                    borderColor: colors.border,
                                },
                            ]}
                            value={confirmText}
                            onChangeText={setConfirmText}
                            placeholder="delete"
                            placeholderTextColor={colors.textTertiary}
                            autoCapitalize="none"
                            autoCorrect={false}
                            editable={!deleting}
                            accessibilityLabel="Type delete to confirm account deletion"
                        />
                        <View style={styles.actions}>
                            <TouchableOpacity
                                style={[styles.btn, { backgroundColor: colors.surfaceSecondary }]}
                                onPress={handleClose}
                                disabled={deleting}
                                accessibilityRole="button"
                                accessibilityLabel="Cancel account deletion"
                            >
                                <Text style={[styles.btnText, { color: colors.textPrimary }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.btn, { backgroundColor: isConfirmed ? colors.danger : colors.border }]}
                                onPress={onConfirm}
                                disabled={!isConfirmed || deleting}
                                accessibilityRole="button"
                                accessibilityLabel="Confirm account deletion"
                                accessibilityState={{ disabled: !isConfirmed || deleting }}
                            >
                                {deleting ? (
                                    <ActivityIndicator size="small" color={colors.textInverse} />
                                ) : (
                                    <Text
                                        style={[
                                            styles.btnText,
                                            { color: isConfirmed ? colors.textInverse : colors.textTertiary },
                                        ]}
                                    >
                                        Delete
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    kavFlex: { flex: 1 },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
    },
    content: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 20,
        padding: 28,
        alignItems: 'center',
    },
    iconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 8,
    },
    message: {
        fontSize: 14,
        marginBottom: 16,
        textAlign: 'center',
        lineHeight: 20,
    },
    errorText: {
        fontSize: 13,
        marginBottom: 12,
        textAlign: 'center',
        lineHeight: 18,
    },
    confirmLabel: {
        fontSize: 13,
        marginBottom: 8,
        alignSelf: 'flex-start',
    },
    input: {
        width: '100%',
        height: 44,
        borderRadius: 10,
        borderWidth: 1,
        paddingHorizontal: 14,
        fontSize: 15,
        marginBottom: 20,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    btn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    btnText: {
        fontSize: 15,
        fontWeight: '600',
    },
});
