import { type ActivityCounts } from '@/components/events/roadshowTokens';
import WheelPicker from '@/components/WheelPicker';
import type { Colors } from '@/constants/Colors';
import { RoadshowRadii, getRoadshowColors } from '@/constants/roadshow/tokens';
import { letterSpacing } from '@/constants/platform';
import { PICKER_AMPM, PICKER_HOURS, PICKER_MINUTES } from '@/constants/ui';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
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
    const { resolved } = useTheme();
    const stage = getRoadshowColors(resolved);

    const cfg =
        confirmActivity === 'sitdown'
            ? {
                  label: 'Sit-down',
                  icon: '◐',
                  color: stage.sitdowns,
                  tint: colors.tintTerra,
                  count: myCounts.sitdowns,
                  line: 'One conversation in the books.',
              }
            : {
                  label: 'Pitch',
                  icon: '◆',
                  color: stage.pitches,
                  tint: colors.tintButter,
                  count: myCounts.pitches,
                  line: 'Plan walked through.',
              };

    return (
        <Modal
            visible={confirmActivity !== null}
            transparent
            animationType="fade"
            onRequestClose={() => setConfirmActivity(null)}
        >
            <View style={styles.overlay}>
                <Pressable
                    style={StyleSheet.absoluteFillObject}
                    onPress={() => setConfirmActivity(null)}
                    accessibilityLabel="Dismiss"
                />
                <View
                    style={[
                        styles.sheet,
                        {
                            backgroundColor: colors.cardBackground,
                            paddingBottom: insets.bottom + 24,
                            borderTopLeftRadius: RoadshowRadii.sheet,
                            borderTopRightRadius: RoadshowRadii.sheet,
                        },
                    ]}
                >
                    <View style={[styles.handle, { backgroundColor: colors.border }]} />

                    <View style={[styles.iconRing, { backgroundColor: cfg.color + '1E', borderColor: cfg.color }]}>
                        <Text style={[styles.iconGlyph, { color: cfg.color }]}>{cfg.icon}</Text>
                    </View>

                    <View style={styles.textCol}>
                        <Text style={[styles.title, { color: colors.textPrimary }]}>
                            {cfg.label} <Text style={[styles.titleItalic, { color: cfg.color }]}>logged</Text>
                        </Text>
                        <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
                            {cfg.line} Your ring just nudged up.
                        </Text>
                    </View>

                    <Text style={[styles.timeLabel, { color: colors.textTertiary }]}>TIME</Text>
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

                    <Pressable
                        onPress={() => {
                            handleLogActivity(confirmActivity!);
                            setConfirmActivity(null);
                        }}
                        style={({ pressed }) => [
                            styles.confirmBtn,
                            {
                                backgroundColor: cfg.color,
                                opacity: pressed ? 0.85 : 1,
                                borderRadius: RoadshowRadii.card,
                            },
                        ]}
                        accessibilityLabel={`Log ${cfg.label}`}
                    >
                        <Text style={styles.confirmBtnText}>Done</Text>
                    </Pressable>

                    <Pressable
                        onPress={() => setConfirmActivity(null)}
                        style={styles.cancelBtn}
                        accessibilityLabel="Cancel"
                    >
                        <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}

export const ActivityConfirmSheet = React.memo(ActivityConfirmSheetInner);

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'flex-end',
        position: 'relative',
    },
    sheet: {
        paddingHorizontal: 24,
        paddingTop: 12,
        alignItems: 'center',
        gap: 10,
    },
    handle: { width: 36, height: 4, borderRadius: 2, marginBottom: 8 },
    iconRing: {
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconGlyph: { fontSize: 36, lineHeight: 36 },
    textCol: { alignItems: 'center', gap: 6, paddingHorizontal: 16 },
    eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
    title: {
        fontSize: 24,
        fontFamily: 'Fraunces',
        fontWeight: '500',
        letterSpacing: letterSpacing(-0.4),
        lineHeight: 28,
    },
    titleItalic: { fontFamily: 'Fraunces-Italic', fontWeight: '500' },
    subtitle: { fontSize: 12.5, fontFamily: 'Inter', lineHeight: 18, textAlign: 'center' },
    timeLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginTop: 6, marginBottom: -4 },
    wheelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    confirmBtn: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 16,
        minHeight: 52,
        marginTop: 6,
    },
    confirmBtnText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Fraunces', fontWeight: '500', letterSpacing: -0.2 },
    cancelBtn: { paddingVertical: 12, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    cancelText: { fontSize: 15 },
});
