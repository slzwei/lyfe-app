import MathRenderer from '@/components/MathRenderer';
import { useTheme } from '@/contexts/ThemeContext';
import type { ExamQuestion } from '@/types/exam';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

interface ExamResult {
    id: string;
    score: number;
    totalQuestions: number;
    percentage: number;
    passed: boolean;
    status: string;
    answers: {
        questionId: string;
        selected: string | null;
        isCorrect: boolean;
        correctAnswer: string;
    }[];
    questions: ExamQuestion[];
    paperCode: string;
}

export default function ExamResultsScreen() {
    const { attemptId } = useLocalSearchParams<{ attemptId: string }>();
    const { colors } = useTheme();
    const router = useRouter();

    const [result, setResult] = useState<ExamResult | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);

    useEffect(() => {
        const loadResult = async () => {
            try {
                const stored = await AsyncStorage.getItem(`exam_result_${attemptId}`);
                if (stored) {
                    setResult(JSON.parse(stored));
                }
            } catch { } finally {
                setIsLoading(false);
            }
        };
        loadResult();
    }, [attemptId]);

    const handleRetake = () => {
        if (!result) return;
        // Navigate back to the exam list
        router.replace('/exams');
    };

    const handleDone = () => {
        router.replace('/exams');
    };

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.accent} />
                </View>
            </SafeAreaView>
        );
    }

    if (!result) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.loadingContainer}>
                    <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
                    <Text style={[styles.errorText, { color: colors.textSecondary }]}>Result not found</Text>
                    <TouchableOpacity onPress={handleDone} style={[styles.doneButton, { backgroundColor: colors.accent }]}>
                        <Text style={styles.doneButtonText}>Back to Exams</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={handleDone} style={styles.backBtn}>
                        <Ionicons name="close" size={24} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                        {result.paperCode} Results
                    </Text>
                    <View style={{ width: 32 }} />
                </View>

                {/* Score Card */}
                <View
                    style={[
                        styles.scoreCard,
                        {
                            backgroundColor: result.passed ? colors.successLight : colors.dangerLight,
                            borderColor: result.passed ? colors.success : colors.danger,
                        },
                    ]}
                >
                    <View style={styles.scoreCircle}>
                        <Text style={[styles.scorePercentage, { color: result.passed ? colors.success : colors.danger }]}>
                            {result.percentage}%
                        </Text>
                        <Text style={[styles.scoreLabel, { color: result.passed ? colors.success : colors.danger }]}>
                            {result.score}/{result.totalQuestions}
                        </Text>
                    </View>
                    <View
                        style={[
                            styles.resultBadge,
                            { backgroundColor: result.passed ? colors.success : colors.danger },
                        ]}
                    >
                        <Ionicons
                            name={result.passed ? 'checkmark-circle' : 'close-circle'}
                            size={18}
                            color="#FFFFFF"
                        />
                        <Text style={styles.resultBadgeText}>
                            {result.passed ? 'PASSED' : 'FAILED'}
                        </Text>
                    </View>
                    {result.status === 'auto_submitted' && (
                        <Text style={[styles.autoSubmitNote, { color: colors.textSecondary }]}>
                            Auto-submitted (time expired)
                        </Text>
                    )}
                </View>

                {/* Stats Row */}
                <View style={styles.statsRow}>
                    <View style={[styles.statCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                        <Text style={[styles.statValue, { color: colors.success }]}>{result.score}</Text>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Correct</Text>
                    </View>
                    <View style={[styles.statCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                        <Text style={[styles.statValue, { color: colors.danger }]}>{result.totalQuestions - result.score}</Text>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Wrong</Text>
                    </View>
                    <View style={[styles.statCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                        <Text style={[styles.statValue, { color: colors.textPrimary }]}>{result.totalQuestions}</Text>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total</Text>
                    </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionRow}>
                    <TouchableOpacity
                        style={[styles.retakeButton, { backgroundColor: colors.accent }]}
                        onPress={handleRetake}
                    >
                        <Ionicons name="refresh" size={18} color="#FFFFFF" />
                        <Text style={styles.retakeButtonText}>Retake Exam</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.doneOutlineButton, { borderColor: colors.border }]}
                        onPress={handleDone}
                    >
                        <Text style={[styles.doneOutlineText, { color: colors.textPrimary }]}>Done</Text>
                    </TouchableOpacity>
                </View>

                {/* Question Review */}
                <View style={styles.reviewSection}>
                    <Text style={[styles.reviewTitle, { color: colors.textPrimary }]}>Question Review</Text>

                    {result.questions.map((q, idx) => {
                        const answer = result.answers[idx];
                        const isExpanded = expandedQuestion === q.id;

                        return (
                            <TouchableOpacity
                                key={q.id}
                                style={[
                                    styles.reviewCard,
                                    {
                                        backgroundColor: colors.cardBackground,
                                        borderColor: answer.isCorrect ? colors.success : colors.danger,
                                        borderLeftWidth: 3,
                                    },
                                ]}
                                onPress={() => setExpandedQuestion(isExpanded ? null : q.id)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.reviewHeader}>
                                    <View style={styles.reviewLeft}>
                                        <Ionicons
                                            name={answer.isCorrect ? 'checkmark-circle' : 'close-circle'}
                                            size={20}
                                            color={answer.isCorrect ? colors.success : colors.danger}
                                        />
                                        <Text style={[styles.reviewNumber, { color: colors.textSecondary }]}>
                                            Q{q.question_number}
                                        </Text>
                                    </View>
                                    <View style={styles.reviewRight}>
                                        {answer.selected ? (
                                            <Text style={[styles.reviewAnswer, { color: answer.isCorrect ? colors.success : colors.danger }]}>
                                                {answer.selected} {!answer.isCorrect && `→ ${answer.correctAnswer}`}
                                            </Text>
                                        ) : (
                                            <Text style={[styles.reviewAnswer, { color: colors.textTertiary }]}>
                                                Skipped → {answer.correctAnswer}
                                            </Text>
                                        )}
                                        <Ionicons
                                            name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                            size={16}
                                            color={colors.textTertiary}
                                        />
                                    </View>
                                </View>

                                {isExpanded && (
                                    <View style={[styles.reviewExpanded, { borderTopColor: colors.borderLight }]}>
                                        {q.has_latex ? (
                                            <MathRenderer content={q.question_text} fontSize={14} />
                                        ) : (
                                            <Text style={[styles.reviewQuestionText, { color: colors.textPrimary }]}>
                                                {q.question_text}
                                            </Text>
                                        )}

                                        {/* Show all options with correct/selected highlighting */}
                                        {['A', 'B', 'C', 'D'].map((opt) => {
                                            const optText = q.options[opt];
                                            if (!optText) return null;
                                            const isCorrectOpt = opt === answer.correctAnswer;
                                            const isSelectedOpt = opt === answer.selected;
                                            const isWrongSelection = isSelectedOpt && !answer.isCorrect;

                                            return (
                                                <View
                                                    key={opt}
                                                    style={[
                                                        styles.reviewOption,
                                                        isCorrectOpt && { backgroundColor: colors.successLight },
                                                        isWrongSelection && { backgroundColor: colors.dangerLight },
                                                    ]}
                                                >
                                                    <Text style={[styles.reviewOptionLetter, { color: colors.textSecondary }]}>
                                                        {opt}.
                                                    </Text>
                                                    <Text
                                                        style={[
                                                            styles.reviewOptionText,
                                                            { color: colors.textPrimary },
                                                            isCorrectOpt && { fontWeight: '700', color: colors.success },
                                                            isWrongSelection && { color: colors.danger },
                                                        ]}
                                                    >
                                                        {optText}
                                                    </Text>
                                                    {isCorrectOpt && (
                                                        <Ionicons name="checkmark" size={16} color={colors.success} />
                                                    )}
                                                </View>
                                            );
                                        })}

                                        {q.explanation && (
                                            <View style={[styles.explanationBox, { backgroundColor: colors.infoLight }]}>
                                                <Ionicons name="bulb-outline" size={16} color={colors.info} />
                                                {q.explanation_has_latex ? (
                                                    <View style={{ flex: 1 }}>
                                                        <MathRenderer content={q.explanation} fontSize={13} />
                                                    </View>
                                                ) : (
                                                    <Text style={[styles.explanationText, { color: colors.textPrimary }]}>
                                                        {q.explanation}
                                                    </Text>
                                                )}
                                            </View>
                                        )}
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
    errorText: { fontSize: 15 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    backBtn: {
        padding: 8,
        minWidth: 44,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: { fontSize: 18, fontWeight: '700' },
    scrollContent: {
        padding: 16,
        paddingBottom: 48,
    },
    scoreCard: {
        alignItems: 'center',
        borderRadius: 16,
        borderWidth: 1,
        padding: 32,
        marginBottom: 16,
    },
    scoreCircle: {
        alignItems: 'center',
        marginBottom: 16,
    },
    scorePercentage: { fontSize: 56, fontWeight: '800', letterSpacing: -2 },
    scoreLabel: { fontSize: 16, fontWeight: '600', marginTop: -4 },
    resultBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
    },
    resultBadgeText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', letterSpacing: 1 },
    autoSubmitNote: { fontSize: 12, marginTop: 8 },
    statsRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    statCard: {
        flex: 1,
        alignItems: 'center',
        borderRadius: 12,
        borderWidth: 0.5,
        paddingVertical: 14,
    },
    statValue: { fontSize: 24, fontWeight: '800' },
    statLabel: { fontSize: 11, fontWeight: '500', marginTop: 2 },
    actionRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 24,
    },
    retakeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 14,
        borderRadius: 12,
    },
    retakeButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
    doneButton: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 10,
    },
    doneButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
    doneOutlineButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
    },
    doneOutlineText: { fontSize: 15, fontWeight: '600' },
    reviewSection: { marginTop: 8 },
    reviewTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
    reviewCard: {
        borderRadius: 10,
        marginBottom: 8,
        overflow: 'hidden',
    },
    reviewHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 14,
    },
    reviewLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    reviewNumber: { fontSize: 13, fontWeight: '600' },
    reviewRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    reviewAnswer: { fontSize: 13, fontWeight: '600' },
    reviewExpanded: {
        padding: 14,
        paddingTop: 12,
        borderTopWidth: 0.5,
    },
    reviewQuestionText: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
    reviewOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 6,
        paddingHorizontal: 8,
        borderRadius: 6,
        marginBottom: 4,
    },
    reviewOptionLetter: { fontSize: 13, fontWeight: '600', width: 20 },
    reviewOptionText: { fontSize: 13, flex: 1, lineHeight: 18 },
    explanationBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        marginTop: 12,
        padding: 12,
        borderRadius: 8,
    },
    explanationText: { flex: 1, fontSize: 13, lineHeight: 19 },
});
