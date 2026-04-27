import { Fonts } from '@/constants/type';
import { letterSpacing } from '@/constants/platform';
import { EMOCK_MODULE_CODES, type EmockModuleCode, type EmockModuleSummary } from '@/types/emock';
import type { ThemeColors } from '@/types/theme';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
    summariesByCode: Record<EmockModuleCode, EmockModuleSummary>;
    colors: ThemeColors;
}

type RowStatus = 'passed' | 'in_progress' | 'not_started';

function rowStatus(s: EmockModuleSummary): RowStatus {
    if (s.everPassed) return 'passed';
    if (s.attemptCount > 0) return 'in_progress';
    return 'not_started';
}

function statusMeta(status: RowStatus, colors: ThemeColors): { label: string; color: string } {
    switch (status) {
        case 'passed':
            return { label: 'Passed', color: colors.success };
        case 'in_progress':
            return { label: 'Practising', color: colors.warning };
        default:
            return { label: 'Not Started', color: colors.textTertiary };
    }
}

function relativeDate(iso: string | null): string | null {
    if (!iso) return null;
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return null;
    const diffMs = Date.now() - then;
    const day = 24 * 60 * 60 * 1000;
    if (diffMs < day) return 'today';
    const days = Math.floor(diffMs / day);
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
}

function buildSubtitle(s: EmockModuleSummary): { subtitle: string; code: string } {
    const code = s.code;
    if (s.attemptCount === 0) {
        return { subtitle: 'no attempts yet', code };
    }
    const plural = s.attemptCount === 1 ? '' : 's';
    const best =
        s.bestAttempt && s.bestAttempt.score != null && s.bestAttempt.total
            ? `best ${s.bestAttempt.score}/${s.bestAttempt.total}`
            : null;
    const last = relativeDate(s.latestAttempt?.completed_at ?? null);
    const parts = [best, `${s.attemptCount} attempt${plural}`, last && `last ${last}`].filter((x): x is string =>
        Boolean(x),
    );
    return { subtitle: parts.join(' · '), code };
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

export default function EmockScoresSection({ summariesByCode, colors }: Props) {
    const summaries = EMOCK_MODULE_CODES.map((c) => summariesByCode[c]);
    const passedCount = summaries.filter((s) => s.everPassed).length;
    const counter = `${pad2(passedCount)}/${pad2(summaries.length)}`;

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <Text style={[styles.heading, { color: colors.textPrimary }]}>
                    {'eMock '}
                    <Text style={[styles.headingItalic, { color: colors.accent }]}>practice</Text>
                </Text>
                <Text style={[styles.counter, { color: colors.textTertiary }]}>{counter}</Text>
            </View>

            <View style={[styles.list, { borderTopColor: colors.cardBorder, borderBottomColor: colors.cardBorder }]}>
                {summaries.map((s) => {
                    const status = rowStatus(s);
                    const meta = statusMeta(status, colors);
                    const { subtitle, code } = buildSubtitle(s);

                    return (
                        <View key={s.code} testID={`emock-scores-section-row-${s.code}`} style={styles.row}>
                            <View style={[styles.spine, { backgroundColor: meta.color }]} />
                            <View style={styles.rowBody}>
                                <Text style={[styles.label, { color: colors.textPrimary }]}>{s.label}</Text>
                                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                                    {subtitle}
                                    <Text style={[styles.code, { color: colors.textTertiary }]}>{`  ${code}`}</Text>
                                </Text>
                            </View>
                            {s.bestPercent != null && (
                                <Text style={[styles.percent, { color: meta.color }]}>{`${s.bestPercent}%`}</Text>
                            )}
                            <Text style={[styles.status, { color: meta.color }]}>{meta.label}</Text>
                        </View>
                    );
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
    percent: {
        fontFamily: Fonts.mono,
        fontSize: 13,
        fontWeight: '600',
    },
    status: {
        fontFamily: Fonts.mono,
        fontSize: 10,
        lineHeight: 14,
        letterSpacing: letterSpacing(1),
        textTransform: 'uppercase',
    },
});
