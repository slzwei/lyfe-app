import { Fonts } from '@/constants/type';
import { letterSpacing } from '@/constants/platform';
import type { PaperRequirement, PaperRequirementStatus } from '@/types/recruitment';
import type { ThemeColors } from '@/types/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
    requirements: PaperRequirement[];
    colors: ThemeColors;
    onMark?: (requirement: PaperRequirement) => void;
}

function statusMeta(status: PaperRequirementStatus, colors: ThemeColors): { label: string; color: string } {
    switch (status) {
        case 'passed':
            return { label: 'Passed', color: colors.success };
        case 'failed':
            return { label: 'Failed', color: colors.danger };
        case 'scheduled':
            return { label: 'Scheduled', color: colors.warning };
        default:
            return { label: 'Not Started', color: colors.textTertiary };
    }
}

function formatShortDate(iso: string | null): string | null {
    if (!iso) return null;
    try {
        return new Date(iso).toLocaleDateString('en-SG', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    } catch {
        return null;
    }
}

// Subtitle = copy WITHOUT the leading paper code. Paper code is returned
// separately so it can be typeset in Fonts.mono at the end of the line.
function buildSubtitleParts(req: PaperRequirement): { subtitle: string; code?: string } {
    const attemptCount = req.attempts.length;
    const plural = attemptCount === 1 ? '' : 's';

    if (req.status === 'passed' && req.passedAttempt) {
        const when = formatShortDate(req.passedAttempt.exam_at);
        const subtitle = when
            ? `passed ${when} · ${attemptCount} attempt${plural}`
            : `${attemptCount} attempt${plural}`;
        return { subtitle, code: req.passedAttempt.paper_code };
    }
    if (req.status === 'failed' && req.latest) {
        const when = formatShortDate(req.latest.exam_at);
        const subtitle = when ? `latest ${when} — retake needed` : 'retake needed';
        return { subtitle, code: req.latest.paper_code };
    }
    if (req.status === 'scheduled' && req.latest) {
        const when = formatShortDate(req.latest.exam_at);
        const cost = req.latest.cost != null ? ` · S$${Number(req.latest.cost).toFixed(0)}` : '';
        const subtitle = when ? `${when}${cost}` : cost.replace(/^ · /, '');
        return { subtitle, code: req.latest.paper_code };
    }
    return { subtitle: req.acceptedPaperCodes.join(' or ') };
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

export default function PapersSection({ requirements, colors, onMark }: Props) {
    const passedCount = requirements.filter((r) => r.satisfied).length;
    const counter = `${pad2(passedCount)}/${pad2(requirements.length)}`;
    const interactive = !!onMark;

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <Text style={[styles.heading, { color: colors.textPrimary }]}>
                    {'Paper '}
                    <Text style={[styles.headingItalic, { color: colors.accent }]}>requirements</Text>
                </Text>
                <Text style={[styles.counter, { color: colors.textTertiary }]}>{counter}</Text>
            </View>

            <View style={[styles.list, { borderTopColor: colors.cardBorder, borderBottomColor: colors.cardBorder }]}>
                {requirements.map((req) => {
                    const meta = statusMeta(req.status, colors);
                    const { subtitle, code } = buildSubtitleParts(req);

                    const body = (
                        <View style={styles.row}>
                            <View style={[styles.spine, { backgroundColor: meta.color }]} />
                            <View style={styles.rowBody}>
                                <Text style={[styles.label, { color: colors.textPrimary }]}>{req.label}</Text>
                                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                                    {subtitle}
                                    {code && (
                                        <Text style={[styles.code, { color: colors.textTertiary }]}>
                                            {subtitle ? '  ' : ''}
                                            {code}
                                        </Text>
                                    )}
                                </Text>
                            </View>
                            <Text style={[styles.status, { color: meta.color }]}>{meta.label}</Text>
                            {interactive && (
                                <Ionicons
                                    name="chevron-forward"
                                    size={14}
                                    color={colors.textTertiary}
                                    style={styles.chevron}
                                />
                            )}
                        </View>
                    );

                    if (interactive) {
                        return (
                            <TouchableOpacity
                                key={req.code}
                                activeOpacity={0.7}
                                onPress={() => onMark?.(req)}
                                testID={`papers-section-row-${req.code}`}
                            >
                                {body}
                            </TouchableOpacity>
                        );
                    }
                    return <View key={req.code}>{body}</View>;
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 20,
        marginTop: 28,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
        gap: 12,
    },
    // Section heading: sans per role rules; italic accent word stays serifItalic for editorial feel
    heading: {
        flex: 1,
        fontFamily: Fonts.sansSemibold,
        fontSize: 17,
        fontWeight: '600',
        lineHeight: 22,
        letterSpacing: letterSpacing(-0.2),
    },
    headingItalic: {
        fontFamily: Fonts.serifItalic,
    },
    counter: {
        fontFamily: Fonts.mono,
        fontSize: 11,
        lineHeight: 14,
    },
    list: {
        borderTopWidth: 1,
        borderBottomWidth: 1,
        paddingVertical: 12,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        gap: 12,
    },
    spine: {
        width: 4,
        borderRadius: 2,
        alignSelf: 'stretch',
    },
    rowBody: {
        flex: 1,
    },
    // List-row label: sans (rows are NEVER serif per role rules)
    label: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 15,
        fontWeight: '600',
        lineHeight: 20,
        letterSpacing: letterSpacing(-0.1),
    },
    subtitle: {
        fontFamily: Fonts.sans,
        fontSize: 12,
        fontWeight: '400',
        lineHeight: 16,
        marginTop: 2,
    },
    code: {
        fontFamily: Fonts.mono,
        fontSize: 11,
    },
    status: {
        fontFamily: Fonts.mono,
        fontSize: 10,
        lineHeight: 14,
        letterSpacing: letterSpacing(1),
        textTransform: 'uppercase',
    },
    chevron: {
        marginLeft: 2,
    },
});
