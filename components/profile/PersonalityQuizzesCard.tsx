import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { VARK_TYPE_INFO, type VarkResults } from '@/constants/vark';
import { ENNEAGRAM_TYPE_INFO, type EnneagramResults, type EnneagramType } from '@/constants/enneagram';
import { getPreferenceLabel, isVarkResults } from '@/lib/vark';
import { isEnneagramResults } from '@/lib/enneagram';
import { displayWeight } from '@/constants/platform';
import type { ThemeColors } from '@/types/theme';

interface QuizResult {
    attemptId: string;
    paperId: string;
    personalityResults: VarkResults | EnneagramResults | null;
}

interface Props {
    colors: ThemeColors;
    userId: string;
}

const TYPE_LABELS: Record<string, string> = { V: 'Visual', A: 'Aural', R: 'Read/Write', K: 'Kinesthetic' };

export default function PersonalityQuizzesCard({ colors, userId }: Props) {
    const router = useRouter();
    const [varkResult, setVarkResult] = useState<QuizResult | null>(null);
    const [enneagramResult, setEnneagramResult] = useState<QuizResult | null>(null);
    const [varkPaperId, setVarkPaperId] = useState<string | null>(null);
    const [enneagramPaperId, setEnneagramPaperId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const loadQuizData = useCallback(async () => {
        // Fetch personality quiz papers
        const { data: papers } = await supabase
            .from('exam_papers')
            .select('id, code')
            .in('code', ['VARK-001', 'ENNEAGRAM_SAMPLER', 'ENNEAGRAM'])
            .eq('is_active', true);

        if (!papers || papers.length === 0) {
            setIsLoading(false);
            return;
        }

        const varkPaper = papers.find((p) => p.code === 'VARK-001');
        // Prefer sampler for "Take" button, but accept results from either enneagram paper
        const enneaSampler = papers.find((p) => p.code === 'ENNEAGRAM_SAMPLER');
        const enneaFull = papers.find((p) => p.code === 'ENNEAGRAM');
        if (varkPaper) setVarkPaperId(varkPaper.id);
        setEnneagramPaperId(enneaSampler?.id ?? enneaFull?.id ?? null);

        const enneaPaperIds = [enneaSampler?.id, enneaFull?.id].filter(Boolean) as string[];
        const paperIds = [varkPaper?.id, ...enneaPaperIds].filter(Boolean) as string[];

        // Fetch latest completed attempts for these papers
        const { data: attempts } = await supabase
            .from('exam_attempts')
            .select('id, paper_id, personality_results')
            .eq('user_id', userId)
            .in('paper_id', paperIds)
            .in('status', ['submitted', 'auto_submitted'])
            .order('created_at', { ascending: false });

        if (attempts) {
            // Take the most recent attempt per paper (already sorted desc by created_at)
            let foundVark = false;
            let foundEnnea = false;
            for (const attempt of attempts) {
                if (attempt.paper_id === varkPaper?.id && !foundVark) {
                    foundVark = true;
                    setVarkResult({
                        attemptId: attempt.id,
                        paperId: attempt.paper_id,
                        personalityResults: isVarkResults(attempt.personality_results)
                            ? attempt.personality_results
                            : null,
                    });
                } else if (enneaPaperIds.includes(attempt.paper_id) && !foundEnnea) {
                    foundEnnea = true;
                    setEnneagramResult({
                        attemptId: attempt.id,
                        paperId: attempt.paper_id,
                        personalityResults: isEnneagramResults(attempt.personality_results)
                            ? attempt.personality_results
                            : null,
                    });
                }
                if (foundVark && foundEnnea) break;
            }
        }

        setIsLoading(false);
    }, [userId]);

    useFocusEffect(
        useCallback(() => {
            setVarkResult(null);
            setEnneagramResult(null);
            loadQuizData();
        }, [loadQuizData]),
    );

    const handleVark = () => {
        if (varkResult) {
            router.push(`/(tabs)/profile/results/vark/${varkResult.attemptId}` as any);
        } else if (varkPaperId) {
            router.push(`/(tabs)/profile/take/${varkPaperId}` as any);
        }
    };

    const handleEnneagram = () => {
        if (enneagramResult) {
            router.push(`/(tabs)/profile/results/enneagram/${enneagramResult.attemptId}` as any);
        } else if (enneagramPaperId) {
            router.push(`/(tabs)/profile/take/${enneagramPaperId}` as any);
        }
    };

    // Derive display strings
    const varkLabel = varkResult?.personalityResults
        ? getPreferenceLabel((varkResult.personalityResults as VarkResults).topTypes, TYPE_LABELS)
        : null;
    const varkTopIcon = varkResult?.personalityResults
        ? VARK_TYPE_INFO[(varkResult.personalityResults as VarkResults).topTypes[0]]
        : null;

    const enneaResults = enneagramResult?.personalityResults as EnneagramResults | null;
    const enneaType = enneaResults ? ENNEAGRAM_TYPE_INFO[enneaResults.primaryType as EnneagramType] : null;

    if (isLoading) {
        return (
            <View style={[styles.card, { backgroundColor: colors.cardBackground, shadowColor: colors.textPrimary }]}>
                <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>PERSONALITY QUIZZES</Text>
                <ActivityIndicator size="small" color={colors.accent} style={{ paddingVertical: 16 }} />
            </View>
        );
    }

    // Don't render if no papers exist
    if (!varkPaperId && !enneagramPaperId) return null;

    return (
        <View style={[styles.card, { backgroundColor: colors.cardBackground, shadowColor: colors.textPrimary }]}>
            <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>PERSONALITY QUIZZES</Text>

            {/* VARK Row */}
            {varkPaperId && (
                <TouchableOpacity style={styles.quizRow} onPress={handleVark} activeOpacity={0.6}>
                    <View
                        style={[
                            styles.quizIcon,
                            { backgroundColor: varkResult ? colors.success + '14' : colors.accentLight },
                        ]}
                    >
                        <Ionicons
                            name={varkTopIcon ? (varkTopIcon.icon as any) : 'school-outline'}
                            size={20}
                            color={varkResult ? colors.success : colors.accent}
                        />
                    </View>
                    <View style={styles.quizTextCol}>
                        <Text style={[styles.quizTitle, { color: colors.textPrimary }]}>Learning Style (VARK)</Text>
                        {varkLabel ? (
                            <Text style={[styles.quizResult, { color: colors.success }]}>{varkLabel}</Text>
                        ) : (
                            <Text style={[styles.quizSubtitle, { color: colors.textTertiary }]}>
                                Discover your learning style
                            </Text>
                        )}
                    </View>
                    <View style={styles.quizAction}>
                        {varkResult ? (
                            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                        ) : (
                            <View style={[styles.takeBadge, { backgroundColor: colors.accent }]}>
                                <Text style={[styles.takeBadgeText, { color: colors.textInverse }]}>Take</Text>
                            </View>
                        )}
                    </View>
                </TouchableOpacity>
            )}

            {/* Divider */}
            {varkPaperId && enneagramPaperId && <View style={[styles.divider, { backgroundColor: colors.border }]} />}

            {/* Enneagram Row */}
            {enneagramPaperId && (
                <TouchableOpacity style={styles.quizRow} onPress={handleEnneagram} activeOpacity={0.6}>
                    <View
                        style={[
                            styles.quizIcon,
                            {
                                backgroundColor: enneaType ? enneaType.color + '14' : colors.accentLight,
                            },
                        ]}
                    >
                        <Ionicons
                            name={enneaType ? (enneaType.icon as any) : 'finger-print-outline'}
                            size={20}
                            color={enneaType ? enneaType.color : colors.accent}
                        />
                    </View>
                    <View style={styles.quizTextCol}>
                        <Text style={[styles.quizTitle, { color: colors.textPrimary }]}>Enneagram Type</Text>
                        {enneaType ? (
                            <Text style={[styles.quizResult, { color: enneaType.color }]}>
                                Type {enneaResults!.primaryType}: {enneaType.name}
                            </Text>
                        ) : (
                            <Text style={[styles.quizSubtitle, { color: colors.textTertiary }]}>
                                Discover your personality type
                            </Text>
                        )}
                    </View>
                    <View style={styles.quizAction}>
                        {enneagramResult ? (
                            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                        ) : (
                            <View style={[styles.takeBadge, { backgroundColor: colors.accent }]}>
                                <Text style={[styles.takeBadgeText, { color: colors.textInverse }]}>Take</Text>
                            </View>
                        )}
                    </View>
                </TouchableOpacity>
            )}
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
    quizRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        gap: 12,
    },
    quizIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    quizTextCol: {
        flex: 1,
        gap: 2,
    },
    quizTitle: {
        fontSize: 15,
        fontWeight: displayWeight('600'),
    },
    quizResult: {
        fontSize: 13,
        fontWeight: '600',
    },
    quizSubtitle: {
        fontSize: 12,
    },
    quizAction: {
        marginLeft: 4,
    },
    takeBadge: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 8,
    },
    takeBadgeText: {
        fontSize: 13,
        fontWeight: '700',
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        marginLeft: 52,
    },
});
