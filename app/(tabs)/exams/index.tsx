import ErrorBanner from '@/components/ErrorBanner';
import ExamCard from '@/components/ExamCard';
import LoadingState from '@/components/LoadingState';
import ScreenHeader from '@/components/ScreenHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { fetchExamPapersWithAttempts } from '@/lib/exams';
import type { ExamPaper, PaperStats } from '@/types/exam';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
        if (!user?.id) return;
        try {
            setError(null);

            const {
                papers: papersData,
                stats: statsData,
                error: fetchError,
            } = await fetchExamPapersWithAttempts(user.id);

            if (fetchError) throw new Error(fetchError);
            setPapers(papersData);
            setStats(statsData);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load quizzes');
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
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <ScreenHeader title="Quizzes" />
                <LoadingState rows={3} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <ScreenHeader title="Quizzes" />
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.accent} />
                }
            >
                {/* Error Banner */}
                {error && <ErrorBanner message={error} onRetry={fetchData} />}

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
                            No quizzes available yet
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
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 64,
        gap: 16,
    },
    emptyText: { fontSize: 15 },
});
