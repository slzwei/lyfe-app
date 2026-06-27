/**
 * "Log activity" sheet (mktr-leads UI/UX · Option B) — type · outcome · note ·
 * next-step · optional follow-up. The reskin's ActivityFeed already renders the
 * resulting outcome + next-step. Follow-up date/time uses lyfe-native pickers.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Sheet, SheetHeader } from './ui/Sheet';
import { Txt, Eyebrow } from './ui/Txt';
import { LeadDateTime } from './ui/LeadDateTime';
import { useLeadsTheme, useLeadsThemedStyles, alpha, radius, spacing, type LeadsTheme } from '@/lib/leads/theme';
import type { IconName } from '@/types/ui';

export type LogType = 'call' | 'whatsapp' | 'meeting' | 'email' | 'note';

export interface LogResult {
    type: LogType;
    outcome: string | null;
    note: string;
    nextStep: string | null;
    followUp?: { at: Date; task: string; remind: boolean };
}

const TYPES: { key: LogType; label: string; icon: IconName }[] = [
    { key: 'call', label: 'Call', icon: 'call' },
    { key: 'whatsapp', label: 'WhatsApp', icon: 'logo-whatsapp' },
    { key: 'meeting', label: 'Meeting', icon: 'people' },
    { key: 'email', label: 'Email', icon: 'mail-outline' },
    { key: 'note', label: 'Note', icon: 'create-outline' },
];
const OUTCOMES = ['Interested', 'No answer', 'Callback', 'Not now'];

function defaultFollowUp(): Date {
    const d = new Date();
    d.setHours(d.getHours() + 3, 0, 0, 0);
    return d;
}

export function LogActivitySheet({
    visible,
    onClose,
    leadName,
    defaultType = 'note',
    busy,
    onSave,
}: {
    visible: boolean;
    onClose: () => void;
    leadName: string;
    defaultType?: LogType;
    busy?: boolean;
    onSave: (r: LogResult) => void;
}) {
    const { colors } = useLeadsTheme();
    const styles = useLeadsThemedStyles(makeStyles);
    const { height } = useWindowDimensions();
    const [type, setType] = useState<LogType>(defaultType);
    const [outcome, setOutcome] = useState<string | null>(null);
    const [note, setNote] = useState('');
    const [nextStep, setNextStep] = useState('');
    const [fuOn, setFuOn] = useState(false);
    const [fuDate, setFuDate] = useState<Date>(defaultFollowUp());

    useEffect(() => {
        if (visible) {
            setType(defaultType);
            setOutcome(null);
            setNote('');
            setNextStep('');
            setFuOn(false);
            setFuDate(defaultFollowUp());
        }
    }, [visible, defaultType]);

    const canSave = !!note.trim() || !!outcome;

    return (
        <Sheet visible={visible} onClose={onClose}>
            <SheetHeader icon="create-outline" title={`Log · ${leadName}`} onClose={onClose} />
            <ScrollView style={{ maxHeight: height * 0.6 }} showsVerticalScrollIndicator={false}>
                <Eyebrow style={{ marginBottom: 9 }}>Type</Eyebrow>
                <View style={styles.row}>
                    {TYPES.map((t) => {
                        const on = t.key === type;
                        return (
                            <Pressable
                                key={t.key}
                                onPress={() => setType(t.key)}
                                accessibilityRole="button"
                                accessibilityState={{ selected: on }}
                                accessibilityLabel={t.label}
                                style={[
                                    styles.typeChip,
                                    {
                                        backgroundColor: on ? colors.accent : colors.surfaceAlt,
                                        borderColor: on ? colors.accent : colors.border,
                                    },
                                ]}
                            >
                                <Ionicons name={t.icon} size={18} color={on ? colors.textInverse : colors.textMuted} />
                                <Txt
                                    role="body"
                                    weight="semibold"
                                    size={13}
                                    color={on ? colors.textInverse : colors.textMuted}
                                >
                                    {t.label}
                                </Txt>
                            </Pressable>
                        );
                    })}
                </View>

                <Eyebrow style={{ marginBottom: 9 }}>Outcome</Eyebrow>
                <View style={styles.row}>
                    {OUTCOMES.map((o) => {
                        const on = o === outcome;
                        return (
                            <Pressable
                                key={o}
                                onPress={() => setOutcome(on ? null : o)}
                                accessibilityRole="button"
                                accessibilityState={{ selected: on }}
                                style={[
                                    styles.outcomeChip,
                                    {
                                        backgroundColor: on ? alpha(colors.accent, 0.16) : 'transparent',
                                        borderColor: on ? colors.accent : colors.border,
                                    },
                                ]}
                            >
                                <Txt
                                    role="body"
                                    weight="semibold"
                                    size={13.5}
                                    color={on ? colors.accent : colors.textMuted}
                                >
                                    {o}
                                </Txt>
                            </Pressable>
                        );
                    })}
                </View>

                <Eyebrow style={{ marginBottom: 9 }}>Note</Eyebrow>
                <TextInput
                    value={note}
                    onChangeText={setNote}
                    placeholder="What happened on this touchpoint?"
                    placeholderTextColor={colors.textFaint}
                    multiline
                    style={[
                        styles.input,
                        styles.noteInput,
                        { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt },
                    ]}
                />

                <Eyebrow style={{ marginVertical: 9 }}>Next step (optional)</Eyebrow>
                <TextInput
                    value={nextStep}
                    onChangeText={setNextStep}
                    placeholder="e.g. Send the final quote"
                    placeholderTextColor={colors.textFaint}
                    style={[
                        styles.input,
                        { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt },
                    ]}
                />

                <View style={styles.fuRow}>
                    <Ionicons name="calendar-outline" size={19} color={colors.accent} />
                    <View style={{ flex: 1 }}>
                        <Txt role="body" weight="semibold" size={14.5} color={colors.text}>
                            Set a follow-up
                        </Txt>
                        <Txt role="body" size={13} color={colors.textMuted}>
                            Schedule the next touch + a reminder
                        </Txt>
                    </View>
                    <Switch value={fuOn} onValueChange={setFuOn} />
                </View>

                {fuOn ? (
                    <View style={{ marginTop: spacing.md }}>
                        <LeadDateTime value={fuDate} onChange={setFuDate} />
                    </View>
                ) : null}
            </ScrollView>

            <Pressable
                onPress={() =>
                    onSave({
                        type,
                        outcome,
                        note: note.trim(),
                        nextStep: nextStep.trim() || null,
                        followUp: fuOn ? { at: fuDate, task: nextStep.trim() || 'Follow up', remind: true } : undefined,
                    })
                }
                disabled={!canSave || busy}
                accessibilityRole="button"
                accessibilityLabel="Save activity"
                style={[styles.save, { backgroundColor: colors.accent, opacity: !canSave || busy ? 0.5 : 1 }]}
            >
                <Txt role="body" weight="bold" size={16} color={colors.textInverse}>
                    {busy ? 'Saving…' : 'Save activity'}
                </Txt>
            </Pressable>
        </Sheet>
    );
}

const makeStyles = ({ colors }: LeadsTheme) =>
    StyleSheet.create({
        row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.lg },
        typeChip: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingVertical: 10,
            paddingHorizontal: 13,
            minHeight: 44,
            borderRadius: radius.chip + 2,
            borderWidth: 1,
        },
        outcomeChip: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 9,
            paddingHorizontal: 14,
            minHeight: 44,
            borderRadius: 99,
            borderWidth: 1.5,
        },
        input: { borderWidth: 1, borderRadius: radius.btn, padding: 13, fontSize: 15 },
        noteInput: { minHeight: 76, textAlignVertical: 'top' },
        fuRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 11,
            marginTop: spacing.lg,
            paddingVertical: 13,
            paddingHorizontal: 14,
            borderRadius: radius.btn,
            backgroundColor: colors.surfaceAlt,
        },
        save: {
            height: 52,
            borderRadius: radius.btn,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: spacing.lg,
        },
    });
