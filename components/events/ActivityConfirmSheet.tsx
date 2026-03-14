import { type ActivityCounts, PITCH_COLOR } from '@/components/events/roadshowShared';
import WheelPicker from '@/components/WheelPicker';
import { PICKER_HOURS, PICKER_MINUTES, PICKER_AMPM } from '@/constants/ui';
import { letterSpacing } from '@/constants/platform';
import type { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

export interface ActivityConfirmSheetProps {
    colors: typeof Colors.light;
    confirmActivity: 'sitdown' | 'pitch' | null;
    setConfirmActivity: (v: 'sitdown' | 'pitch' | null) => void;
    myCounts: ActivityCounts;
    insets: EdgeInsets;
    logHour: number;
    setLogHour: (v: number) => void;
    logMinuteIdx: number;
    setLogMinuteIdx: (v: number) => void;
    logAmPm: number;
    setLogAmPm: (v: number) => void;
    handleLogActivity: (type: 'sitdown' | 'pitch') => void;
}

function ActivityConfirmSheetInner({
    colors,
    confirmActivity,
    setConfirmActivity,
    myCounts,
    insets,
    logHour,
    setLogHour,
    logMinuteIdx,
    setLogMinuteIdx,
    logAmPm,
    setLogAmPm,
    handleLogActivity,
}: ActivityConfirmSheetProps) {
    const cfg =
        confirmActivity === 'sitdown'
            ? {
                  label: 'Sitdown',
                  icon: 'people-outline' as const,
                  color: colors.managerColor,
                  count: myCounts.sitdowns,
              }
            : {
                  label: 'Pitch',
                  icon: 'megaphone-outline' as const,
                  color: PITCH_COLOR,
                  count: myCounts.pitches,
              };

    return (
        <Modal
            visible={confirmActivity !== null}
            transparent
            animationType="fade"
            onRequestClose={() => setConfirmActivity(null)}
        >
            <View style={styles.confirmOverlay}>
                <TouchableOpacity
                    style={StyleSheet.absoluteFillObject}
                    activeOpacity={1}
                    onPress={() => setConfirmActivity(null)}
                />
                <View
                    style={[
                        styles.confirmSheet,
                        { backgroundColor: colors.cardBackground, paddingBottom: insets.bottom + 24 },
                    ]}
                >
                    <View style={[styles.confirmHandle, { backgroundColor: colors.border }]} />
                    <View style={[styles.confirmIconBg, { backgroundColor: cfg.color + '18' }]}>
                        <Ionicons name={cfg.icon} size={34} color={cfg.color} />
                    </View>
                    <Text style={[styles.confirmTitle, { color: colors.textPrimary }]}>Log {cfg.label}?</Text>
                    <Text style={[styles.confirmSubtitle, { color: colors.textTertiary }]}>
                        {cfg.count === 0 ? 'First one today' : `${cfg.count} logged so far today`}
                    </Text>
                    <Text style={[styles.confirmTimeLabel, { color: colors.textTertiary }]}>Time</Text>
                    <View style={styles.wheelRow}>
                        <WheelPicker
                            items={PICKER_HOURS}
                            selectedIndex={logHour}
                            onChange={setLogHour}
                            colors={colors}
                            width={52}
                        />
                        <WheelPicker
                            items={PICKER_MINUTES}
                            selectedIndex={logMinuteIdx}
                            onChange={setLogMinuteIdx}
                            colors={colors}
                            width={52}
                        />
                        <WheelPicker
                            items={PICKER_AMPM}
                            selectedIndex={logAmPm}
                            onChange={setLogAmPm}
                            colors={colors}
                            width={60}
                        />
                    </View>
                    <TouchableOpacity
                        style={[styles.confirmBtn, { backgroundColor: cfg.color }]}
                        activeOpacity={0.8}
                        onPress={() => {
                            handleLogActivity(confirmActivity!);
                            setConfirmActivity(null);
                        }}
                    >
                        <Text style={styles.confirmBtnText}>Log {cfg.label}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.confirmCancel} onPress={() => setConfirmActivity(null)}>
                        <Text style={[styles.confirmCancelText, { color: colors.textSecondary }]}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

export const ActivityConfirmSheet = React.memo(ActivityConfirmSheetInner);

const styles = StyleSheet.create({
    confirmOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'flex-end',
        position: 'relative',
    },
    confirmSheet: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 24,
        paddingTop: 12,
        alignItems: 'center',
        gap: 10,
    },
    confirmHandle: { width: 36, height: 4, borderRadius: 2, marginBottom: 4 },
    confirmIconBg: {
        width: 76,
        height: 76,
        borderRadius: 38,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 2,
    },
    confirmTitle: { fontSize: 22, fontWeight: '700', letterSpacing: letterSpacing(-0.3) },
    confirmSubtitle: { fontSize: 14 },
    confirmBtn: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 14,
        paddingVertical: 16,
        minHeight: 52,
        marginTop: 6,
    },
    confirmBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
    confirmCancel: { paddingVertical: 12, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    confirmCancelText: { fontSize: 16 },
    confirmTimeLabel: { fontSize: 13, fontWeight: '500', marginTop: 4, marginBottom: -4 },
    wheelRow: { flexDirection: 'row', gap: 0, alignItems: 'center', justifyContent: 'center' },
});
