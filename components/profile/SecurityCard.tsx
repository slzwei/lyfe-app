import { biometricMeta, type BiometryType } from '@/lib/biometrics';
import type { ThemeColors } from '@/types/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

interface SecurityCardProps {
    colors: ThemeColors;
    biometryType: BiometryType;
    enabled: boolean;
    onToggle: (value: boolean) => void;
    /**
     * Optional Lyfe ID row — our face-based check-in feature. Distinct from
     * Apple's Face ID biometric (above), which this same card exposes as the
     * sign-in toggle. Rendered as a second row with a divider above it when
     * `onFaceRegisterPress` is supplied.
     */
    faceRegisteredAt?: string | null;
    onFaceRegisterPress?: () => void;
    testID?: string;
}

export default function SecurityCard({
    colors,
    biometryType,
    enabled,
    onToggle,
    faceRegisteredAt = null,
    onFaceRegisterPress,
    testID,
}: SecurityCardProps) {
    const showBiometric = biometryType !== 'none';
    const showLyfeId = !!onFaceRegisterPress;
    const meta = showBiometric ? biometricMeta(biometryType) : null;
    const isRegistered = !!faceRegisteredAt;

    // Nothing to show — skip the card entirely.
    if (!showBiometric && !showLyfeId) return null;

    return (
        <View
            testID={testID}
            style={[styles.card, { backgroundColor: colors.cardBackground, shadowColor: colors.textPrimary }]}
        >
            <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>SECURITY</Text>

            {showBiometric && meta && (
                <View style={styles.row}>
                    <View style={[styles.iconCircle, { backgroundColor: colors.accentLight }]}>
                        <Ionicons name={meta.icon} size={18} color={colors.accent} />
                    </View>
                    <View style={styles.textCol}>
                        <Text style={[styles.label, { color: colors.textPrimary }]}>{meta.label}</Text>
                        <Text style={[styles.subtitle, { color: colors.textTertiary }]}>Sign in without OTP</Text>
                    </View>
                    <Switch
                        value={enabled}
                        onValueChange={onToggle}
                        trackColor={{ false: colors.border, true: colors.accent }}
                        thumbColor={colors.textInverse}
                        accessibilityLabel={`${meta.label} sign-in`}
                    />
                </View>
            )}

            {showBiometric && showLyfeId && <View style={[styles.divider, { backgroundColor: colors.border }]} />}

            {showLyfeId && (
                <Pressable
                    style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
                    onPress={onFaceRegisterPress}
                    accessibilityRole="button"
                    accessibilityLabel={isRegistered ? 'Re-register your Lyfe ID' : 'Set up your Lyfe ID'}
                    accessibilityHint="Opens the Lyfe ID registration camera"
                >
                    <View style={[styles.iconCircle, { backgroundColor: colors.accentLight }]}>
                        <Ionicons name="scan" size={18} color={colors.accent} />
                    </View>
                    <View style={styles.textCol}>
                        <Text style={[styles.label, { color: colors.textPrimary }]}>Lyfe ID</Text>
                        <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
                            {isRegistered
                                ? `Registered ${formatRegisteredAt(faceRegisteredAt!)}`
                                : 'Not set up — tap to register'}
                        </Text>
                    </View>
                    {isRegistered ? (
                        <View style={[styles.statusPill, { backgroundColor: '#34C75920' }]}>
                            <Ionicons name="checkmark-circle" size={14} color="#34C759" />
                            <Text style={[styles.statusPillText, { color: '#34C759' }]}>Active</Text>
                        </View>
                    ) : (
                        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                    )}
                </Pressable>
            )}
        </View>
    );
}

function formatRegisteredAt(iso: string): string {
    try {
        const d = new Date(iso);
        return d.toLocaleDateString('en-SG', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
        return '';
    }
}

const styles = StyleSheet.create({
    card: {
        marginHorizontal: 16,
        marginBottom: 12,
        borderRadius: 16,
        padding: 16,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 2,
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.8,
        marginBottom: 12,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        gap: 12,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        marginVertical: 4,
    },
    iconCircle: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textCol: {
        flex: 1,
    },
    label: {
        fontSize: 15,
        fontWeight: '500',
    },
    subtitle: {
        fontSize: 12,
        marginTop: 1,
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusPillText: {
        fontSize: 12,
        fontWeight: '600',
    },
});
