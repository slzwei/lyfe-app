import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ThemeColors } from '@/types/theme';

export interface SettingsRowConfig {
    key: string;
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    subtitle?: string;
    danger?: boolean;
}

interface SettingsListCardProps {
    colors: ThemeColors;
    title: string;
    rows: SettingsRowConfig[];
    onPress: (key: string) => void;
    testID?: string;
}

export default function SettingsListCard({ colors, title, rows, onPress, testID }: SettingsListCardProps) {
    return (
        <View
            testID={testID}
            style={[styles.card, { backgroundColor: colors.cardBackground, shadowColor: colors.textPrimary }]}
        >
            <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>{title}</Text>
            {rows.map((row, index) => (
                <React.Fragment key={row.key}>
                    <TouchableOpacity
                        style={styles.settingsRow}
                        onPress={() => onPress(row.key)}
                        activeOpacity={0.6}
                        accessibilityRole="button"
                        accessibilityLabel={row.label}
                    >
                        <View style={[styles.iconCircle, { backgroundColor: colors.accentLight }]}>
                            <Ionicons name={row.icon} size={18} color={colors.accent} />
                        </View>
                        <View style={styles.textCol}>
                            <Text style={[styles.label, { color: colors.textPrimary }]}>{row.label}</Text>
                            {row.subtitle && (
                                <Text style={[styles.subtitle, { color: colors.textTertiary }]}>{row.subtitle}</Text>
                            )}
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                    </TouchableOpacity>
                    {index < rows.length - 1 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                </React.Fragment>
            ))}
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
    settingsRow: {
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
    divider: {
        height: StyleSheet.hairlineWidth,
        marginLeft: 48,
    },
});
