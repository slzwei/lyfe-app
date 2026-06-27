/**
 * Leads-scoped bottom sheet (mktr-leads UI/UX · Option B), built on lyfe's
 * existing Modal + `useSheetAnimation` slide pattern (no new native dep). The
 * reusable foundation for the Log / Follow-up / Key-facts / Actions sheets.
 */
import React from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSheetAnimation } from '@/hooks/useSheetAnimation';
import { useBottomSheetSafeBottom } from '@/hooks/useBottomSheetSafeBottom';
import { Txt } from './Txt';
import { useLeadsTheme, alpha, radius, spacing } from '@/lib/leads/theme';
import type { IconName } from '@/types/ui';

export function Sheet({
    visible,
    onClose,
    children,
}: {
    visible: boolean;
    onClose: () => void;
    children: React.ReactNode;
}) {
    const { colors } = useLeadsTheme();
    const sheetY = useSharedValue(Dimensions.get('window').height);
    const modalVisible = useSheetAnimation(visible, sheetY);
    const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: sheetY.value }] }));
    const paddingBottom = useBottomSheetSafeBottom(spacing.xl);

    return (
        <Modal visible={modalVisible} transparent animationType="none" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <Pressable
                    style={StyleSheet.absoluteFill}
                    onPress={onClose}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                />
                <Animated.View
                    style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom }, animatedStyle]}
                >
                    <View style={[styles.handle, { backgroundColor: colors.border }]} />
                    {children}
                </Animated.View>
            </View>
        </Modal>
    );
}

/** Sheet title row: tinted icon + title + close. */
export function SheetHeader({ icon, title, onClose }: { icon: IconName; title: string; onClose: () => void }) {
    const { colors } = useLeadsTheme();
    return (
        <View style={styles.header}>
            <View style={[styles.headerIcon, { backgroundColor: alpha(colors.accent, 0.14) }]}>
                <Ionicons name={icon} size={18} color={colors.accent} />
            </View>
            <Txt role="display" weight="semibold" size={18} color={colors.text} tracking={-0.2} style={{ flex: 1 }}>
                {title}
            </Txt>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
                <Ionicons name="close" size={22} color={colors.textFaint} />
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheet: {
        borderTopLeftRadius: radius.hero,
        borderTopRightRadius: radius.hero,
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.md,
    },
    handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 99, marginBottom: spacing.lg },
    header: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: spacing.lg },
    headerIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
