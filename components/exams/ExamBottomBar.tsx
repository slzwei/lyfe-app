import type { ThemeColors } from '@/types/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
    currentIndex: number;
    totalQuestions: number;
    isSubmitting: boolean;
    allAnswered: boolean;
    isPersonalityQuiz: boolean;
    colors: ThemeColors;
    onPrev: () => void;
    onNext: () => void;
    onGridToggle: () => void;
    onSubmit: () => void;
}

function ExamBottomBar({
    currentIndex,
    totalQuestions,
    isSubmitting,
    allAnswered,
    isPersonalityQuiz,
    colors,
    onPrev,
    onNext,
    onGridToggle,
    onSubmit,
}: Props) {
    const isLastQuestion = currentIndex === totalQuestions - 1;

    return (
        <View
            style={[styles.bottomBar, { backgroundColor: colors.cardBackground, borderTopColor: colors.borderLight }]}
        >
            <TouchableOpacity
                style={[styles.navButton, { opacity: currentIndex === 0 ? 0.3 : 1 }]}
                onPress={onPrev}
                disabled={currentIndex === 0}
            >
                <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
                <Text style={[styles.navButtonText, { color: colors.textPrimary }]}>Prev</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.gridButton, { backgroundColor: colors.surfacePrimary }]}
                onPress={onGridToggle}
            >
                <Ionicons name="grid-outline" size={18} color={colors.textSecondary} />
            </TouchableOpacity>

            {isLastQuestion ? (
                <TouchableOpacity
                    style={[
                        styles.submitButton,
                        { backgroundColor: colors.accent, opacity: isSubmitting ? 0.6 : 1 },
                    ]}
                    onPress={onSubmit}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? (
                        <ActivityIndicator size="small" color={colors.textInverse} />
                    ) : (
                        <>
                            <Text style={[styles.submitButtonText, { color: colors.textInverse }]}>Submit</Text>
                            <Ionicons name="checkmark-circle" size={18} color={colors.textInverse} />
                        </>
                    )}
                </TouchableOpacity>
            ) : (
                <View style={styles.navRight}>
                    {allAnswered && isPersonalityQuiz && (
                        <TouchableOpacity
                            style={[
                                styles.submitButton,
                                { backgroundColor: colors.accent, opacity: isSubmitting ? 0.6 : 1 },
                            ]}
                            onPress={onSubmit}
                            disabled={isSubmitting}
                        >
                            <Text style={[styles.submitButtonText, { color: colors.textInverse }]}>Submit</Text>
                            <Ionicons name="checkmark-circle" size={18} color={colors.textInverse} />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.navButton} onPress={onNext}>
                        <Text style={[styles.navButtonText, { color: colors.textPrimary }]}>Next</Text>
                        <Ionicons name="chevron-forward" size={20} color={colors.textPrimary} />
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    bottomBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 0.5,
    },
    navButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 10,
        paddingHorizontal: 12,
        minHeight: 44,
    },
    navRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    navButtonText: { fontSize: 14, fontWeight: '600' },
    gridButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
    },
    submitButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
    },
    submitButtonText: { fontSize: 14, fontWeight: '700' },
});

export default React.memo(ExamBottomBar);
