import type { Colors } from '@/constants/Colors';
import { RoadshowBounds, RoadshowRadii, getRoadshowColors } from '@/constants/roadshow/tokens';
import { TropicFonts } from '@/constants/roadshow/typography';
import { ERROR_BG, ERROR_TEXT } from '@/constants/ui';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

/** Prototype RSStepper — label+hint on left, circular − / colored number / filled + on right. */
function InlineStepper({
    label,
    hint,
    value,
    setter,
    color,
    min = RoadshowBounds.minPledge,
    max = RoadshowBounds.maxPledge,
    borderColor,
    stepperBg,
    inkColor,
    paperInverse,
}: {
    label: string;
    hint: string;
    value: number;
    setter: React.Dispatch<React.SetStateAction<number>>;
    color: string;
    min?: number;
    max?: number;
    borderColor: string;
    stepperBg: string;
    inkColor: string;
    paperInverse: string;
}) {
    const clamp = (n: number) => Math.max(min, Math.min(max, n));
    return (
        <View style={pledgeStyles.stepperRow}>
            <View style={{ flex: 1 }}>
                <Text style={[pledgeStyles.stepperLabel, { color: inkColor }]}>{label}</Text>
                <Text style={[pledgeStyles.stepperHint, { color: inkColor, opacity: 0.55 }]}>{hint}</Text>
            </View>
            <View style={pledgeStyles.stepperControls}>
                <Pressable
                    onPress={() => setter((v) => clamp(v - 1))}
                    hitSlop={6}
                    style={({ pressed }) => [
                        pledgeStyles.stepperBtn,
                        {
                            borderColor,
                            backgroundColor: stepperBg,
                            opacity: pressed ? 0.6 : 1,
                        },
                    ]}
                    accessibilityLabel={`Decrease ${label}`}
                >
                    <Text style={[pledgeStyles.stepperBtnText, { color: inkColor }]}>−</Text>
                </Pressable>
                <Text style={[pledgeStyles.stepperValue, { color }]}>{value}</Text>
                <Pressable
                    onPress={() => setter((v) => clamp(v + 1))}
                    hitSlop={6}
                    style={({ pressed }) => [
                        pledgeStyles.stepperBtnPlus,
                        { backgroundColor: color, opacity: pressed ? 0.85 : 1 },
                    ]}
                    accessibilityLabel={`Increase ${label}`}
                >
                    <Text style={[pledgeStyles.stepperBtnText, { color: paperInverse }]}>+</Text>
                </Pressable>
            </View>
        </View>
    );
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
    const { resolved } = useTheme();
    const stage = getRoadshowColors(resolved);
    const insets = useSafeAreaInsets();
    const afycNum = Number(pledgeAfyc) || 0;

    return (
        <Modal
            visible={showPledgeSheet}
            transparent
            animationType="fade"
            onRequestClose={() => setShowPledgeSheet(false)}
            statusBarTranslucent
        >
            <View style={pledgeStyles.overlay}>
                <Pressable
                    style={StyleSheet.absoluteFillObject}
                    onPress={() => setShowPledgeSheet(false)}
                    accessibilityLabel="Dismiss"
                />
                <View
                    style={[
                        pledgeStyles.sheet,
                        {
                            backgroundColor: colors.cardBackground,
                            paddingBottom: insets.bottom + 24,
                            borderTopLeftRadius: RoadshowRadii.sheet,
                            borderTopRightRadius: RoadshowRadii.sheet,
                        },
                    ]}
                >
                    <View style={[pledgeStyles.handle, { backgroundColor: colors.border }]} />

                    <Text style={[pledgeStyles.title, { color: colors.textPrimary }]}>
                        Your <Text style={[pledgeStyles.titleItalic, { color: stage.live }]}>pledge</Text> for tonight
                    </Text>
                    <Text style={[pledgeStyles.subtitle, { color: colors.textTertiary }]}>
                        Set before you walk onto the booth. You can't change it mid-event.
                    </Text>

                    <View
                        style={[
                            pledgeStyles.steppersCard,
                            { backgroundColor: colors.background, borderColor: colors.hairline },
                        ]}
                    >
                        <InlineStepper
                            label="Sit-downs"
                            hint="conversations you'll have"
                            value={pledgeSitdowns}
                            setter={setPledgeSitdowns}
                            color={stage.sitdowns}
                            borderColor={colors.border}
                            stepperBg={colors.surfaceElevated}
                            inkColor={colors.textPrimary}
                            paperInverse="#FFFFFF"
                        />
                        <View style={[pledgeStyles.separator, { backgroundColor: colors.hairline }]} />
                        <InlineStepper
                            label="Pitches"
                            hint="plans you'll walk through"
                            value={pledgePitches}
                            setter={setPledgePitches}
                            color={stage.pitches}
                            borderColor={colors.border}
                            stepperBg={colors.surfaceElevated}
                            inkColor={colors.textPrimary}
                            paperInverse="#FFFFFF"
                        />
                        <View style={[pledgeStyles.separator, { backgroundColor: colors.hairline }]} />
                        <InlineStepper
                            label="Cases"
                            hint="closes you'll make"
                            value={pledgeClosed}
                            setter={setPledgeClosed}
                            color={stage.closes}
                            borderColor={colors.border}
                            stepperBg={colors.surfaceElevated}
                            inkColor={colors.textPrimary}
                            paperInverse="#FFFFFF"
                        />
                    </View>

                    <View
                        style={[
                            pledgeStyles.afycCard,
                            { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                        ]}
                    >
                        <View style={{ flex: 1 }}>
                            <Text style={[pledgeStyles.afycLabel, { color: colors.textPrimary }]}>AFYC target</Text>
                            <Text style={[pledgeStyles.afycHint, { color: colors.textTertiary }]}>
                                stretch · set your own
                            </Text>
                        </View>
                        <View style={pledgeStyles.afycInputRow}>
                            <Text style={[pledgeStyles.afycCurrency, { color: stage.closes }]}>$</Text>
                            <TextInput
                                value={pledgeAfyc}
                                onChangeText={(v) => {
                                    const cleaned = v.replace(/[^0-9]/g, '');
                                    if (cleaned === '' || Number(cleaned) <= RoadshowBounds.afycMax) {
                                        setPledgeAfyc(cleaned);
                                    }
                                }}
                                keyboardType="number-pad"
                                inputMode="numeric"
                                placeholder="0"
                                placeholderTextColor={colors.textTertiary}
                                style={[pledgeStyles.afycValue, { color: stage.closes }]}
                                selectionColor={stage.closes}
                                maxLength={7}
                            />
                            {afycNum > 0 ? null : null}
                        </View>
                    </View>

                    {checkinError ? (
                        <View style={[pledgeStyles.errorBanner, { backgroundColor: ERROR_BG }]}>
                            <Ionicons name="alert-circle" size={14} color={ERROR_TEXT} />
                            <Text style={{ color: ERROR_TEXT, fontSize: 13, flex: 1 }}>{checkinError}</Text>
                        </View>
                    ) : null}

                    <Pressable
                        testID="pledge-sheet-confirm"
                        onPress={handleConfirmPledge}
                        disabled={checkingIn}
                        style={({ pressed }) => [
                            pledgeStyles.cta,
                            {
                                backgroundColor: pressed ? colors.accentDark : colors.accent,
                                opacity: checkingIn ? 0.6 : 1,
                                borderRadius: RoadshowRadii.card,
                            },
                        ]}
                        accessibilityLabel="Confirm pledge and continue to face check"
                    >
                        {checkingIn ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <>
                                <Text style={pledgeStyles.ctaText}>Continue to face check</Text>
                                <Text style={pledgeStyles.ctaArrow}>→</Text>
                            </>
                        )}
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}

export const PledgeSheet = React.memo(PledgeSheetInner);

const pledgeStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'flex-end',
    },
    sheet: {
        paddingHorizontal: 20,
        paddingTop: 14,
        gap: 14,
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 40,
        shadowOffset: { width: 0, height: -10 },
        elevation: 24,
    },
    handle: { width: 40, height: 4, borderRadius: 3, alignSelf: 'center' },

    title: {
        fontSize: 22,
        fontFamily: TropicFonts.serif,
        fontWeight: '500',
        letterSpacing: -0.4,
        lineHeight: 26,
    },
    titleItalic: { fontFamily: TropicFonts.serifItalic, fontWeight: '500' },
    subtitle: { fontSize: 12.5, fontFamily: TropicFonts.ui, lineHeight: 18 },

    steppersCard: {
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 4,
    },
    stepperRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 12,
    },
    stepperLabel: {
        fontSize: 15,
        fontFamily: TropicFonts.serif,
        fontWeight: '500',
    },
    stepperHint: {
        fontSize: 11,
        fontFamily: TropicFonts.ui,
        marginTop: 2,
    },
    stepperControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    stepperBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepperBtnPlus: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepperBtnText: { fontSize: 18, lineHeight: 18, fontFamily: TropicFonts.uiMedium },
    stepperValue: {
        fontSize: 22,
        fontFamily: TropicFonts.serif,
        fontWeight: '500',
        minWidth: 28,
        textAlign: 'center',
        fontVariant: ['tabular-nums'],
    },
    separator: {
        height: StyleSheet.hairlineWidth,
    },

    afycCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 12,
        borderWidth: 1,
        padding: 14,
    },
    afycLabel: { fontSize: 14.5, fontFamily: TropicFonts.serif, fontWeight: '500' },
    afycHint: { fontSize: 11, fontFamily: TropicFonts.ui, marginTop: 2 },
    afycInputRow: { flexDirection: 'row', alignItems: 'baseline' },
    afycCurrency: {
        fontSize: 20,
        fontFamily: TropicFonts.serif,
        fontWeight: '500',
    },
    afycValue: {
        fontSize: 20,
        fontFamily: TropicFonts.serif,
        fontWeight: '500',
        minWidth: 60,
        textAlign: 'right',
        padding: 0,
        margin: 0,
        fontVariant: ['tabular-nums'],
    },

    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: 8,
        padding: 10,
    },

    cta: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        minHeight: 52,
    },
    ctaText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: TropicFonts.serif,
        fontWeight: '500',
        letterSpacing: -0.2,
    },
    ctaArrow: {
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: TropicFonts.serifItalic,
        opacity: 0.85,
    },
});
