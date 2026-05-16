import { useTheme } from '@/contexts/ThemeContext';
import { fetchExamResult } from '@/lib/exams';
import { getPreferenceLabel } from '@/lib/vark';
import { displayWeight, letterSpacing } from '@/constants/platform';
import type { VarkType, VarkResults, VarkPreference } from '@/constants/vark';
import { VARK_TYPE_INFO, VARK_CHART_COLORS, VARK_MIN_ANSWERED } from '@/constants/vark';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter, useSegments } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const VARK_ORDER: VarkType[] = ['V', 'A', 'R', 'K'];

const PREFERENCE_BADGES: Record<VarkPreference, string> = {
    single: 'Single Preference',
    bimodal: 'Bimodal',
    trimodal: 'Trimodal',
    multimodal: 'Multimodal',
};

export default function VarkResultsScreen() {
    const { attemptId } = useLocalSearchParams<{ attemptId: string }>();
    const { colors } = useTheme();
    const router = useRouter();
    const segments = useSegments() as unknown as string[];
    const isFromRoadmap = segments[1] === 'roadmap';
    const isFromProfile = segments[1] === 'profile';

    const [varkResults, setVarkResults] = useState<VarkResults | null>(null);
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
                if (parsed.personalityResults) {
                    setVarkResults(parsed.personalityResults);
                    setIsLoading(false);
                    return;
                }
            }

            // Fall back to Supabase
            const { data, error: fetchError } = await fetchExamResult(attemptId || '');
            if (data?.personalityResults) {
                setVarkResults(data.personalityResults as VarkResults | null);
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

    const getBackRoute = () => {
        if (isFromProfile) return '/(tabs)/profile';
        if (isFromRoadmap) return '/(tabs)/roadmap';
        return '/(tabs)/exams';
    };

    const handleDone = () => {
        router.replace(getBackRoute());
    };

    const handleRetake = () => {
        router.replace(getBackRoute());
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

    if (!varkResults || error) {
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
                        <Text style={[styles.doneButtonText, { color: colors.textInverse }]}>Back to Roadmap</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const typeLabels: Record<VarkType, string> = { V: 'Visual', A: 'Aural', R: 'Read/Write', K: 'Kinesthetic' };
    const preferenceLabel = getPreferenceLabel(varkResults.topTypes, typeLabels);
    const maxScore = Math.max(...VARK_ORDER.map((t) => varkResults.scores[t]), 1);
    const totalSelections = VARK_ORDER.reduce((sum, t) => sum + varkResults.scores[t], 0);
    const isLowConfidence = totalSelections < VARK_MIN_ANSWERED;

    // Sort by score descending for the bar chart
    const sortedTypes = VARK_ORDER.slice().sort((a, b) => varkResults.scores[b] - varkResults.scores[a]);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={handleDone} style={styles.backBtn}>
                        <Ionicons name="close" size={24} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Your Learning Style</Text>
                    <View style={{ width: 32 }} />
                </View>

                {/* ── 1. Hero Card (unified shell: icon → eyebrow → name → secondary) ── */}
                <View
                    style={[
                        styles.heroCard,
                        {
                            backgroundColor: colors.cardBackground,
                            borderColor: colors.accent + '30',
                        },
                    ]}
                >
                    <View style={[styles.typeIconBadge, { backgroundColor: colors.accentLight }]}>
                        <Ionicons name="school-outline" size={28} color={colors.accent} />
                    </View>

                    <Text style={[styles.heroLabel, { color: colors.textTertiary }]}>YOUR LEARNING STYLE</Text>

                    <Text style={[styles.heroName, { color: colors.textPrimary }]}>{preferenceLabel}</Text>

                    <Text style={[styles.heroSecondary, { color: colors.textSecondary }]}>
                        {PREFERENCE_BADGES[varkResults.preference]}
                    </Text>

                    {varkResults.topTypes.length > 0 && (
                        <View style={styles.topIcons}>
                            {varkResults.topTypes.map((t) => (
                                <View
                                    key={t}
                                    style={[styles.topIconBadge, { backgroundColor: getBarColor(t, colors) + '18' }]}
                                >
                                    <Ionicons name={VARK_TYPE_INFO[t].icon} size={16} color={getBarColor(t, colors)} />
                                    <Text style={[styles.topIconLabel, { color: getBarColor(t, colors) }]}>
                                        {VARK_TYPE_INFO[t].label}
                                    </Text>
                                </View>
                            ))}
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

                {/* Bar Chart */}
                <View style={styles.chartSection}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Score Breakdown</Text>
                    {sortedTypes.map((type) => {
                        const score = varkResults.scores[type];
                        const pct = varkResults.percentages[type];
                        const barColor = getBarColor(type, colors);
                        const barWidth = maxScore > 0 ? (score / maxScore) * 100 : 0;
                        const isTop = varkResults.topTypes.includes(type);

                        return (
                            <View key={type} style={styles.barRow}>
                                <View style={styles.barLabelCol}>
                                    <Ionicons name={VARK_TYPE_INFO[type].icon} size={16} color={barColor} />
                                    <Text
                                        style={[
                                            styles.barLabel,
                                            { color: isTop ? colors.textPrimary : colors.textTertiary },
                                            isTop && { fontWeight: '700' },
                                        ]}
                                    >
                                        {VARK_TYPE_INFO[type].label}
                                    </Text>
                                </View>
                                <View style={styles.barTrack}>
                                    <View
                                        style={[
                                            styles.barFill,
                                            {
                                                backgroundColor: barColor,
                                                width: `${Math.max(barWidth, 2)}%`,
                                                opacity: isTop ? 1 : 0.4,
                                            },
                                        ]}
                                    />
                                </View>
                                <Text
                                    style={[
                                        styles.barValue,
                                        { color: isTop ? colors.textPrimary : colors.textTertiary },
                                    ]}
                                >
                                    {score} ({pct}%)
                                </Text>
                            </View>
                        );
                    })}
                </View>

                {/* Top Modality Details */}
                <View style={styles.detailsSection}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>What This Means</Text>
                    {varkResults.topTypes.map((type) => {
                        const info = VARK_TYPE_INFO[type];
                        const barColor = getBarColor(type, colors);

                        return (
                            <View
                                key={type}
                                style={[
                                    styles.detailCard,
                                    { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder },
                                ]}
                            >
                                <View style={styles.detailHeader}>
                                    <View style={[styles.detailIconBadge, { backgroundColor: barColor + '18' }]}>
                                        <Ionicons name={info.icon} size={20} color={barColor} />
                                    </View>
                                    <Text style={[styles.detailTitle, { color: colors.textPrimary }]}>
                                        {info.label}
                                    </Text>
                                </View>
                                <Text style={[styles.detailDesc, { color: colors.textSecondary }]}>
                                    {info.description}
                                </Text>

                                <Text style={[styles.tipsTitle, { color: colors.textPrimary }]}>Study Tips</Text>
                                {info.tips.map((tip, i) => (
                                    <View key={i} style={styles.tipRow}>
                                        <Ionicons name="checkmark-circle-outline" size={14} color={barColor} />
                                        <Text style={[styles.tipText, { color: colors.textSecondary }]}>{tip}</Text>
                                    </View>
                                ))}
                            </View>
                        );
                    })}
                </View>

                {/* Multimodal note */}
                {varkResults.topTypes.length >= 2 && (
                    <View style={[styles.noteCard, { backgroundColor: colors.infoLight }]}>
                        <Ionicons name="information-circle-outline" size={16} color={colors.info} />
                        <Text style={[styles.noteText, { color: colors.textPrimary }]}>
                            If more than one modality is near the top, use strategies from each of those modalities
                            rather than trying to force yourself into one label.
                        </Text>
                    </View>
                )}

                {/* ── Disclaimer (shared across DISC/Enneagram/VARK) ── */}
                <Text style={[styles.disclaimer, { color: colors.textTertiary }]}>
                    This assessment is for personal reflection only. Your profile may vary across situations and over
                    time.
                </Text>

                {/* ── Actions ── */}
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

/** Get bar color from theme, falling back to the static fallback */
function getBarColor(type: VarkType, colors: Record<string, string>): string {
    const config = VARK_CHART_COLORS[type];
    return (colors as Record<string, string>)[config.colorKey] || config.fallback;
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

    // ── Unified hero card (matches DISC + Enneagram shell) ──────────
    heroCard: {
        alignItems: 'center',
        borderRadius: 20,
        borderWidth: 1,
        padding: 24,
        marginBottom: 12,
        gap: 8,
    },
    typeIconBadge: {
        width: 56,
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
    },
    heroLabel: {
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: letterSpacing(1),
        textTransform: 'uppercase',
    },
    heroName: {
        fontSize: 28,
        fontWeight: displayWeight('800'),
        letterSpacing: letterSpacing(-0.5),
        textAlign: 'center',
    },
    heroSecondary: { fontSize: 13, textAlign: 'center' },
    topIcons: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 },
    topIconBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
    },
    topIconLabel: { fontSize: 12, fontWeight: '600' },

    // Disclaimer (shared copy across DISC/Enneagram/VARK)
    disclaimer: {
        fontSize: 11,
        textAlign: 'center',
        lineHeight: 16,
        marginBottom: 24,
        paddingHorizontal: 8,
    },

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

    // Chart
    chartSection: { marginBottom: 24, gap: 10 },
    sectionTitle: { fontSize: 16, fontWeight: '700', letterSpacing: letterSpacing(-0.2), marginBottom: 4 },
    barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    barLabelCol: { flexDirection: 'row', alignItems: 'center', gap: 6, width: 100 },
    barLabel: { fontSize: 13 },
    barTrack: {
        flex: 1,
        height: 20,
        backgroundColor: 'transparent',
        borderRadius: 6,
        overflow: 'hidden',
    },
    barFill: { height: 20, borderRadius: 6 },
    barValue: { fontSize: 12, fontWeight: '600', width: 60, textAlign: 'right' },

    // Details
    detailsSection: { marginBottom: 16, gap: 12 },
    detailCard: {
        borderRadius: 14,
        borderWidth: 0.5,
        padding: 16,
        gap: 8,
    },
    detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
    detailIconBadge: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    detailTitle: { fontSize: 16, fontWeight: '700' },
    detailDesc: { fontSize: 14, lineHeight: 20 },
    tipsTitle: { fontSize: 13, fontWeight: '600', marginTop: 4 },
    tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingLeft: 2 },
    tipText: { flex: 1, fontSize: 13, lineHeight: 19 },

    // Note
    noteCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        padding: 14,
        borderRadius: 10,
        marginBottom: 24,
    },
    noteText: { flex: 1, fontSize: 13, lineHeight: 19 },

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
