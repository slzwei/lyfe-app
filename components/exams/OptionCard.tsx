import MathRenderer from '@/components/MathRenderer';
import type { ThemeColors } from '@/types/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
    option: string;
    optionText: string;
    isSelected: boolean;
    isMultiSelect: boolean;
    colors: ThemeColors;
    onPress: () => void;
}

function OptionCard({ option, optionText, isSelected, isMultiSelect, colors, onPress }: Props) {
    const hasLatexContent = optionText.includes('$') || optionText.includes('\\');

    return (
        <TouchableOpacity
            style={[
                styles.optionCard,
                {
                    backgroundColor: isSelected ? colors.accentLight : colors.cardBackground,
                    borderColor: isSelected ? colors.accent : colors.cardBorder,
                    borderWidth: isSelected ? 1.5 : 0.5,
                },
            ]}
            onPress={onPress}
            activeOpacity={0.7}
            accessibilityRole={isMultiSelect ? 'checkbox' : 'radio'}
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`Option ${option}: ${optionText}`}
        >
            <View
                style={[
                    styles.optionLetter,
                    isMultiSelect
                        ? {
                              backgroundColor: isSelected ? colors.accent : 'transparent',
                              borderColor: isSelected ? colors.accent : colors.border,
                              borderRadius: 6,
                              borderWidth: 1.5,
                          }
                        : {
                              backgroundColor: isSelected ? colors.accent : colors.surfacePrimary,
                              borderColor: isSelected ? colors.accent : colors.border,
                              borderRadius: 8,
                          },
                ]}
            >
                {isMultiSelect ? (
                    isSelected ? (
                        <Ionicons name="checkmark" size={16} color={colors.textInverse} />
                    ) : null
                ) : (
                    <Text
                        style={[
                            styles.optionLetterText,
                            { color: isSelected ? colors.textInverse : colors.textSecondary },
                        ]}
                    >
                        {option}
                    </Text>
                )}
            </View>
            <View style={styles.optionContent}>
                {hasLatexContent ? (
                    <MathRenderer content={optionText} fontSize={15} />
                ) : (
                    <Text style={[styles.optionText, { color: colors.textPrimary }]}>{optionText}</Text>
                )}
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    optionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderRadius: 12,
        padding: 14,
        marginBottom: 8,
    },
    optionLetter: {
        width: 32,
        height: 32,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    optionLetterText: { fontSize: 14, fontWeight: '700' },
    optionContent: { flex: 1 },
    optionText: { fontSize: 15, lineHeight: 22 },
});

export default React.memo(OptionCard);
