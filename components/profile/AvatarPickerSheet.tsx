import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useBottomSheetSafeBottom } from '@/hooks/useBottomSheetSafeBottom';
import type { ThemeColors } from '@/types/theme';

export type AvatarAction = 'camera' | 'library' | 'remove';

interface AvatarPickerSheetProps {
    visible: boolean;
    colors: ThemeColors;
    hasAvatar: boolean;
    onAction: (action: AvatarAction) => void;
    onClose: () => void;
}

export default function AvatarPickerSheet({ visible, colors, hasAvatar, onAction, onClose }: AvatarPickerSheetProps) {
    const sheetY = useRef(new Animated.Value(400)).current;
    const paddingBottom = useBottomSheetSafeBottom(40);

    useEffect(() => {
        if (visible) {
            sheetY.setValue(400);
            Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }).start();
        }
    }, [visible]);

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} accessibilityViewIsModal>
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
                <Animated.View
                    style={[
                        styles.sheet,
                        {
                            backgroundColor: colors.cardBackground,
                            transform: [{ translateY: sheetY }],
                            paddingBottom,
                        },
                    ]}
                >
                    <View style={[styles.handle, { backgroundColor: colors.divider }]} />
                    <Text style={[styles.title, { color: colors.textPrimary }]}>Profile Photo</Text>

                    <TouchableOpacity style={styles.row} onPress={() => onAction('camera')} activeOpacity={0.7}>
                        <View style={[styles.iconCircle, { backgroundColor: colors.accentLight }]}>
                            <Ionicons name="camera-outline" size={20} color={colors.accent} />
                        </View>
                        <Text style={[styles.rowText, { color: colors.textPrimary }]}>Take Photo</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.row} onPress={() => onAction('library')} activeOpacity={0.7}>
                        <View style={[styles.iconCircle, { backgroundColor: colors.accentLight }]}>
                            <Ionicons name="image-outline" size={20} color={colors.accent} />
                        </View>
                        <Text style={[styles.rowText, { color: colors.textPrimary }]}>Choose from Library</Text>
                    </TouchableOpacity>

                    {hasAvatar && (
                        <TouchableOpacity style={styles.row} onPress={() => onAction('remove')} activeOpacity={0.7}>
                            <View style={[styles.iconCircle, { backgroundColor: colors.dangerLight }]}>
                                <Ionicons name="trash-outline" size={20} color={colors.danger} />
                            </View>
                            <Text style={[styles.rowText, { color: colors.danger }]}>Remove Photo</Text>
                        </TouchableOpacity>
                    )}
                </Animated.View>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    sheet: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 40,
        gap: 4,
    },
    handle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 16,
        opacity: 0.5,
    },
    title: {
        fontSize: 17,
        fontWeight: '700',
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 12,
        paddingHorizontal: 4,
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowText: {
        fontSize: 16,
        fontWeight: '500',
    },
});
