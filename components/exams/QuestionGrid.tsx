import type { ExamQuestion } from '@/types/exam';
import type { ThemeColors } from '@/types/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
    questions: ExamQuestion[];
    answers: Record<string, string>;
    currentIndex: number;
    colors: ThemeColors;
    onSelectQuestion: (index: number) => void;
    onClose: () => void;
}

/**
 * Check if a question is answered. For multi-select, an empty string
 * after all deselections means "not answered".
 */
function isQuestionAnswered(answers: Record<string, string>, questionId: string): boolean {
    const val = answers[questionId];
    return val != null && val.length > 0;
}

function QuestionGrid({ questions, answers, currentIndex, colors, onSelectQuestion, onClose }: Props) {
    return (
        <View style={[styles.gridOverlay, { backgroundColor: colors.background + 'F2' }]}>
            <View
                style={[
                    styles.gridContainer,
                    { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder },
                ]}
            >
                <View style={styles.gridHeader}>
                    <Text style={[styles.gridTitle, { color: colors.textPrimary }]}>Question Navigator</Text>
                    <TouchableOpacity onPress={onClose}>
                        <Ionicons name="close" size={22} color={colors.textPrimary} />
                    </TouchableOpacity>
                </View>
                <ScrollView style={styles.gridScroll} showsVerticalScrollIndicator={false}>
                    <View style={styles.gridItems}>
                        {questions.map((q, idx) => {
                            const isAnswered = isQuestionAnswered(answers, q.id);
                            const isCurrent = idx === currentIndex;
                            return (
                                <TouchableOpacity
                                    key={q.id}
                                    style={[
                                        styles.gridItem,
                                        {
                                            backgroundColor: isCurrent
                                                ? colors.accent
                                                : isAnswered
                                                  ? colors.accentLight
                                                  : colors.surfacePrimary,
                                            borderColor: isCurrent
                                                ? colors.accent
                                                : isAnswered
                                                  ? colors.accent
                                                  : colors.border,
                                        },
                                    ]}
                                    onPress={() => onSelectQuestion(idx)}
                                >
                                    <Text
                                        style={[
                                            styles.gridItemText,
                                            {
                                                color: isCurrent
                                                    ? colors.textInverse
                                                    : isAnswered
                                                      ? colors.accent
                                                      : colors.textTertiary,
                                            },
                                        ]}
                                    >
                                        {idx + 1}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </ScrollView>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    gridOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    gridContainer: {
        width: '100%',
        maxWidth: 400,
        maxHeight: '80%',
        borderRadius: 16,
        borderWidth: 0.5,
        padding: 20,
    },
    gridHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    gridTitle: { fontSize: 16, fontWeight: '700' },
    gridScroll: {
        flexShrink: 1,
    },
    gridItems: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        paddingBottom: 4,
    },
    gridItem: {
        width: 40,
        height: 40,
        borderRadius: 10,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    gridItemText: { fontSize: 14, fontWeight: '600' },
});

export default React.memo(QuestionGrid);
