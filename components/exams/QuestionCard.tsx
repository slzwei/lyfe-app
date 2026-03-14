import MathRenderer from '@/components/MathRenderer';
import type { ExamQuestion } from '@/types/exam';
import type { ThemeColors } from '@/types/theme';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
    question: ExamQuestion;
    isMultiSelect: boolean;
    quizType: 'standard' | 'vark' | 'enneagram';
    colors: ThemeColors;
}

function QuestionCard({ question, isMultiSelect, quizType, colors }: Props) {
    return (
        <View style={[styles.questionCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
            <Text style={[styles.questionLabel, { color: colors.textTertiary }]}>
                Question {question.question_number}
            </Text>
            {question.has_latex ? (
                <MathRenderer content={question.question_text} fontSize={16} />
            ) : (
                <Text style={[styles.questionText, { color: colors.textPrimary }]}>{question.question_text}</Text>
            )}
            {isMultiSelect && (
                <Text style={[styles.multiSelectHint, { color: colors.textTertiary }]}>Select all that apply</Text>
            )}
            {quizType === 'enneagram' && (
                <Text style={[styles.multiSelectHint, { color: colors.textTertiary }]}>Choose one</Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    questionCard: {
        borderRadius: 12,
        borderWidth: 0.5,
        padding: 16,
        marginBottom: 16,
    },
    questionLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 8 },
    questionText: { fontSize: 16, lineHeight: 24, fontWeight: '500' },
    multiSelectHint: { fontSize: 12, fontWeight: '500', fontStyle: 'italic', marginTop: 8 },
});

export default React.memo(QuestionCard);
