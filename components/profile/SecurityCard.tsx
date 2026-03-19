import { biometricMeta, type BiometryType } from '@/lib/biometrics';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import type { ThemeColors } from '@/types/theme';

interface SecurityCardProps {
    colors: ThemeColors;
    biometryType: BiometryType;
    enabled: boolean;
    onToggle: (value: boolean) => void;
    testID?: string;
}

export default function SecurityCard({ colors, biometryType, enabled, onToggle, testID }: SecurityCardProps) {
    const meta = biometricMeta(biometryType);

    return (
        <View
            testID={testID}
            style={[styles.card, { backgroundColor: colors.cardBackground, shadowColor: colors.textPrimary }]}
        >
            <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>SECURITY</Text>
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
        </View>
    );
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
});
