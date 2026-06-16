import Avatar from '@/components/Avatar';
import { Fonts } from '@/constants/type';
import { useLiveApplicants, type LiveApplicant } from '@/hooks/useLiveApplicants';
import { FORM_STEPS, QUIZ_TOTAL } from '@/lib/recruitment/liveApplicants';
import type { ThemeColors } from '@/types/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
    colors: ThemeColors;
    onPressApplicant: (candidateId: string) => void;
}

function clamp(n: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, n));
}

/**
 * Label + bar fill for a live applicant. Uses the precise progress counts when
 * loaded (v2); falls back to the coarse broadcast phase until then. Form occupies
 * 0–50% of the bar, quiz 50–100%; values are clamped.
 */
function phaseMeta(a: LiveApplicant, colors: ThemeColors): { label: string; pct: number; color: string } {
    const p = a.progress;
    switch (a.state) {
        case 'viewing-results':
            return { label: 'Viewing results', pct: 100, color: colors.statusLive };
        case 'quiz': {
            if (!p) return { label: 'Taking quiz', pct: 65, color: colors.accent };
            const answered = clamp(p.quizAnswered, 0, QUIZ_TOTAL);
            return {
                label: `Taking quiz · ${answered}/${QUIZ_TOTAL}`,
                pct: clamp(50 + (answered / QUIZ_TOTAL) * 50, 50, 100),
                color: colors.accent,
            };
        }
        case 'form':
        default: {
            if (!p || p.onboardingStep < 1) return { label: 'Filling form', pct: 25, color: colors.warning };
            const step = clamp(p.onboardingStep, 1, FORM_STEPS);
            return {
                label: `Filling form · ${step}/${FORM_STEPS}`,
                pct: clamp((step / FORM_STEPS) * 50, 8, 50),
                color: colors.warning,
            };
        }
    }
}

/**
 * "Now onboarding" dashboard card (privileged audience only — gated by the
 * caller). Persistent: it always shows today's state rather than vanishing.
 *   - Applicants filling their form/quiz right now appear live with a phase bar.
 *   - When no one is live, it shows "N onboarded today".
 *   - "Onboarded today" lists candidates invited today (SGT) who finished.
 */
function LiveApplicantsCard({ colors, onPressApplicant }: Props) {
    const { applicants, todaysOnboarded } = useLiveApplicants();
    const [expanded, setExpanded] = useState(false);

    // Pulsing "live" dot (matches LiveEventBar's pattern).
    const pulse = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 0.35, duration: 700, useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
            ]),
        );
        loop.start();
        return () => loop.stop();
    }, [pulse]);

    const hasLive = applicants.length > 0;
    // A live "viewing-results" candidate can also be in today's onboarded set —
    // show them only once (as live).
    const liveIds = new Set(applicants.map((a) => a.userId));
    const completedToday = todaysOnboarded.filter((t) => !liveIds.has(t.userId));

    // Show only when there's something today — live applicants OR someone already
    // onboarded. When nothing has happened yet, render nothing.
    if (!hasLive && completedToday.length === 0) return null;

    const title = hasLive ? `${applicants.length} onboarding now` : `${completedToday.length} onboarded today`;

    const clusterPeople = hasLive ? applicants : completedToday;
    const names =
        clusterPeople
            .slice(0, 3)
            .map((a) => a.name.split(' ')[0])
            .join(', ') + (clusterPeople.length > 3 ? ` +${clusterPeople.length - 3}` : '');

    const dotColor = hasLive ? colors.statusLive : completedToday.length > 0 ? colors.success : colors.textTertiary;
    const avatarBg = hasLive ? colors.accentLight : colors.successLight;
    const avatarFg = hasLive ? colors.accent : colors.success;

    return (
        <View style={[styles.card, { backgroundColor: colors.cardBackground, shadowColor: colors.textPrimary }]}>
            <TouchableOpacity
                style={styles.header}
                onPress={() => setExpanded((e) => !e)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                accessibilityLabel={`${title}. Tap to ${expanded ? 'collapse' : 'expand'}.`}
            >
                <Animated.View style={[styles.dot, { backgroundColor: dotColor, opacity: hasLive ? pulse : 1 }]} />
                <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
                    {title}
                </Text>
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textTertiary} />
            </TouchableOpacity>

            {!expanded && clusterPeople.length > 0 && (
                <TouchableOpacity style={styles.collapsedSub} onPress={() => setExpanded(true)} activeOpacity={0.7}>
                    <View style={styles.cluster}>
                        {clusterPeople.slice(0, 3).map((a, i) => (
                            <View
                                key={a.userId}
                                style={[
                                    styles.clusterAv,
                                    { borderColor: colors.cardBackground, marginLeft: i === 0 ? 0 : -9 },
                                ]}
                            >
                                <Avatar name={a.name} size={26} backgroundColor={avatarBg} textColor={avatarFg} />
                            </View>
                        ))}
                    </View>
                    <Text style={[styles.names, { color: colors.textSecondary }]} numberOfLines={1}>
                        {names}
                    </Text>
                </TouchableOpacity>
            )}

            {expanded && (
                <View style={styles.body}>
                    {applicants.map((a) => {
                        const meta = phaseMeta(a, colors);
                        return (
                            <TouchableOpacity
                                key={a.userId}
                                style={[styles.row, { borderTopColor: colors.hairline }]}
                                onPress={() => onPressApplicant(a.candidateId)}
                                activeOpacity={0.7}
                                accessibilityRole="button"
                                accessibilityLabel={`${a.name}, ${meta.label}`}
                            >
                                <Avatar
                                    name={a.name}
                                    size={38}
                                    backgroundColor={colors.accentLight}
                                    textColor={colors.accent}
                                />
                                <View style={styles.rowMain}>
                                    <View style={styles.rowTop}>
                                        <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                                            {a.name}
                                        </Text>
                                        <View style={[styles.chip, { backgroundColor: meta.color + '1F' }]}>
                                            <Text style={[styles.chipText, { color: meta.color }]}>{meta.label}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.track}>
                                        <View
                                            style={[
                                                styles.fill,
                                                { backgroundColor: meta.color, width: `${meta.pct}%` },
                                            ]}
                                        />
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    })}

                    {completedToday.map((c) => (
                        <TouchableOpacity
                            key={c.userId}
                            style={[styles.row, { borderTopColor: colors.hairline }]}
                            onPress={() => onPressApplicant(c.candidateId)}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            accessibilityLabel={`${c.name}, onboarded`}
                        >
                            <Avatar
                                name={c.name}
                                size={38}
                                backgroundColor={colors.successLight}
                                textColor={colors.success}
                            />
                            <View style={styles.rowMain}>
                                <View style={styles.rowTop}>
                                    <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                                        {c.name}
                                    </Text>
                                    <View style={[styles.doneChip, { backgroundColor: colors.success + '1F' }]}>
                                        <Ionicons name="checkmark" size={12} color={colors.success} />
                                        <Text style={[styles.doneText, { color: colors.success }]}>Done</Text>
                                    </View>
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        marginHorizontal: 16,
        marginBottom: 20,
        borderRadius: 20,
        padding: 16,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 2,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    dot: {
        width: 9,
        height: 9,
        borderRadius: 5,
    },
    title: {
        flex: 1,
        fontFamily: Fonts.sansSemibold,
        fontSize: 15,
        fontWeight: '600',
        letterSpacing: -0.1,
    },
    collapsedSub: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 12,
    },
    cluster: {
        flexDirection: 'row',
    },
    clusterAv: {
        borderRadius: 999,
        borderWidth: 2,
    },
    names: {
        flex: 1,
        fontFamily: Fonts.sans,
        fontSize: 13,
    },
    body: {
        marginTop: 6,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        paddingTop: 14,
        marginTop: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    rowMain: {
        flex: 1,
        minWidth: 0,
    },
    rowTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        marginBottom: 9,
    },
    name: {
        flex: 1,
        fontFamily: Fonts.sansSemibold,
        fontSize: 15,
        fontWeight: '600',
        letterSpacing: -0.1,
    },
    chip: {
        paddingHorizontal: 9,
        paddingVertical: 3,
        borderRadius: 10,
    },
    chipText: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.2,
    },
    doneChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 9,
        paddingVertical: 3,
        borderRadius: 10,
    },
    doneText: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.2,
    },
    track: {
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(0,0,0,0.06)',
        overflow: 'hidden',
    },
    fill: {
        height: '100%',
        borderRadius: 4,
    },
});

export default React.memo(LiveApplicantsCard);
