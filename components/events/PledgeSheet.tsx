import { ERROR_BG, ERROR_TEXT } from '@/constants/ui';
import { KAV_BEHAVIOR } from '@/constants/platform';
import type { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export interface PledgeSheetProps {
    colors: typeof Colors.light;
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
    handleConfirmPledge: () => void;
}

function PledgeSheetInner({
    colors,
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
    handleConfirmPledge,
}: PledgeSheetProps) {
    return (
        <Modal
            visible={showPledgeSheet}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setShowPledgeSheet(false)}
        >
            <SafeAreaView style={[styles.sheetContainer, { backgroundColor: colors.background }]}>
                <KeyboardAvoidingView style={{ flex: 1 }} behavior={KAV_BEHAVIOR}>
                    <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
                        <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>Your Pledge for Today</Text>
                        <TouchableOpacity
                            onPress={() => setShowPledgeSheet(false)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Ionicons name="close" size={24} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                    <ScrollView contentContainerStyle={styles.sheetContent}>
                        <Text style={{ color: colors.textTertiary, fontSize: 13, marginBottom: 16 }}>
                            Pre-filled with suggested targets. Adjust as needed.
                        </Text>
                        {(
                            [
                                ['pledgeSitdowns', 'Sitdowns today', setPledgeSitdowns, pledgeSitdowns],
                                ['pledgePitches', 'Pitches today', setPledgePitches, pledgePitches],
                                ['pledgeClosed', 'Cases to close', setPledgeClosed, pledgeClosed],
                            ] as any[]
                        ).map(([key, label, setter, val]) => (
                            <View key={key} style={styles.pledgeRow}>
                                <Text style={[styles.pledgeLabel, { color: colors.textSecondary }]}>{label}</Text>
                                <View style={styles.pledgeStepperRow}>
                                    <TouchableOpacity
                                        style={[styles.stepBtn, { backgroundColor: colors.surfaceSecondary }]}
                                        onPress={() => setter((v: number) => Math.max(0, v - 1))}
                                        accessibilityLabel={`Decrease ${label}`}
                                    >
                                        <Ionicons name="remove" size={18} color={colors.textPrimary} />
                                    </TouchableOpacity>
                                    <Text style={[styles.stepVal, { color: colors.textPrimary }]}>{val}</Text>
                                    <TouchableOpacity
                                        style={[styles.stepBtn, { backgroundColor: colors.surfaceSecondary }]}
                                        onPress={() => setter((v: number) => v + 1)}
                                        accessibilityLabel={`Increase ${label}`}
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
                                value={pledgeAfyc}
                                onChangeText={(v) => setPledgeAfyc(v.replace(/[^0-9]/g, ''))}
                                keyboardType="number-pad"
                            />
                        </View>
                        {checkinError && (
                            <View style={[styles.errorBanner, { backgroundColor: ERROR_BG }]}>
                                <Text style={{ color: ERROR_TEXT, fontSize: 13 }}>{checkinError}</Text>
                            </View>
                        )}
                        <TouchableOpacity
                            style={[
                                styles.checkinBtn,
                                { backgroundColor: colors.accent, opacity: checkingIn ? 0.6 : 1 },
                            ]}
                            onPress={handleConfirmPledge}
                            disabled={checkingIn}
                        >
                            {checkingIn ? (
                                <ActivityIndicator size="small" color={colors.textInverse} />
                            ) : (
                                <>
                                    <Ionicons name="checkmark" size={20} color={colors.textInverse} />
                                    <Text style={styles.checkinBtnText}>Confirm &amp; Pledge</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    );
}

export const PledgeSheet = React.memo(PledgeSheetInner);

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
