import { DarkHeroCard } from '@/components/roadshow/atoms/DarkHeroCard';
import { EditorialHeader } from '@/components/roadshow/atoms/EditorialHeader';
import { EventStatusPill } from '@/components/roadshow/atoms/EventStatusPill';
import type { Colors } from '@/constants/Colors';
import { RoadshowRadii, getRoadshowColors } from '@/constants/roadshow/tokens';
import { RoadshowType, TropicFonts } from '@/constants/roadshow/typography';
import { useTheme } from '@/contexts/ThemeContext';
import type { RoadshowConfig } from '@/types/event';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export interface RoadshowUpcomingProps {
    roadshowConfig: RoadshowConfig | null;
    colors: typeof Colors.light;
    onSetupPress?: () => void;
    canEdit?: boolean;
    countdownLabel?: string;
    place?: string;
    subPlace?: string;
    meta?: string;
    teamPledge?: {
        sitdowns: number;
        pitches: number;
        closes: number;
        afyc: number;
    };
}

function RoadshowUpcomingInner({
    roadshowConfig,
    colors,
    onSetupPress,
    canEdit = false,
    countdownLabel,
    place,
    subPlace,
    meta,
    teamPledge,
}: RoadshowUpcomingProps) {
    const { resolved } = useTheme();
    const stage = getRoadshowColors(resolved);
    const hasConfig = !!roadshowConfig;

    // Derive team pledge from config's suggested_* fields when not passed
    const derivedPledge =
        roadshowConfig && !teamPledge
            ? {
                  sitdowns: roadshowConfig.suggested_sitdowns,
                  pitches: roadshowConfig.suggested_pitches,
                  closes: roadshowConfig.suggested_closed,
                  afyc: 0,
              }
            : teamPledge;

    return (
        <View style={styles.container}>
            {/* Editorial header — only if place data passed from parent, otherwise hidden */}
            {place ? (
                <EditorialHeader
                    eyebrow={meta ?? 'ROADSHOW'}
                    place={place}
                    sub={subPlace}
                    size="lg"
                    paddingHorizontal={0}
                    right={<EventStatusPill status="setup" />}
                />
            ) : null}

            {/* Countdown hero */}
            {countdownLabel ? (
                <DarkHeroCard glow="terra" glowSize="lg">
                    <Text style={[RoadshowType.eyebrow, { color: stage.live }]}>OPENS IN</Text>
                    <Text style={[RoadshowType.heroNumber, { color: '#F4EEE1', marginTop: 4 }]} numberOfLines={1}>
                        {countdownLabel}
                    </Text>
                </DarkHeroCard>
            ) : null}

            {/* The tariff */}
            <View style={styles.section}>
                <View style={styles.eyebrowRow}>
                    <Text style={[RoadshowType.eyebrow, { color: colors.textTertiary }]}>THE TARIFF</Text>
                </View>
                <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                    {hasConfig ? (
                        <>
                            <View style={styles.tariffGrid}>
                                <TariffStat
                                    label="Weekly cost"
                                    value={`$${roadshowConfig!.weekly_cost.toLocaleString()}`}
                                    sub="booth rental"
                                    color={colors.textPrimary}
                                    muted={colors.textTertiary}
                                />
                                <TariffStat
                                    label="Slots / day"
                                    value={String(roadshowConfig!.slots_per_day)}
                                    sub="per agent"
                                    color={colors.textPrimary}
                                    muted={colors.textTertiary}
                                />
                                <TariffStat
                                    label="Per-slot"
                                    value={`$${roadshowConfig!.slot_cost.toFixed(2)}`}
                                    sub="daily"
                                    color={stage.live}
                                    muted={colors.textTertiary}
                                />
                            </View>
                            <View style={[styles.tariffFoot, { borderTopColor: colors.hairline }]}>
                                <Text style={[styles.tariffFootText, { color: colors.textTertiary }]}>
                                    Grace{' '}
                                    <Text style={{ color: colors.textPrimary, fontFamily: TropicFonts.uiSemiBold }}>
                                        {roadshowConfig!.late_grace_minutes} min
                                    </Text>
                                    {' · '}
                                    Proximity{' '}
                                    <Text style={{ color: colors.textPrimary, fontFamily: TropicFonts.uiSemiBold }}>
                                        100m
                                    </Text>
                                    {' · '}
                                    Face{' '}
                                    <Text style={{ color: stage.closes, fontFamily: TropicFonts.uiSemiBold }}>ON</Text>
                                </Text>
                            </View>
                        </>
                    ) : (
                        <View style={styles.emptyInner}>
                            <Ionicons name="storefront-outline" size={20} color={colors.textTertiary} />
                            <Text style={[RoadshowType.body, { color: colors.textSecondary }]}>
                                No booth configuration yet.
                            </Text>
                            <Text style={[RoadshowType.caption, { color: colors.textTertiary }]}>
                                Set cost, slots, and targets before the event goes live.
                            </Text>
                        </View>
                    )}
                </View>
            </View>

            {/* Team pledge preview / suggested daily targets */}
            {derivedPledge ? (
                <View style={styles.section}>
                    <View style={styles.eyebrowRow}>
                        <Text
                            style={[RoadshowType.eyebrow, { color: colors.textTertiary }]}
                            accessibilityLabel="Suggested Daily Targets"
                        >
                            TEAM PLEDGE
                        </Text>
                        {canEdit && onSetupPress ? (
                            <Pressable onPress={onSetupPress} hitSlop={8}>
                                <Text
                                    style={[
                                        RoadshowType.caption,
                                        { color: stage.live, fontFamily: TropicFonts.uiSemiBold },
                                    ]}
                                >
                                    Edit
                                </Text>
                            </Pressable>
                        ) : null}
                    </View>
                    <View style={[styles.pledgeCard, { backgroundColor: colors.tintTerra }]}>
                        <PledgeStat label="Sitdowns" value={String(derivedPledge.sitdowns)} color={colors.accentDark} />
                        <PledgeStat label="Pitches" value={String(derivedPledge.pitches)} color={colors.accentDark} />
                        <PledgeStat label="Closed" value={String(derivedPledge.closes)} color={colors.accentDark} />
                        {derivedPledge.afyc > 0 ? (
                            <PledgeStat
                                label="AFYC"
                                value={`$${(derivedPledge.afyc / 1000).toFixed(1).replace('.0', '')}k`}
                                color={colors.accentDark}
                            />
                        ) : null}
                    </View>
                </View>
            ) : null}

            {/* CTA */}
            {canEdit && onSetupPress ? (
                <View style={styles.ctaWrap}>
                    <Pressable
                        onPress={onSetupPress}
                        style={({ pressed }) => [
                            styles.cta,
                            {
                                backgroundColor: pressed ? colors.accentDark : colors.accent,
                                borderRadius: RoadshowRadii.card,
                            },
                        ]}
                        accessibilityLabel={hasConfig ? 'Edit booth settings' : 'Set up booth'}
                    >
                        <Text style={styles.ctaText}>{hasConfig ? 'Edit the booth' : 'Set up the booth'}</Text>
                        <Text style={[styles.ctaArrow, { fontFamily: TropicFonts.serifItalic }]}>→</Text>
                    </Pressable>
                </View>
            ) : null}
        </View>
    );
}

function TariffStat({
    label,
    value,
    sub,
    color,
    muted,
}: {
    label: string;
    value: string;
    sub: string;
    color: string;
    muted: string;
}) {
    return (
        <View style={styles.tariffCell}>
            <Text style={[RoadshowType.eyebrowSm, { color: muted }]}>{label.toUpperCase()}</Text>
            <Text style={[RoadshowType.statLg, { color, marginTop: 2, lineHeight: 22 }]}>{value}</Text>
            <Text style={[RoadshowType.caption, { color: muted, marginTop: 2 }]}>{sub}</Text>
        </View>
    );
}

function PledgeStat({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <View style={styles.pledgeStat}>
            <Text style={[RoadshowType.eyebrowSm, { color, opacity: 0.85 }]}>{label.toUpperCase()}</Text>
            <Text style={[RoadshowType.statLg, { color, marginTop: 2 }]}>{value}</Text>
        </View>
    );
}

export const RoadshowUpcoming = React.memo(RoadshowUpcomingInner);

const styles = StyleSheet.create({
    container: { gap: 16 },

    section: { gap: 8 },
    eyebrowRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },

    card: {
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
        gap: 10,
    },

    tariffGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
    tariffCell: { flex: 1, gap: 0 },
    tariffFoot: {
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingTop: 10,
    },
    tariffFootText: { fontSize: 11.5, lineHeight: 17, fontFamily: TropicFonts.ui },

    emptyInner: { alignItems: 'center', gap: 4, paddingVertical: 12 },

    pledgeCard: {
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 10,
    },
    pledgeStat: { flex: 1 },

    ctaWrap: { paddingTop: 4 },
    cta: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 15,
    },
    ctaText: { color: '#FFFFFF', fontSize: 16, fontFamily: TropicFonts.serif, fontWeight: '500', letterSpacing: -0.2 },
    ctaArrow: { color: '#FFFFFF', fontSize: 16, opacity: 0.85 },
});
