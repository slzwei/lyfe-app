import ConfirmDialog, { type ConfirmDialogButton } from '@/components/ConfirmDialog';
import MathRenderer from '@/components/MathRenderer';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import type { ExamQuestion } from '@/types/exam';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    AppState,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    type AppStateStatus,
} from 'react-native';

const MOCK_OTP = process.env.EXPO_PUBLIC_MOCK_OTP === 'true';

// Mock questions for development
const MOCK_QUESTIONS: ExamQuestion[] = [
    { id: 'q1', paper_id: 'm5', question_number: 1, question_text: 'Under the Insurance Act, what is the minimum paid-up capital requirement for a life insurer in Singapore?', has_latex: false, options: { A: '$5 million', B: '$10 million', C: '$25 million', D: '$50 million' }, correct_answer: 'B', explanation: 'The Insurance Act requires a minimum paid-up capital of $10 million for life insurers operating in Singapore.', explanation_has_latex: false },
    { id: 'q2', paper_id: 'm5', question_number: 2, question_text: 'A policyholder takes out a whole life policy with a sum assured of $S200{,}000$. If the annual premium is $S4{,}800$ and the policy has been in force for 5 years, what is the total premium paid?', has_latex: true, options: { A: '$S20{,}000$', B: '$S24{,}000$', C: '$S28{,}000$', D: '$S30{,}000$' }, correct_answer: 'B', explanation: 'Total premium = Annual premium × Number of years = $S4{,}800 \\times 5 = S24{,}000$.', explanation_has_latex: true },
    { id: 'q3', paper_id: 'm5', question_number: 3, question_text: 'Which of the following is NOT a type of life insurance policy?', has_latex: false, options: { A: 'Term Life Insurance', B: 'Whole Life Insurance', C: 'Universal Life Insurance', D: 'Property Life Insurance' }, correct_answer: 'D', explanation: 'Property Life Insurance does not exist. The three main types are Term, Whole Life, and Universal Life Insurance.', explanation_has_latex: false },
    { id: 'q4', paper_id: 'm5', question_number: 4, question_text: 'If a policyholder has a coverage ratio calculated as $\\frac{\\text{Sum Assured}}{\\text{Annual Income}}$, and earns $S80{,}000$ per year with a sum assured of $S640{,}000$, what is the coverage ratio?', has_latex: true, options: { A: '6 times', B: '8 times', C: '10 times', D: '12 times' }, correct_answer: 'B', explanation: 'Coverage ratio = $\\frac{S640{,}000}{S80{,}000} = 8$ times annual income.', explanation_has_latex: true },
    { id: 'q5', paper_id: 'm5', question_number: 5, question_text: 'What is the free-look period for a new life insurance policy in Singapore?', has_latex: false, options: { A: '7 days', B: '14 days', C: '21 days', D: '30 days' }, correct_answer: 'B', explanation: 'The free-look period in Singapore is 14 days from the date the policyholder receives the policy document.', explanation_has_latex: false },
];

const MOCK_QUESTIONS_M9: ExamQuestion[] = [
    { id: 'q6', paper_id: 'm9', question_number: 1, question_text: 'What is the Net Asset Value (NAV) per unit if a fund has total assets of $S10{,}000{,}000$, total liabilities of $S500{,}000$, and $1{,}900{,}000$ units outstanding?', has_latex: true, options: { A: '$S5.00$', B: '$S5.26$', C: '$S4.50$', D: '$S5.50$' }, correct_answer: 'A', explanation: 'NAV per unit = $\\frac{S10{,}000{,}000 - S500{,}000}{1{,}900{,}000} = S5.00$.', explanation_has_latex: true },
    { id: 'q7', paper_id: 'm9', question_number: 2, question_text: 'Which of the following best describes an Investment-Linked Policy (ILP)?', has_latex: false, options: { A: 'A policy that guarantees a fixed return', B: 'A policy that combines insurance protection with investment in sub-funds', C: 'A policy that only provides death coverage', D: 'A fixed deposit with insurance benefits' }, correct_answer: 'B', explanation: 'An ILP combines insurance protection with investment components, where the policy value depends on the performance of the chosen sub-funds.', explanation_has_latex: false },
    { id: 'q8', paper_id: 'm9', question_number: 3, question_text: 'If the bid-offer spread is $5\\%$ and the offer price of a fund unit is $S2.00$, what is the bid price?', has_latex: true, options: { A: '$S1.80$', B: '$S1.90$', C: '$S1.95$', D: '$S2.10$' }, correct_answer: 'B', explanation: 'Bid price = Offer price × $(1 - \\text{spread})$ = $S2.00 \\times (1 - 0.05) = S1.90$.', explanation_has_latex: true },
];

const MOCK_QUESTIONS_HI: ExamQuestion[] = [
    { id: 'q9', paper_id: 'hi', question_number: 1, question_text: 'What is the maximum claim limit for MediShield Life per policy year?', has_latex: false, options: { A: '$S100,000', B: '$S150,000', C: '$S200,000', D: 'No maximum limit' }, correct_answer: 'A', explanation: 'MediShield Life has a maximum claim limit of $S100,000 per policy year.', explanation_has_latex: false },
    { id: 'q10', paper_id: 'hi', question_number: 2, question_text: 'Which of the following is covered under an Integrated Shield Plan (IP) but NOT under basic MediShield Life?', has_latex: false, options: { A: 'Class B2/C ward hospitalisation', B: 'Private hospital ward charges', C: 'Day surgery at public hospitals', D: 'Basic outpatient treatment' }, correct_answer: 'B', explanation: 'Integrated Shield Plans extend coverage beyond MediShield Life to include private hospital wards.', explanation_has_latex: false },
    { id: 'q11', paper_id: 'hi', question_number: 3, question_text: 'A patient incurs hospital bills of $S25{,}000$. The deductible is $S3{,}500$ and co-insurance is $10\\%$. What is the patient\'s out-of-pocket amount?', has_latex: true, options: { A: '$S3{,}500$', B: '$S5{,}650$', C: '$S5{,}150$', D: '$S6{,}000$' }, correct_answer: 'B', explanation: 'Out-of-pocket = $S3{,}500 + 0.10 \\times (S25{,}000 - S3{,}500) = S3{,}500 + S2{,}150 = S5{,}650$.', explanation_has_latex: true },
];

const ALL_MOCK_QUESTIONS: Record<string, ExamQuestion[]> = {
    m5: MOCK_QUESTIONS,
    m9: MOCK_QUESTIONS_M9,
    hi: MOCK_QUESTIONS_HI,
};

const PAPER_DURATIONS: Record<string, number> = { m5: 60, m9: 60, m9a: 45, hi: 45 };
const PAPER_CODES: Record<string, string> = { m5: 'M5', m9: 'M9', m9a: 'M9A', hi: 'HI' };

function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

const STORAGE_KEY = 'lyfe_active_exam';

export default function TakeExamScreen() {
    const { paperId } = useLocalSearchParams<{ paperId: string }>();
    const { colors, isDark } = useTheme();
    const { user } = useAuth();
    const router = useRouter();

    const [questions, setQuestions] = useState<ExamQuestion[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [timeLeft, setTimeLeft] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showGrid, setShowGrid] = useState(false);
    const [dialogConfig, setDialogConfig] = useState<{
        visible: boolean;
        title: string;
        message: string;
        buttons: ConfirmDialogButton[];
    }>({ visible: false, title: '', message: '', buttons: [] });

    const showDialog = (title: string, message: string, buttons: ConfirmDialogButton[]) => {
        setDialogConfig({ visible: true, title, message, buttons });
    };
    const hideDialog = () => setDialogConfig(prev => ({ ...prev, visible: false }));

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const appStateRef = useRef<AppStateStatus>(AppState.currentState);
    const pausedAtRef = useRef<number | null>(null);
    const startedAtRef = useRef<number>(Date.now());
    const hasRestoredRef = useRef(false);

    // Load questions + restore saved progress
    useEffect(() => {
        const loadQuestions = async () => {
            let questionsData: ExamQuestion[] = [];
            let duration = 60;

            if (MOCK_OTP) {
                questionsData = ALL_MOCK_QUESTIONS[paperId || ''] || [];
                duration = PAPER_DURATIONS[paperId || ''] || 60;
            } else {
                const { data, error } = await supabase
                    .from('exam_questions')
                    .select('*')
                    .eq('paper_id', paperId)
                    .order('question_number');

                if (error) {
                    router.back();
                    return;
                }
                questionsData = data as ExamQuestion[];

                const { data: paper } = await supabase
                    .from('exam_papers')
                    .select('duration_minutes')
                    .eq('id', paperId)
                    .single();

                duration = paper?.duration_minutes || 60;
            }

            setQuestions(questionsData);

            // Try to restore saved progress
            try {
                const saved = await AsyncStorage.getItem(STORAGE_KEY);
                if (saved) {
                    const state = JSON.parse(saved);
                    if (state.paperId === paperId) {
                        setAnswers(state.answers || {});
                        setCurrentIndex(state.currentIndex || 0);
                        startedAtRef.current = state.startedAt || Date.now();
                        if (typeof state.timeLeft === 'number' && state.timeLeft > 0) {
                            setTimeLeft(state.timeLeft);
                        } else {
                            const elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
                            setTimeLeft(Math.max(0, duration * 60 - elapsed));
                        }
                        setIsLoading(false);
                        setTimeout(() => { hasRestoredRef.current = true; }, 0);
                        return;
                    }
                }
            } catch { }

            // No saved state — start fresh
            startedAtRef.current = Date.now();
            setTimeLeft(duration * 60);
            setIsLoading(false);
            // Mark restoration complete after a tick so state settles
            setTimeout(() => { hasRestoredRef.current = true; }, 0);
        };

        loadQuestions();
    }, [paperId]);

    // Timer
    useEffect(() => {
        if (isLoading || isSubmitting) return;

        timerRef.current = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    handleAutoSubmit();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isLoading, isSubmitting]);

    // App state listener — pause timer when backgrounded (UX risk 3.3)
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
            if (appStateRef.current === 'active' && nextState.match(/inactive|background/)) {
                // Going to background — record pause time
                pausedAtRef.current = Date.now();
                if (timerRef.current) clearInterval(timerRef.current);
            } else if (nextState === 'active' && appStateRef.current.match(/inactive|background/)) {
                // Returning to foreground — do NOT deduct paused time
                // Timer resumes from where it left off
                pausedAtRef.current = null;
            }
            appStateRef.current = nextState;
        });

        return () => subscription.remove();
    }, []);

    // Auto-save answers + timer to AsyncStorage
    useEffect(() => {
        if (questions.length === 0 || !hasRestoredRef.current) return;
        const state = {
            attemptId: `${user?.id}_${paperId}`,
            paperId: paperId || '',
            paperCode: PAPER_CODES[paperId || ''] || '',
            answers,
            currentIndex,
            startedAt: startedAtRef.current,
            durationMinutes: PAPER_DURATIONS[paperId || ''] || 60,
            totalQuestions: questions.length,
            timeLeft,
        };
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => { });
    }, [answers, currentIndex, timeLeft]);

    const handleSelectAnswer = (questionId: string, answer: string) => {
        setAnswers((prev) => ({ ...prev, [questionId]: answer }));
    };

    const handleAutoSubmit = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        showDialog(
            "Time's Up!",
            'Your exam has been automatically submitted.',
            [{ text: 'View Results', onPress: () => { hideDialog(); submitExam('auto_submitted'); } }],
        );
    }, [answers, questions]);

    const handleSubmit = () => {
        const unanswered = questions.filter((q) => !answers[q.id]).length;

        if (unanswered > 0) {
            showDialog(
                'Unanswered Questions',
                `You have ${unanswered} unanswered question${unanswered > 1 ? 's' : ''}. Unanswered questions will be marked incorrect. Submit anyway?`,
                [
                    { text: 'Review', style: 'cancel', onPress: hideDialog },
                    { text: 'Submit', style: 'destructive', onPress: () => { hideDialog(); submitExam('submitted'); } },
                ],
            );
        } else {
            showDialog(
                'Submit Exam',
                'Are you sure you want to submit? You cannot change your answers after submission.',
                [
                    { text: 'Cancel', style: 'cancel', onPress: hideDialog },
                    { text: 'Submit', onPress: () => { hideDialog(); submitExam('submitted'); } },
                ],
            );
        }
    };

    const submitExam = async (status: 'submitted' | 'auto_submitted') => {
        if (isSubmitting) return; // Double-tap guard (UX risk 3.7)
        setIsSubmitting(true);
        if (timerRef.current) clearInterval(timerRef.current);

        // Calculate score
        let correct = 0;
        const answerDetails = questions.map((q) => {
            const selected = answers[q.id] || null;
            const isCorrect = selected === q.correct_answer;
            if (isCorrect) correct++;
            return { questionId: q.id, selected, isCorrect, correctAnswer: q.correct_answer };
        });

        const percentage = Math.round((correct / questions.length) * 100);
        const passed = percentage >= 70;

        // Store results locally for mock mode
        const resultId = `result_${Date.now()}`;
        const result = {
            id: resultId,
            score: correct,
            totalQuestions: questions.length,
            percentage,
            passed,
            status,
            answers: answerDetails,
            questions,
            paperCode: PAPER_CODES[paperId || ''] || paperId,
        };

        await AsyncStorage.setItem(`exam_result_${resultId}`, JSON.stringify(result));
        await AsyncStorage.removeItem(STORAGE_KEY);

        router.replace(`/exams/results/${resultId}`);
    };

    const handleBack = () => {
        showDialog(
            'Leave Exam?',
            'Your progress is saved. You can resume later.',
            [
                { text: 'Stay', style: 'cancel', onPress: hideDialog },
                {
                    text: 'Leave',
                    style: 'destructive',
                    onPress: () => {
                        hideDialog();
                        if (timerRef.current) clearInterval(timerRef.current);
                        router.back();
                    },
                },
            ]
        );
    };

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.accent} />
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading questions...</Text>
                </View>
            </SafeAreaView>
        );
    }

    const currentQuestion = questions[currentIndex];
    const answeredCount = Object.keys(answers).length;
    const isTimeLow = timeLeft < 300; // 5 minutes

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Top Bar */}
            <View style={[styles.topBar, { borderBottomColor: colors.borderLight }]}>
                <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                    <Ionicons name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <View style={styles.topCenter}>
                    <Text style={[styles.paperCode, { color: colors.accent }]}>
                        {PAPER_CODES[paperId || ''] || paperId}
                    </Text>
                    <Text style={[styles.questionCount, { color: colors.textSecondary }]}>
                        {currentIndex + 1} / {questions.length}
                    </Text>
                </View>
                <View
                    style={[
                        styles.timerBadge,
                        { backgroundColor: isTimeLow ? colors.dangerLight : colors.surfacePrimary },
                    ]}
                >
                    <Ionicons
                        name="time-outline"
                        size={16}
                        color={isTimeLow ? colors.danger : colors.textSecondary}
                    />
                    <Text
                        style={[
                            styles.timerText,
                            { color: isTimeLow ? colors.danger : colors.textPrimary },
                        ]}
                    >
                        {formatTime(timeLeft)}
                    </Text>
                </View>
            </View>

            {/* Progress Bar */}
            <View style={[styles.progressBarOuter, { backgroundColor: colors.surfacePrimary }]}>
                <View
                    style={[
                        styles.progressBarInner,
                        {
                            backgroundColor: colors.accent,
                            width: `${((currentIndex + 1) / questions.length) * 100}%`,
                        },
                    ]}
                />
            </View>

            {/* Question Content */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Question Text */}
                <View style={[styles.questionCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                    <Text style={[styles.questionLabel, { color: colors.textTertiary }]}>
                        Question {currentQuestion.question_number}
                    </Text>
                    {currentQuestion.has_latex ? (
                        <MathRenderer content={currentQuestion.question_text} fontSize={16} />
                    ) : (
                        <Text style={[styles.questionText, { color: colors.textPrimary }]}>
                            {currentQuestion.question_text}
                        </Text>
                    )}
                </View>

                {/* Options */}
                {['A', 'B', 'C', 'D'].map((option) => {
                    const optionText = currentQuestion.options[option];
                    if (!optionText) return null;
                    const isSelected = answers[currentQuestion.id] === option;
                    const hasLatexContent = optionText.includes('$') || optionText.includes('\\');

                    return (
                        <TouchableOpacity
                            key={option}
                            style={[
                                styles.optionCard,
                                {
                                    backgroundColor: isSelected ? colors.accentLight : colors.cardBackground,
                                    borderColor: isSelected ? colors.accent : colors.cardBorder,
                                    borderWidth: isSelected ? 1.5 : 0.5,
                                },
                            ]}
                            onPress={() => handleSelectAnswer(currentQuestion.id, option)}
                            activeOpacity={0.7}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: isSelected }}
                            accessibilityLabel={`Option ${option}: ${optionText}`}
                        >
                            <View
                                style={[
                                    styles.optionLetter,
                                    {
                                        backgroundColor: isSelected ? colors.accent : colors.surfacePrimary,
                                        borderColor: isSelected ? colors.accent : colors.border,
                                    },
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.optionLetterText,
                                        { color: isSelected ? '#FFFFFF' : colors.textSecondary },
                                    ]}
                                >
                                    {option}
                                </Text>
                            </View>
                            <View style={styles.optionContent}>
                                {hasLatexContent ? (
                                    <MathRenderer content={optionText} fontSize={15} />
                                ) : (
                                    <Text style={[styles.optionText, { color: colors.textPrimary }]}>
                                        {optionText}
                                    </Text>
                                )}
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {/* Bottom Navigation */}
            <View style={[styles.bottomBar, { backgroundColor: colors.cardBackground, borderTopColor: colors.borderLight }]}>
                <TouchableOpacity
                    style={[styles.navButton, { opacity: currentIndex === 0 ? 0.3 : 1 }]}
                    onPress={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                    disabled={currentIndex === 0}
                >
                    <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
                    <Text style={[styles.navButtonText, { color: colors.textPrimary }]}>Prev</Text>
                </TouchableOpacity>

                {/* Question Grid Toggle */}
                <TouchableOpacity
                    style={[styles.gridButton, { backgroundColor: colors.surfacePrimary }]}
                    onPress={() => setShowGrid(!showGrid)}
                >
                    <Ionicons name="grid-outline" size={18} color={colors.textSecondary} />
                    <Text style={[styles.gridBadge, { color: colors.accent }]}>
                        {answeredCount}/{questions.length}
                    </Text>
                </TouchableOpacity>

                {currentIndex === questions.length - 1 ? (
                    <TouchableOpacity
                        style={[styles.submitButton, { backgroundColor: colors.accent, opacity: isSubmitting ? 0.6 : 1 }]}
                        onPress={handleSubmit}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <>
                                <Text style={styles.submitButtonText}>Submit</Text>
                                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                            </>
                        )}
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={styles.navButton}
                        onPress={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
                    >
                        <Text style={[styles.navButtonText, { color: colors.textPrimary }]}>Next</Text>
                        <Ionicons name="chevron-forward" size={20} color={colors.textPrimary} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Question Grid Overlay */}
            {showGrid && (
                <View style={[styles.gridOverlay, { backgroundColor: colors.background + 'F2' }]}>
                    <View style={[styles.gridContainer, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                        <View style={styles.gridHeader}>
                            <Text style={[styles.gridTitle, { color: colors.textPrimary }]}>Question Navigator</Text>
                            <TouchableOpacity onPress={() => setShowGrid(false)}>
                                <Ionicons name="close" size={22} color={colors.textPrimary} />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.gridItems}>
                            {questions.map((q, idx) => {
                                const isAnswered = !!answers[q.id];
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
                                        onPress={() => {
                                            setCurrentIndex(idx);
                                            setShowGrid(false);
                                        }}
                                    >
                                        <Text
                                            style={[
                                                styles.gridItemText,
                                                {
                                                    color: isCurrent
                                                        ? '#FFFFFF'
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
                    </View>
                </View>
            )}

            {/* Confirmation Dialog */}
            <ConfirmDialog
                visible={dialogConfig.visible}
                title={dialogConfig.title}
                message={dialogConfig.message}
                buttons={dialogConfig.buttons}
                onDismiss={hideDialog}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    loadingText: { fontSize: 14 },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 0.5,
    },
    backButton: {
        padding: 8,
        minWidth: 44,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    topCenter: { alignItems: 'center' },
    paperCode: { fontSize: 14, fontWeight: '700' },
    questionCount: { fontSize: 12, marginTop: 2 },
    timerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    timerText: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
    progressBarOuter: { height: 3 },
    progressBarInner: { height: 3 },
    scrollView: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 24 },
    questionCard: {
        borderRadius: 12,
        borderWidth: 0.5,
        padding: 16,
        marginBottom: 16,
    },
    questionLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 8 },
    questionText: { fontSize: 16, lineHeight: 24, fontWeight: '500' },
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
        borderRadius: 8,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    optionLetterText: { fontSize: 14, fontWeight: '700' },
    optionContent: { flex: 1 },
    optionText: { fontSize: 15, lineHeight: 22 },
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
    navButtonText: { fontSize: 14, fontWeight: '600' },
    gridButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
    },
    gridBadge: { fontSize: 13, fontWeight: '700' },
    submitButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
    },
    submitButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
    gridOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    gridContainer: {
        width: '100%',
        maxWidth: 400,
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
    gridItems: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
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
