import Avatar from '@/components/Avatar';
import { Fonts } from '@/constants/type';
import { useLiveApplicants, type LivePhase } from '@/hooks/useLiveApplicants';
import type { ThemeColors } from '@/types/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
    colors: ThemeColors;
    onPressApplicant: (candidateId: string) => void;
}

/** v1: bar fill + label are driven by the broadcast phase (no per-question counts). */
function phaseMeta(state: LivePhase, colors: ThemeColors): { label: string; pct: number; color: string } {
    switch (state) {
        case 'viewing-results':
            return { label: 'Viewing results', pct: 100, color: colors.statusLive };
        case 'quiz':
            return { label: 'Taking quiz', pct: 65, color: colors.accent };
        case 'form':
        default:
            return { label: 'Filling form', pct: 25, color: colors.warning };
    }
}

/**
 * "Now onboarding" — a privileged-only dashboard card showing applicants who are
 * filling in their application right now. Collapsed to a single line by default;
 * tap to expand per-applicant phase + progress. Renders nothing when no one is
 * live, so it adds zero clutter on a quiet day. Mount this only behind the
 * privileged dashboard gate (managers/directors in manager view, RO, admin).
 */
function LiveApplicantsCard({ colors, onPressApplicant }: Props) {
    const { applicants } = useLiveApplicants();
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

    if (applicants.length === 0) return null;

    const count = applicants.length;
    const title = `${count} onboarding now`;
    const names =
        applicants
            .slice(0, 3)
            .map((a) => a.name.split(' ')[0])
            .join(', ') + (count > 3 ? ` +${count - 3}` : '');

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
                <Animated.View style={[styles.dot, { backgroundColor: colors.statusLive, opacity: pulse }]} />
                <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
                    {title}
                </Text>
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textTertiary} />
            </TouchableOpacity>

            {!expanded && (
                <TouchableOpacity style={styles.collapsedSub} onPress={() => setExpanded(true)} activeOpacity={0.7}>
                    <View style={styles.cluster}>
                        {applicants.slice(0, 3).map((a, i) => (
                            <View
                                key={a.userId}
                                style={[
                                    styles.clusterAv,
                                    { borderColor: colors.cardBackground, marginLeft: i === 0 ? 0 : -9 },
                                ]}
                            >
                                <Avatar
                                    name={a.name}
                                    size={26}
                                    backgroundColor={colors.accentLight}
                                    textColor={colors.accent}
                                />
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
                        const meta = phaseMeta(a.state, colors);
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
