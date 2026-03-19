import { letterSpacing } from '@/constants/platform';
import { biometricMeta, type BiometryType } from '@/lib/biometrics';
import type { ThemeColors } from '@/types/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
    visible: boolean;
    biometryType: BiometryType;
    isEnabling: boolean;
    colors: ThemeColors;
    onEnable: () => void;
    onDismiss: () => void;
}

function BiometricsPrompt({ visible, biometryType, isEnabling, colors, onEnable, onDismiss }: Props) {
    const meta = biometricMeta(biometryType);

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss} accessibilityViewIsModal>
            <View style={styles.overlay}>
                <View style={[styles.sheet, { backgroundColor: colors.cardBackground }]}>
                    <View style={[styles.iconCircle, { backgroundColor: colors.accentLight }]}>
                        <Ionicons name={meta.icon} size={40} color={colors.accent} />
                    </View>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>Sign in with {meta.label}</Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        Skip the OTP next time — use {meta.label} to sign in instantly.
                    </Text>
                    <TouchableOpacity
                        testID="biometrics-prompt-enable"
                        style={[styles.enableBtn, { backgroundColor: colors.accent }]}
                        onPress={onEnable}
                        disabled={isEnabling}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel={`Enable ${meta.label}`}
                    >
                        <Ionicons name={meta.icon} size={20} color={colors.textInverse} />
                        <Text style={[styles.enableBtnText, { color: colors.textInverse }]}>Enable {meta.label}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        testID="biometrics-prompt-dismiss"
                        style={styles.dismissBtn}
                        onPress={onDismiss}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel="Not now"
                    >
                        <Text style={[styles.dismissText, { color: colors.textTertiary }]}>Not Now</Text>
                    </TouchableOpacity>
                </View>
            </View>
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
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 32,
        paddingBottom: 48,
        alignItems: 'center',
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 10,
        textAlign: 'center',
        letterSpacing: letterSpacing(-0.3),
    },
    subtitle: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 28,
    },
    enableBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        width: '100%',
        height: 52,
        borderRadius: 14,
        marginBottom: 12,
    },
    enableBtnText: {
        fontSize: 16,
        fontWeight: '600',
    },
    dismissBtn: {
        padding: 12,
    },
    dismissText: {
        fontSize: 15,
        fontWeight: '500',
    },
});

export default React.memo(BiometricsPrompt);
