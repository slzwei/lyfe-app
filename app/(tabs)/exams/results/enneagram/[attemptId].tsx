import { useTheme } from '@/contexts/ThemeContext';
import { fetchExamResult } from '@/lib/exams';
import { getEnneagramLabel, isEnneagramResults } from '@/lib/enneagram';
import { displayWeight, letterSpacing } from '@/constants/platform';
import type { EnneagramType, EnneagramResults } from '@/constants/enneagram';
import { ENNEAGRAM_TYPES, ENNEAGRAM_TYPE_INFO, ENNEAGRAM_MIN_ANSWERED_PCT } from '@/constants/enneagram';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter, useSegments } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ENNEAGRAM_MIN_ANSWERED = ENNEAGRAM_MIN_ANSWERED_PCT;

export default function EnneagramResultsScreen() {
    const { attemptId } = useLocalSearchParams<{ attemptId: string }>();
    const { colors } = useTheme();
    const router = useRouter();
    const segments = useSegments();
    const isFromRoadmap = segments[1] === 'roadmap';

    const [results, setResults] = useState<EnneagramResults | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadResult();
    }, [attemptId]);

    const loadResult = async () => {
        try {
            setError(null);
            // Try AsyncStorage first (immediate post-submit)
            const stored = await AsyncStorage.getItem(`exam_result_${attemptId}`);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed.personalityResults && isEnneagramResults(parsed.personalityResults)) {
                    setResults(parsed.personalityResults);
                    setIsLoading(false);
                    return;
                }
            }

            // Fall back to Supabase
            const { data, error: fetchError } = await fetchExamResult(attemptId || '');
            if (data?.personalityResults && isEnneagramResults(data.personalityResults)) {
                setResults(data.personalityResults);
            } else if (fetchError) {
                setError(fetchError);
            } else {
                setError('Result not found.');
            }
        } catch {
            setError('Failed to load results.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDone = () => {
        router.replace(isFromRoadmap ? '/(tabs)/roadmap' : '/(tabs)/exams');
    };

    const handleRetake = () => {
        router.replace(isFromRoadmap ? '/(tabs)/roadmap' : '/(tabs)/exams');
    };

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.accent} />
                </View>
            </SafeAreaView>
        );
    }

    if (!results || error) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
                <View style={styles.loadingContainer}>
                    <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
                    <Text style={[styles.errorText, { color: colors.textSecondary }]}>
                        {error || 'Result not found'}
                    </Text>
                    <TouchableOpacity
                        onPress={handleDone}
                        style={[styles.doneButton, { backgroundColor: colors.accent }]}
                    >
                        <Text style={[styles.doneButtonText, { color: colors.textInverse }]}>
                            Back to {isFromRoadmap ? 'Roadmap' : 'Exams'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const primaryInfo = ENNEAGRAM_TYPE_INFO[results.primaryType];
    const typeLabel = getEnneagramLabel(results.primaryType, results.wing);
    const wingInfo = results.wing != null ? ENNEAGRAM_TYPE_INFO[results.wing] : null;
    const totalSelections = ENNEAGRAM_TYPES.reduce((sum, t) => sum + (results.scores[String(t)] || 0), 0);
    const isLowConfidence = totalSelections < ENNEAGRAM_MIN_ANSWERED;
    const maxScore = Math.max(...ENNEAGRAM_TYPES.map((t) => results.scores[String(t)] || 0), 1);

    // Sort by score descending for the bar chart
    const sortedTypes = ENNEAGRAM_TYPES.slice().sort(
        (a, b) => (results.scores[String(b)] || 0) - (results.scores[String(a)] || 0),
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={handleDone} style={styles.backBtn}>
                        <Ionicons name="close" size={24} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Your Enneagram Type</Text>
                    <View style={{ width: 32 }} />
                </View>

                {/* Primary Result Card */}
                <View
                    style={[
                        styles.resultCard,
                        { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder },
                    ]}
                >
                    <View style={[styles.typeNumberBadge, { backgroundColor: primaryInfo.color + '18' }]}>
                        <Ionicons name={primaryInfo.icon as any} size={28} color={primaryInfo.color} />
                    </View>
                    <Text style={[styles.typeLabel, { color: colors.textPrimary }]}>{typeLabel}</Text>
                    <Text style={[styles.typeName, { color: primaryInfo.color }]}>{primaryInfo.name}</Text>
                    {wingInfo && (
                        <View style={[styles.wingBadge, { backgroundColor: colors.surfacePrimary }]}>
                            <Ionicons name={wingInfo.icon as any} size={14} color={wingInfo.color} />
                            <Text style={[styles.wingText, { color: colors.textSecondary }]}>
                                Wing {results.wing}: {wingInfo.name}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Low confidence warning */}
                {isLowConfidence && (
                    <View
                        style={[
                            styles.warningCard,
                            { backgroundColor: colors.warningLight, borderColor: colors.warning + '30' },
                        ]}
                    >
                        <Ionicons name="warning-outline" size={16} color={colors.warning} />
                        <Text style={[styles.warningText, { color: colors.warning }]}>
                            Low confidence result. Answer more questions for a more accurate profile.
                        </Text>
                    </View>
                )}

                {/* Description Card */}
                <View
                    style={[
                        styles.descriptionCard,
                        { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder },
                    ]}
                >
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>About Your Type</Text>
                    <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>
                        {primaryInfo.description}
                    </Text>

                    <Text style={[styles.subsectionTitle, { color: colors.textPrimary }]}>Key Strengths</Text>
                    {primaryInfo.strengths.map((strength, i) => (
                        <View key={i} style={styles.bulletRow}>
                            <Ionicons name="checkmark-circle-outline" size={14} color={primaryInfo.color} />
                            <Text style={[styles.bulletText, { color: colors.textSecondary }]}>{strength}</Text>
                        </View>
                    ))}

                    <Text style={[styles.subsectionTitle, { color: colors.textPrimary }]}>Growth Path</Text>
                    {primaryInfo.growthTips.map((tip, i) => (
                        <View key={i} style={styles.bulletRow}>
                            <Ionicons name="arrow-forward-circle-outline" size={14} color={colors.accent} />
                            <Text style={[styles.bulletText, { color: colors.textSecondary }]}>{tip}</Text>
                        </View>
                    ))}
                </View>

                {/* Bar Chart */}
                <View style={styles.chartSection}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Score Breakdown</Text>
                    {sortedTypes.map((type) => {
                        const score = results.scores[String(type)] || 0;
                        const pct = results.percentages[String(type)] || 0;
                        const info = ENNEAGRAM_TYPE_INFO[type];
                        const barWidth = maxScore > 0 ? (score / maxScore) * 100 : 0;
                        const isPrimary = type === results.primaryType;

                        return (
                            <View key={type} style={styles.barRow}>
                                <View style={styles.barLabelCol}>
                                    <View
                                        style={[
                                            styles.barTypeNum,
                                            {
                                                backgroundColor: isPrimary ? info.color : info.color + '18',
                                            },
                                        ]}
                                    >
                                        <Text
                                            style={[styles.barTypeNumText, { color: isPrimary ? '#fff' : info.color }]}
                                        >
                                            {type}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.barTrack}>
                                    <View
                                        style={[
                                            styles.barFill,
                                            {
                                                backgroundColor: info.color,
                                                width: `${Math.max(barWidth, 2)}%`,
                                                opacity: isPrimary ? 1 : 0.4,
                                            },
                                        ]}
                                    />
                                </View>
                                <Text
                                    style={[
                                        styles.barValue,
                                        { color: isPrimary ? colors.textPrimary : colors.textTertiary },
                                    ]}
                                >
                                    {score} ({pct}%)
                                </Text>
                            </View>
                        );
                    })}
                </View>

                {/* Actions */}
                <View style={styles.actionRow}>
                    <TouchableOpacity
                        style={[styles.retakeButton, { borderColor: colors.border }]}
                        onPress={handleRetake}
                    >
                        <Ionicons name="refresh" size={18} color={colors.textPrimary} />
                        <Text style={[styles.retakeButtonText, { color: colors.textPrimary }]}>Retake</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.primaryButton, { backgroundColor: colors.accent }]}
                        onPress={handleDone}
                    >
                        <Text style={[styles.primaryButtonText, { color: colors.textInverse }]}>Done</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
    errorText: { fontSize: 15 },
    doneButton: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, marginTop: 8 },
    doneButtonText: { fontSize: 14, fontWeight: '600' },
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
    scroll: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 48, flexGrow: 1 },

    // Result card
    resultCard: {
        alignItems: 'center',
        borderRadius: 16,
        borderWidth: 0.5,
        padding: 28,
        marginBottom: 16,
        gap: 8,
    },
    typeNumberBadge: {
        width: 56,
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
    },
    typeLabel: {
        fontSize: 30,
        fontWeight: displayWeight('800'),
        letterSpacing: letterSpacing(-0.5),
        textAlign: 'center',
    },
    typeName: {
        fontSize: 18,
        fontWeight: '600',
        textAlign: 'center',
    },
    wingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        marginTop: 4,
    },
    wingText: { fontSize: 13, fontWeight: '500' },

    // Warning
    warningCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        marginBottom: 16,
    },
    warningText: { flex: 1, fontSize: 13, lineHeight: 18 },

    // Description
    descriptionCard: {
        borderRadius: 14,
        borderWidth: 0.5,
        padding: 16,
        marginBottom: 24,
        gap: 8,
    },
    descriptionText: { fontSize: 14, lineHeight: 21 },
    subsectionTitle: { fontSize: 13, fontWeight: '600', marginTop: 4 },
    bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingLeft: 2 },
    bulletText: { flex: 1, fontSize: 13, lineHeight: 19 },

    // Chart
    sectionTitle: { fontSize: 16, fontWeight: '700', letterSpacing: letterSpacing(-0.2), marginBottom: 4 },
    chartSection: { marginBottom: 24, gap: 8 },
    barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    barLabelCol: { width: 32, alignItems: 'center' },
    barTypeNum: {
        width: 26,
        height: 26,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    barTypeNumText: { fontSize: 13, fontWeight: '700' },
    barTrack: {
        flex: 1,
        height: 20,
        backgroundColor: 'transparent',
        borderRadius: 6,
        overflow: 'hidden',
    },
    barFill: { height: 20, borderRadius: 6 },
    barValue: { fontSize: 12, fontWeight: '600', width: 60, textAlign: 'right' },

    // Actions
    actionRow: { flexDirection: 'row', gap: 8 },
    retakeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
    },
    retakeButtonText: { fontSize: 15, fontWeight: '600' },
    primaryButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
    },
    primaryButtonText: { fontSize: 15, fontWeight: '700' },
});
