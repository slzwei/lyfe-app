/**
 * DISC Results Screen — hero card, personality map, style tendencies,
 * priorities, strengths, blind spots, disclaimer.
 *
 * Section order mirrors the web results page exactly.
 */
import { useTheme } from '@/contexts/ThemeContext';
import { fetchExamResult } from '@/lib/exams';
import { isDiscResults, getCircumplexType, getSecondaryType } from '@/lib/disc';
import { displayWeight, letterSpacing } from '@/constants/platform';
import type { DiscType, DiscResults, DiscResultType } from '@/constants/disc';
import {
    DISC_TYPES,
    DISC_TYPE_INFO,
    DISC_PRIORITIES,
    DISC_BRIDGE_TEXT,
    DISC_SECONDARY_STRENGTHS,
    DISC_SECONDARY_BLIND_SPOTS,
} from '@/constants/disc';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter, useSegments } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Easing,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle as SvgCircle, Line, Path, Text as SvgText } from 'react-native-svg';

// ── DISC type hex colors (hardcoded per design spec, same as web) ──

const DISC_HEX: Record<DiscType, string> = {
    D: '#2B8C8C',
    I: '#9B7EC8',
    S: '#D4876C',
    C: '#4A7FB5',
};

const DISC_LABELS: Record<DiscType, string> = {
    D: 'Drive',
    I: 'Influence',
    S: 'Support',
    C: 'Clarity',
};

const AnimatedSvgCircle = Animated.createAnimatedComponent(SvgCircle);

// ── Root screen ──────────────────────────────────────────────────

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

    // ── Derived data ──────────────────────────────────────────────

    const isBalanced = results.disc_type === 'Balanced';
    const primaryInfo = DISC_TYPE_INFO[results.disc_type];
    const primaryDiscType: DiscType | null = isBalanced ? null : (results.disc_type.charAt(0) as DiscType);

    // For Balanced, show the closest circumplex type as a note
    const closestTypeInfo = isBalanced ? DISC_TYPE_INFO[getCircumplexType(results.angle)] : null;

    // Sorted by percentage descending for the bar chart
    const pctByType: Record<DiscType, number> = {
        D: results.d_pct,
        I: results.i_pct,
        S: results.s_pct,
        C: results.c_pct,
    };
    const sortedTypes = DISC_TYPES.slice().sort((a, b) => pctByType[b] - pctByType[a]);

    // Priorities (top 3 as cards, remainder as text)
    const topPriorities = results.priorities.slice(0, 3);
    const extraPriorities = results.priorities.slice(3);

    // Subtype display and secondary type
    const secondaryType = getSecondaryType(results);
    // Build Everything DiSC display code (I is always lowercase 'i')
    const discLetter = (t: DiscType) => (t === 'I' ? 'i' : t);
    const subtypeCode =
        !isBalanced && primaryDiscType && secondaryType
            ? discLetter(primaryDiscType) + discLetter(secondaryType)
            : null;
    const bridgeKey = primaryDiscType && secondaryType ? `${primaryDiscType}-${secondaryType}` : null;
    const bridgeText = bridgeKey ? (DISC_BRIDGE_TEXT[bridgeKey] ?? null) : null;
    const secondaryStrength = secondaryType ? DISC_SECONDARY_STRENGTHS[secondaryType] : null;
    const secondaryBlindSpot = secondaryType ? DISC_SECONDARY_BLIND_SPOTS[secondaryType] : null;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                {/* ── Header ── */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={handleDone} style={styles.backBtn}>
                        <Ionicons name="close" size={24} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Your DISC Profile</Text>
                    <View style={styles.headerSpacer} />
                </View>

                {/* ── 1. Hero Card ── */}
                <View
                    style={[
                        styles.heroCard,
                        {
                            backgroundColor: colors.cardBackground,
                            borderColor: primaryInfo.color + '30',
                        },
                    ]}
                >
                    <View style={[styles.typeIconBadge, { backgroundColor: primaryInfo.color + '18' }]}>
                        <Ionicons name={primaryInfo.icon as any} size={28} color={primaryInfo.color} />
                    </View>

                    <Text style={[styles.heroLabel, { color: colors.textTertiary }]}>YOUR DISC PROFILE</Text>

                    <Text style={[styles.heroName, { color: primaryInfo.color }]}>
                        {primaryInfo.name}
                        {subtypeCode ? (
                            <Text style={[styles.heroSubtype, { color: primaryInfo.color + 'AA' }]}>
                                {' '}
                                ({subtypeCode})
                            </Text>
                        ) : null}
                    </Text>

                    {secondaryType && (
                        <Text style={[styles.heroSecondary, { color: colors.textTertiary }]}>
                            with {DISC_LABELS[secondaryType]} secondary
                        </Text>
                    )}

                    <Text style={[styles.heroMotto, { color: colors.textSecondary }]}>
                        &ldquo;{primaryInfo.motto}&rdquo;
                    </Text>

                    <View style={styles.descriptorsRow}>
                        {primaryInfo.descriptors.map((d) => (
                            <View
                                key={d}
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

                    <Text style={[styles.heroDescription, { color: colors.textSecondary }]}>
                        {primaryInfo.description}
                    </Text>

                    {/* Profile strength indicator */}
                    {!isBalanced && (
                        <View style={styles.inclinationRow}>
                            <Text style={[styles.inclinationLabel, { color: colors.textTertiary }]}>
                                Inclination strength
                            </Text>
                            <View style={styles.inclinationDots}>
                                {[0, 1, 2].map((i) => (
                                    <View
                                        key={i}
                                        style={[
                                            styles.inclinationDot,
                                            {
                                                backgroundColor:
                                                    i < (results.profile_strength === 'strong' ? 3 : 2)
                                                        ? primaryInfo.color
                                                        : primaryInfo.color + '25',
                                            },
                                        ]}
                                    />
                                ))}
                            </View>
                            <Text style={[styles.inclinationValue, { color: primaryInfo.color }]}>
                                {results.profile_strength === 'strong' ? 'Strong' : 'Moderate'}
                            </Text>
                        </View>
                    )}

                    {/* Balanced: show closest style */}
                    {closestTypeInfo && (
                        <Text style={[styles.balancedNote, { color: colors.textTertiary }]}>
                            Your closest style: {closestTypeInfo.fullName}
                        </Text>
                    )}
                </View>

                {/* ── 2. Personality Map ── */}
                <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
                    <Text style={[styles.cardSectionLabel, { color: colors.textTertiary }]}>PERSONALITY MAP</Text>
                    <DiscCircumplexChart results={results} colors={colors} />
                </View>

                {/* ── 3. Score Breakdown (renamed from "Behavioral Blend" to match Enneagram/VARK) ── */}
                <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Score Breakdown</Text>
                    <Text style={[styles.sectionSubtitle, { color: colors.textTertiary }]}>
                        Independent scores — not percentages of a whole
                    </Text>
                    <View style={styles.barsContainer}>
                        {sortedTypes.map((type) => {
                            const pct = pctByType[type];
                            const hex = DISC_HEX[type];
                            const isPrimary = type === primaryDiscType;
                            return (
                                <View key={type} style={styles.barRow}>
                                    <Text style={[styles.barLabel, { color: hex }]}>{DISC_LABELS[type]}</Text>
                                    <View style={[styles.barTrack, { backgroundColor: colors.surfacePrimary }]}>
                                        <View
                                            style={[
                                                styles.barFill,
                                                {
                                                    backgroundColor: hex,
                                                    width: `${Math.max(pct, 2)}%` as any,
                                                    opacity: isPrimary ? 1 : 0.45,
                                                },
                                            ]}
                                        />
                                        {/* 50% midline */}
                                        <View style={[styles.barMidline, { backgroundColor: colors.border }]} />
                                    </View>
                                    <Text
                                        style={[
                                            styles.barValue,
                                            {
                                                color: isPrimary ? colors.textPrimary : colors.textTertiary,
                                            },
                                        ]}
                                    >
                                        {pct}%
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                    <Text style={[styles.midlineNote, { color: colors.textTertiary }]}>50% midline</Text>
                    {isBalanced && (
                        <Text style={[styles.balancedBarNote, { color: colors.textTertiary }]}>
                            Your scores are closely balanced — you naturally adapt across all four styles.
                        </Text>
                    )}
                    {!isBalanced && (
                        <Text style={[styles.blendExplainer, { color: colors.textTertiary }]}>
                            Your DISC type is based on where you fall on two behavioral axes (pace and focus), not the
                            highest individual score.
                        </Text>
                    )}
                </View>

                {/* ── 4. Your Priorities ── */}
                <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Your Priorities</Text>
                    <Text style={[styles.sectionSubtitle, { color: colors.textTertiary }]}>
                        The areas where you focus your energy
                    </Text>
                    <View style={styles.priorityCards}>
                        {topPriorities.map((name) => {
                            const pDef = DISC_PRIORITIES.find((p) => p.name === name);
                            if (!pDef) return null;
                            const hex = DISC_HEX[pDef.dimension];
                            return (
                                <View
                                    key={name}
                                    style={[
                                        styles.priorityCard,
                                        {
                                            backgroundColor: colors.surfacePrimary,
                                            borderColor: colors.border,
                                        },
                                    ]}
                                >
                                    <View style={[styles.priorityCardTopBar, { backgroundColor: hex }]} />
                                    <View style={styles.priorityCardBody}>
                                        <View style={styles.priorityCardHeader}>
                                            <View style={[styles.priorityDot, { backgroundColor: hex }]} />
                                            <Text style={[styles.priorityName, { color: colors.textPrimary }]}>
                                                {name}
                                            </Text>
                                        </View>
                                        <Text style={[styles.priorityDesc, { color: colors.textSecondary }]}>
                                            {pDef.description}
                                        </Text>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                    {extraPriorities.length > 0 && (
                        <Text style={[styles.extraPriorities, { color: colors.textTertiary }]}>
                            Also relevant:{' '}
                            <Text style={[styles.extraPrioritiesNames, { color: colors.textSecondary }]}>
                                {extraPriorities.join(', ')}
                            </Text>
                        </Text>
                    )}
                </View>

                {/* ── 5. Strengths ── */}
                <View
                    style={[
                        styles.strengthsCard,
                        { borderColor: colors.success + '30', backgroundColor: colors.success + '0a' },
                    ]}
                >
                    <View style={styles.strengthsHeader}>
                        <View style={[styles.strengthsIconBadge, { backgroundColor: colors.success + '20' }]}>
                            <Ionicons name="checkmark" size={14} color={colors.success} />
                        </View>
                        <Text style={[styles.strengthsTitle, { color: colors.textPrimary }]}>Strengths</Text>
                    </View>
                    {bridgeText && (
                        <Text style={[styles.bridgeText, { color: colors.textSecondary }]}>{bridgeText}</Text>
                    )}
                    {primaryInfo.strengths.map((item, i) => (
                        <View key={i} style={styles.bulletRow}>
                            <Ionicons name="checkmark-circle-outline" size={15} color={colors.success} />
                            <Text style={[styles.bulletText, { color: colors.textSecondary }]}>{item}</Text>
                        </View>
                    ))}
                    {secondaryStrength && (
                        <View style={styles.bulletRow}>
                            <Ionicons name="checkmark-circle-outline" size={15} color={colors.success} />
                            <Text style={[styles.bulletText, { color: colors.textSecondary }]}>
                                {secondaryStrength}
                            </Text>
                        </View>
                    )}
                </View>

                {/* ── 6. Blind Spots ── */}
                <View
                    style={[
                        styles.blindSpotsCard,
                        { borderColor: colors.warning + '30', backgroundColor: colors.warning + '0a' },
                    ]}
                >
                    <View style={styles.strengthsHeader}>
                        <View style={[styles.blindSpotsIconBadge, { backgroundColor: colors.warning + '20' }]}>
                            <Ionicons name="warning" size={12} color={colors.warning} />
                        </View>
                        <Text style={[styles.blindSpotsTitle, { color: colors.textPrimary }]}>Blind Spots</Text>
                    </View>
                    {primaryInfo.blindSpots.map((item, i) => (
                        <View key={i} style={styles.bulletRow}>
                            <Ionicons name="warning-outline" size={15} color={colors.warning} />
                            <Text style={[styles.bulletText, { color: colors.textSecondary }]}>{item}</Text>
                        </View>
                    ))}
                    {secondaryBlindSpot && (
                        <View style={styles.bulletRow}>
                            <Ionicons name="warning-outline" size={15} color={colors.warning} />
                            <Text style={[styles.bulletText, { color: colors.textSecondary }]}>
                                {secondaryBlindSpot}
                            </Text>
                        </View>
                    )}
                </View>

                {/* ── 7. Disclaimer (shared copy across DISC/Enneagram/VARK) ── */}
                <Text style={[styles.disclaimer, { color: colors.textTertiary }]}>
                    This assessment is for personal reflection only. Your profile may vary across situations and over
                    time.
                </Text>

                {/* ── Actions ── */}
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

// ── Circumplex Chart ─────────────────────────────────────────────
//
// Quadrant layout (matches web CircumplexChart.tsx):
//   D (teal)   — top-left   (90°–180°)
//   I (purple) — top-right  (0°–90°)
//   S (coral)  — bot-right  (270°–360°)
//   C (blue)   — bot-left   (180°–270°)

interface ChartArc {
    type: DiscType;
    startDeg: number;
    endDeg: number;
}

function DiscCircumplexChart({ results, colors }: { results: DiscResults; colors: any }) {
    // Circle geometry — larger chart with axis labels instead of priority labels
    const outerR = 125;
    const svgPad = 40; // padding for axis labels outside circle
    const totalSize = (outerR + svgPad) * 2; // 330
    const cx = totalSize / 2;
    const cy = totalSize / 2;

    const primaryDiscType: DiscType | null =
        results.disc_type === 'Balanced' ? null : (results.disc_type.charAt(0) as DiscType);

    // ── Pulse animation for user dot glow ──
    const pulseAnim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1400,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: false,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 0,
                    duration: 1400,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: false,
                }),
            ]),
        ).start();
    }, []);

    const glowOuterOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.06, 0.15] });
    const glowOuterR = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 30] });
    const glowMidOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.06, 0.15] });
    const glowMidR = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [15, 19] });

    const arcPath = (startDeg: number, endDeg: number): string => {
        const toRad = (d: number) => (d * Math.PI) / 180;
        const x1 = cx + outerR * Math.cos(toRad(startDeg));
        const y1 = cy + outerR * Math.sin(toRad(startDeg));
        const x2 = cx + outerR * Math.cos(toRad(endDeg));
        const y2 = cy + outerR * Math.sin(toRad(endDeg));
        return `M ${cx} ${cy} L ${x1} ${y1} A ${outerR} ${outerR} 0 0 1 ${x2} ${y2} Z`;
    };

    const arcs: ChartArc[] = [
        { type: 'D', startDeg: 180, endDeg: 270 },
        { type: 'I', startDeg: 270, endDeg: 360 },
        { type: 'S', startDeg: 0, endDeg: 90 },
        { type: 'C', startDeg: 90, endDeg: 180 },
    ];

    const quadLabelPos: Record<DiscType, { x: number; y: number }> = {
        D: { x: cx - outerR * 0.42, y: cy - outerR * 0.35 },
        I: { x: cx + outerR * 0.42, y: cy - outerR * 0.35 },
        S: { x: cx + outerR * 0.42, y: cy + outerR * 0.4 },
        C: { x: cx - outerR * 0.42, y: cy + outerR * 0.4 },
    };

    // User dot: math angle (0°=east, 90°=north), SVG y is inverted
    const angleRad = (results.angle * Math.PI) / 180;
    const normalizedMag = Math.min(results.strength_pct / 100, 1);
    const dotDist = outerR * (0.15 + normalizedMag * 0.7);
    const dotX = cx + dotDist * Math.cos(angleRad);
    const dotY = cy - dotDist * Math.sin(angleRad);

    const refCircles = [0.33, 0.66].map((f) => outerR * f);

    return (
        <View style={chartStyles.wrapper}>
            <Svg width={totalSize} height={totalSize} viewBox={`0 0 ${totalSize} ${totalSize}`}>
                {/* Quadrant arcs */}
                {arcs.map(({ type, startDeg, endDeg }) => {
                    const hex = DISC_HEX[type];
                    const isPrimary = type === primaryDiscType;
                    return (
                        <Path
                            key={`arc-${type}`}
                            d={arcPath(startDeg, endDeg)}
                            fill={hex}
                            opacity={isPrimary ? 0.18 : 0.06}
                        />
                    );
                })}

                {/* Reference circles */}
                {refCircles.map((r, i) => (
                    <SvgCircle
                        key={`ref-${i}`}
                        cx={cx}
                        cy={cy}
                        r={r}
                        fill="none"
                        stroke={colors.border}
                        strokeWidth={0.75}
                        strokeDasharray="3 3"
                        opacity={0.5}
                    />
                ))}

                {/* Axis lines */}
                <Line
                    x1={cx - outerR}
                    y1={cy}
                    x2={cx + outerR}
                    y2={cy}
                    stroke={colors.border}
                    strokeWidth={0.75}
                    opacity={0.6}
                />
                <Line
                    x1={cx}
                    y1={cy - outerR}
                    x2={cx}
                    y2={cy + outerR}
                    stroke={colors.border}
                    strokeWidth={0.75}
                    opacity={0.6}
                />

                {/* Outer circle */}
                <SvgCircle
                    cx={cx}
                    cy={cy}
                    r={outerR}
                    fill="none"
                    stroke={colors.border}
                    strokeWidth={1.5}
                    opacity={0.4}
                />

                {/* Axis labels — outside the circle */}
                <SvgText x={cx} y={16} textAnchor="middle" fill={colors.textSecondary} fontSize={9} fontWeight="600">
                    FAST-PACED
                </SvgText>
                <SvgText
                    x={cx}
                    y={totalSize - 6}
                    textAnchor="middle"
                    fill={colors.textSecondary}
                    fontSize={9}
                    fontWeight="600"
                >
                    METHODICAL
                </SvgText>
                <SvgText
                    x={16}
                    y={cy}
                    textAnchor="middle"
                    fill={colors.textSecondary}
                    fontSize={9}
                    fontWeight="600"
                    transform={`rotate(-90, 16, ${cy})`}
                >
                    TASK-FOCUSED
                </SvgText>
                <SvgText
                    x={totalSize - 16}
                    y={cy}
                    textAnchor="middle"
                    fill={colors.textSecondary}
                    fontSize={9}
                    fontWeight="600"
                    transform={`rotate(90, ${totalSize - 16}, ${cy})`}
                >
                    PEOPLE-FOCUSED
                </SvgText>

                {/* Quadrant letters + type names */}
                {DISC_TYPES.map((type) => {
                    const pos = quadLabelPos[type];
                    const hex = DISC_HEX[type];
                    const isPrimary = type === primaryDiscType;
                    return (
                        <React.Fragment key={`qlabel-${type}`}>
                            <SvgText
                                x={pos.x}
                                y={pos.y}
                                fill={hex}
                                fontSize={isPrimary ? 30 : 28}
                                fontWeight="700"
                                textAnchor="middle"
                            >
                                {type}
                            </SvgText>
                            <SvgText
                                x={pos.x}
                                y={pos.y + 16}
                                fill={hex}
                                fontSize={10}
                                fontWeight="600"
                                textAnchor="middle"
                            >
                                {DISC_LABELS[type]}
                            </SvgText>
                        </React.Fragment>
                    );
                })}

                {/* User dot — pulsing glow + static white dot */}
                <AnimatedSvgCircle
                    cx={dotX}
                    cy={dotY}
                    r={glowOuterR as any}
                    fill="#FFFFFF"
                    opacity={glowOuterOpacity as any}
                />
                <AnimatedSvgCircle
                    cx={dotX}
                    cy={dotY}
                    r={glowMidR as any}
                    fill="#FFFFFF"
                    opacity={glowMidOpacity as any}
                />
                <SvgCircle cx={dotX} cy={dotY} r={7} fill="#FFFFFF" />
                <SvgCircle
                    cx={dotX}
                    cy={dotY}
                    r={7}
                    fill="none"
                    stroke="#000000"
                    strokeOpacity={0.25}
                    strokeWidth={1.5}
                />

                {/* Balanced: dashed pulse ring */}
                {results.profile_strength === 'balanced' && (
                    <SvgCircle
                        cx={dotX}
                        cy={dotY}
                        r={14}
                        fill="none"
                        stroke="#a8a29e"
                        strokeWidth={1}
                        strokeDasharray="2 2"
                        opacity={0.4}
                    />
                )}
            </Svg>
        </View>
    );
}

const chartStyles = StyleSheet.create({
    wrapper: {
        alignSelf: 'center',
        marginVertical: 4,
    },
});

// ── Styles ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
    errorText: { fontSize: 15 },
    doneButton: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, marginTop: 8 },
    doneButtonText: { fontSize: 14, fontWeight: '600' },

    // Layout
    scroll: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 48 },

    // Header
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
    headerSpacer: { width: 44 },

    // Hero card
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
    // Shared with Enneagram + VARK — eyebrow caps at 1.0 letterSpacing
    heroLabel: {
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: letterSpacing(1),
        textTransform: 'uppercase',
    },
    heroName: {
        fontSize: 32,
        fontWeight: displayWeight('800'),
        letterSpacing: letterSpacing(-0.5),
        textAlign: 'center',
    },
    heroMotto: { fontSize: 15, fontStyle: 'italic', textAlign: 'center' },
    descriptorsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 6,
        marginTop: 4,
    },
    descriptorPill: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 20,
        borderWidth: 1,
    },
    descriptorText: { fontSize: 12, fontWeight: '600' },
    heroSecondary: { fontSize: 13, textAlign: 'center' },
    heroDescription: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 4 },
    heroSubtype: { fontSize: 22, fontWeight: '500' },
    inclinationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 6,
    },
    inclinationLabel: { fontSize: 11 },
    inclinationDots: { flexDirection: 'row', gap: 4 },
    inclinationDot: { width: 8, height: 8, borderRadius: 4 },
    inclinationValue: { fontSize: 12, fontWeight: '600' },
    balancedNote: { fontSize: 12, marginTop: 2 },

    // Generic card
    card: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
    },
    cardSectionLabel: {
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: letterSpacing(0.15),
        textTransform: 'uppercase',
        textAlign: 'center',
        marginBottom: 2,
    },

    // Section headers
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: letterSpacing(-0.2),
        marginBottom: 2,
    },
    sectionSubtitle: { fontSize: 12, marginBottom: 12 },

    // Bar chart
    barsContainer: { gap: 10 },
    barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    barLabel: { fontSize: 13, fontWeight: '600', width: 72 },
    barTrack: {
        flex: 1,
        height: 10,
        borderRadius: 5,
        overflow: 'hidden',
    },
    barFill: { height: 10, borderRadius: 5 },
    barMidline: {
        position: 'absolute',
        left: '50%',
        marginLeft: -0.5,
        top: 0,
        height: 10,
        width: 1,
        opacity: 0.5,
    },
    barValue: { fontSize: 13, fontWeight: '700', width: 38, textAlign: 'right' },
    midlineNote: { fontSize: 10, textAlign: 'center', marginTop: 6 },
    balancedBarNote: { fontSize: 12, textAlign: 'center', marginTop: 6, lineHeight: 17 },
    blendExplainer: { fontSize: 11, textAlign: 'center', marginTop: 8, lineHeight: 16 },

    // Priority cards
    priorityCards: { gap: 8, marginTop: 4 },
    priorityCard: {
        borderRadius: 12,
        borderWidth: 0.5,
        overflow: 'hidden',
    },
    priorityCardTopBar: { height: 3 },
    priorityCardBody: { padding: 12, gap: 4 },
    priorityCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    priorityDot: { width: 8, height: 8, borderRadius: 4 },
    priorityName: { fontSize: 14, fontWeight: '700' },
    priorityDesc: { fontSize: 13, lineHeight: 19 },
    extraPriorities: { fontSize: 12, marginTop: 10 },
    extraPrioritiesNames: { fontWeight: '500' },

    // Strengths card (emerald tint)
    strengthsCard: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 16,
        marginBottom: 12,
        gap: 8,
    },
    strengthsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    strengthsIconBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    strengthsTitle: { fontSize: 14, fontWeight: '700' },
    bridgeText: { fontSize: 13, lineHeight: 19, fontStyle: 'italic', marginBottom: 4 },

    // Blind spots card (amber tint)
    blindSpotsCard: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 16,
        marginBottom: 12,
        gap: 8,
    },
    blindSpotsIconBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    blindSpotsTitle: { fontSize: 14, fontWeight: '700' },

    // Bullet rows (shared by strengths and blind spots)
    bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    bulletText: { flex: 1, fontSize: 13, lineHeight: 19 },

    // Disclaimer
    disclaimer: {
        fontSize: 11,
        textAlign: 'center',
        lineHeight: 16,
        marginBottom: 24,
        paddingHorizontal: 8,
    },

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
