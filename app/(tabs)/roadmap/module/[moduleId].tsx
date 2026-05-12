import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useTypedRouter } from '@/hooks/useTypedRouter';
import { Ionicons } from '@expo/vector-icons';
import WebView from 'react-native-webview';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import ScreenHeader from '@/components/ScreenHeader';
import ModuleCard from '@/components/roadmap/ModuleCard';
import ModuleItemRow from '@/components/roadmap/ModuleItemRow';
import ErrorBanner from '@/components/ErrorBanner';
import {
    fetchModule,
    fetchModuleResources,
    fetchModuleProgressForCandidate,
    fetchModuleItemsWithProgress,
} from '@/lib/roadmap';
import { supabase } from '@/lib/supabase';
import { TAB_BAR_HEIGHT } from '@/constants/platform';
import { letterSpacing } from '@/constants/platform';
import type { RoadmapModule, RoadmapResource, CandidateModuleProgress, ModuleItemWithProgress } from '@/types/roadmap';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ORIGIN = SUPABASE_URL ? new URL(SUPABASE_URL).origin : '';

/**
 * Candidate-facing module detail screen.
 * Entirely read-only — no completion actions.
 * Completion is managed by PA/Manager/Director from management views.
 */
export default function ModuleDetailScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const { moduleId } = useLocalSearchParams<{ moduleId: string }>();
    const router = useTypedRouter();
    const { bottom } = useSafeAreaInsets();

    const [module, setModule] = useState<RoadmapModule | null>(null);
    const [progress, setProgress] = useState<CandidateModuleProgress | null>(null);
    const [resources, setResources] = useState<RoadmapResource[]>([]);
    const [items, setItems] = useState<ModuleItemWithProgress[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isItemsLoading, setIsItemsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // In-app PDF viewer
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [pdfTitle, setPdfTitle] = useState('');
    const [showPdf, setShowPdf] = useState(false);

    const loadData = useCallback(async () => {
        if (!moduleId) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);

        const [moduleRes, resourcesRes, progressRes] = await Promise.all([
            fetchModule(moduleId),
            fetchModuleResources(moduleId),
            user?.id
                ? fetchModuleProgressForCandidate(user.id, moduleId)
                : Promise.resolve({ data: null, error: null }),
        ]);

        if (moduleRes.error) {
            setError(moduleRes.error);
            setIsLoading(false);
            return;
        }

        if (!moduleRes.data) {
            setError('This module is not available.');
            setIsLoading(false);
            return;
        }

        setModule(moduleRes.data);
        setResources(resourcesRes.data ?? []);
        setProgress(progressRes.data ?? null);
        setIsLoading(false);

        // Lazy-load items after main content renders
        if (user?.id) {
            setIsItemsLoading(true);
            const itemsRes = await fetchModuleItemsWithProgress(moduleId, user.id);
            setItems(itemsRes.data ?? []);
            setIsItemsLoading(false);
        } else {
            setIsItemsLoading(false);
        }
    }, [moduleId, user?.id]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleTakeExam = useCallback(() => {
        if (module?.exam_paper_id) {
            router.push(`/(tabs)/roadmap/exam/${module.exam_paper_id}`);
        }
    }, [module, router]);

    const handleStartExam = useCallback(
        (examPaperId: string) => {
            router.push(`/(tabs)/roadmap/exam/${examPaperId}`);
        },
        [router],
    );

    const handleViewResults = useCallback(
        async (examPaperId: string) => {
            // Look up the latest completed attempt for this exam paper
            const { data } = await supabase
                .from('exam_attempts')
                .select('id, personality_results')
                .eq('paper_id', examPaperId)
                .eq('user_id', user?.id ?? '')
                .in('status', ['submitted', 'auto_submitted'])
                .order('submitted_at', { ascending: false })
                .limit(1)
                .single();

            if (data) {
                const isEnneagram =
                    data.personality_results &&
                    typeof data.personality_results === 'object' &&
                    'quizType' in data.personality_results &&
                    data.personality_results.quizType === 'enneagram';
                const isVark =
                    data.personality_results &&
                    typeof data.personality_results === 'object' &&
                    'topTypes' in data.personality_results;
                const resultPath = isEnneagram ? `enneagram/${data.id}` : isVark ? `vark/${data.id}` : data.id;
                router.push(`/(tabs)/roadmap/results/${resultPath}`);
            }
        },
        [user?.id, router],
    );

    const handleViewMaterial = useCallback((url: string, title: string) => {
        setPdfUrl(url);
        setPdfTitle(title);
        setShowPdf(true);
    }, []);

    // Build the enriched module object that ModuleCard expects
    const enrichedModule = module
        ? {
              ...module,
              progress,
              resources,
              itemSummary: null,
              isLocked: false,
              examPaper: null,
              prerequisiteIds: [],
              isArchived: module.archived_at !== null,
          }
        : null;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <ScreenHeader title={module?.title ?? 'Module'} showBack />

            {error && <ErrorBanner message={error} onRetry={loadData} />}

            {isLoading ? (
                <View style={styles.loading}>
                    <ActivityIndicator size="large" color={colors.accent} />
                    <Text style={[styles.loadingText, { color: colors.textTertiary }]}>Loading module...</Text>
                </View>
            ) : enrichedModule ? (
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + bottom + 16 }}
                >
                    <ModuleCard
                        module={enrichedModule}
                        colors={colors}
                        onTakeExam={module?.module_type === 'exam' && module.exam_paper_id ? handleTakeExam : undefined}
                    />

                    {/* Items Checklist */}
                    {isItemsLoading ? (
                        <View style={styles.itemsLoading}>
                            {[0, 1, 2].map((i) => (
                                <View key={i} style={[styles.skeletonRow, { backgroundColor: colors.border + '20' }]} />
                            ))}
                        </View>
                    ) : items.length > 0 ? (
                        <View style={styles.itemsSection}>
                            <View style={styles.itemsHeader}>
                                <Text style={[styles.itemsSectionTitle, { color: colors.textPrimary }]}>Checklist</Text>
                                <View style={[styles.itemsCountBadge, { backgroundColor: colors.accent + '14' }]}>
                                    <Text style={[styles.itemsCountText, { color: colors.accent }]}>
                                        {items.filter((i) => i.progress?.status === 'completed').length}/{items.length}
                                    </Text>
                                </View>
                            </View>
                            {items.map((item, idx) => (
                                <ModuleItemRow
                                    key={item.id}
                                    item={item}
                                    colors={colors}
                                    isLast={idx === items.length - 1}
                                    onStartExam={handleStartExam}
                                    onViewResults={handleViewResults}
                                    onViewMaterial={handleViewMaterial}
                                />
                            ))}
                        </View>
                    ) : null}
                </ScrollView>
            ) : (
                <View style={styles.emptyState}>
                    <Ionicons name="alert-circle-outline" size={48} color={colors.textTertiary} />
                    <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Module not found</Text>
                    <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                        This module may have been removed or archived.
                    </Text>
                    <Pressable
                        style={[styles.backButton, { backgroundColor: colors.accent }]}
                        onPress={() => router.back()}
                    >
                        <Text style={[styles.backButtonText, { color: colors.textInverse }]}>Go Back</Text>
                    </Pressable>
                </View>
            )}
            {/* In-app PDF / file viewer */}
            <Modal
                visible={showPdf}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowPdf(false)}
            >
                <View style={{ flex: 1, backgroundColor: colors.background }}>
                    <View
                        style={[
                            styles.pdfHeader,
                            {
                                borderBottomWidth: StyleSheet.hairlineWidth,
                                borderBottomColor: colors.border,
                            },
                        ]}
                    >
                        <TouchableOpacity
                            onPress={() => setShowPdf(false)}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                            style={styles.pdfDoneButton}
                        >
                            <Text style={[styles.pdfDoneText, { color: colors.accent }]}>Done</Text>
                        </TouchableOpacity>
                        <Text style={[styles.pdfTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                            {pdfTitle}
                        </Text>
                        <View style={styles.pdfDoneButton} />
                    </View>
                    {pdfUrl && (
                        <WebView
                            source={{ uri: pdfUrl }}
                            style={{ flex: 1 }}
                            originWhitelist={[SUPABASE_ORIGIN]}
                            startInLoadingState={true}
                            renderLoading={() => (
                                <ActivityIndicator size="large" color={colors.accent} style={StyleSheet.absoluteFill} />
                            )}
                            onError={() => {}}
                            onHttpError={() => {}}
                            renderError={() => (
                                <View style={styles.pdfErrorContainer}>
                                    <Ionicons name="cloud-offline-outline" size={48} color={colors.textTertiary} />
                                    <Text style={[styles.pdfErrorTitle, { color: colors.textPrimary }]}>
                                        Unable to load file
                                    </Text>
                                    <Text style={[styles.pdfErrorSubtitle, { color: colors.textTertiary }]}>
                                        Please check your connection and try again.
                                    </Text>
                                </View>
                            )}
                        />
                    )}
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scroll: {
        flex: 1,
    },
    loading: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    loadingText: {
        fontSize: 14,
    },
    itemsSection: {
        paddingHorizontal: 16,
        paddingTop: 24,
    },
    itemsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    itemsSectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: letterSpacing(-0.2),
    },
    itemsCountBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    itemsCountText: {
        fontSize: 12,
        fontWeight: '600',
    },
    itemsLoading: {
        paddingHorizontal: 16,
        paddingTop: 24,
        gap: 12,
    },
    skeletonRow: {
        height: 44,
        borderRadius: 8,
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
        gap: 12,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
    backButton: {
        marginTop: 8,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 10,
    },
    backButtonText: {
        fontSize: 15,
        fontWeight: '600',
    },
    pdfHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    pdfDoneButton: {
        width: 52,
    },
    pdfDoneText: {
        fontSize: 17,
        fontWeight: '600',
    },
    pdfTitle: {
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
        textAlign: 'center',
    },
    pdfErrorContainer: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        gap: 8,
    },
    pdfErrorTitle: {
        fontSize: 17,
        fontWeight: '600',
        textAlign: 'center',
    },
    pdfErrorSubtitle: {
        fontSize: 14,
        textAlign: 'center',
    },
});
