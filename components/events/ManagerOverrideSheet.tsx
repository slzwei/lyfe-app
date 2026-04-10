import { ERROR_BG, ERROR_TEXT, ROADSHOW_PINK } from '@/constants/ui';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import type { EventAttendee } from '@/types/event';
import type { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type PledgeField = [string, number, React.Dispatch<React.SetStateAction<number>>];

export interface ManagerOverrideSheetProps {
    colors: typeof Colors.light;
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
    handleConfirmOverride: () => void;
    userFullName: string | undefined;
}

function ManagerOverrideSheetInner({
    colors,
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
    handleConfirmOverride,
    userFullName,
}: ManagerOverrideSheetProps) {
    return (
        <Modal
            visible={!!overrideTarget}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setOverrideTarget(null)}
        >
            <SafeAreaView style={[styles.sheetContainer, { backgroundColor: colors.background }]}>
                <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
                        Check in for {overrideTarget?.full_name}
                    </Text>
                    <TouchableOpacity
                        onPress={() => setOverrideTarget(null)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Ionicons name="close" size={24} color={colors.textSecondary} />
                    </TouchableOpacity>
                </View>
                <KeyboardAwareScrollView
                    contentContainerStyle={styles.sheetContent}
                    keyboardShouldPersistTaps="handled"
                >
                    <Text style={{ color: colors.textTertiary, fontSize: 12, marginBottom: 16 }}>
                        Recorded as override by {userFullName}
                    </Text>
                    <View style={styles.field}>
                        <Text style={[styles.pledgeLabel, { color: colors.textSecondary }]}>Arrival time</Text>
                        <TextInput
                            style={[
                                styles.inputSm,
                                {
                                    backgroundColor: colors.inputBackground,
                                    borderColor: colors.inputBorder,
                                    color: colors.textPrimary,
                                },
                            ]}
                            placeholder="e.g. 10:15 AM"
                            placeholderTextColor={colors.textTertiary}
                            value={overrideTime}
                            onChangeText={setOverrideTime}
                        />
                    </View>
                    <View style={styles.field}>
                        <Text style={[styles.pledgeLabel, { color: colors.textSecondary }]}>
                            Late reason (optional)
                        </Text>
                        <TextInput
                            style={[
                                styles.inputSm,
                                {
                                    backgroundColor: colors.inputBackground,
                                    borderColor: colors.inputBorder,
                                    color: colors.textPrimary,
                                },
                            ]}
                            placeholder="e.g. MRT delay"
                            placeholderTextColor={colors.textTertiary}
                            value={overrideLateReason}
                            onChangeText={setOverrideLateReason}
                        />
                    </View>
                    <Text
                        style={[
                            {
                                color: colors.textSecondary,
                                fontSize: 13,
                                fontWeight: '600',
                                marginBottom: 8,
                            },
                        ]}
                    >
                        Pledge on their behalf
                    </Text>
                    {(
                        [
                            ['Sitdowns', overridePledgeSitdowns, setOverridePledgeSitdowns],
                            ['Pitches', overridePledgePitches, setOverridePledgePitches],
                            ['Cases', overridePledgeClosed, setOverridePledgeClosed],
                        ] as PledgeField[]
                    ).map(([label, val, setter]) => (
                        <View key={label} style={styles.pledgeRow}>
                            <Text style={[styles.pledgeLabel, { color: colors.textSecondary }]}>{label}</Text>
                            <View style={styles.pledgeStepperRow}>
                                <TouchableOpacity
                                    style={[styles.stepBtn, { backgroundColor: colors.surfaceSecondary }]}
                                    onPress={() => setter((v: number) => Math.max(0, v - 1))}
                                >
                                    <Ionicons name="remove" size={18} color={colors.textPrimary} />
                                </TouchableOpacity>
                                <Text style={[styles.stepVal, { color: colors.textPrimary }]}>{val}</Text>
                                <TouchableOpacity
                                    style={[styles.stepBtn, { backgroundColor: colors.surfaceSecondary }]}
                                    onPress={() => setter((v: number) => v + 1)}
                                >
                                    <Ionicons name="add" size={18} color={colors.textPrimary} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                    <View style={styles.field}>
                        <Text style={[styles.pledgeLabel, { color: colors.textSecondary }]}>AFYC target ($)</Text>
                        <TextInput
                            style={[
                                styles.inputSm,
                                {
                                    backgroundColor: colors.inputBackground,
                                    borderColor: colors.inputBorder,
                                    color: colors.textPrimary,
                                },
                            ]}
                            placeholder="e.g. 2000"
                            placeholderTextColor={colors.textTertiary}
                            value={overridePledgeAfyc}
                            onChangeText={(v) => setOverridePledgeAfyc(v.replace(/[^0-9]/g, ''))}
                            keyboardType="number-pad"
                        />
                    </View>
                    {overrideError && (
                        <View style={[styles.errorBanner, { backgroundColor: ERROR_BG }]}>
                            <Text style={{ color: ERROR_TEXT, fontSize: 13 }}>{overrideError}</Text>
                        </View>
                    )}
                    <TouchableOpacity
                        style={[
                            styles.checkinBtn,
                            { backgroundColor: ROADSHOW_PINK, opacity: overrideSubmitting ? 0.6 : 1 },
                        ]}
                        onPress={handleConfirmOverride}
                        disabled={overrideSubmitting}
                    >
                        {overrideSubmitting ? (
                            <ActivityIndicator size="small" color={colors.textInverse} />
                        ) : (
                            <>
                                <Ionicons name="checkmark-circle-outline" size={20} color={colors.textInverse} />
                                <Text style={styles.checkinBtnText}>Confirm Override Check-in</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </KeyboardAwareScrollView>
            </SafeAreaView>
        </Modal>
    );
}

export const ManagerOverrideSheet = React.memo(ManagerOverrideSheetInner);

const styles = StyleSheet.create({
    sheetContainer: { flex: 1 },
    sheetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    sheetTitle: { fontSize: 17, fontWeight: '700' },
    sheetContent: { padding: 16, gap: 12 },
    field: { gap: 4 },
    inputSm: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
    errorBanner: { borderRadius: 8, padding: 10 },
    checkinBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderRadius: 14,
        paddingVertical: 15,
        minHeight: 52,
    },
    checkinBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
    pledgeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    pledgeLabel: { fontSize: 15, fontWeight: '500' },
    pledgeStepperRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    stepBtn: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    stepVal: { fontSize: 18, fontWeight: '700', minWidth: 32, textAlign: 'center' },
});
