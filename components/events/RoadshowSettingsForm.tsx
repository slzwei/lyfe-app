import { NumberStepper } from '@/components/roadshow/atoms/NumberStepper';
import { RoadshowRadii, getRoadshowColors } from '@/constants/roadshow/tokens';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

export interface RoadshowSettingsFormProps {
    rsWeeklyCost: string;
    onWeeklyCostChange: (v: string) => void;
    rsSlots: number;
    onSlotsChange: React.Dispatch<React.SetStateAction<number>>;
    rsGrace: number;
    onGraceChange: React.Dispatch<React.SetStateAction<number>>;
    rsSitdowns: number;
    onSitdownsChange: React.Dispatch<React.SetStateAction<number>>;
    rsPitches: number;
    onPitchesChange: React.Dispatch<React.SetStateAction<number>>;
    rsClosed: number;
    onClosedChange: React.Dispatch<React.SetStateAction<number>>;
    rsConfigLocked: boolean;
    errors: Record<string, string>;
    onClearError: (key: string) => void;
}

export default function RoadshowSettingsForm({
    rsWeeklyCost,
    onWeeklyCostChange,
    rsSlots,
    onSlotsChange,
    rsGrace,
    onGraceChange,
    rsSitdowns,
    onSitdownsChange,
    rsPitches,
    onPitchesChange,
    rsClosed,
    onClosedChange,
    rsConfigLocked,
    errors,
    onClearError,
}: RoadshowSettingsFormProps) {
    const { colors, resolved } = useTheme();
    const stage = getRoadshowColors(resolved);

    const weeklyNum = Number(rsWeeklyCost);
    const hasWeekly = rsWeeklyCost && !isNaN(weeklyNum) && weeklyNum > 0;

    return (
        <View
            style={styles.container}
            // Preserve the legacy "Roadshow Settings" name for a11y /
            // semantic consumers even though the visible header moved up
            // to the parent screen's "ROADSHOW CONFIG" eyebrow.
            accessibilityLabel="Roadshow Settings"
        >
            {rsConfigLocked ? (
                <View style={styles.lockedRow}>
                    <View style={[styles.lockChip, { backgroundColor: colors.tintButter, borderColor: stage.setup }]}>
                        <Ionicons name="lock-closed" size={12} color={stage.setup} />
                        <Text style={[styles.lockChipText, { color: stage.setup }]}>LOCKED</Text>
                    </View>
                    <Text style={[styles.lockNoteText, { color: colors.textTertiary }]}>
                        Config locked — agents have already checked in.
                    </Text>
                </View>
            ) : null}

            <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>WEEKLY COST (SGD) *</Text>
                <View style={styles.currencyRow}>
                    <Text style={[styles.currency, { color: colors.textTertiary }]}>$</Text>
                    <TextInput
                        style={[
                            styles.input,
                            {
                                backgroundColor: colors.inputBackground,
                                borderColor: errors.rsWeeklyCost ? colors.danger : colors.inputBorder,
                                color: colors.textPrimary,
                                opacity: rsConfigLocked ? 0.5 : 1,
                            },
                        ]}
                        placeholder="e.g. 1800"
                        placeholderTextColor={colors.textTertiary}
                        value={rsWeeklyCost}
                        onChangeText={(v) => {
                            onWeeklyCostChange(v.replace(/[^0-9.]/g, ''));
                            onClearError('rsWeeklyCost');
                        }}
                        keyboardType="decimal-pad"
                        editable={!rsConfigLocked}
                    />
                </View>
                {errors.rsWeeklyCost ? (
                    <Text style={[styles.errorText, { color: colors.danger }]}>{errors.rsWeeklyCost}</Text>
                ) : null}
            </View>

            <View
                style={[
                    styles.stepperBand,
                    {
                        backgroundColor: colors.surfacePrimary,
                        borderColor: colors.hairline,
                        opacity: rsConfigLocked ? 0.5 : 1,
                    },
                ]}
            >
                <View style={[styles.stepperCell, { borderColor: colors.hairline }]}>
                    <NumberStepper
                        value={rsSlots}
                        onChange={(n) => onSlotsChange(() => n)}
                        label="Slots / day"
                        accessibilityLabel="agents per slot"
                        min={1}
                        max={20}
                        disabled={rsConfigLocked}
                    />
                </View>
                <View style={styles.stepperCell}>
                    <NumberStepper
                        value={rsGrace}
                        onChange={(n) => onGraceChange(() => n)}
                        label="Grace (min)"
                        accessibilityLabel="grace period"
                        min={0}
                        max={60}
                        step={5}
                        disabled={rsConfigLocked}
                    />
                </View>
            </View>

            <View style={styles.targetsBlock}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>SUGGESTED DAILY TARGETS</Text>
                <View
                    style={[
                        styles.stepperBand,
                        {
                            backgroundColor: colors.surfacePrimary,
                            borderColor: colors.hairline,
                            opacity: rsConfigLocked ? 0.5 : 1,
                        },
                    ]}
                >
                    <View style={[styles.stepperCell, { borderColor: colors.hairline }]}>
                        <NumberStepper
                            value={rsSitdowns}
                            onChange={(n) => onSitdownsChange(() => n)}
                            label="Sitdowns"
                            accessibilityLabel="Sitdowns target"
                            disabled={rsConfigLocked}
                        />
                    </View>
                    <View style={[styles.stepperCell, { borderColor: colors.hairline }]}>
                        <NumberStepper
                            value={rsPitches}
                            onChange={(n) => onPitchesChange(() => n)}
                            label="Pitches"
                            accessibilityLabel="Pitches target"
                            disabled={rsConfigLocked}
                        />
                    </View>
                    <View style={styles.stepperCell}>
                        <NumberStepper
                            value={rsClosed}
                            onChange={(n) => onClosedChange(() => n)}
                            label="Closed"
                            accessibilityLabel="Cases Closed target"
                            disabled={rsConfigLocked}
                        />
                    </View>
                </View>
            </View>

            {hasWeekly ? (
                <View style={[styles.preview, { backgroundColor: colors.tintTerra, borderColor: colors.hairline }]}>
                    <Text style={[styles.previewTitle, { color: colors.textSecondary }]}>Cost Preview</Text>
                    <View style={styles.previewRow}>
                        <Text style={[styles.previewLabel, { color: colors.textTertiary }]}>Daily cost</Text>
                        <Text style={[styles.previewValue, { color: colors.textPrimary }]}>
                            ${(weeklyNum / 7).toFixed(2)}
                        </Text>
                    </View>
                    <View style={styles.previewRow}>
                        <Text style={[styles.previewLabel, { color: colors.textTertiary }]}>Per agent / slot</Text>
                        <Text style={[styles.previewValue, { color: stage.live, fontWeight: '700' }]}>
                            ${(weeklyNum / 7 / Math.max(1, rsSlots)).toFixed(2)}
                        </Text>
                    </View>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    // Flat container — no border/padding/margin. The parent screen's
    // highlightFrame provides the card chrome so we don't double-nest.
    container: { gap: 14 },

    lockedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
    },
    lockChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        borderWidth: 1,
    },
    lockChipText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
    lockNoteText: { fontSize: 12, flex: 1 },

    field: { gap: 6 },
    fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
    currencyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    currency: { fontSize: 22, fontWeight: '600' },
    input: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 17,
        fontWeight: '600',
        fontVariant: ['tabular-nums'],
    },
    errorText: { fontSize: 12 },

    stepperBand: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: RoadshowRadii.card,
        borderWidth: 1,
        paddingVertical: 14,
    },
    stepperCell: { flex: 1, borderRightWidth: StyleSheet.hairlineWidth },

    targetsBlock: { gap: 8 },

    preview: {
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        gap: 6,
    },
    previewTitle: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.8 },
    previewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    previewLabel: { fontSize: 13 },
    previewValue: { fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
