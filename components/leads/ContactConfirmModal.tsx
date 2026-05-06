import type { ThemeColors } from '@/types/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type ContactOutcome = 'reached' | 'no_answer' | 'sent' | 'skip';

interface ContactConfirmModalProps {
    visible: boolean;
    contactType: 'call' | 'whatsapp' | null;
    leadName: string;
    colors: ThemeColors;
    onConfirm: (outcome: ContactOutcome) => void;
}

function ContactConfirmModal({ visible, contactType, leadName, colors, onConfirm }: ContactConfirmModalProps) {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={() => onConfirm('skip')}
            accessibilityViewIsModal
        >
            <View style={styles.confirmOverlay}>
                <View style={[styles.confirmSheet, { backgroundColor: colors.cardBackground }]}>
                    {contactType === 'call' ? (
                        <>
                            <View style={[styles.confirmIconWrap, { backgroundColor: colors.successLight }]}>
                                <Ionicons name="call" size={26} color={colors.success} />
                            </View>
                            <Text style={[styles.confirmTitle, { color: colors.textPrimary }]}>
                                How did the call go?
                            </Text>
                            <Text style={[styles.confirmSubtitle, { color: colors.textSecondary }]}>
                                With {leadName}
                            </Text>
                            <TouchableOpacity
                                testID="lead-contact-outcome-reached"
                                accessibilityRole="button"
                                accessibilityLabel="Reached them"
                                style={[styles.confirmBtn, { backgroundColor: colors.success }]}
                                onPress={() => onConfirm('reached')}
                            >
                                <Ionicons name="checkmark-circle-outline" size={18} color={colors.textInverse} />
                                <Text style={[styles.confirmBtnText, { color: colors.textInverse }]}>Reached them</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                testID="lead-contact-outcome-no-answer"
                                accessibilityRole="button"
                                accessibilityLabel="No answer"
                                style={[
                                    styles.confirmBtn,
                                    {
                                        backgroundColor: colors.surfacePrimary,
                                        borderWidth: 0.5,
                                        borderColor: colors.borderLight,
                                    },
                                ]}
                                onPress={() => onConfirm('no_answer')}
                            >
                                <Ionicons name="close-circle-outline" size={18} color={colors.textSecondary} />
                                <Text style={[styles.confirmBtnText, { color: colors.textSecondary }]}>No answer</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <View style={[styles.confirmIconWrap, { backgroundColor: colors.successLight }]}>
                                <Ionicons name="logo-whatsapp" size={26} color="#25D366" />
                            </View>
                            <Text style={[styles.confirmTitle, { color: colors.textPrimary }]}>
                                Did you send the message?
                            </Text>
                            <Text style={[styles.confirmSubtitle, { color: colors.textSecondary }]}>To {leadName}</Text>
                            <TouchableOpacity
                                testID="lead-contact-outcome-sent"
                                accessibilityRole="button"
                                accessibilityLabel="Yes, sent"
                                style={[styles.confirmBtn, { backgroundColor: '#25D366' }]}
                                onPress={() => onConfirm('sent')}
                            >
                                <Ionicons name="checkmark-circle-outline" size={18} color={colors.textInverse} />
                                <Text style={[styles.confirmBtnText, { color: colors.textInverse }]}>Yes, sent</Text>
                            </TouchableOpacity>
                        </>
                    )}
                    <TouchableOpacity
                        testID="lead-contact-skip"
                        accessibilityRole="button"
                        accessibilityLabel="Skip"
                        onPress={() => onConfirm('skip')}
                    >
                        <Text style={[styles.confirmSkip, { color: colors.textTertiary }]}>Skip — don't log</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

export default React.memo(ContactConfirmModal);

const styles = StyleSheet.create({
    confirmOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
    },
    confirmSheet: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        gap: 0,
    },
    confirmIconWrap: {
        width: 56,
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    confirmTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
    confirmSubtitle: { fontSize: 13, textAlign: 'center', marginBottom: 20 },
    confirmBtn: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 13,
        borderRadius: 12,
        marginBottom: 10,
    },
    confirmBtnText: { fontSize: 15, fontWeight: '700' },
    confirmSkip: { fontSize: 13, marginTop: 4, fontWeight: '500' },
});
