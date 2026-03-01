import { useTheme } from '@/contexts/ThemeContext';
import React from 'react';
import {
    Modal,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

export interface ConfirmDialogButton {
    text: string;
    style?: 'default' | 'cancel' | 'destructive';
    onPress?: () => void;
}

interface ConfirmDialogProps {
    visible: boolean;
    title: string;
    message: string;
    buttons: ConfirmDialogButton[];
    onDismiss?: () => void;
}

/**
 * Cross-platform confirmation dialog that works on both native and web.
 * 
 * On native, Alert.alert uses the OS dialog which has issues on web
 * (window.confirm auto-cancels in some browser environments).
 * This component renders a proper React Native Modal instead.
 */
export default function ConfirmDialog({
    visible,
    title,
    message,
    buttons,
    onDismiss,
}: ConfirmDialogProps) {
    const { colors } = useTheme();

    if (!visible) return null;

    return (
        <Modal
            transparent
            animationType="fade"
            visible={visible}
            onRequestClose={onDismiss}
        >
            <View style={styles.overlay}>
                <View style={[styles.dialog, { backgroundColor: colors.cardBackground }]}>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>
                        {title}
                    </Text>
                    <Text style={[styles.message, { color: colors.textSecondary }]}>
                        {message}
                    </Text>
                    <View style={styles.buttonRow}>
                        {buttons.map((btn, idx) => (
                            <TouchableOpacity
                                key={idx}
                                style={[
                                    styles.button,
                                    btn.style === 'destructive' && {
                                        backgroundColor: colors.danger,
                                    },
                                    btn.style === 'cancel' && {
                                        backgroundColor: colors.surfacePrimary,
                                        borderWidth: 1,
                                        borderColor: colors.border,
                                    },
                                    btn.style === 'default' && {
                                        backgroundColor: colors.accent,
                                    },
                                    !btn.style && {
                                        backgroundColor: colors.accent,
                                    },
                                ]}
                                onPress={() => {
                                    btn.onPress?.();
                                }}
                                activeOpacity={0.7}
                            >
                                <Text
                                    style={[
                                        styles.buttonText,
                                        {
                                            color:
                                                btn.style === 'cancel'
                                                    ? colors.textPrimary
                                                    : '#FFFFFF',
                                        },
                                    ]}
                                >
                                    {btn.text}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    dialog: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 14,
        padding: 24,
        ...Platform.select({
            web: {
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            },
            default: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.2,
                shadowRadius: 32,
                elevation: 12,
            },
        }),
    },
    title: {
        fontSize: 17,
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 8,
    },
    message: {
        fontSize: 14,
        lineHeight: 20,
        textAlign: 'center',
        marginBottom: 20,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 8,
    },
    button: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44,
    },
    buttonText: {
        fontSize: 15,
        fontWeight: '600',
    },
});
