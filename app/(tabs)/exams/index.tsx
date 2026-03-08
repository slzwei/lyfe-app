import ExamCard from '@/components/ExamCard';
import LoadingState from '@/components/LoadingState';
import ScreenHeader from '@/components/ScreenHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import type { ExamPaper, PaperStats } from '@/types/exam';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
export default function ExamsListScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const router = useRouter();

    const [papers, setPapers] = useState<ExamPaper[]>([]);
    const [stats, setStats] = useState<Record<string, PaperStats>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setError(null);

            const { data: papersData, error: papersError } = await supabase
                .from('exam_papers')
                .select('*')
                .eq('is_active', true)
                .order('display_order');

            if (papersError) throw papersError;
            setPapers(papersData as ExamPaper[]);

            // Fetch best attempt stats for current user
            if (user?.id) {
                const { data: attempts } = await supabase
                    .from('exam_attempts')
                    .select('paper_id, score, percentage, passed, submitted_at')
                    .eq('user_id', user.id)
                    .in('status', ['submitted', 'auto_submitted']);

                if (attempts) {
                    const statsMap: Record<string, PaperStats> = {};
                    for (const attempt of attempts) {
                        const existing = statsMap[attempt.paper_id];
                        if (!existing) {
                            statsMap[attempt.paper_id] = {
                                attemptCount: 1,
                                bestScore: attempt.percentage,
                                lastAttemptDate: attempt.submitted_at,
                                bestPassed: attempt.passed,
                            };
                        } else {
                            existing.attemptCount++;
                            if (attempt.percentage && (!existing.bestScore || attempt.percentage > existing.bestScore)) {
                                existing.bestScore = attempt.percentage;
                                existing.bestPassed = attempt.passed;
                            }
                            if (attempt.submitted_at && (!existing.lastAttemptDate || attempt.submitted_at > existing.lastAttemptDate)) {
                                existing.lastAttemptDate = attempt.submitted_at;
                            }
                        }
                    }
                    setStats(statsMap);
                }
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load exams');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [user?.id]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const onRefresh = useCallback(() => {
        setIsRefreshing(true);
        fetchData();
    }, [fetchData]);

    const handlePaperPress = (paper: ExamPaper) => {
        if (paper.question_count === 0) return;
        router.push(`/(tabs)/exams/take/${paper.id}`);
    };

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <ScreenHeader title="Exams" subtitle="Complete all 4 mandatory papers to get licensed" />
                <LoadingState rows={3} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScreenHeader
                title="Exams"
                subtitle="Complete all 4 mandatory papers to get licensed"
            />
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.accent} />
                }
            >

                {/* Progress Overview */}
                <View style={[styles.progressCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                    <View style={styles.progressHeader}>
                        <Ionicons name="ribbon-outline" size={20} color={colors.accent} />
                        <Text style={[styles.progressTitle, { color: colors.textPrimary }]}>Your Progress</Text>
                    </View>
                    <View style={styles.progressBar}>
                        {papers.filter(p => p.is_mandatory).map((paper) => {
                            const passed = stats[paper.id]?.bestPassed === true;
                            return (
                                <View
                                    key={paper.id}
                                    style={[
                                        styles.progressSegment,
                                        {
                                            backgroundColor: passed ? colors.success : colors.surfacePrimary,
                                            borderColor: passed ? colors.success : colors.border,
                                        },
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.progressSegmentText,
                                            { color: passed ? colors.textInverse : colors.textTertiary },
                                        ]}
                                    >
                                        {paper.code}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                </View>

                {/* Error Banner */}
                {error && (
                    <TouchableOpacity
                        style={[styles.errorBanner, { backgroundColor: colors.dangerLight }]}
                        onPress={fetchData}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="alert-circle" size={18} color={colors.danger} />
                        <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
                        <Text style={[styles.retryText, { color: colors.danger }]}>Tap to retry</Text>
                    </TouchableOpacity>
                )}

                {/* Exam Cards */}
                {papers.map((paper) => (
                    <ExamCard
                        key={paper.id}
                        paper={paper}
                        stats={stats[paper.id] || null}
                        onPress={() => handlePaperPress(paper)}
                        disabled={paper.question_count === 0}
                    />
                ))}

                {/* Empty State */}
                {papers.length === 0 && !error && (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="school-outline" size={64} color={colors.textTertiary} />
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                            No exams available yet
                        </Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 32,
        paddingTop: 12,
    },
    progressCard: {
        borderRadius: 12,
        borderWidth: 0.5,
        padding: 16,
        marginBottom: 20,
    },
    progressHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    progressTitle: { fontSize: 14, fontWeight: '600' },
    progressBar: {
        flexDirection: 'row',
        gap: 6,
    },
    progressSegment: {
        flex: 1,
        height: 32,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    progressSegmentText: { fontSize: 11, fontWeight: '700' },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        borderRadius: 10,
        marginBottom: 12,
    },
    errorText: { flex: 1, fontSize: 13 },
    retryText: { fontSize: 12, fontWeight: '600' },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 64,
        gap: 16,
    },
    emptyText: { fontSize: 15 },
});
