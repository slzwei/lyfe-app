import type { ThemeColors } from '@/types/theme';
import { shadow } from '@/constants/platform';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface NoteInputProps {
    noteText: string;
    onChangeText: (text: string) => void;
    isSaving: boolean;
    colors: ThemeColors;
    onSave: () => void;
    onCancel: () => void;
    testID?: string;
}

function NoteInput({ noteText, onChangeText, isSaving, colors, onSave, onCancel, testID }: NoteInputProps) {
    const canSave = !!noteText.trim() && !isSaving;

    return (
        <View testID={testID} style={[styles.card, { backgroundColor: colors.cardBackground }, shadow('sm')]}>
            {/* Header */}
            <View style={styles.header}>
                <View style={[styles.headerIcon, { backgroundColor: colors.accentLight }]}>
                    <Ionicons name="create-outline" size={14} color={colors.accent} />
                </View>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Add Note</Text>
            </View>

            {/* Input */}
            <TextInput
                testID={testID ? `${testID}-field` : undefined}
                style={[
                    styles.noteInput,
                    {
                        color: colors.textPrimary,
                        borderColor: colors.border,
                        backgroundColor: colors.surfaceSecondary,
                    },
                ]}
                placeholder="Write a note..."
                placeholderTextColor={colors.textTertiary}
                value={noteText}
                onChangeText={onChangeText}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
            />

            {/* Actions */}
            <View style={styles.noteActions}>
                <TouchableOpacity
                    style={[styles.noteCancel, { borderColor: colors.border }]}
                    onPress={onCancel}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel note"
                >
                    <Text style={[styles.noteCancelText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    testID={testID ? `${testID}-save` : undefined}
                    style={[
                        styles.noteSave,
                        {
                            backgroundColor: colors.accent,
                            opacity: canSave ? 1 : 0.45,
                        },
                    ]}
                    onPress={onSave}
                    disabled={!canSave}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={isSaving ? 'Saving note' : 'Save note'}
                >
                    <Ionicons
                        name={isSaving ? 'hourglass-outline' : 'checkmark'}
                        size={15}
                        color={colors.textInverse}
                    />
                    <Text style={[styles.noteSaveText, { color: colors.textInverse }]}>
                        {isSaving ? 'Saving...' : 'Save Note'}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

export default React.memo(NoteInput);

const styles = StyleSheet.create({
    card: {
        borderRadius: 16,
        padding: 16,
    },

    // ── Header ──
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 14,
    },
    headerIcon: {
        width: 28,
        height: 28,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionTitle: { fontSize: 15, fontWeight: '700' },

    // ── Input ──
    noteInput: {
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 12,
        padding: 12,
        fontSize: 14,
        lineHeight: 22,
        minHeight: 96,
    },

    // ── Actions ──
    noteActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
        marginTop: 12,
    },
    noteCancel: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
        justifyContent: 'center',
    },
    noteCancelText: { fontSize: 14, fontWeight: '600' },
    noteSave: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
    },
    noteSaveText: { fontSize: 14, fontWeight: '700' },
});
