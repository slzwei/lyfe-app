import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ThemeColors } from '@/types/theme';

interface SignOutModalProps {
    visible: boolean;
    colors: ThemeColors;
    onCancel: () => void;
    onConfirm: () => void;
}

export default function SignOutModal({ visible, colors, onCancel, onConfirm }: SignOutModalProps) {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} accessibilityViewIsModal>
            <View style={styles.overlay}>
                <View style={[styles.content, { backgroundColor: colors.cardBackground }]}>
                    <View style={[styles.iconCircle, { backgroundColor: colors.dangerLight }]}>
                        <Ionicons name="log-out-outline" size={28} color={colors.danger} />
                    </View>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>Sign Out</Text>
                    <Text style={[styles.message, { color: colors.textSecondary }]}>
                        Are you sure you want to sign out of your account?
                    </Text>
                    <View style={styles.actions}>
                        <TouchableOpacity
                            testID="sign-out-modal-cancel"
                            style={[styles.btn, { backgroundColor: colors.surfaceSecondary }]}
                            onPress={onCancel}
                            accessibilityRole="button"
                            accessibilityLabel="Cancel sign out"
                        >
                            <Text style={[styles.btnText, { color: colors.textPrimary }]}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            testID="sign-out-modal-confirm"
                            style={[styles.btn, { backgroundColor: colors.danger }]}
                            onPress={onConfirm}
                            accessibilityRole="button"
                            accessibilityLabel="Confirm sign out"
                        >
                            <Text style={[styles.btnText, { color: colors.textInverse }]}>Sign Out</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
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
        marginBottom: 24,
        textAlign: 'center',
        lineHeight: 20,
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
