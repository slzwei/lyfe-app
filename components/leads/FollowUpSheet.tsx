/**
 * "Set a follow-up" sheet — task + date/time + reminder toggle. Persists as a
 * `follow_up` activity (metadata carries next_follow_up_at / task / remind /
 * reminder_id). Uses the leads Sheet + lyfe-native date/time.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Sheet, SheetHeader } from './ui/Sheet';
import { Txt, Eyebrow } from './ui/Txt';
import { LeadDateTime } from './ui/LeadDateTime';
import type { FollowUp } from '@/lib/leads/meta';
import { useLeadsTheme, useLeadsThemedStyles, radius, spacing, type LeadsTheme } from '@/lib/leads/theme';

function defaultAt(): Date {
    const d = new Date();
    d.setHours(d.getHours() + 3, 0, 0, 0);
    return d;
}

export function FollowUpSheet({
    visible,
    onClose,
    initial,
    busy,
    onSave,
}: {
    visible: boolean;
    onClose: () => void;
    initial: FollowUp | null;
    busy?: boolean;
    onSave: (at: Date, task: string, remind: boolean) => void;
}) {
    const { colors } = useLeadsTheme();
    const styles = useLeadsThemedStyles(makeStyles);
    const { height } = useWindowDimensions();
    const [task, setTask] = useState('');
    const [date, setDate] = useState<Date>(defaultAt());
    const [remind, setRemind] = useState(true);

    useEffect(() => {
        if (visible) {
            setTask(initial?.task ?? '');
            setDate(initial?.at ? new Date(initial.at) : defaultAt());
            setRemind(initial?.remind ?? true);
        }
    }, [visible, initial]);

    return (
        <Sheet visible={visible} onClose={onClose}>
            <SheetHeader
                icon="notifications-outline"
                title={initial ? 'Edit follow-up' : 'Set a follow-up'}
                onClose={onClose}
            />
            <ScrollView style={{ maxHeight: height * 0.62 }} showsVerticalScrollIndicator={false}>
                <Eyebrow style={{ marginBottom: 9 }}>Task</Eyebrow>
                <TextInput
                    value={task}
                    onChangeText={setTask}
                    placeholder="e.g. Call back with the quote"
                    placeholderTextColor={colors.textFaint}
                    style={[
                        styles.input,
                        { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt },
                    ]}
                />

                <Eyebrow style={{ marginVertical: 9 }}>When</Eyebrow>
                <LeadDateTime value={date} onChange={setDate} />

                <View style={styles.remindRow}>
                    <Ionicons name="notifications" size={19} color={colors.success} />
                    <View style={{ flex: 1 }}>
                        <Txt role="body" weight="semibold" size={14.5} color={colors.text}>
                            Remind me
                        </Txt>
                        <Txt role="body" size={13} color={colors.textMuted}>
                            A reminder ~30 min before
                        </Txt>
                    </View>
                    <Switch value={remind} onValueChange={setRemind} />
                </View>
            </ScrollView>

            <Pressable
                onPress={() => onSave(date, task.trim() || 'Follow up', remind)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Save follow-up"
                style={[styles.save, { backgroundColor: colors.accent, opacity: busy ? 0.5 : 1 }]}
            >
                <Txt role="body" weight="bold" size={16} color={colors.textInverse}>
                    {busy ? 'Saving…' : 'Save follow-up'}
                </Txt>
            </Pressable>
        </Sheet>
    );
}

const makeStyles = ({ colors }: LeadsTheme) =>
    StyleSheet.create({
        input: { borderWidth: 1, borderRadius: radius.btn, padding: 13, fontSize: 15 },
        remindRow: {
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
