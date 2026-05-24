import { KAV_BEHAVIOR } from '@/constants/platform';
import React, { useEffect, useRef } from 'react';
import {
    Animated,
    KeyboardAvoidingView,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useBottomSheetSafeBottom } from '@/hooks/useBottomSheetSafeBottom';
import type { ThemeColors } from '@/types/theme';

interface EditProfileSheetProps {
    visible: boolean;
    colors: ThemeColors;
    name: string;
    email: string;
    saving: boolean;
    error: string | null;
    onNameChange: (v: string) => void;
    onEmailChange: (v: string) => void;
    onSave: () => void;
    onClose: () => void;
}

export default function EditProfileSheet({
    visible,
    colors,
    name,
    email,
    saving,
    error,
    onNameChange,
    onEmailChange,
    onSave,
    onClose,
}: EditProfileSheetProps) {
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
            <KeyboardAvoidingView behavior={KAV_BEHAVIOR} style={{ flex: 1 }}>
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
                        <Text style={[styles.title, { color: colors.textPrimary }]}>Edit Profile</Text>

                        <Text style={[styles.label, { color: colors.textTertiary }]}>FULL NAME</Text>
                        <View
                            style={[
                                styles.inputWrap,
                                { backgroundColor: colors.inputBackground, borderColor: colors.border },
                            ]}
                        >
                            <TextInput
                                testID="edit-profile-name"
                                style={[styles.input, { color: colors.textPrimary }]}
                                value={name}
                                onChangeText={onNameChange}
                                placeholder="Your full name"
                                placeholderTextColor={colors.textTertiary}
                                returnKeyType="next"
                                autoCapitalize="words"
                            />
                        </View>

                        <Text style={[styles.label, { color: colors.textTertiary, marginTop: 16 }]}>
                            EMAIL (OPTIONAL)
                        </Text>
                        <View
                            style={[
                                styles.inputWrap,
                                { backgroundColor: colors.inputBackground, borderColor: colors.border },
                            ]}
                        >
                            <TextInput
                                testID="edit-profile-email"
                                style={[styles.input, { color: colors.textPrimary }]}
                                value={email}
                                onChangeText={onEmailChange}
                                placeholder="your@email.com"
                                placeholderTextColor={colors.textTertiary}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                returnKeyType="done"
                                onSubmitEditing={onSave}
                            />
                        </View>

                        {error && <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>}

                        <TouchableOpacity
                            testID="edit-profile-save"
                            style={[styles.saveBtn, { backgroundColor: colors.accent, opacity: saving ? 0.5 : 1 }]}
                            onPress={onSave}
                            disabled={saving}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.saveBtnText, { color: colors.textInverse }]}>
                                {saving ? 'Saving\u2026' : 'Save Changes'}
                            </Text>
                        </TouchableOpacity>
                    </Animated.View>
                </TouchableOpacity>
            </KeyboardAvoidingView>
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
    label: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.6,
        marginBottom: 6,
        paddingHorizontal: 4,
    },
    inputWrap: {
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    input: {
        fontSize: 16,
        padding: 0,
    },
    errorText: {
        fontSize: 13,
        marginTop: 8,
        paddingHorizontal: 4,
    },
    saveBtn: {
        marginTop: 24,
        paddingVertical: 15,
        borderRadius: 14,
        alignItems: 'center',
    },
    saveBtnText: {
        fontSize: 16,
        fontWeight: '600',
    },
});
