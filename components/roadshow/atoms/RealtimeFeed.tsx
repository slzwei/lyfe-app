import type { Colors } from '@/constants/Colors';
import { getRoadshowColors } from '@/constants/roadshow/tokens';
import { RoadshowType, TropicFonts } from '@/constants/roadshow/typography';
import { useTheme } from '@/contexts/ThemeContext';
import { formatCheckinTime } from '@/lib/dateTime';
import type { RoadshowActivity } from '@/types/event';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export interface RealtimeFeedProps {
    colors: typeof Colors.light;
    activities: RoadshowActivity[];
    userId?: string;
    title?: string;
    rightLabel?: string | null;
    max?: number;
}

/**
 * Prototype "Team · realtime" / "Activity · reverse chrono" feed.
 * 44px time column + name/act/sub lines, self-row tinted in terraTint.
 */
export function RealtimeFeed({
    colors,
    activities,
    userId,
    title = 'TEAM · REALTIME',
    rightLabel = 'live',
    max = 8,
}: RealtimeFeedProps) {
    const { resolved } = useTheme();
    const stage = getRoadshowColors(resolved);

    const feed = useMemo(
        () =>
            activities
                .slice()
                .sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime())
                .slice(0, max),
        [activities, max],
    );

    if (feed.length === 0) return null;

    const actMap: Record<string, { label: string; sub: (a: RoadshowActivity) => string; color: string }> = {
        sitdown: { label: 'sat down with a lead', sub: () => 'Conversation', color: stage.sitdowns },
        pitch: { label: 'pitched a plan', sub: () => 'Plan walked', color: stage.pitches },
        case_closed: {
            label: 'closed a case',
            sub: (a) => (a.afyc_amount ? `AFYC $${a.afyc_amount.toLocaleString()}` : 'Close logged'),
            color: stage.closes,
        },
        check_in: { label: 'checked in', sub: () => 'Booth opened', color: colors.textTertiary },
        departure: { label: 'left the booth', sub: () => '', color: colors.textTertiary },
    };

    return (
        <View style={styles.section}>
            <View style={styles.eyebrowRow}>
                <Text style={[RoadshowType.eyebrow, { color: colors.textTertiary }]}>{title}</Text>
                {rightLabel ? (
                    <Text style={[RoadshowType.caption, { color: stage.live, fontFamily: TropicFonts.uiSemiBold }]}>
                        {rightLabel}
                    </Text>
                ) : null}
            </View>
            <View style={[styles.feedCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                {feed.map((f, i) => {
                    const m = actMap[f.type] ?? { label: f.type, sub: () => '', color: colors.textTertiary };
                    const isSelf = f.user_id === userId;
                    const who = isSelf ? 'You' : (f.full_name ?? '—');
                    return (
                        <View
                            key={f.id ?? `${f.user_id}-${f.logged_at}-${i}`}
                            style={[
                                styles.feedRow,
                                {
                                    borderBottomColor: colors.hairline,
                                    borderBottomWidth: i < feed.length - 1 ? StyleSheet.hairlineWidth : 0,
                                    backgroundColor: isSelf ? colors.tintTerra + '66' : 'transparent',
                                },
                            ]}
                        >
                            <Text style={[styles.feedTime, { color: colors.textTertiary }]}>
                                {formatCheckinTime(f.logged_at)}
                            </Text>
                            <View style={{ flex: 1 }}>
                                <Text style={[RoadshowType.body, { color: colors.textPrimary }]}>
                                    <Text
                                        style={{
                                            fontFamily: TropicFonts.uiSemiBold,
                                            color: isSelf ? stage.live : colors.textPrimary,
                                        }}
                                    >
                                        {who}
                                    </Text>{' '}
                                    <Text style={{ color: colors.textTertiary }}>{m.label}</Text>
                                </Text>
                                {m.sub(f) ? (
                                    <Text style={[RoadshowType.caption, { color: m.color, marginTop: 1 }]}>
                                        {m.sub(f)}
                                    </Text>
                                ) : null}
                            </View>
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    section: { gap: 8 },
    eyebrowRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        paddingHorizontal: 2,
    },
    feedCard: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
    feedRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        paddingHorizontal: 14,
        paddingVertical: 9,
    },
    feedTime: {
        width: 44,
        fontSize: 10.5,
        fontFamily: TropicFonts.uiSemiBold,
        fontVariant: ['tabular-nums'],
        paddingTop: 2,
    },
});
