import type { ThemeColors } from '@/types/theme';
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
    return (
        <View
            testID={testID}
            style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}
        >
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Add Note</Text>
            <TextInput
                testID={testID ? `${testID}-field` : undefined}
                style={[
                    styles.noteInput,
                    {
                        color: colors.textPrimary,
                        borderColor: colors.borderLight,
                        backgroundColor: colors.surfacePrimary,
                    },
                ]}
                placeholder="Write a note..."
                placeholderTextColor={colors.textTertiary}
                value={noteText}
                onChangeText={onChangeText}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
            />
            <View style={styles.noteActions}>
                <TouchableOpacity style={[styles.noteCancel, { borderColor: colors.borderLight }]} onPress={onCancel}>
                    <Text style={[styles.noteCancelText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    testID={testID ? `${testID}-save` : undefined}
                    style={[
                        styles.noteSave,
                        {
                            backgroundColor: colors.accent,
                            opacity: noteText.trim() && !isSaving ? 1 : 0.5,
                        },
                    ]}
                    onPress={onSave}
                    disabled={!noteText.trim() || isSaving}
                >
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
        borderRadius: 14,
        borderWidth: 0.5,
        padding: 16,
        marginBottom: 12,
    },
    sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
    noteInput: {
        borderWidth: 0.5,
        borderRadius: 10,
        padding: 12,
        fontSize: 14,
        minHeight: 80,
    },
    noteActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
        marginTop: 10,
    },
    noteCancel: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 0.5,
    },
    noteCancelText: { fontSize: 13, fontWeight: '600' },
    noteSave: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
    },
    noteSaveText: { fontSize: 13, fontWeight: '700' },
});
