/**
 * Singapore Citizen / PR confirm gate (D1). Marking a lead "qualified" fires a
 * ConfirmedResident conversion to Meta (via the live leads_notify_mktr_outcome
 * trigger → mktr CAPI), so the irreversible transition is gated behind an explicit
 * confirm — "Yes" qualifies + reports; "No" logs an internal note, no status change.
 */
import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Txt } from './ui/Txt';
import { useLeadsTheme, radius, spacing } from '@/lib/leads/theme';

export function ScPrConfirmDialog({
    visible,
    busy,
    onYes,
    onNo,
    onClose,
}: {
    visible: boolean;
    busy?: boolean;
    onYes: () => void;
    onNo: () => void;
    onClose: () => void;
}) {
    const { colors } = useLeadsTheme();
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <Pressable
                    style={StyleSheet.absoluteFill}
                    onPress={busy ? undefined : onClose}
                    accessibilityLabel="Dismiss"
                />
                <View style={[styles.card, { backgroundColor: colors.surface }]}>
                    <View style={[styles.icon, { backgroundColor: colors.accentLight }]}>
                        <Ionicons name="shield-checkmark-outline" size={24} color={colors.accent} />
                    </View>
                    <Txt
                        role="display"
                        weight="semibold"
                        size={18}
                        color={colors.text}
                        center
                        style={{ marginTop: 12 }}
                    >
                        Singapore Citizen / PR?
                    </Txt>
                    <Txt role="body" size={14} color={colors.textMuted} center leading={20} style={{ marginTop: 6 }}>
                        Confirm on the call. “Yes” marks the lead Qualified and reports it.
                    </Txt>
                    <Pressable
                        testID="sc-pr-yes"
                        onPress={onYes}
                        disabled={busy}
                        accessibilityRole="button"
                        accessibilityLabel="Yes, Singapore Citizen or PR"
                        style={[styles.yes, { backgroundColor: colors.accent, opacity: busy ? 0.5 : 1 }]}
                    >
                        <Ionicons name="checkmark-circle" size={18} color={colors.textInverse} />
                        <Txt role="body" weight="bold" size={15} color={colors.textInverse}>
                            Yes — SC/PR
                        </Txt>
                    </Pressable>
                    <Pressable
                        testID="sc-pr-no"
                        onPress={onNo}
                        disabled={busy}
                        accessibilityRole="button"
                        accessibilityLabel="No, not a Singapore Citizen or PR"
                        style={styles.no}
                    >
                        <Txt role="body" weight="semibold" size={15} color={colors.textMuted}>
                            No
                        </Txt>
                    </Pressable>
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
    card: { width: '100%', maxWidth: 360, borderRadius: radius.hero, padding: 24, alignItems: 'center' },
    icon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    yes: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 50,
        width: '100%',
        borderRadius: radius.btn,
        marginTop: spacing.lg,
    },
    no: { height: 48, width: '100%', alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs },
});
