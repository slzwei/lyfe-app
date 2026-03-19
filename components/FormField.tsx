import type { ThemeColors } from '@/types/theme';
import type { IconName } from '@/types/ui';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Platform, StyleSheet, Text, TextInput, View, type ViewStyle } from 'react-native';

interface FormFieldProps {
    label: string;
    value: string;
    onChangeText: (v: string) => void;
    placeholder: string;
    error?: string;
    colors: ThemeColors;
    icon?: IconName;
    required?: boolean;
    keyboardType?: 'default' | 'phone-pad' | 'email-address';
    autoCapitalize?: 'none' | 'sentences' | 'words';
    containerStyle?: ViewStyle;
}

export default function FormField({
    label,
    value,
    onChangeText,
    placeholder,
    error,
    colors,
    icon,
    required,
    keyboardType,
    autoCapitalize,
    containerStyle,
}: FormFieldProps) {
    return (
        <View style={[styles.container, containerStyle]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
                {label}
                {required && <Text style={{ color: colors.danger }}> *</Text>}
            </Text>
            {icon ? (
                <View
                    style={[
                        styles.inputRow,
                        {
                            backgroundColor: colors.surfacePrimary,
                            borderColor: error ? colors.danger : colors.borderLight,
                        },
                    ]}
                >
                    <Ionicons name={icon} size={18} color={error ? colors.danger : colors.textTertiary} />
                    <TextInput
                        style={[styles.inputWithIcon, { color: colors.textPrimary }]}
                        value={value}
                        onChangeText={onChangeText}
                        placeholder={placeholder}
                        placeholderTextColor={colors.textTertiary}
                        keyboardType={keyboardType}
                        autoCapitalize={autoCapitalize}
                        accessibilityLabel={label}
                    />
                </View>
            ) : (
                <TextInput
                    style={[styles.input, { color: colors.textPrimary }]}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textTertiary}
                    keyboardType={keyboardType}
                    autoCapitalize={autoCapitalize}
                    accessibilityLabel={label}
                />
            )}
            {error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { marginBottom: 14 },
    label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderRadius: 10,
        borderWidth: 0.5,
        paddingHorizontal: 14,
        minHeight: 48,
    },
    inputWithIcon: { flex: 1, fontSize: 15, padding: 0 },
    input: { fontSize: 16, ...(Platform.OS === 'android' && { minHeight: 48, paddingHorizontal: 14 }) },
    error: { fontSize: 12, marginTop: 4, fontWeight: '500' },
});
