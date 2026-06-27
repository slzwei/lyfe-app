/**
 * "Key facts" sheet — editable label/value rows (looking-for, budget, good-to-know).
 * Persists as a `key_facts` activity whose metadata carries the facts array.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Sheet, SheetHeader } from './ui/Sheet';
import { Txt } from './ui/Txt';
import type { KeyFact } from '@/lib/leads/meta';
import { useLeadsTheme, useLeadsThemedStyles, radius, spacing, type LeadsTheme } from '@/lib/leads/theme';

export function KeyFactsSheet({
    visible,
    onClose,
    initial,
    busy,
    onSave,
}: {
    visible: boolean;
    onClose: () => void;
    initial: KeyFact[];
    busy?: boolean;
    onSave: (facts: KeyFact[]) => void;
}) {
    const { colors } = useLeadsTheme();
    const styles = useLeadsThemedStyles(makeStyles);
    const { height } = useWindowDimensions();
    const [facts, setFacts] = useState<KeyFact[]>([]);

    useEffect(() => {
        if (visible) setFacts(initial.length ? initial.map((f) => ({ ...f })) : [{ label: '', value: '' }]);
    }, [visible, initial]);

    const update = (i: number, patch: Partial<KeyFact>) =>
        setFacts((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
    const remove = (i: number) => setFacts((prev) => prev.filter((_, idx) => idx !== i));

    return (
        <Sheet visible={visible} onClose={onClose}>
            <SheetHeader icon="bookmark-outline" title="Key facts" onClose={onClose} />
            <ScrollView style={{ maxHeight: height * 0.55 }} showsVerticalScrollIndicator={false}>
                {facts.map((f, i) => (
                    <View key={i} style={styles.factRow}>
                        <TextInput
                            value={f.label}
                            onChangeText={(t) => update(i, { label: t })}
                            placeholder="Label"
                            placeholderTextColor={colors.textFaint}
                            style={[
                                styles.input,
                                styles.label,
                                { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt },
                            ]}
                        />
                        <TextInput
                            value={f.value}
                            onChangeText={(t) => update(i, { value: t })}
                            placeholder="Value"
                            placeholderTextColor={colors.textFaint}
                            style={[
                                styles.input,
                                {
                                    flex: 1,
                                    color: colors.text,
                                    borderColor: colors.border,
                                    backgroundColor: colors.surfaceAlt,
                                },
                            ]}
                        />
                        <Pressable
                            onPress={() => remove(i)}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel="Remove fact"
                        >
                            <Ionicons name="close-circle" size={22} color={colors.textFaint} />
                        </Pressable>
                    </View>
                ))}
                <Pressable
                    onPress={() => setFacts((prev) => [...prev, { label: '', value: '' }])}
                    style={styles.addRow}
                    accessibilityRole="button"
                    accessibilityLabel="Add a fact"
                >
                    <Ionicons name="add" size={18} color={colors.accent} />
                    <Txt role="body" weight="semibold" size={14.5} color={colors.accent}>
                        Add a fact
                    </Txt>
                </Pressable>
            </ScrollView>

            <Pressable
                onPress={() =>
                    onSave(
                        facts
                            .filter((f) => f.label.trim() && f.value.trim())
                            .map((f) => ({ label: f.label.trim(), value: f.value.trim() })),
                    )
                }
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Save key facts"
                style={[styles.save, { backgroundColor: colors.accent, opacity: busy ? 0.5 : 1 }]}
            >
                <Txt role="body" weight="bold" size={16} color={colors.textInverse}>
                    {busy ? 'Saving…' : 'Save key facts'}
                </Txt>
            </Pressable>
        </Sheet>
    );
}

const makeStyles = ({ colors }: LeadsTheme) =>
    StyleSheet.create({
        factRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm },
        input: {
            borderWidth: 1,
            borderRadius: radius.btn,
            paddingHorizontal: 12,
            paddingVertical: 11,
            fontSize: 15,
            minHeight: 44,
        },
        label: { width: 110 },
        addRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 12,
            paddingHorizontal: 4,
            alignSelf: 'flex-start',
        },
        save: {
            height: 52,
            borderRadius: radius.btn,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: spacing.lg,
        },
    });
