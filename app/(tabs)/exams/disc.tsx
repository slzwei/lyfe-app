/**
 * DISC Personality Assessment — dedicated step-based quiz screen.
 *
 * 5 steps with multiple questions per step:
 *   Steps 1-3: Word pair 5-point scale
 *   Step 4: Single-word 5-point rating
 *   Step 5: Scenario binary choice
 */
import ConfirmDialog, { type ConfirmDialogButton } from '@/components/ConfirmDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useTypedRouter } from '@/hooks/useTypedRouter';
import { submitDiscAttempt } from '@/lib/exams';
import { computeDiscScores } from '@/lib/disc';
import {
    DISC_STEPS,
    DISC_TOTAL_STEPS,
    DISC_TOTAL_QUESTIONS,
    DISC_WORD_PAIR_QUESTIONS,
    DISC_SINGLE_WORD_QUESTIONS,
    DISC_SCENARIO_QUESTIONS,
    getStepQuestionIds,
    type DiscWordPairQuestion,
    type DiscSingleWordQuestion,
    type DiscScenarioQuestion,
} from '@/constants/disc';
import { displayWeight, letterSpacing } from '@/constants/platform';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useSegments } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const STORAGE_KEY = 'lyfe_disc_quiz';

export default function DiscQuizScreen() {
    const { paperId } = useLocalSearchParams<{ paperId: string }>();
    const { colors } = useTheme();
    const { user } = useAuth();
    const router = useTypedRouter();
    const segments = useSegments() as unknown as string[];
    const tabBase =
        segments[1] === 'roadmap' ? '/(tabs)/roadmap' : segments[1] === 'profile' ? '/(tabs)/profile' : '/(tabs)/exams';

    const [currentStep, setCurrentStep] = useState(1);
    const [answers, setAnswers] = useState<Record<number, number | string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [dialogConfig, setDialogConfig] = useState<{
        visible: boolean;
        title: string;
        message: string;
        buttons: ConfirmDialogButton[];
    }>({ visible: false, title: '', message: '', buttons: [] });

    const startedAtRef = useRef(Date.now());
    const scrollRef = useRef<ScrollView>(null);
    const hasRestoredRef = useRef(false);

    const showDialog = (title: string, message: string, buttons: ConfirmDialogButton[]) => {
        setDialogConfig({ visible: true, title, message, buttons });
    };
    const hideDialog = () => setDialogConfig((prev) => ({ ...prev, visible: false }));

    // Restore saved progress
    useEffect(() => {
        const restore = async () => {
            try {
                const saved = await AsyncStorage.getItem(STORAGE_KEY);
                if (saved) {
                    const state = JSON.parse(saved);
                    if (state.paperId === paperId) {
                        setAnswers(state.answers || {});
                        setCurrentStep(state.currentStep || 1);
                        startedAtRef.current = state.startedAt || Date.now();
                    } else {
                        await AsyncStorage.removeItem(STORAGE_KEY);
                    }
                }
            } catch {
                // ignore
            }
            setIsLoading(false);
            setTimeout(() => {
                hasRestoredRef.current = true;
            }, 0);
        };
        restore();
    }, [paperId]);

    // Auto-save
    useEffect(() => {
        if (!hasRestoredRef.current) return;
        const state = {
            paperId,
            answers,
            currentStep,
            startedAt: startedAtRef.current,
        };
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
    }, [answers, currentStep]);

    const stepInfo = DISC_STEPS[currentStep - 1];
    const stepQuestionIds = getStepQuestionIds(currentStep);
    const answeredOnStep = stepQuestionIds.filter((id) => answers[id] != null).length;
    const allStepAnswered = answeredOnStep === stepQuestionIds.length;

    const totalAnswered = Object.keys(answers).length;
    const allAnswered = totalAnswered === DISC_TOTAL_QUESTIONS;

    const handleSetAnswer = (questionId: number, value: number | string) => {
        setValidationError(null);
        setAnswers((prev) => ({ ...prev, [questionId]: value }));
    };

    const handleNextStep = () => {
        if (!allStepAnswered) {
            setValidationError('Please answer all questions before continuing.');
            return;
        }
        setValidationError(null);
        if (currentStep < DISC_TOTAL_STEPS) {
            setCurrentStep((s) => s + 1);
            scrollRef.current?.scrollTo({ y: 0, animated: false });
        } else {
            handleSubmit();
        }
    };

    const handlePrevStep = () => {
        setValidationError(null);
        if (currentStep > 1) {
            setCurrentStep((s) => s - 1);
            scrollRef.current?.scrollTo({ y: 0, animated: false });
        }
    };

    const handleSubmit = () => {
        if (!allAnswered) {
            setValidationError('Please answer all questions before submitting.');
            return;
        }
        showDialog(
            'Submit Assessment',
            'Are you sure you want to submit? You cannot change your answers after submission.',
            [
                { text: 'Cancel', style: 'cancel', onPress: hideDialog },
                {
                    text: 'Submit',
                    onPress: () => {
                        hideDialog();
                        submitQuiz();
                    },
                },
            ],
        );
    };

    const submitQuiz = async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);

        const discResults = computeDiscScores(answers);

        if (user?.id && paperId) {
            const { data: result, error } = await submitDiscAttempt(
                {
                    userId: user.id,
                    paperId,
                    answers,
                    startedAt: startedAtRef.current,
                },
                discResults,
            );

            if (!error && result) {
                await AsyncStorage.setItem(`exam_result_${result.id}`, JSON.stringify(result));
                await AsyncStorage.removeItem(STORAGE_KEY);
                router.replace(`${tabBase}/results/disc/${result.id}`);
                return;
            }
        }

        // Local-only fallback
        const resultId = `result_${Date.now()}`;
        const result = {
            id: resultId,
            score: 0,
            totalQuestions: DISC_TOTAL_QUESTIONS,
            percentage: 0,
            passed: false,
            status: 'submitted',
            answers: [],
            questions: [],
            paperCode: 'DISC',
            personalityResults: discResults,
        };
        await AsyncStorage.setItem(`exam_result_${resultId}`, JSON.stringify(result));
        await AsyncStorage.removeItem(STORAGE_KEY);
        router.replace(`${tabBase}/results/disc/${resultId}`);
    };

    const handleBack = () => {
        showDialog('Leave Assessment?', 'Your progress is saved. You can resume later.', [
            { text: 'Stay', style: 'cancel', onPress: hideDialog },
            {
                text: 'Leave',
                style: 'destructive',
                onPress: () => {
                    hideDialog();
                    router.back();
                },
            },
        ]);
    };

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.accent} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Top Bar */}
            <View style={styles.topBar}>
                <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
                    <Ionicons name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.topTitle, { color: colors.textPrimary }]}>DISC Assessment</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Progress */}
            <View style={styles.progressRow}>
                <Text style={[styles.stepLabel, { color: colors.textSecondary }]}>
                    Step {currentStep} of {DISC_TOTAL_STEPS}
                </Text>
                <Text style={[styles.answeredLabel, { color: colors.textTertiary }]}>
                    {totalAnswered}/{DISC_TOTAL_QUESTIONS} answered
                </Text>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                <View
                    style={[
                        styles.progressFill,
                        {
                            backgroundColor: colors.accent,
                            width: `${(currentStep / DISC_TOTAL_STEPS) * 100}%`,
                        },
                    ]}
                />
            </View>

            {/* Questions */}
            <ScrollView
                ref={scrollRef}
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Instructions */}
                <View style={[styles.instructionCard, { backgroundColor: colors.surfacePrimary }]}>
                    <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
                    <Text style={[styles.instructionText, { color: colors.textSecondary }]}>
                        {stepInfo.instructions}
                    </Text>
                </View>

                {/* Step 1-3: Word Pairs */}
                {stepInfo.format === 'word_pair' &&
                    DISC_WORD_PAIR_QUESTIONS[currentStep]?.map((q) => (
                        <WordPairRow
                            key={q.id}
                            question={q}
                            value={answers[q.id] as number | undefined}
                            onSelect={(val) => handleSetAnswer(q.id, val)}
                            colors={colors}
                        />
                    ))}

                {/* Step 4: Single-Word Ratings */}
                {stepInfo.format === 'single_word' &&
                    DISC_SINGLE_WORD_QUESTIONS.map((q) => (
                        <SingleWordRow
                            key={q.id}
                            question={q}
                            value={answers[q.id] as number | undefined}
                            onSelect={(val) => handleSetAnswer(q.id, val)}
                            colors={colors}
                        />
                    ))}

                {/* Step 5: Scenarios */}
                {stepInfo.format === 'scenario' &&
                    DISC_SCENARIO_QUESTIONS.map((q) => (
                        <ScenarioRow
                            key={q.id}
                            question={q}
                            value={answers[q.id] as string | undefined}
                            onSelect={(val) => handleSetAnswer(q.id, val)}
                            colors={colors}
                        />
                    ))}

                {/* Validation error */}
                {validationError && (
                    <Text style={[styles.validationError, { color: colors.danger }]}>{validationError}</Text>
                )}
            </ScrollView>

            {/* Bottom Bar */}
            <View style={[styles.bottomBar, { borderTopColor: colors.border }]}>
                {currentStep > 1 ? (
                    <TouchableOpacity
                        style={[styles.secondaryBtn, { borderColor: colors.border }]}
                        onPress={handlePrevStep}
                    >
                        <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
                        <Text style={[styles.secondaryBtnText, { color: colors.textPrimary }]}>Previous</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={{ flex: 1 }} />
                )}

                <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: allStepAnswered ? colors.accent : colors.border }]}
                    onPress={handleNextStep}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? (
                        <ActivityIndicator size="small" color={colors.textInverse} />
                    ) : (
                        <>
                            <Text
                                style={[
                                    styles.primaryBtnText,
                                    { color: allStepAnswered ? colors.textInverse : colors.textTertiary },
                                ]}
                            >
                                {currentStep === DISC_TOTAL_STEPS ? 'Submit' : 'Next Step'}
                            </Text>
                            {currentStep < DISC_TOTAL_STEPS && (
                                <Ionicons
                                    name="chevron-forward"
                                    size={18}
                                    color={allStepAnswered ? colors.textInverse : colors.textTertiary}
                                />
                            )}
                        </>
                    )}
                </TouchableOpacity>
            </View>

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

// ── Word Pair Row ────────────────────────────────────────────────

interface WordPairRowProps {
    question: DiscWordPairQuestion;
    value?: number;
    onSelect: (val: number) => void;
    colors: any;
}

function WordPairRow({ question, value, onSelect, colors }: WordPairRowProps) {
    return (
        <View style={[styles.questionCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
            <View style={styles.wordPairLabels}>
                <Text style={[styles.wordLabel, { color: colors.textPrimary }]}>{question.left}</Text>
                <Text style={[styles.wordLabel, { color: colors.textPrimary }]}>{question.right}</Text>
            </View>
            <View style={styles.scaleRow}>
                {[5, 4, 3, 2, 1].map((v) => (
                    <TouchableOpacity
                        key={v}
                        style={[
                            styles.radioOuter,
                            {
                                borderColor: value === v ? colors.accent : colors.border,
                                backgroundColor: value === v ? colors.accent + '14' : 'transparent',
                            },
                        ]}
                        onPress={() => onSelect(v)}
                        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                    >
                        {value === v && <View style={[styles.radioInner, { backgroundColor: colors.accent }]} />}
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
}

// ── Single Word Row ──────────────────────────────────────────────

interface SingleWordRowProps {
    question: DiscSingleWordQuestion;
    value?: number;
    onSelect: (val: number) => void;
    colors: any;
}

function SingleWordRow({ question, value, onSelect, colors }: SingleWordRowProps) {
    return (
        <View style={[styles.questionCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
            <Text style={[styles.singleWordTitle, { color: colors.textPrimary }]}>{question.word}</Text>
            <View style={styles.ratingRow}>
                <Text style={[styles.ratingEndLabel, { color: colors.textTertiary }]}>Not Like Me</Text>
                <View style={styles.scaleRow}>
                    {[1, 2, 3, 4, 5].map((v) => (
                        <TouchableOpacity
                            key={v}
                            style={[
                                styles.radioOuter,
                                {
                                    borderColor: value === v ? colors.accent : colors.border,
                                    backgroundColor: value === v ? colors.accent + '14' : 'transparent',
                                },
                            ]}
                            onPress={() => onSelect(v)}
                            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                        >
                            {value === v && <View style={[styles.radioInner, { backgroundColor: colors.accent }]} />}
                        </TouchableOpacity>
                    ))}
                </View>
                <Text style={[styles.ratingEndLabel, { color: colors.textTertiary }]}>Like Me</Text>
            </View>
        </View>
    );
}

// ── Scenario Row ─────────────────────────────────────────────────

interface ScenarioRowProps {
    question: DiscScenarioQuestion;
    value?: string;
    onSelect: (val: string) => void;
    colors: any;
}

function ScenarioRow({ question, value, onSelect, colors }: ScenarioRowProps) {
    return (
        <View style={[styles.questionCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
            <Text style={[styles.scenarioStem, { color: colors.textPrimary }]}>{question.stem}</Text>
            {[
                { key: 'A', text: question.optionA.text },
                { key: 'B', text: question.optionB.text },
            ].map((opt) => {
                const selected = value === opt.key;
                return (
                    <TouchableOpacity
                        key={opt.key}
                        style={[
                            styles.scenarioOption,
                            {
                                backgroundColor: selected ? colors.accent + '14' : colors.surfacePrimary,
                                borderColor: selected ? colors.accent : colors.border,
                            },
                        ]}
                        onPress={() => onSelect(opt.key)}
                        activeOpacity={0.7}
                    >
                        <View
                            style={[
                                styles.radioOuter,
                                styles.radioSmall,
                                {
                                    borderColor: selected ? colors.accent : colors.border,
                                    backgroundColor: selected ? colors.accent + '14' : 'transparent',
                                },
                            ]}
                        >
                            {selected && (
                                <View
                                    style={[
                                        styles.radioInner,
                                        styles.radioInnerSmall,
                                        { backgroundColor: colors.accent },
                                    ]}
                                />
                            )}
                        </View>
                        <Text style={[styles.scenarioOptionText, { color: colors.textPrimary }]}>{opt.text}</Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

// ── Styles ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    // Top bar
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    backBtn: { padding: 8, minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
    topTitle: { fontSize: 17, fontWeight: '700' },

    // Progress
    progressRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 6,
    },
    stepLabel: { fontSize: 13, fontWeight: '600' },
    answeredLabel: { fontSize: 12 },
    progressTrack: { height: 4, marginHorizontal: 16, borderRadius: 2 },
    progressFill: { height: 4, borderRadius: 2 },

    // Scroll
    scroll: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 24, gap: 12 },

    // Instructions
    instructionCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        padding: 12,
        borderRadius: 10,
        marginBottom: 4,
    },
    instructionText: { flex: 1, fontSize: 13, lineHeight: 19 },

    // Question card
    questionCard: {
        borderRadius: 12,
        borderWidth: 0.5,
        padding: 16,
    },

    // Word pair
    wordPairLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    wordLabel: { fontSize: 15, fontWeight: displayWeight('600'), letterSpacing: letterSpacing(-0.2) },
    scaleRow: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    radioOuter: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioInner: {
        width: 14,
        height: 14,
        borderRadius: 7,
    },
    radioSmall: { width: 22, height: 22, borderRadius: 11 },
    radioInnerSmall: { width: 10, height: 10, borderRadius: 5 },

    // Single word
    singleWordTitle: {
        fontSize: 16,
        fontWeight: displayWeight('700'),
        letterSpacing: letterSpacing(-0.3),
        marginBottom: 12,
        textAlign: 'center',
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    ratingEndLabel: { fontSize: 11, width: 48, textAlign: 'center' },

    // Scenario
    scenarioStem: {
        fontSize: 15,
        fontWeight: displayWeight('600'),
        letterSpacing: letterSpacing(-0.2),
        marginBottom: 12,
    },
    scenarioOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 14,
        borderRadius: 10,
        borderWidth: 1,
        marginBottom: 8,
    },
    scenarioOptionText: { flex: 1, fontSize: 14, lineHeight: 20 },

    // Validation
    validationError: { fontSize: 13, textAlign: 'center', marginTop: 4 },

    // Bottom bar
    bottomBar: {
        flexDirection: 'row',
        gap: 8,
        padding: 16,
        borderTopWidth: 0.5,
    },
    secondaryBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
    },
    secondaryBtnText: { fontSize: 15, fontWeight: '600' },
    primaryBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingVertical: 14,
        borderRadius: 12,
    },
    primaryBtnText: { fontSize: 15, fontWeight: '700' },
});
