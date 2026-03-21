/**
 * DISC Results Screen — shows type result, circumplex chart, score breakdown.
 */
import { useTheme } from '@/contexts/ThemeContext';
import { fetchExamResult } from '@/lib/exams';
import { getDiscLabel, isDiscResults, getCircumplexType } from '@/lib/disc';
import { displayWeight, letterSpacing } from '@/constants/platform';
import type { DiscType, DiscResults } from '@/constants/disc';
import { DISC_TYPES, DISC_TYPE_INFO } from '@/constants/disc';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter, useSegments } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle as SvgCircle, Text as SvgText, Line } from 'react-native-svg';

export default function DiscResultsScreen() {
    const { attemptId } = useLocalSearchParams<{ attemptId: string }>();
    const { colors } = useTheme();
    const router = useRouter();
    const segments = useSegments();
    const isFromRoadmap = segments[1] === 'roadmap';
    const isFromProfile = segments[1] === 'profile';

    const [results, setResults] = useState<DiscResults | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadResult();
    }, [attemptId]);

    const loadResult = async () => {
        try {
            setError(null);
            const stored = await AsyncStorage.getItem(`exam_result_${attemptId}`);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed.personalityResults && isDiscResults(parsed.personalityResults)) {
                    setResults(parsed.personalityResults);
                    setIsLoading(false);
                    return;
                }
            }

            const { data, error: fetchError } = await fetchExamResult(attemptId || '');
            if (data?.personalityResults && isDiscResults(data.personalityResults)) {
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

    const getBackRoute = () => {
        if (isFromProfile) return '/(tabs)/profile';
        if (isFromRoadmap) return '/(tabs)/roadmap';
        return '/(tabs)/exams';
    };

    const handleDone = () => {
        router.replace(getBackRoute() as any);
    };

    const handleRetake = () => {
        router.replace(getBackRoute() as any);
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

    const primaryInfo = DISC_TYPE_INFO[results.disc_type];
    const typeLabel = getDiscLabel(results.disc_type);
    const pctByType: Record<DiscType, number> = {
        D: results.d_pct,
        I: results.i_pct,
        S: results.s_pct,
        C: results.c_pct,
    };
    const sortedTypes = DISC_TYPES.slice().sort((a, b) => pctByType[b] - pctByType[a]);
    const primaryDiscType: DiscType | null =
        results.disc_type === 'Balanced' ? null : (results.disc_type.charAt(0) as DiscType);

    // For Balanced, show closest circumplex type as secondary info
    const closestType = results.disc_type === 'Balanced' ? DISC_TYPE_INFO[getCircumplexType(results.angle)] : null;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={handleDone} style={styles.backBtn}>
                        <Ionicons name="close" size={24} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Your DISC Profile</Text>
                    <View style={{ width: 32 }} />
                </View>

                {/* Primary Result Card */}
                <View style={[styles.resultCard, { backgroundColor: colors.cardBackground }]}>
                    <View style={[styles.typeIconBadge, { backgroundColor: primaryInfo.color + '18' }]}>
                        <Ionicons name={primaryInfo.icon as any} size={28} color={primaryInfo.color} />
                    </View>
                    <Text style={[styles.typeLabel, { color: primaryInfo.color }]}>{typeLabel}</Text>
                    <Text style={[styles.mottoText, { color: colors.textSecondary }]}>
                        &ldquo;{primaryInfo.motto}&rdquo;
                    </Text>

                    {/* Descriptors */}
                    <View style={styles.descriptorsRow}>
                        {primaryInfo.descriptors.map((d, i) => (
                            <View
                                key={i}
                                style={[
                                    styles.descriptorPill,
                                    {
                                        backgroundColor: primaryInfo.color + '14',
                                        borderColor: primaryInfo.color + '30',
                                    },
                                ]}
                            >
                                <Text style={[styles.descriptorText, { color: primaryInfo.color }]}>{d}</Text>
                            </View>
                        ))}
                    </View>

                    <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
                        {primaryInfo.description}
                    </Text>

                    {/* Profile Strength */}
                    {results.profile_strength !== 'balanced' && (
                        <Text style={[styles.strengthLabel, { color: primaryInfo.color }]}>
                            {results.profile_strength === 'strong' ? '\u25CF\u25CF\u25CF' : '\u25CF\u25CF\u25CB'}{' '}
                            {results.profile_strength === 'strong' ? 'Strong' : 'Moderate'} inclination
                        </Text>
                    )}
                    {closestType && (
                        <Text style={[styles.balancedNote, { color: colors.textTertiary }]}>
                            Your closest style: {closestType.fullName}
                        </Text>
                    )}
                </View>

                {/* Quadrant Chart */}
                <View style={[styles.chartCard, { backgroundColor: colors.cardBackground }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Personality Map</Text>
                    <DiscQuadrantChart results={results} colors={colors} />
                </View>

                {/* Strengths & Blind Spots */}
                <View style={[styles.descriptionCard, { backgroundColor: colors.cardBackground }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Strengths</Text>
                    {primaryInfo.strengths.map((item, i) => (
                        <View key={i} style={styles.bulletRow}>
                            <Ionicons name="checkmark-circle-outline" size={14} color={primaryInfo.color} />
                            <Text style={[styles.bulletText, { color: colors.textSecondary }]}>{item}</Text>
                        </View>
                    ))}

                    <Text style={[styles.subsectionTitle, { color: colors.textPrimary }]}>Blind Spots</Text>
                    {primaryInfo.blindSpots.map((item, i) => (
                        <View key={i} style={styles.bulletRow}>
                            <Ionicons name="warning-outline" size={14} color={colors.warning} />
                            <Text style={[styles.bulletText, { color: colors.textSecondary }]}>{item}</Text>
                        </View>
                    ))}
                </View>

                {/* Score Breakdown */}
                <View style={styles.chartSection}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Style Tendencies</Text>
                    {sortedTypes.map((type) => {
                        const pct = pctByType[type];
                        const info = DISC_TYPE_INFO[type];
                        const isPrimary = type === primaryDiscType;

                        return (
                            <View key={type} style={styles.barRow}>
                                <View style={styles.barLabelCol}>
                                    <View
                                        style={[
                                            styles.barTypeBadge,
                                            { backgroundColor: isPrimary ? info.color : info.color + '18' },
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.barTypeBadgeText,
                                                { color: isPrimary ? '#fff' : info.color },
                                            ]}
                                        >
                                            {type}
                                        </Text>
                                    </View>
                                </View>
                                <View style={[styles.barTrack, { backgroundColor: colors.surfacePrimary }]}>
                                    <View
                                        style={[
                                            styles.barFill,
                                            {
                                                backgroundColor: info.color,
                                                width: `${Math.max(pct, 2)}%`,
                                                opacity: isPrimary ? 1 : 0.4,
                                            },
                                        ]}
                                    />
                                    {/* 50% midline */}
                                    <View style={styles.barMidline} />
                                </View>
                                <Text
                                    style={[
                                        styles.barValue,
                                        { color: isPrimary ? colors.textPrimary : colors.textTertiary },
                                    ]}
                                >
                                    {pct}%
                                </Text>
                            </View>
                        );
                    })}
                    <Text style={[styles.midlineNote, { color: colors.textTertiary }]}>50% midline</Text>
                </View>

                {/* All Types Summary */}
                <View style={[styles.allTypesCard, { backgroundColor: colors.cardBackground }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>All DISC Types</Text>
                    {DISC_TYPES.map((type) => {
                        const info = DISC_TYPE_INFO[type];
                        const isPrimary = type === primaryDiscType;
                        return (
                            <View
                                key={type}
                                style={[styles.allTypeRow, isPrimary && { backgroundColor: info.color + '08' }]}
                            >
                                <View style={[styles.allTypeIcon, { backgroundColor: info.color + '18' }]}>
                                    <Ionicons name={info.icon as any} size={18} color={info.color} />
                                </View>
                                <View style={styles.allTypeText}>
                                    <Text style={[styles.allTypeName, { color: colors.textPrimary }]}>
                                        {info.label} - {info.name}
                                        {isPrimary ? ' (You)' : ''}
                                    </Text>
                                    <Text
                                        style={[styles.allTypeDesc, { color: colors.textTertiary }]}
                                        numberOfLines={2}
                                    >
                                        {info.description}
                                    </Text>
                                </View>
                            </View>
                        );
                    })}
                </View>

                {/* Actions */}
                <View style={styles.actionRow}>
                    <TouchableOpacity
                        style={[styles.retakeButton, { borderColor: colors.border }]}
                        onPress={handleRetake}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="refresh" size={18} color={colors.textPrimary} />
                        <Text style={[styles.retakeButtonText, { color: colors.textPrimary }]}>Retake</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.primaryButton, { backgroundColor: colors.accent }]}
                        onPress={handleDone}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.primaryButtonText, { color: colors.textInverse }]}>Done</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

// ── Quadrant Circle Chart (SVG) ──────────────────────────────────
//
// Everything DiSC-style circle: 4 coloured arc segments, axis labels,
// and a dot placed according to the circumplex angle and profile strength.
//
//   Layout:  D (teal, top-left)      I (purple, top-right)
//            C (blue, bottom-left)   S (coral, bottom-right)

function DiscQuadrantChart({ results, colors }: { results: DiscResults; colors: any }) {
    const svgSize = 240;
    const padding = 28;
    const totalSize = svgSize + padding * 2;
    const cx = totalSize / 2;
    const cy = totalSize / 2;
    const r = svgSize / 2;

    const pctByType: Record<DiscType, number> = {
        D: results.d_pct,
        I: results.i_pct,
        S: results.s_pct,
        C: results.c_pct,
    };

    const primaryDiscType: DiscType | null =
        results.disc_type === 'Balanced' ? null : (results.disc_type.charAt(0) as DiscType);

    // SVG arc path — 90-degree pie slice from centre
    const arcPath = (startAngle: number, endAngle: number): string => {
        const toRad = (deg: number) => (deg * Math.PI) / 180;
        const x1 = cx + r * Math.cos(toRad(startAngle));
        const y1 = cy + r * Math.sin(toRad(startAngle));
        const x2 = cx + r * Math.cos(toRad(endAngle));
        const y2 = cy + r * Math.sin(toRad(endAngle));
        return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`;
    };

    const arcs: { type: DiscType; start: number; end: number }[] = [
        { type: 'D', start: 180, end: 270 },
        { type: 'I', start: 270, end: 360 },
        { type: 'S', start: 0, end: 90 },
        { type: 'C', start: 90, end: 180 },
    ];

    const labelOffset = r * 0.5;
    const labelPositions: Record<DiscType, { x: number; y: number }> = {
        D: { x: cx - labelOffset, y: cy - labelOffset },
        I: { x: cx + labelOffset, y: cy - labelOffset },
        S: { x: cx + labelOffset, y: cy + labelOffset },
        C: { x: cx - labelOffset, y: cy + labelOffset },
    };

    // Dot position from circumplex angle and profile strength
    const angleRad = (results.angle * Math.PI) / 180;
    const dotDist = r * (0.15 + (results.strength_pct / 100) * 0.7);
    const dotX = cx + dotDist * Math.cos(angleRad);
    const dotY = cy - dotDist * Math.sin(angleRad); // SVG y is inverted

    const dotColor = DISC_TYPE_INFO[results.disc_type].color;

    return (
        <View style={chartStyles.wrapper}>
            <Svg width={totalSize} height={totalSize} viewBox={`0 0 ${totalSize} ${totalSize}`}>
                {/* Quadrant arcs */}
                {arcs.map(({ type, start, end }) => {
                    const info = DISC_TYPE_INFO[type];
                    const isPrimary = type === primaryDiscType;
                    return (
                        <Path key={type} d={arcPath(start, end)} fill={info.color} opacity={isPrimary ? 0.38 : 0.15} />
                    );
                })}

                {/* Axis cross lines */}
                <Line x1={cx} y1={cy - r} x2={cx} y2={cy + r} stroke={colors.border} strokeWidth={0.5} opacity={0.6} />
                <Line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke={colors.border} strokeWidth={0.5} opacity={0.6} />

                {/* Circle outline */}
                <SvgCircle cx={cx} cy={cy} r={r} fill="none" stroke={colors.border} strokeWidth={1} opacity={0.25} />

                {/* Quadrant labels */}
                {DISC_TYPES.map((type) => {
                    const info = DISC_TYPE_INFO[type];
                    const pos = labelPositions[type];
                    const isPrimary = type === primaryDiscType;
                    const pct = pctByType[type];
                    const textColor = isPrimary ? '#FFFFFF' : colors.textSecondary;
                    return (
                        <React.Fragment key={type}>
                            <SvgText
                                x={pos.x}
                                y={pos.y - 4}
                                fill={textColor}
                                fontSize={24}
                                fontWeight="800"
                                textAnchor="middle"
                                opacity={isPrimary ? 1 : 0.7}
                            >
                                {type}
                            </SvgText>
                            <SvgText
                                x={pos.x}
                                y={pos.y + 14}
                                fill={textColor}
                                fontSize={13}
                                fontWeight="700"
                                textAnchor="middle"
                                opacity={isPrimary ? 0.9 : 0.55}
                            >
                                {pct}%
                            </SvgText>
                        </React.Fragment>
                    );
                })}

                {/* User dot */}
                <SvgCircle cx={dotX} cy={dotY} r={14} fill={dotColor} opacity={0.2} />
                <SvgCircle cx={dotX} cy={dotY} r={8} fill={dotColor} />
                <SvgCircle cx={dotX} cy={dotY} r={8} fill="none" stroke="#FFFFFF" strokeWidth={2} opacity={0.8} />

                {/* Axis labels */}
                <SvgText
                    x={cx}
                    y={cy - r - 10}
                    fill={colors.textTertiary}
                    fontSize={11}
                    fontWeight="600"
                    textAnchor="middle"
                >
                    Active
                </SvgText>
                <SvgText
                    x={cx}
                    y={cy + r + 18}
                    fill={colors.textTertiary}
                    fontSize={11}
                    fontWeight="600"
                    textAnchor="middle"
                >
                    Receptive
                </SvgText>
                <SvgText
                    x={cx - r - 8}
                    y={cy + 4}
                    fill={colors.textTertiary}
                    fontSize={11}
                    fontWeight="600"
                    textAnchor="end"
                >
                    Skeptical
                </SvgText>
                <SvgText
                    x={cx + r + 8}
                    y={cy + 4}
                    fill={colors.textTertiary}
                    fontSize={11}
                    fontWeight="600"
                    textAnchor="start"
                >
                    Agreeable
                </SvgText>
            </Svg>
        </View>
    );
}

const chartStyles = StyleSheet.create({
    wrapper: {
        alignSelf: 'center',
        marginVertical: 8,
    },
});

// ── Styles ───────────────────────────────────────────────────────

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
    backBtn: { padding: 8, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '700' },
    scroll: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 48, flexGrow: 1 },

    // Result card
    resultCard: {
        alignItems: 'center',
        borderRadius: 16,
        padding: 28,
        marginBottom: 16,
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
    typeLabel: {
        fontSize: 30,
        fontWeight: displayWeight('800'),
        letterSpacing: letterSpacing(-0.5),
        textAlign: 'center',
    },
    mottoText: { fontSize: 15, fontStyle: 'italic', textAlign: 'center' },
    descriptorsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 4 },
    descriptorPill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
    descriptorText: { fontSize: 12, fontWeight: '600' },
    cardDescription: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 4 },
    strengthLabel: { fontSize: 13, fontWeight: '600', marginTop: 4 },
    balancedNote: { fontSize: 12, marginTop: 2 },

    // Chart card
    chartCard: {
        borderRadius: 14,
        padding: 16,
        marginBottom: 16,
    },

    // Description
    descriptionCard: {
        borderRadius: 14,
        padding: 16,
        marginBottom: 24,
        gap: 8,
    },
    descriptionText: { fontSize: 14, lineHeight: 21 },
    subsectionTitle: { fontSize: 13, fontWeight: '600', marginTop: 4 },
    bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingLeft: 2 },
    bulletText: { flex: 1, fontSize: 13, lineHeight: 19 },

    // Score breakdown
    sectionTitle: { fontSize: 16, fontWeight: '700', letterSpacing: letterSpacing(-0.2), marginBottom: 4 },
    chartSection: { marginBottom: 24, gap: 8 },
    barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    barLabelCol: { width: 32, alignItems: 'center' },
    barTypeBadge: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    barTypeBadgeText: { fontSize: 13, fontWeight: '700' },
    barTrack: { flex: 1, height: 20, borderRadius: 6, overflow: 'hidden' },
    barFill: { height: 20, borderRadius: 6 },
    barMidline: {
        position: 'absolute',
        left: '50%',
        top: 0,
        height: 20,
        width: 1,
        borderLeftWidth: 1,
        borderStyle: 'dashed',
        borderColor: 'rgba(0,0,0,0.15)',
    },
    barValue: { fontSize: 12, fontWeight: '600', width: 40, textAlign: 'right' },
    midlineNote: { fontSize: 10, textAlign: 'center', marginTop: -4 },

    // All types
    allTypesCard: {
        borderRadius: 14,
        padding: 16,
        marginBottom: 24,
        gap: 8,
    },
    allTypeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 8,
        borderRadius: 8,
    },
    allTypeIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    allTypeText: { flex: 1, gap: 2 },
    allTypeName: { fontSize: 14, fontWeight: '600' },
    allTypeDesc: { fontSize: 12, lineHeight: 16 },

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
