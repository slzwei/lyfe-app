import React, { useEffect } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import Touchable from '@/components/Touchable';
import { displayWeight, letterSpacing, MODAL_STATUS_BAR_TRANSLUCENT } from '@/constants/platform';
import { useBottomSheetSafeBottom } from '@/hooks/useBottomSheetSafeBottom';
import type { ThemeColors } from '@/types/theme';

interface Props {
    visible: boolean;
    candidateName: string;
    programmeName: string;
    isUnlocking: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    colors: ThemeColors;
}

/**
 * Confirmation bottom sheet shown before manually unlocking a locked programme
 * for a candidate. Only PA, Manager, and Director roles trigger this.
 *
 * Overlay appears instantly (animationType="none"); only the sheet springs in.
 * Tap outside the sheet to dismiss.
 */
function UnlockConfirmSheet({
    visible,
    candidateName,
    programmeName,
    isUnlocking,
    onConfirm,
    onCancel,
    colors,
}: Props) {
    const translateY = useSharedValue(400);

    useEffect(() => {
        translateY.value = visible
            ? withSpring(0, { damping: 22, stiffness: 220 })
            : withSpring(400, { damping: 22, stiffness: 220 });
    }, [visible, translateY]);

    const sheetStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));
    const paddingBottom = useBottomSheetSafeBottom(40);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={onCancel}
            statusBarTranslucent={MODAL_STATUS_BAR_TRANSLUCENT}
            testID="unlock-confirm-modal"
        >
            {/* Overlay — instant, no animation */}
            <Touchable style={styles.overlay} onPress={onCancel} activeOpacity={1}>
                <View style={StyleSheet.absoluteFill} />
            </Touchable>

            {/* Sheet — springs up, isolated from overlay tap */}
            <Animated.View
                style={[styles.sheet, { backgroundColor: colors.cardBackground, paddingBottom }, sheetStyle]}
            >
                <View style={[styles.handle, { backgroundColor: colors.border }]} />

                <View style={[styles.iconWrap, { backgroundColor: colors.accentLight }]}>
                    <Ionicons name="lock-open-outline" size={28} color={colors.accent} />
                </View>

                <Text style={[styles.title, { color: colors.textPrimary }]}>Unlock {programmeName}?</Text>

                <Text style={[styles.body, { color: colors.textSecondary }]}>
                    You are about to manually unlock{' '}
                    <Text style={{ fontWeight: '600', color: colors.textPrimary }}>{programmeName}</Text> for{' '}
                    <Text style={{ fontWeight: '600', color: colors.textPrimary }}>{candidateName}</Text>. This bypasses
                    the normal prerequisite requirements.
                </Text>

                <View style={[styles.infoRow, { backgroundColor: colors.surfacePrimary }]}>
                    <Ionicons name="information-circle-outline" size={16} color={colors.textTertiary} />
                    <Text style={[styles.infoText, { color: colors.textTertiary }]}>
                        The candidate will gain access to all {programmeName} modules immediately.
                    </Text>
                </View>

                <Touchable
                    onPress={onConfirm}
                    disabled={isUnlocking}
                    activeOpacity={0.85}
                    style={[styles.confirmBtn, { backgroundColor: colors.accent, opacity: isUnlocking ? 0.5 : 1 }]}
                    testID="unlock-confirm-btn"
                >
                    {isUnlocking ? (
                        <ActivityIndicator size="small" color={colors.textInverse} />
                    ) : (
                        <>
                            <Ionicons name="lock-open-outline" size={18} color={colors.textInverse} />
                            <Text style={[styles.confirmBtnText, { color: colors.textInverse }]}>Confirm Unlock</Text>
                        </>
                    )}
                </Touchable>

                <Touchable
                    onPress={onCancel}
                    disabled={isUnlocking}
                    activeOpacity={0.7}
                    style={styles.cancelRow}
                    testID="unlock-cancel-btn"
                >
                    <Text style={[styles.cancelText, { color: colors.textTertiary }]}>Cancel</Text>
                </Touchable>
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    sheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        paddingBottom: 40,
        alignItems: 'center',
        gap: 12,
    },
    handle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        marginBottom: 4,
    },
    iconWrap: {
        width: 56,
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 18,
        fontWeight: displayWeight('700'),
        letterSpacing: letterSpacing(-0.3),
        textAlign: 'center',
    },
    body: {
        fontSize: 14,
        lineHeight: 20,
        textAlign: 'center',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        borderRadius: 10,
        padding: 12,
        width: '100%',
    },
    infoText: {
        flex: 1,
        fontSize: 13,
        lineHeight: 18,
    },
    confirmBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 12,
        width: '100%',
        marginTop: 4,
        minHeight: 50,
    },
    confirmBtnText: {
        fontSize: 15,
        fontWeight: '600',
    },
    cancelRow: {
        paddingVertical: 4,
    },
    cancelText: {
        fontSize: 14,
    },
});

export default UnlockConfirmSheet;
