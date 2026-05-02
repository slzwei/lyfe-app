import { type ActivityCounts } from '@/components/events/roadshowTokens';
import { DarkHeroCard } from '@/components/roadshow/atoms/DarkHeroCard';
import { PledgeRing } from '@/components/roadshow/atoms/PledgeRing';
import { RealtimeFeed } from '@/components/roadshow/atoms/RealtimeFeed';
import { ShimmerOverlay } from '@/components/roadshow/atoms/ShimmerOverlay';
import type { Colors } from '@/constants/Colors';
import { RoadshowRadii, getRoadshowColors } from '@/constants/roadshow/tokens';
import { RoadshowType, TropicFonts } from '@/constants/roadshow/typography';
import { ERROR_BG, ERROR_TEXT } from '@/constants/ui';
import { useTheme } from '@/contexts/ThemeContext';
import { formatCheckinTime, formatTime as formatTimeOnly } from '@/lib/dateTime';
import type { RoadshowActivity, RoadshowAttendance, RoadshowConfig } from '@/types/event';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { ActivityIndicator, type DimensionValue, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';
import { ActivityConfirmSheet } from './ActivityConfirmSheet';
import { AfycSheet } from './AfycSheet';
import { PledgeSheet } from './PledgeSheet';

export interface RoadshowLiveT1Props {
    colors: typeof Colors.light;
    attendance: RoadshowAttendance[];
    myAttendance: RoadshowAttendance | null;
    myCounts: ActivityCounts;
    roadshowConfig: RoadshowConfig | null;
    activities: RoadshowActivity[];
    isCurrentlyLate: boolean;
    minutesCurrentlyLate: number;
    insets: EdgeInsets;
    userId: string | undefined;
    // Check-in flow
    lateReason: string;
    setLateReason: (v: string) => void;
    showPledgeSheet: boolean;
    setShowPledgeSheet: (v: boolean) => void;
    pledgeSitdowns: number;
    setPledgeSitdowns: React.Dispatch<React.SetStateAction<number>>;
    pledgePitches: number;
    setPledgePitches: React.Dispatch<React.SetStateAction<number>>;
    pledgeClosed: number;
    setPledgeClosed: React.Dispatch<React.SetStateAction<number>>;
    pledgeAfyc: string;
    setPledgeAfyc: (v: string) => void;
    checkingIn: boolean;
    checkinError: string | null;
    handleOpenCheckin: () => void;
    handleConfirmPledge: () => void;
    // Activity log
    logDebounce: Record<string, boolean>;
    confirmActivity: 'sitdown' | 'pitch' | null;
    setConfirmActivity: (v: 'sitdown' | 'pitch' | null) => void;
    showAfycSheet: boolean;
    setShowAfycSheet: (v: boolean) => void;
    afycInput: string;
    setAfycInput: (v: string) => void;
    loggingActivity: boolean;
    logHour: number;
    setLogHour: (v: number) => void;
    logMinuteIdx: number;
    setLogMinuteIdx: (v: number) => void;
    logAmPm: number;
    setLogAmPm: (v: number) => void;
    initLogTime: () => void;
    handleLogActivity: (type: 'sitdown' | 'pitch') => void;
    handleLogCaseClosed: () => void;
    handleLogDeparture: () => void;
    handleReturnToBooth: () => void;
    hasCheckedIn: boolean;
}

function RoadshowLiveT1Inner(props: RoadshowLiveT1Props) {
    const {
        colors,
        attendance,
        myAttendance,
        myCounts,
        roadshowConfig,
        activities,
        isCurrentlyLate,
        minutesCurrentlyLate,
        insets,
        userId,
        lateReason,
        setLateReason,
        showPledgeSheet,
        setShowPledgeSheet,
        pledgeSitdowns,
        setPledgeSitdowns,
        pledgePitches,
        setPledgePitches,
        pledgeClosed,
        setPledgeClosed,
        pledgeAfyc,
        setPledgeAfyc,
        checkingIn,
        checkinError,
        handleOpenCheckin,
        handleConfirmPledge,
        logDebounce,
        confirmActivity,
        setConfirmActivity,
        showAfycSheet,
        setShowAfycSheet,
        afycInput,
        setAfycInput,
        loggingActivity,
        logHour,
        setLogHour,
        logMinuteIdx,
        setLogMinuteIdx,
        logAmPm,
        setLogAmPm,
        initLogTime,
        handleLogActivity,
        handleLogCaseClosed,
        handleLogDeparture,
        handleReturnToBooth,
        hasCheckedIn,
    } = props;

    const { resolved } = useTheme();
    const stage = getRoadshowColors(resolved);

    const pledgedSitdowns = myAttendance?.pledged_sitdowns ?? 0;
    const pledgedPitches = myAttendance?.pledged_pitches ?? 0;
    const pledgedClosed = myAttendance?.pledged_closed ?? 0;
    const pledgedAfyc = myAttendance?.pledged_afyc ?? 0;

    const lastCheckinOrDep = activities
        .filter((a) => a.user_id === userId && (a.type === 'check_in' || a.type === 'departure'))
        .sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime())[0];
    const hasDeparted = lastCheckinOrDep?.type === 'departure';

    const checkedInByManager = attendance.find((a) => a.user_id === userId && a.checked_in_by);

    const timeInLabel = useMemo(() => {
        if (!myAttendance) return null;
        const diff = Math.max(0, Date.now() - new Date(myAttendance.checked_in_at).getTime());
        const mins = Math.floor(diff / 60000);
        const hh = String(Math.floor(mins / 60)).padStart(2, '0');
        const mm = String(mins % 60).padStart(2, '0');
        return `${hh}:${mm} in`;
    }, [myAttendance]);

    return (
        <View style={styles.container}>
            {/* ── Check-in bar (dark, with shimmer intent via small indicator) ── */}
            {!hasCheckedIn && !checkedInByManager ? (
                <Pressable testID="roadshow-checkin-cta" onPress={handleOpenCheckin} disabled={checkingIn}>
                    <DarkHeroCard
                        glow="terra"
                        glowSize="md"
                        overlay={<ShimmerOverlay color={stage.live} intensity="44" durationMs={3000} radius={16} />}
                    >
                        <View style={styles.checkinRow}>
                            <View style={[styles.checkinCircle, { backgroundColor: stage.live }]}>
                                <Ionicons name="scan-outline" size={18} color="#FFFFFF" />
                            </View>
                            <View style={styles.checkinTextCol}>
                                <Text style={[RoadshowType.statMd, { color: '#F4EEE1' }]}>Check yourself in</Text>
                                <Text style={[RoadshowType.caption, { color: 'rgba(244,238,225,0.6)', marginTop: 2 }]}>
                                    pledge → face → attendance · ~30s
                                </Text>
                            </View>
                            <Text style={[RoadshowType.bodyMd, { color: stage.live }]}>→</Text>
                        </View>
                        {roadshowConfig ? (
                            <Text style={[RoadshowType.caption, { color: 'rgba(244,238,225,0.45)', marginTop: 10 }]}>
                                Opens {formatTimeOnly(roadshowConfig.expected_start_time)} ·{' '}
                                {roadshowConfig.late_grace_minutes}m grace · slot ${roadshowConfig.slot_cost.toFixed(0)}
                            </Text>
                        ) : null}
                    </DarkHeroCard>
                </Pressable>
            ) : null}

            {/* Late banner pre-check-in */}
            {!hasCheckedIn && isCurrentlyLate ? (
                <View
                    style={[
                        styles.lateBanner,
                        {
                            backgroundColor: colors.tintPink,
                            borderColor: stage.late,
                        },
                    ]}
                >
                    <Ionicons name="alert-circle" size={14} color={stage.late} />
                    <Text
                        style={[
                            RoadshowType.caption,
                            { color: stage.late, flex: 1, fontFamily: TropicFonts.uiSemiBold },
                        ]}
                    >
                        {minutesCurrentlyLate} min late · {formatCheckinTime(new Date().toISOString())}
                    </Text>
                </View>
            ) : null}

            {!hasCheckedIn && isCurrentlyLate ? (
                <View style={styles.field}>
                    <Text style={[RoadshowType.eyebrowSm, { color: colors.textSecondary }]}>
                        LATE REASON (OPTIONAL)
                    </Text>
                    <TextInput
                        style={[
                            styles.input,
                            {
                                backgroundColor: colors.inputBackground,
                                borderColor: colors.inputBorder,
                                color: colors.textPrimary,
                                fontFamily: TropicFonts.ui,
                            },
                        ]}
                        placeholder="e.g. MRT delay"
                        placeholderTextColor={colors.textTertiary}
                        value={lateReason}
                        onChangeText={setLateReason}
                    />
                </View>
            ) : null}

            {/* Manager pre-check-in notice */}
            {checkedInByManager ? (
                <View style={[styles.infoBanner, { backgroundColor: colors.infoLight, borderColor: colors.info }]}>
                    <Ionicons name="information-circle" size={16} color={colors.info} />
                    <Text style={[RoadshowType.caption, { color: colors.info, flex: 1 }]}>
                        Checked in by your manager at {formatCheckinTime(checkedInByManager.checked_in_at)}.
                    </Text>
                </View>
            ) : null}

            {/* Check-in error */}
            {checkinError ? (
                <View style={[styles.errorBanner, { backgroundColor: ERROR_BG }]}>
                    <Text style={{ color: ERROR_TEXT, fontSize: 13, fontFamily: TropicFonts.ui }}>{checkinError}</Text>
                </View>
            ) : null}

            {/* ── Pledge rings card ── */}
            {hasCheckedIn ? (
                <View
                    testID="roadshow-pledge-card"
                    style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}
                >
                    <View style={styles.cardHeaderRow}>
                        <Text style={[RoadshowType.statMd, { color: colors.textPrimary }]}>
                            Your{' '}
                            <Text
                                style={[
                                    RoadshowType.serifAccent,
                                    { color: stage.live, fontFamily: TropicFonts.serifItalic },
                                ]}
                            >
                                pledge
                            </Text>
                        </Text>
                        {timeInLabel ? (
                            <Text style={[RoadshowType.eyebrowSm, { color: colors.textTertiary }]}>{timeInLabel}</Text>
                        ) : null}
                    </View>

                    <View style={styles.ringsRow}>
                        <PledgeRing
                            value={myCounts.sitdowns}
                            pledge={pledgedSitdowns}
                            color={stage.sitdowns}
                            label="sitdowns"
                        />
                        <PledgeRing
                            value={myCounts.pitches}
                            pledge={pledgedPitches}
                            color={stage.pitches}
                            label="pitches"
                        />
                        <PledgeRing value={myCounts.closed} pledge={pledgedClosed} color={stage.closes} label="cases" />
                    </View>

                    <View style={[styles.afycRow, { borderTopColor: colors.hairline }]}>
                        <Text style={[RoadshowType.eyebrowSm, { color: colors.textTertiary }]}>AFYC</Text>
                        {pledgedAfyc > 0 ? (
                            <Text style={[RoadshowType.statLg, { color: stage.closes }]}>
                                ${myCounts.afyc.toLocaleString()}
                                <Text
                                    style={[{ fontSize: 11, color: colors.textTertiary, fontFamily: TropicFonts.ui }]}
                                >
                                    {' '}
                                    / ${pledgedAfyc.toLocaleString()}
                                </Text>
                            </Text>
                        ) : (
                            <Text style={[RoadshowType.statLg, { color: stage.closes }]}>
                                ${myCounts.afyc.toLocaleString()}
                            </Text>
                        )}
                    </View>
                    {pledgedAfyc > 0 ? (
                        <View style={[styles.afycBar, { backgroundColor: colors.hairline }]}>
                            <View
                                style={{
                                    height: 4,
                                    borderRadius: 2,
                                    backgroundColor: stage.closes,
                                    width: `${Math.min(100, (myCounts.afyc / pledgedAfyc) * 100)}%` as DimensionValue,
                                }}
                            />
                        </View>
                    ) : null}
                </View>
            ) : null}

            {/* ── Log activity grid ── */}
            {hasCheckedIn ? (
                <View style={styles.section}>
                    <View style={styles.eyebrowRow}>
                        <Text style={[RoadshowType.eyebrow, { color: colors.textTertiary }]}>
                            LOG · WHAT JUST HAPPENED?
                        </Text>
                    </View>
                    <View style={[styles.logGrid, hasDeparted && { opacity: 0.35 }]}>
                        <LogCard
                            icon="◐"
                            label="Sit-down"
                            sub="conversation"
                            color={stage.sitdowns}
                            colors={colors}
                            disabled={!!logDebounce['sitdown'] || hasDeparted}
                            count={myCounts.sitdowns}
                            onPress={() => {
                                initLogTime();
                                setConfirmActivity('sitdown');
                            }}
                        />
                        <LogCard
                            icon="◆"
                            label="Pitch"
                            sub="plan walked"
                            color={stage.pitches}
                            colors={colors}
                            disabled={!!logDebounce['pitch'] || hasDeparted}
                            count={myCounts.pitches}
                            onPress={() => {
                                initLogTime();
                                setConfirmActivity('pitch');
                            }}
                        />
                        <LogCard
                            icon="✦"
                            label="Close"
                            sub="+ AFYC"
                            color={stage.closes}
                            colors={colors}
                            disabled={hasDeparted}
                            count={myCounts.closed}
                            onPress={() => {
                                setAfycInput('');
                                initLogTime();
                                setShowAfycSheet(true);
                            }}
                        />
                    </View>
                </View>
            ) : null}

            {/* ── Realtime feed ── */}
            <RealtimeFeed colors={colors} activities={activities} userId={userId} />

            {/* ── Leave / return booth ── */}
            {hasCheckedIn && !hasDeparted ? (
                <Pressable
                    onPress={handleLogDeparture}
                    style={({ pressed }) => [
                        styles.leaveBtn,
                        { borderColor: colors.hairline, opacity: pressed ? 0.7 : 1 },
                    ]}
                    accessibilityLabel="Log departure"
                >
                    <Text style={[RoadshowType.caption, { color: colors.textTertiary }]}>
                        Stepping away?{' '}
                        <Text style={{ color: stage.live, fontFamily: TropicFonts.uiSemiBold }}>Log departure</Text>
                    </Text>
                </Pressable>
            ) : null}

            {hasCheckedIn && hasDeparted ? (
                <View style={{ gap: 8 }}>
                    <View style={styles.departedBadge}>
                        <Ionicons name="walk-outline" size={14} color={colors.textTertiary} />
                        <Text style={[RoadshowType.caption, { color: colors.textTertiary }]}>You left the booth</Text>
                    </View>
                    <Pressable
                        onPress={handleReturnToBooth}
                        disabled={checkingIn}
                        style={({ pressed }) => [
                            styles.returnBtn,
                            {
                                backgroundColor: colors.tintTerra,
                                borderColor: colors.accent,
                                opacity: checkingIn ? 0.6 : pressed ? 0.8 : 1,
                                borderRadius: RoadshowRadii.card,
                            },
                        ]}
                        accessibilityLabel="Return to booth"
                    >
                        {checkingIn ? (
                            <>
                                <ActivityIndicator size="small" color={colors.accent} />
                                <Text
                                    style={[{ color: colors.accent, fontFamily: TropicFonts.uiSemiBold, fontSize: 14 }]}
                                >
                                    Checking GPS…
                                </Text>
                            </>
                        ) : (
                            <>
                                <Ionicons name="enter-outline" size={16} color={colors.accent} />
                                <Text
                                    style={[{ color: colors.accent, fontFamily: TropicFonts.uiSemiBold, fontSize: 14 }]}
                                >
                                    Return to booth
                                </Text>
                            </>
                        )}
                    </Pressable>
                </View>
            ) : null}

            <PledgeSheet
                colors={colors}
                showPledgeSheet={showPledgeSheet}
                setShowPledgeSheet={setShowPledgeSheet}
                pledgeSitdowns={pledgeSitdowns}
                setPledgeSitdowns={setPledgeSitdowns}
                pledgePitches={pledgePitches}
                setPledgePitches={setPledgePitches}
                pledgeClosed={pledgeClosed}
                setPledgeClosed={setPledgeClosed}
                pledgeAfyc={pledgeAfyc}
                setPledgeAfyc={setPledgeAfyc}
                checkingIn={checkingIn}
                checkinError={checkinError}
                handleConfirmPledge={handleConfirmPledge}
            />

            <ActivityConfirmSheet
                colors={colors}
                confirmActivity={confirmActivity}
                setConfirmActivity={setConfirmActivity}
                myCounts={myCounts}
                insets={insets}
                logHour={logHour}
                setLogHour={setLogHour}
                logMinuteIdx={logMinuteIdx}
                setLogMinuteIdx={setLogMinuteIdx}
                logAmPm={logAmPm}
                setLogAmPm={setLogAmPm}
                handleLogActivity={handleLogActivity}
            />

            <AfycSheet
                colors={colors}
                showAfycSheet={showAfycSheet}
                setShowAfycSheet={setShowAfycSheet}
                afycInput={afycInput}
                setAfycInput={setAfycInput}
                logHour={logHour}
                setLogHour={setLogHour}
                logMinuteIdx={logMinuteIdx}
                setLogMinuteIdx={setLogMinuteIdx}
                logAmPm={logAmPm}
                setLogAmPm={setLogAmPm}
                loggingActivity={loggingActivity}
                handleLogCaseClosed={handleLogCaseClosed}
            />
        </View>
    );
}

function LogCard({
    icon,
    label,
    sub,
    color,
    colors,
    disabled,
    count,
    onPress,
}: {
    icon: string;
    label: string;
    sub: string;
    color: string;
    colors: typeof Colors.light;
    disabled: boolean;
    count: number;
    onPress: () => void;
}) {
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            style={({ pressed }) => [
                styles.logCard,
                {
                    backgroundColor: colors.cardBackground,
                    borderColor: colors.cardBorder,
                    opacity: pressed ? 0.75 : 1,
                },
            ]}
            accessibilityLabel={`Log ${label}, current count ${count}`}
        >
            <Text style={[styles.logIcon, { color }]}>{icon}</Text>
            <Text style={[RoadshowType.statMd, { color: colors.textPrimary, marginTop: 6 }]}>{label}</Text>
            <Text style={[RoadshowType.caption, { color: colors.textTertiary, marginTop: 1 }]}>{sub}</Text>
            <View style={[styles.logBadge, { backgroundColor: color }]}>
                <Text style={styles.logBadgeText}>{count}</Text>
            </View>
        </Pressable>
    );
}

export const RoadshowLiveT1 = React.memo(RoadshowLiveT1Inner);

const styles = StyleSheet.create({
    container: { gap: 16 },
    section: { gap: 8 },
    eyebrowRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        paddingHorizontal: 2,
    },

    checkinRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    checkinCircle: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkinTextCol: { flex: 1 },

    lateBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderRadius: 12,
    },
    infoBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        borderWidth: 1,
        borderRadius: RoadshowRadii.card,
    },
    errorBanner: { borderRadius: 8, padding: 10 },

    field: { gap: 6 },
    input: {
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
    },

    card: {
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
        gap: 10,
    },
    cardHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
    },

    ringsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 4 },

    afycRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        paddingTop: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    afycBar: { height: 4, borderRadius: 2, overflow: 'hidden' },

    logGrid: { flexDirection: 'row', gap: 6 },
    logCard: {
        flex: 1,
        padding: 12,
        borderRadius: 14,
        borderWidth: 1,
        minHeight: 96,
        position: 'relative',
    },
    logIcon: { fontSize: 18, lineHeight: 18 },
    logBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 5,
    },
    logBadgeText: { color: '#FFFFFF', fontSize: 10, fontFamily: TropicFonts.uiBold },

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

    leaveBtn: {
        borderWidth: 1,
        borderStyle: 'dashed',
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: 'center',
    },
    departedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingVertical: 4,
    },
    returnBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderWidth: 1.5,
        paddingVertical: 11,
        minHeight: 44,
    },
});
