import ConfirmDialog, { type ConfirmDialogButton } from '@/components/ConfirmDialog';
import ErrorBanner from '@/components/ErrorBanner';
import ExamBottomBar from '@/components/exams/ExamBottomBar';
import ExamProgressBar from '@/components/exams/ExamProgressBar';
import ExamTopBar from '@/components/exams/ExamTopBar';
import OptionCard from '@/components/exams/OptionCard';
import QuestionCard from '@/components/exams/QuestionCard';
import QuestionGrid from '@/components/exams/QuestionGrid';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { submitExamAttempt, submitVarkAttempt, submitEnneagramAttempt } from '@/lib/exams';
import { computeVarkScores } from '@/lib/vark';
import { computeEnneagramScores } from '@/lib/enneagram';
import { supabase } from '@/lib/supabase';
import type { ExamQuestion } from '@/types/exam';
import { ACTIVE_EXAM_SCHEMA_VERSION } from '@/types/exam';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useSegments } from 'expo-router';
import { useTypedRouter } from '@/hooks/useTypedRouter';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, ScrollView, StyleSheet, Text, View, type AppStateStatus } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PAPER_DURATIONS: Record<string, number> = { m5: 60, m9: 60, m9a: 45, hi: 45 };
const PAPER_CODES: Record<string, string> = { m5: 'M5', m9: 'M9', m9a: 'M9A', hi: 'HI' };
const STORAGE_KEY = 'lyfe_active_exam';

function isQuestionAnswered(answers: Record<string, string>, questionId: string): boolean {
    const val = answers[questionId];
    return val != null && val.length > 0;
}

export default function TakeExamScreen() {
    const { paperId } = useLocalSearchParams<{ paperId: string }>();
    const { colors } = useTheme();
    const { user } = useAuth();
    const router = useTypedRouter();
    const segments = useSegments();
    const tabBase =
        segments[1] === 'roadmap' ? '/(tabs)/roadmap' : segments[1] === 'profile' ? '/(tabs)/profile' : '/(tabs)/exams';

    const [questions, setQuestions] = useState<ExamQuestion[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [timeLeft, setTimeLeft] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showGrid, setShowGrid] = useState(false);
    const [isMultiSelect, setIsMultiSelect] = useState(false);
    const [quizType, setQuizType] = useState<'standard' | 'vark' | 'enneagram'>('standard');
    const [paperTitle, setPaperTitle] = useState<string | null>(null);
    const [dialogConfig, setDialogConfig] = useState<{
        visible: boolean;
        title: string;
        message: string;
        buttons: ConfirmDialogButton[];
    }>({ visible: false, title: '', message: '', buttons: [] });

    const showDialog = (title: string, message: string, buttons: ConfirmDialogButton[]) => {
        setDialogConfig({ visible: true, title, message, buttons });
    };
    const hideDialog = () => setDialogConfig((prev) => ({ ...prev, visible: false }));

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const appStateRef = useRef<AppStateStatus>(AppState.currentState);
    const pausedAtRef = useRef<number | null>(null);
    const startedAtRef = useRef<number>(Date.now());
    const hasRestoredRef = useRef(false);
    const isMultiSelectRef = useRef(false);
    const quizTypeRef = useRef<'standard' | 'vark' | 'enneagram'>('standard');

    // Refs that sync with state to avoid stale closures in timer/dialog callbacks
    const answersRef = useRef(answers);
    const questionsRef = useRef(questions);
    const userRef = useRef(user);
    const paperTitleRef = useRef(paperTitle);
    const tabBaseRef = useRef(tabBase);
    useEffect(() => {
        answersRef.current = answers;
    }, [answers]);
    useEffect(() => {
        questionsRef.current = questions;
    }, [questions]);
    useEffect(() => {
        userRef.current = user;
    }, [user]);
    useEffect(() => {
        paperTitleRef.current = paperTitle;
    }, [paperTitle]);
    useEffect(() => {
        tabBaseRef.current = tabBase;
    }, [tabBase]);

    // Load questions + restore saved progress
    useEffect(() => {
        const loadQuestions = async () => {
            let questionsData: ExamQuestion[] = [];
            let duration = 60;

            const { data, error } = await supabase.rpc('get_exam_questions', { p_paper_id: paperId });

            if (error) {
                setError('Failed to load questions. Please try again.');
                setIsLoading(false);
                return;
            }
            questionsData = data as ExamQuestion[];

            const { data: paper } = await supabase
                .from('exam_papers')
                .select('duration_minutes, allow_multiple_answers, title')
                .eq('id', paperId)
                .single();

            duration = paper?.duration_minutes || 60;
            setPaperTitle(paper?.title || null);

            let detected: 'standard' | 'vark' | 'enneagram' = 'standard';
            if (questionsData.length > 0) {
                try {
                    const parsed = JSON.parse(questionsData[0].explanation || '');
                    if (parsed?.quiz_type === 'enneagram') detected = 'enneagram';
                    else if (parsed?.quiz_type === 'vark') detected = 'vark';
                    else if (parsed?.quiz_type === 'disc') {
                        // DISC uses a dedicated screen — redirect
                        router.replace({ pathname: `${tabBase}/disc` as any, params: { paperId } });
                        return;
                    }
                } catch {
                    /* Not a personality quiz */
                }
            }
            setQuizType(detected);
            quizTypeRef.current = detected;

            const multiSelect = detected === 'vark';
            setIsMultiSelect(multiSelect);
            isMultiSelectRef.current = multiSelect;
            setQuestions(questionsData);

            try {
                const saved = await AsyncStorage.getItem(STORAGE_KEY);
                if (saved) {
                    const state = JSON.parse(saved);
                    if (
                        state.paperId === paperId &&
                        state.schemaVersion === ACTIVE_EXAM_SCHEMA_VERSION &&
                        state.allowMultipleAnswers === multiSelect
                    ) {
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
                        setTimeout(() => {
                            hasRestoredRef.current = true;
                        }, 0);
                        return;
                    }
                    await AsyncStorage.removeItem(STORAGE_KEY);
                }
            } catch (e) {
                if (__DEV__) console.error('[ExamTake] Failed to restore saved state:', e);
            }

            startedAtRef.current = Date.now();
            setTimeLeft(duration * 60);
            setIsLoading(false);
            setTimeout(() => {
                hasRestoredRef.current = true;
            }, 0);
        };
        loadQuestions();
    }, [paperId]);

    // Timer
    useEffect(() => {
        if (isLoading || isSubmitting) return;
        if (quizTypeRef.current !== 'standard') return;
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

    // App state listener
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
            if (appStateRef.current === 'active' && nextState.match(/inactive|background/)) {
                pausedAtRef.current = Date.now();
                if (timerRef.current) clearInterval(timerRef.current);
            } else if (nextState === 'active' && appStateRef.current.match(/inactive|background/)) {
                pausedAtRef.current = null;
            }
            appStateRef.current = nextState;
        });
        return () => subscription.remove();
    }, []);

    // Auto-save
    useEffect(() => {
        if (questions.length === 0 || !hasRestoredRef.current) return;
        const state = {
            schemaVersion: ACTIVE_EXAM_SCHEMA_VERSION,
            attemptId: `${user?.id}_${paperId}`,
            paperId: paperId || '',
            paperCode: PAPER_CODES[paperId || ''] || paperTitle || '',
            answers,
            currentIndex,
            startedAt: startedAtRef.current,
            durationMinutes: PAPER_DURATIONS[paperId || ''] || 60,
            totalQuestions: questions.length,
            timeLeft,
            allowMultipleAnswers: isMultiSelectRef.current,
        };
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch((e) => {
            if (__DEV__) console.error('[ExamTake] Failed to auto-save state:', e);
        });
    }, [answers, currentIndex, timeLeft]);

    const handleSelectAnswer = (questionId: string, answer: string) => {
        setAnswers((prev) => ({ ...prev, [questionId]: answer }));
    };

    const handleToggleAnswer = (questionId: string, option: string) => {
        setAnswers((prev) => {
            const current = prev[questionId] || '';
            const selections = current ? current.split(',') : [];
            const idx = selections.indexOf(option);
            if (idx >= 0) {
                selections.splice(idx, 1);
            } else {
                selections.push(option);
            }
            selections.sort();
            return { ...prev, [questionId]: selections.join(',') };
        });
    };

    const isPersonalityQuiz = quizType !== 'standard';

    const handleAutoSubmit = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        const label = quizTypeRef.current !== 'standard' ? 'assessment' : 'exam';
        showDialog("Time's Up!", `Your ${label} has been automatically submitted.`, [
            {
                text: 'View Results',
                onPress: () => {
                    hideDialog();
                    submitExam('auto_submitted');
                },
            },
        ]);
    }, []);

    const handleSubmit = () => {
        const unansweredQuestions = questions.filter((q) => !isQuestionAnswered(answers, q.id));
        const unanswered = unansweredQuestions.length;

        if (unanswered > 0 && isPersonalityQuiz) {
            const nums = unansweredQuestions.map((q) => q.question_number);
            const preview =
                nums.length <= 10
                    ? nums.join(', ')
                    : nums.slice(0, 10).join(', ') + `, ... and ${nums.length - 10} more`;
            showDialog(
                'All Questions Required',
                `Please answer all questions for accurate results.\n\nUnanswered: ${preview}`,
                [
                    {
                        text: 'Go to First',
                        onPress: () => {
                            hideDialog();
                            const firstIdx = questions.findIndex((q) => q.id === unansweredQuestions[0].id);
                            if (firstIdx >= 0) setCurrentIndex(firstIdx);
                        },
                    },
                ],
            );
        } else if (unanswered > 0) {
            showDialog(
                'Unanswered Questions',
                `You have ${unanswered} unanswered question${unanswered > 1 ? 's' : ''}. Unanswered questions will be marked incorrect. Submit anyway?`,
                [
                    { text: 'Review', style: 'cancel', onPress: hideDialog },
                    {
                        text: 'Submit',
                        style: 'destructive',
                        onPress: () => {
                            hideDialog();
                            submitExam('submitted');
                        },
                    },
                ],
            );
        } else {
            const title = isPersonalityQuiz ? 'Submit Assessment' : 'Submit Exam';
            showDialog(title, 'Are you sure you want to submit? You cannot change your answers after submission.', [
                { text: 'Cancel', style: 'cancel', onPress: hideDialog },
                {
                    text: 'Submit',
                    onPress: () => {
                        hideDialog();
                        submitExam('submitted');
                    },
                },
            ]);
        }
    };

    const submitExam = async (status: 'submitted' | 'auto_submitted') => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        if (timerRef.current) clearInterval(timerRef.current);

        // Read from refs to avoid stale closures (timer/dialog callbacks)
        const currentAnswers = answersRef.current;
        const currentQuestions = questionsRef.current;
        const currentUser = userRef.current;
        const currentPaperTitle = paperTitleRef.current;
        const currentTabBase = tabBaseRef.current;

        const pc = PAPER_CODES[paperId || ''] || currentPaperTitle || paperId || '';

        if (currentUser?.id) {
            const submitFn =
                quizTypeRef.current === 'enneagram'
                    ? submitEnneagramAttempt
                    : quizTypeRef.current === 'vark'
                      ? submitVarkAttempt
                      : submitExamAttempt;
            const { data: result, error } = await submitFn(
                {
                    userId: currentUser.id,
                    paperId: paperId || '',
                    questions: currentQuestions,
                    answers: currentAnswers,
                    status,
                    startedAt: startedAtRef.current,
                },
                pc,
            );

            if (!error && result) {
                await AsyncStorage.setItem(`exam_result_${result.id}`, JSON.stringify(result));
                await AsyncStorage.removeItem(STORAGE_KEY);
                if (result.personalityResults) {
                    const isEnneagram =
                        'quizType' in result.personalityResults && result.personalityResults.quizType === 'enneagram';
                    router.replace(`${currentTabBase}/results/${isEnneagram ? 'enneagram' : 'vark'}/${result.id}`);
                } else {
                    router.replace(`${currentTabBase}/results/${result.id}`);
                }
                return;
            }
        }

        // Local-only fallback
        if (quizTypeRef.current === 'enneagram') {
            const enneagramResults = computeEnneagramScores(currentQuestions, currentAnswers);
            const resultId = `result_${Date.now()}`;
            const result = {
                id: resultId,
                score: 0,
                totalQuestions: currentQuestions.length,
                percentage: 0,
                passed: false,
                status,
                answers: currentQuestions.map((q) => ({
                    questionId: q.id,
                    selected: currentAnswers[q.id] || null,
                    isCorrect: false,
                    correctAnswer: q.correct_answer,
                })),
                questions: currentQuestions,
                paperCode: pc,
                personalityResults: enneagramResults,
            };
            await AsyncStorage.setItem(`exam_result_${resultId}`, JSON.stringify(result));
            await AsyncStorage.removeItem(STORAGE_KEY);
            router.replace(`${currentTabBase}/results/enneagram/${resultId}`);
        } else if (quizTypeRef.current === 'vark') {
            const varkResults = computeVarkScores(currentQuestions, currentAnswers);
            const resultId = `result_${Date.now()}`;
            const result = {
                id: resultId,
                score: 0,
                totalQuestions: currentQuestions.length,
                percentage: 0,
                passed: false,
                status,
                answers: currentQuestions.map((q) => ({
                    questionId: q.id,
                    selected: currentAnswers[q.id] || null,
                    isCorrect: false,
                    correctAnswer: q.correct_answer,
                })),
                questions: currentQuestions,
                paperCode: pc,
                personalityResults: varkResults,
            };
            await AsyncStorage.setItem(`exam_result_${resultId}`, JSON.stringify(result));
            await AsyncStorage.removeItem(STORAGE_KEY);
            router.replace(`${currentTabBase}/results/vark/${resultId}`);
        } else {
            let correct = 0;
            const answerDetails = currentQuestions.map((q) => {
                const selected = currentAnswers[q.id] || null;
                const isCorrect = selected === q.correct_answer;
                if (isCorrect) correct++;
                return { questionId: q.id, selected, isCorrect, correctAnswer: q.correct_answer };
            });
            const percentage = Math.round((correct / currentQuestions.length) * 100);
            const resultId = `result_${Date.now()}`;
            const result = {
                id: resultId,
                score: correct,
                totalQuestions: currentQuestions.length,
                percentage,
                passed: percentage >= 70,
                status,
                answers: answerDetails,
                questions: currentQuestions,
                paperCode: PAPER_CODES[paperId || ''] || paperId,
            };
            await AsyncStorage.setItem(`exam_result_${resultId}`, JSON.stringify(result));
            await AsyncStorage.removeItem(STORAGE_KEY);
            router.replace(`${currentTabBase}/results/${resultId}`);
        }
    };

    const handleBack = () => {
        showDialog(
            `Leave ${isPersonalityQuiz ? 'Assessment' : 'Exam'}?`,
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
            ],
        );
    };

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.accent} />
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading questions...</Text>
                </View>
            </SafeAreaView>
        );
    }

    const currentQuestion = questions[currentIndex];
    const displayCode = PAPER_CODES[paperId || ''] || paperTitle || paperId;
    const allAnswered = isPersonalityQuiz && questions.every((q) => isQuestionAnswered(answers, q.id));
    const currentSelections = isMultiSelect ? (answers[currentQuestion.id] || '').split(',').filter(Boolean) : [];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <ExamTopBar
                displayCode={displayCode}
                currentIndex={currentIndex}
                totalQuestions={questions.length}
                timeLeft={timeLeft}
                isPersonalityQuiz={isPersonalityQuiz}
                colors={colors}
                onBack={handleBack}
            />
            <ExamProgressBar currentIndex={currentIndex} totalQuestions={questions.length} colors={colors} />

            {error && (
                <ErrorBanner
                    message={error}
                    onRetry={() =>
                        router.replace(`${tabBase}/${segments[1] === 'roadmap' ? 'exam' : 'take'}/${paperId}`)
                    }
                    onDismiss={() => setError(null)}
                />
            )}

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <QuestionCard
                    question={currentQuestion}
                    isMultiSelect={isMultiSelect}
                    quizType={quizType}
                    colors={colors}
                />

                {['A', 'B', 'C', 'D'].map((option) => {
                    const optionText = currentQuestion.options[option];
                    if (!optionText) return null;
                    const isSelected = isMultiSelect
                        ? currentSelections.includes(option)
                        : answers[currentQuestion.id] === option;
                    return (
                        <OptionCard
                            key={option}
                            option={option}
                            optionText={optionText}
                            isSelected={isSelected}
                            isMultiSelect={isMultiSelect}
                            colors={colors}
                            onPress={() =>
                                isMultiSelect
                                    ? handleToggleAnswer(currentQuestion.id, option)
                                    : handleSelectAnswer(currentQuestion.id, option)
                            }
                        />
                    );
                })}
            </ScrollView>

            <ExamBottomBar
                currentIndex={currentIndex}
                totalQuestions={questions.length}
                isSubmitting={isSubmitting}
                allAnswered={allAnswered}
                isPersonalityQuiz={isPersonalityQuiz}
                colors={colors}
                onPrev={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                onNext={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
                onGridToggle={() => setShowGrid(!showGrid)}
                onSubmit={handleSubmit}
            />

            {showGrid && (
                <QuestionGrid
                    questions={questions}
                    answers={answers}
                    currentIndex={currentIndex}
                    colors={colors}
                    onSelectQuestion={(idx) => {
                        setCurrentIndex(idx);
                        setShowGrid(false);
                    }}
                    onClose={() => setShowGrid(false)}
                />
            )}

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
    scrollView: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 24 },
});
