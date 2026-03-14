import ProgressRing from '@/components/events/ProgressRing';
import { type ActivityCounts, type BoothTotals, CASE_CLOSED_COLOR } from '@/components/events/roadshowTokens';
import { ACTIVITY_TYPE_CONFIG } from '@/constants/displayConfigs';
import type { AgencyEvent, EventAttendee, RoadshowAttendance, RoadshowConfig } from '@/types/event';
import type { Colors } from '@/constants/Colors';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AgentStatusCard } from './AgentStatusCard';
import { ManagerOverrideSheet } from './ManagerOverrideSheet';

export interface RoadshowLiveT2Props {
    colors: typeof Colors.light;
    event: AgencyEvent;
    attendance: RoadshowAttendance[];
    activityCounts: (userId: string) => ActivityCounts;
    boothTotals: BoothTotals;
    roadshowConfig: RoadshowConfig | null;
    // Manager override
    overrideTarget: EventAttendee | null;
    setOverrideTarget: (v: EventAttendee | null) => void;
    overrideTime: string;
    setOverrideTime: (v: string) => void;
    overrideLateReason: string;
    setOverrideLateReason: (v: string) => void;
    overridePledgeSitdowns: number;
    setOverridePledgeSitdowns: React.Dispatch<React.SetStateAction<number>>;
    overridePledgePitches: number;
    setOverridePledgePitches: React.Dispatch<React.SetStateAction<number>>;
    overridePledgeClosed: number;
    setOverridePledgeClosed: React.Dispatch<React.SetStateAction<number>>;
    overridePledgeAfyc: string;
    setOverridePledgeAfyc: (v: string) => void;
    overrideSubmitting: boolean;
    overrideError: string | null;
    openOverride: (agent: EventAttendee) => void;
    handleConfirmOverride: () => void;
    userFullName: string | undefined;
}

function RoadshowLiveT2Inner(props: RoadshowLiveT2Props) {
    const {
        colors,
        event,
        attendance,
        activityCounts,
        boothTotals,
        roadshowConfig,
        overrideTarget,
        setOverrideTarget,
        overrideTime,
        setOverrideTime,
        overrideLateReason,
        setOverrideLateReason,
        overridePledgeSitdowns,
        setOverridePledgeSitdowns,
        overridePledgePitches,
        setOverridePledgePitches,
        overridePledgeClosed,
        setOverridePledgeClosed,
        overridePledgeAfyc,
        setOverridePledgeAfyc,
        overrideSubmitting,
        overrideError,
        openOverride,
        handleConfirmOverride,
        userFullName,
    } = props;

    return (
        <>
            {/* Booth Totals */}
            <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Booth Totals</Text>
                {roadshowConfig && (
                    <Text style={[styles.boothCostLabel, { color: colors.textTertiary }]}>
                        Cost today: ${roadshowConfig.daily_cost.toFixed(2)} ({roadshowConfig.slots_per_day} × $
                        {roadshowConfig.slot_cost.toFixed(2)})
                    </Text>
                )}
                <View style={styles.ringsRow}>
                    <ProgressRing
                        actual={boothTotals.sitdowns}
                        pledged={boothTotals.pledgedSitdowns}
                        color={colors.managerColor}
                        label="Sitdowns"
                        accessLabel={`Booth sitdowns: ${boothTotals.sitdowns} of ${boothTotals.pledgedSitdowns}`}
                    />
                    <ProgressRing
                        actual={boothTotals.pitches}
                        pledged={boothTotals.pledgedPitches}
                        color={ACTIVITY_TYPE_CONFIG.pitch.color}
                        label="Pitches"
                        accessLabel={`Booth pitches: ${boothTotals.pitches} of ${boothTotals.pledgedPitches}`}
                    />
                    <ProgressRing
                        actual={boothTotals.closed}
                        pledged={boothTotals.pledgedClosed}
                        color={ACTIVITY_TYPE_CONFIG.case_closed.color}
                        label="Closed"
                        accessLabel={`Booth cases: ${boothTotals.closed} of ${boothTotals.pledgedClosed}`}
                    />
                </View>
                <View style={styles.afycSection}>
                    <View style={styles.afycRow}>
                        <Text style={[styles.afycLabel, { color: colors.textSecondary }]}>AFYC</Text>
                        <Text style={[styles.afycValue, { color: colors.textPrimary }]}>
                            ${boothTotals.afyc.toLocaleString()}
                            {boothTotals.pledgedAfyc > 0 && (
                                <Text style={{ color: colors.textTertiary }}>
                                    {' '}
                                    of ${boothTotals.pledgedAfyc.toLocaleString()} pledged
                                </Text>
                            )}
                        </Text>
                    </View>
                    {boothTotals.pledgedAfyc > 0 && (
                        <View style={[styles.afycTrack, { backgroundColor: colors.surfaceSecondary }]}>
                            <View
                                style={[
                                    styles.afycFill,
                                    {
                                        width: `${Math.min(100, (boothTotals.afyc / boothTotals.pledgedAfyc) * 100)}%` as any,
                                        backgroundColor: CASE_CLOSED_COLOR,
                                    },
                                ]}
                            />
                        </View>
                    )}
                </View>
            </View>

            {/* Agent Status */}
            <AgentStatusCard
                colors={colors}
                event={event}
                attendance={attendance}
                activityCounts={activityCounts}
                openOverride={openOverride}
            />

            {/* Manager Override Sheet */}
            <ManagerOverrideSheet
                colors={colors}
                overrideTarget={overrideTarget}
                setOverrideTarget={setOverrideTarget}
                overrideTime={overrideTime}
                setOverrideTime={setOverrideTime}
                overrideLateReason={overrideLateReason}
                setOverrideLateReason={setOverrideLateReason}
                overridePledgeSitdowns={overridePledgeSitdowns}
                setOverridePledgeSitdowns={setOverridePledgeSitdowns}
                overridePledgePitches={overridePledgePitches}
                setOverridePledgePitches={setOverridePledgePitches}
                overridePledgeClosed={overridePledgeClosed}
                setOverridePledgeClosed={setOverridePledgeClosed}
                overridePledgeAfyc={overridePledgeAfyc}
                setOverridePledgeAfyc={setOverridePledgeAfyc}
                overrideSubmitting={overrideSubmitting}
                overrideError={overrideError}
                handleConfirmOverride={handleConfirmOverride}
                userFullName={userFullName}
            />
        </>
    );
}

export const RoadshowLiveT2 = React.memo(RoadshowLiveT2Inner);

const styles = StyleSheet.create({
    card: { borderRadius: 16, padding: 16, gap: 12 },
    cardTitle: { fontSize: 15, fontWeight: '700' },
    ringsRow: { flexDirection: 'row', justifyContent: 'space-around' },
    boothCostLabel: { fontSize: 13 },
    afycSection: { gap: 6 },
    afycRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    afycLabel: { fontSize: 14, fontWeight: '600' },
    afycValue: { fontSize: 14, fontWeight: '700' },
    afycTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
    afycFill: { height: 6, borderRadius: 3 },
});
