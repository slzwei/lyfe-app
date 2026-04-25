import { NumberStepper } from '@/components/roadshow/atoms/NumberStepper';
import type { Colors } from '@/constants/Colors';
import { RoadshowBounds, RoadshowRadii, getRoadshowColors } from '@/constants/roadshow/tokens';
import { ERROR_BG, ERROR_TEXT } from '@/constants/ui';
import { Fonts } from '@/constants/type';
import { useTheme } from '@/contexts/ThemeContext';
import type { EventAttendee } from '@/types/event';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

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
    const { resolved } = useTheme();
    const stage = getRoadshowColors(resolved);

    return (
        <Modal
            visible={!!overrideTarget}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setOverrideTarget(null)}
        >
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <View style={styles.headerCol}>
                        <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
                            Bypass face + proximity. Your name goes on the log.
                        </Text>
                        <Text style={[styles.title, { color: colors.textPrimary }]}>
                            Override <Text style={[styles.titleItalic, { color: colors.info }]}>check-in</Text>
                        </Text>
                    </View>
                    <Pressable
                        onPress={() => setOverrideTarget(null)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel="Close"
                    >
                        <Ionicons name="close" size={24} color={colors.textSecondary} />
                    </Pressable>
                </View>

                <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                    <View style={[styles.noteBand, { backgroundColor: colors.infoLight, borderColor: colors.info }]}>
                        <Ionicons name="shield-checkmark-outline" size={14} color={colors.info} />
                        <Text style={[styles.noteText, { color: colors.info }]}>
                            Recorded as override by {userFullName ?? 'you'}. Bypasses face + proximity.
                        </Text>
                    </View>

                    <View style={styles.field}>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>ARRIVAL TIME</Text>
                        <TextInput
                            style={[
                                styles.input,
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
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>LATE REASON (OPTIONAL)</Text>
                        <TextInput
                            style={[
                                styles.input,
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

                    <View style={styles.pledgeBlock}>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>PLEDGE ON THEIR BEHALF</Text>
                        <View
                            style={[
                                styles.steppersBand,
                                { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder },
                            ]}
                        >
                            <View style={[styles.stepperCell, { borderColor: colors.hairline }]}>
                                <NumberStepper
                                    value={overridePledgeSitdowns}
                                    onChange={(n) => setOverridePledgeSitdowns(n)}
                                    label="Sitdowns"
                                />
                            </View>
                            <View style={[styles.stepperCell, { borderColor: colors.hairline }]}>
                                <NumberStepper
                                    value={overridePledgePitches}
                                    onChange={(n) => setOverridePledgePitches(n)}
                                    label="Pitches"
                                />
                            </View>
                            <View style={styles.stepperCell}>
                                <NumberStepper
                                    value={overridePledgeClosed}
                                    onChange={(n) => setOverridePledgeClosed(n)}
                                    label="Closes"
                                />
                            </View>
                        </View>
                    </View>

                    <View style={styles.field}>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>AFYC TARGET</Text>
                        <View style={styles.afycInputRow}>
                            <Text style={[styles.afycCurrency, { color: colors.textTertiary }]}>$</Text>
                            <TextInput
                                style={[
                                    styles.afycInput,
                                    {
                                        backgroundColor: colors.inputBackground,
                                        borderColor: colors.inputBorder,
                                        color: colors.textPrimary,
                                    },
                                ]}
                                placeholder="0"
                                placeholderTextColor={colors.textTertiary}
                                value={overridePledgeAfyc}
                                onChangeText={(v) => {
                                    const cleaned = v.replace(/[^0-9]/g, '');
                                    if (cleaned === '' || Number(cleaned) <= RoadshowBounds.afycMax) {
                                        setOverridePledgeAfyc(cleaned);
                                    }
                                }}
                                keyboardType="number-pad"
                                maxLength={7}
                            />
                        </View>
                    </View>

                    {overrideError ? (
                        <View style={[styles.errorBanner, { backgroundColor: ERROR_BG }]}>
                            <Ionicons name="alert-circle" size={14} color={ERROR_TEXT} />
                            <Text style={{ color: ERROR_TEXT, fontSize: 13, flex: 1 }}>{overrideError}</Text>
                        </View>
                    ) : null}

                    <Pressable
                        onPress={handleConfirmOverride}
                        disabled={overrideSubmitting}
                        style={({ pressed }) => [
                            styles.primaryBtn,
                            {
                                backgroundColor: pressed ? colors.accentDark : stage.live,
                                opacity: overrideSubmitting ? 0.6 : 1,
                                borderRadius: RoadshowRadii.card,
                            },
                        ]}
                        accessibilityLabel="Confirm override check-in"
                    >
                        {overrideSubmitting ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <>
                                <Ionicons name="shield-checkmark" size={20} color="#FFFFFF" />
                                <Text style={styles.primaryBtnText}>Confirm override</Text>
                            </>
                        )}
                    </Pressable>
                </KeyboardAwareScrollView>
            </SafeAreaView>
        </Modal>
    );
}

export const ManagerOverrideSheet = React.memo(ManagerOverrideSheetInner);

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    headerCol: { flex: 1, gap: 4 },
    eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
    subtitle: { fontSize: 12, fontFamily: Fonts.sans },
    title: { fontSize: 22, fontFamily: 'Fraunces', fontWeight: '500', letterSpacing: -0.4, lineHeight: 26 },
    titleItalic: { fontFamily: 'Fraunces-Italic', fontWeight: '500' },

    content: { padding: 20, gap: 16 },

    noteBand: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1,
    },
    noteText: { fontSize: 12, fontWeight: '500', flex: 1 },

    field: { gap: 6 },
    fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
    input: {
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
    },

    pledgeBlock: { gap: 8 },
    steppersBand: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: RoadshowRadii.card,
        borderWidth: 1,
        paddingVertical: 14,
    },
    stepperCell: { flex: 1, borderRightWidth: StyleSheet.hairlineWidth },

    afycInputRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    afycCurrency: { fontSize: 22, fontWeight: '600' },
    afycInput: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 18,
        fontWeight: '600',
        fontVariant: ['tabular-nums'],
    },

    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: 8,
        padding: 10,
    },

    primaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 15,
        minHeight: 52,
    },
    primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
